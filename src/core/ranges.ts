// src/core/ranges.ts
// ------------------------------------------------------
// RangeSet の読み書き・検索まわり
// - localStorage: pftrainer_ranges_v2
// - RangeSet が1つも無い場合は、空のデフォルトを作る（既存挙動）
// - ★ 追加: ranges_6max.json から GTO入り RangeSet を生成するヘルパー
// ------------------------------------------------------

import type {
  RangeSet,
  RangeScenario,
  Position,
  HandCode,
  HandDecision,
} from "./types";

const STORAGE_KEY = "pftrainer_ranges_v2";

// Vite の BASE_URL を取るための簡易型
interface ImportMetaEnvLike {
  env?: {
    BASE_URL?: string;
  };
}

const BASE_URL =
  ((import.meta as unknown as ImportMetaEnvLike).env?.BASE_URL) ?? "/";

// JSON ファイルのURL（/poker-gto/data/ranges_6max.json みたいな形も吸収）
const RANGE_DATA_URL = `${BASE_URL}data/ranges_6max.json`;

/**
 * pftrainer_ranges_v2 から RangeSet[] をロード
 * - データが無い or 壊れている場合は「空配列」を返すだけ（デフォルト生成は別関数でやる）
 */
export function loadRangeSets(): RangeSet[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    // v2 以降は RangeSet[] をそのまま保存している想定
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as RangeSet[];
    }

    // 互換用: { rangeSets: [...] } 形式だった場合
    if (
      parsed &&
      Array.isArray((parsed as any).rangeSets) &&
      (parsed as any).rangeSets.length > 0
    ) {
      return (parsed as any).rangeSets as RangeSet[];
    }

    return [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to load range sets", e);
    return [];
  }
}

/**
 * RangeSet[] を pftrainer_ranges_v2 に保存
 */
export function saveRangeSets(rangeSets: RangeSet[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rangeSets));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to save range sets", e);
  }
}

/**
 * ID から RangeSet を探す
 */
export function findRangeSetById(
  rangeSets: RangeSet[],
  rangeSetId: string | null | undefined,
): RangeSet | null {
  if (!rangeSetId) return null;
  return rangeSets.find((rs) => rs.meta?.id === rangeSetId) ?? null;
}

/**
 * RangeSet or RangeSet[] 内からシナリオを探す
 */
export function findScenarioById(
  rangeSetOrSets: RangeSet | RangeSet[] | null | undefined,
  scenarioId: string | null | undefined,
): RangeScenario | null {
  if (!scenarioId) return null;
  if (!rangeSetOrSets) return null;

  const rangeSets = Array.isArray(rangeSetOrSets)
    ? rangeSetOrSets
    : [rangeSetOrSets];

  for (const rs of rangeSets) {
    const found = rs.scenarios.find((s) => s.id === scenarioId);
    if (found) return found;
  }
  return null;
}

// ------------------------------------------------------
// ranges_6max.json → GTO入り RangeSet 生成
// ------------------------------------------------------

// JSON構造用のローカル型（他と衝突しないよう Gto〜 プレフィックスを付ける）
interface GtoJsonPositionData {
  ev?: number;
  open?: {
    raise?: number;
    call?: number;
    fold?: number;
  };
  vs3bet?: {
    call?: number;
    fourBet?: number;
    fold?: number;
  };
}

interface GtoJsonHandEntry {
  hand: string; // "AA", "AKs", "AKo" など
  positions?: Record<string, GtoJsonPositionData>;
}

interface GtoJsonRangeRoot {
  hands?: GtoJsonHandEntry[];
}

/**
 * ranges_6max.json から「GTO 6max Default」RangeSet を構築する。
 *
 * - 各ポジションごとに 1 シナリオ:
 *   - "UTG Open"
 *   - "HJ Open"
 *   - "CO Open"
 *   - "BTN Open"
 *   - "SB Open"
 *   - "BB Open"
 */
export async function createInitialRangeSetFromJson(): Promise<RangeSet> {
  const res = await fetch(RANGE_DATA_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to load range data JSON: ${res.status} ${res.statusText}`,
    );
  }

  const json = (await res.json()) as GtoJsonRangeRoot;
  const hands = Array.isArray(json.hands) ? json.hands : [];

  // 6max 用ポジション
  const positions: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

  const scenarios: RangeScenario[] = [];

for (const pos of positions) {
  // ========= OPEN シナリオ =========
  {
    const scenarioHands: Record<HandCode, HandDecision> = {};
    const enabledHandCodes: HandCode[] = [];
    const handEvs: Record<HandCode, number> = {};

    for (const entry of hands) {
      const code = entry.hand.trim() as HandCode;
      if (!code) continue;

      const pData = entry.positions?.[pos];
      if (!pData) {
        // そのポジションにデータが無ければスキップ
        continue;
      }

      // EV（あれば）
      if (typeof pData.ev === "number") {
        handEvs[code] = pData.ev;
      }

      const open = pData.open;
      if (!open) {
        continue;
      }

      const raise = open.raise ?? 0;
      const call = open.call ?? 0;
      const baseFold = open.fold ?? 0;

      let fold = baseFold;
      if (fold === 0 && (raise > 0 || call > 0)) {
        // fold 未指定なら残りで埋める（マイナスにはしない）
        fold = Math.max(0, 100 - raise - call);
      }

      const decision: HandDecision = { raise, call, fold };

      scenarioHands[code] = decision;

      // raise or call が効いてるハンドだけ「出題候補」にする
      if (raise > 0 || call > 0) {
        enabledHandCodes.push(code);
      }
    }

    if (enabledHandCodes.length > 0) {
      const scenarioId = `open_${pos.toLowerCase()}`;

      const scenario: RangeScenario = {
        id: scenarioId,
        name: `${pos} Open`,
        position: pos,
        heroPosition: pos,
        scenarioType: "OPEN",
        stackSizeBB: 100,
        hands: scenarioHands,
        enabledHandCodes,
        handEvs,
      };

      scenarios.push(scenario);
    }
  }

  // ========= VS 3BET シナリオ =========
  {
    const scenarioHands: Record<HandCode, HandDecision> = {};
    const enabledHandCodes: HandCode[] = [];
    const handEvs: Record<HandCode, number> = {};

    for (const entry of hands) {
      const code = entry.hand.trim() as HandCode;
      if (!code) continue;

      const pData = entry.positions?.[pos];
      if (!pData) continue;

      const vs = pData.vs3bet;
      if (!vs) continue; // vs3bet が無いポジションはスキップ

      // EV（あれば）: とりあえずポジション全体の ev を共有
      if (typeof pData.ev === "number") {
        handEvs[code] = pData.ev;
      }

      const raise = vs.fourBet ?? 0; // fourBet を「RAISE」として扱う
      const call = vs.call ?? 0;
      const baseFold = vs.fold ?? 0;

      let fold = baseFold;
      if (fold === 0 && (raise > 0 || call > 0)) {
        fold = Math.max(0, 100 - raise - call);
      }

      const decision: HandDecision = { raise, call, fold };
      scenarioHands[code] = decision;

      if (raise > 0 || call > 0) {
        enabledHandCodes.push(code);
      }
    }

    if (enabledHandCodes.length > 0) {
      const scenarioId = `vs3bet_${pos.toLowerCase()}`;

      const scenario: RangeScenario = {
        id: scenarioId,
        name: `${pos} vs 3bet`,
        position: pos,
        heroPosition: pos,
        // scenarioType をちゃんと分けたい場合は types.ts 側に "VS_3BET" を足す。
        // いまは型崩れを避けて一旦 "OPEN" のままにしておく。
        scenarioType: "OPEN",
        stackSizeBB: 100,
        hands: scenarioHands,
        enabledHandCodes,
        handEvs,
      };

      scenarios.push(scenario);
    }
  }
}

  const nowIso = new Date().toISOString();

  const rangeSet: RangeSet = {
    meta: {
      id: "gto_6max_default",
      name: "GTO 6max Default",
      description: "ranges_6max.json から生成された 6max オープンレンジ",
      // gameType や tags が必須ならここに追加
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
    } as RangeSet["meta"],
    scenarios,
  };

  return rangeSet;
}

/**
 * localStorage に何もなければ JSON から初期 RangeSet を作る。
 * 既にシナリオ付きの RangeSet が保存されていればそれを優先。
 */
export async function initRangeSetsFromJsonIfEmpty(): Promise<RangeSet[]> {
  const existing = loadRangeSets();

  const hasScenario = existing.some(
    (rs) => Array.isArray(rs.scenarios) && rs.scenarios.length > 0,
  );

  if (hasScenario) {
    return existing;
  }

  const initial = await createInitialRangeSetFromJson();
  const all: RangeSet[] = [initial];
  saveRangeSets(all);
  return all;
}

/**
 * TrainerRoot などから呼ばれる想定。
 */
export async function loadOrInitRangeSets(): Promise<RangeSet[]> {
  return initRangeSetsFromJsonIfEmpty();
}

/**
 * 「デフォルトに戻す」ボタン用。
 * localStorage を消してから JSON から作り直す。
 */
export async function resetRangeSetsToDefault(): Promise<RangeSet[]> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear range sets storage", e);
    }
  }

  const sets = await initRangeSetsFromJsonIfEmpty();
  return sets;
}
