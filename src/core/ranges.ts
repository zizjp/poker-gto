// src/core/ranges.ts

import type { Position } from "../ranges/types";
import type { RangeSet, RangeScenario } from "./types";

/**
 * localStorage のキー
 */
const STORAGE_KEY = "poker-gto:rangeSets";

/**
 * 6-max オープンレンジのざっくりデフォルト
 * - 形式は RangeGrid と同じ "AKs" / "AQo" / "TT" などを想定
 */
const UTG_OPEN: string[] = [
  "AA",
  "KK",
  "QQ",
  "JJ",
  "TT",
  "AKs",
  "AQs",
  "AJs",
  "KQs",
  "AKo",
  "AQo",
];

const CO_OPEN: string[] = [
  "AA",
  "KK",
  "QQ",
  "JJ",
  "TT",
  "99",
  "88",
  "AKs",
  "AQs",
  "AJs",
  "ATs",
  "KQs",
  "KJs",
  "QJs",
  "JTs",
  "T9s",
  "AKo",
  "AQo",
  "AJo",
];

const BTN_OPEN: string[] = [
  "AA",
  "KK",
  "QQ",
  "JJ",
  "TT",
  "99",
  "88",
  "77",
  "66",
  "AKs",
  "AQs",
  "AJs",
  "ATs",
  "A9s",
  "A8s",
  "KQs",
  "KJs",
  "KTs",
  "QJs",
  "QTs",
  "JTs",
  "T9s",
  "98s",
  "87s",
  "AKo",
  "AQo",
  "AJo",
  "ATo",
];

/**
 * オープンレンジを「100%レイズ」の RangeScenario に変換
 * - hands のキーは "AKs" などの 169-hand 文字列
 */
function buildOpenRaiseScenario(params: {
  id: string;
  name: string;
  description?: string;
  heroPosition: Position;
  stackSizeBB: number;
  openHands: string[];
}): RangeScenario {
  const hands: RangeScenario["hands"] = {};

  for (const hand of params.openHands) {
    // HandDecision の実際の型は core/types.ts 依存なので any で握る
    // raise100% / fold,call0% にしておくと大体妥当
    (hands as any)[hand] = {
      fold: 0,
      call: 0,
      raise: 1,
    };
  }

  const enabledHandCodes = Object.keys(hands);

  const scenario: RangeScenario = {
    id: params.id,
    name: params.name,
    heroPosition: params.heroPosition,
    stackSizeBB: params.stackSizeBB,
    scenarioType: "open" as any,
    hands,
    enabledHandCodes,
  };

  return scenario;
}

/**
 * デフォルト 6-max オープンレンジセットを作成する
 *
 * - meta.id = "default_6max_open"
 * - meta.gameType = "6max"
 * - meta.version = 1
 * - UTG / CO / BTN の 3シナリオ（いずれも 40BB オープン）を含む
 */
export function createDefaultRangeSet(
  now: () => Date = () => new Date(),
): RangeSet {
  const timestamp = now().toISOString();

  const scenarios: RangeScenario[] = [
    buildOpenRaiseScenario({
      id: "utg_open_40bb",
      name: "UTG オープン 40BB",
      description: "6-max UTG のオープンレンジ（ざっくり）",
      heroPosition: "UTG",
      stackSizeBB: 40,
      openHands: UTG_OPEN,
    }),
    buildOpenRaiseScenario({
      id: "co_open_40bb",
      name: "CO オープン 40BB",
      description: "6-max CO のオープンレンジ（ざっくり）",
      heroPosition: "CO",
      stackSizeBB: 40,
      openHands: CO_OPEN,
    }),
    buildOpenRaiseScenario({
      id: "btn_open_40bb",
      name: "BTN オープン 40BB",
      description: "6-max BTN のオープンレンジ（ざっくり）",
      heroPosition: "BTN",
      stackSizeBB: 40,
      openHands: BTN_OPEN,
    }),
  ];

  const meta: RangeSet["meta"] = {
    id: "default_6max_open",
    name: "6-max オープンレンジ（デフォルト）",
    version: 1,
    gameType: "6max",
    createdAt: timestamp,
    updatedAt: timestamp,
    description:
      "UTG / CO / BTN の 40BB オープンレンジを含むデフォルトレンジセット",
  };

  return {
    meta,
    scenarios,
  };
}

/**
 * RangeSet 配列を localStorage に保存する
 */
export function saveRangeSets(rangeSets: RangeSet[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const serialized = JSON.stringify(rangeSets);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // 容量オーバーなどは握りつぶす（アプリ側でリカバリ）
  }
}

/**
 * localStorage から RangeSet の配列を読み込む
 * - なければデフォルトセットを1つ作成して返す
 * - 壊れていてもデフォルトセットにフォールバック
 */
export function loadRangeSets(): RangeSet[] {
  // SSR / テスト環境など localStorage が無い場合は、とりあえずデフォルト1つ返す
  if (typeof window === "undefined" || !window.localStorage) {
    return [createDefaultRangeSet()];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaults = [createDefaultRangeSet()];
    saveRangeSets(defaults);
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      const defaults = [createDefaultRangeSet()];
      saveRangeSets(defaults);
      return defaults;
    }
    return parsed as RangeSet[];
  } catch {
    const defaults = [createDefaultRangeSet()];
    saveRangeSets(defaults);
    return defaults;
  }
}

/**
 * 保存済みレンジセットがあればそれを返し、なければデフォルトを作って保存して返す
 * - 互換性のために残してあるが、実質 loadRangeSets() と同じ挙動
 */
export function loadOrCreateDefaultRangeSets(): RangeSet[] {
  return loadRangeSets();
}

/**
 * RangeSet ID から RangeSet を探す
 * - 見つからなければ「最初の RangeSet」か null を返す
 */
export function findRangeSetById(
  rangeSets: RangeSet[],
  id: string | null | undefined,
): RangeSet | null {
  if (rangeSets.length === 0) return null;
  if (!id) return rangeSets[0];

  const found = rangeSets.find((rs) => rs.meta.id === id);
  return found ?? rangeSets[0] ?? null;
}

/**
 * Scenario ID から RangeScenario を探す
 * - 見つからなければ「最初のシナリオ」か null を返す
 */
export function findScenarioById(
  rangeSet: RangeSet | null,
  id: string | null | undefined,
): RangeScenario | null {
  if (!rangeSet || rangeSet.scenarios.length === 0) return null;
  if (!id) return rangeSet.scenarios[0];

  const found = rangeSet.scenarios.find((sc) => sc.id === id);
  return found ?? rangeSet.scenarios[0] ?? null;
}
