// src/ranges/rangeData.ts
import {
  RangeData,
  PositionRange,
  Action,
  Hand,
  Position,
  RangeCategoryKey,
  PositionCategoryBuckets,
  RangeDataWithCategories,
  HandCategoryIndex,
  HandCode
} from "./types";
// ★ 追加: 全ハンド169個を生成するユーティリティ
import { generateHandGridOrder } from "../core/handOrder";

interface ImportMetaEnvLike {
  env?: {
    BASE_URL?: string;
  };
}

const BASE_URL =
  ((import.meta as unknown as ImportMetaEnvLike).env?.BASE_URL) ?? "/";
const RANGE_DATA_URL = `${BASE_URL}data/ranges_6max.json`;
const LOCAL_STORAGE_KEY = "poker-gto-range-data";
// ⭐ EVプリセット専用キャッシュキー（RangeDataとは別）
const EV_LOCAL_STORAGE_KEY = "poker-gto-range-ev-hands";

let rangeDataCache: RangeData | null = null;

/**
 * 新しい ranges_6max.json（hands[] + positions.* + ev）を
 * RangeData（ranges: PositionRange[]）に正規化する。
 */
function normalizeRangeData(raw: any): RangeData {
  // すでに ranges があればそのまま使う（互換性維持）
  if (raw && Array.isArray(raw.ranges)) {
    return raw as RangeData;
  }

  const positions: Position[] = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

  const byPos: Record<Position, PositionRange> = {
    UTG: { position: "UTG", open: [] },
    "UTG+1": { position: "UTG+1", open: [] },
    MP: { position: "MP", open: [] },
    HJ: { position: "HJ", open: [] },
    CO: { position: "CO", open: [] },
    BTN: { position: "BTN", open: [] },
    SB: { position: "SB", open: [] },
    BB: { position: "BB", open: [] },
  };

  // ★ 追加: EV マップ
  const evByPosition: Record<Position, Record<string, number>> = {
    UTG: {},
    "UTG+1": {},
    MP: {},
    HJ: {},
    CO: {},
    BTN: {},
    SB: {},
    BB: {},
  };

  const hands = Array.isArray(raw?.hands) ? raw.hands : [];

  for (const h of hands) {
    const handCode: Hand = h.hand;
    const posMap = h.positions ?? {};

    for (const pos of positions) {
      const pData = posMap[pos];
      if (!pData) continue;

      const open = pData.open ?? null;
      const vs3bet = pData.vs3bet ?? null;
      const range = byPos[pos];

      // open.raise > 0 ならオープンレンジに入れる
      if (open && typeof open.raise === "number" && open.raise > 0) {
        range.open.push(handCode);
      }

      // vs3bet.call > 0 → call3bet
      if (vs3bet && typeof vs3bet.call === "number" && vs3bet.call > 0) {
        if (!range.call3bet) range.call3bet = [];
        range.call3bet.push(handCode);
      }

      // vs3bet.fourBet > 0 → jam 側に寄せる
      if (vs3bet && typeof vs3bet.fourBet === "number" && vs3bet.fourBet > 0) {
        if (!range.jam) range.jam = [];
        range.jam.push(handCode);
      }

      // ★ ここで EV を拾う
      if (typeof pData.ev === "number") {
        evByPosition[pos][handCode] = pData.ev;
      }
    }
  }

  return {
    ranges: Object.values(byPos),
    raw,
    evByPosition, // ★ 追加
  };
}

/**
 * レンジ定義をロード
 * 1. まず localStorage を見る
 * 2. なければ public/data/ranges_6max.json から fetch
 */
export async function loadRangeData(): Promise<RangeData> {
  if (rangeDataCache) {
    return rangeDataCache;
  }
  // 1️⃣ localStorage 優先（ブラウザ環境のみ）
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RangeData;
        if (parsed && Array.isArray(parsed.ranges)) {
          rangeDataCache = parsed;
          return parsed;
        }
      }
    } catch (e) {
      // ここで死なないようにしておく（フォールバックで JSON を読む）
      // eslint-disable-next-line no-console
      console.error("Failed to read range data from localStorage", e);
    }
  }
  // 2️⃣ デフォルト JSON からロード
  const response = await fetch(RANGE_DATA_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load range data: ${response.status} ${response.statusText}`,
    );
  }

  const rawJson = await response.json();
  const data = normalizeRangeData(rawJson);

  if (!Array.isArray(data.ranges)) {
    throw new Error("Invalid range data format");
  }

  rangeDataCache = data;
  // 3️⃣ 初回ロード時に localStorage にも保存しておく（任意）
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to write initial range data to localStorage", e);
  }

  return data;
}

/**
 * 特定ポジションのレンジを取得
 */
export function getPositionRange(
  data: RangeData,
  position: Position,
): PositionRange | undefined {
  return data.ranges.find((r: PositionRange) => r.position === position);
}

/**
 * ハンドが特定アクションレンジに含まれるか判定
 */
export function isHandInRange(
  hand: Hand,
  position: Position,
  action: Action,
  data: RangeData,
): boolean {
  const posRange = getPositionRange(data, position);
  if (!posRange) return false;
  const inOpen = posRange.open.includes(hand);
  const inCall =
    (posRange.call3bet?.includes(hand) ?? false) ||
    (posRange.call4bet?.includes(hand) ?? false);
  const inJam = posRange.jam?.includes(hand) ?? false;

  switch (action) {
    case "open":
      return inOpen;
    case "call":
      return inCall;
    case "jam":
      return inJam;
    case "fold":
      return !inOpen && !inCall && !inJam;
    default:
      return false;
  }
}

function toggleInArray(list: Hand[], hand: Hand): Hand[] {
  const exists = list.includes(hand);
  if (exists) {
    return list.filter((h: Hand) => h !== hand);
  }
  return [...list, hand];
}

/**
 * レンジ編集（immutable）
 */
export function toggleHandInRange(
  data: RangeData,
  position: Position,
  action: Action,
  hand: Hand,
): RangeData {
  const ranges = data.ranges.map((r: PositionRange) => {
    if (r.position !== position) return r;
    const open = [...r.open];
    const call3bet = [...(r.call3bet ?? [])];
    const call4bet = [...(r.call4bet ?? [])];
    const jam = [...(r.jam ?? [])];

    if (action === "fold") {
      return {
        ...r,
        open: open.filter((h: Hand) => h !== hand),
        call3bet: call3bet.filter((h: Hand) => h !== hand),
        call4bet: call4bet.filter((h: Hand) => h !== hand),
        jam: jam.filter((h: Hand) => h !== hand),
      };
    }
    if (action === "open") {
      return {
        ...r,
        open: toggleInArray(open, hand),
      };
    }

    if (action === "call") {
      return {
        ...r,
        call3bet: toggleInArray(call3bet, hand),
      };
    }

    // action === 'jam'
    return {
      ...r,
      jam: toggleInArray(jam, hand),
    };
  });

  return {
    ...data,
    ranges,
  };
}

/**
 * あるハンドについて、優先度付きで Action を決定
 * 優先度: jam > call > open > fold
 */
export function deriveActionForHand(
  data: RangeData,
  position: Position,
  hand: Hand,
): Action {
  if (isHandInRange(hand, position, "jam", data)) return "jam";
  if (isHandInRange(hand, position, "call", data)) return "call";
  if (isHandInRange(hand, position, "open", data)) return "open";
  return "fold";
}

/**
 * ranges_6max.json の positions.* から PositionCategoryBuckets[] を構築する
 *
 * ※ 今の JSON には positions が無いので、positions が無い場合は空配列を返す。
 *   （カテゴリ無しで安全に動くようにしておく）
 */
export function buildCategoryBuckets(rawJson: unknown): PositionCategoryBuckets[] {
  if (!rawJson || typeof rawJson !== "object") {
    return [];
  }

  type RawPositions = Record<
    string,
    Partial<Record<RangeCategoryKey, string[]>>
  >;

  const raw = rawJson as { positions?: RawPositions };

  if (!raw.positions) {
    // 旧フォーマットのみカテゴリ対応、それ以外はカテゴリ無し
    return [];
  }

  const result: PositionCategoryBuckets[] = [];

  for (const [positionKey, posData] of Object.entries(raw.positions)) {
    if (!posData) continue;

    const position = positionKey as Position;
    const buckets: Record<RangeCategoryKey, Hand[]> = {
      premium: [],
      strong: [],
      medium: [],
      speculative: [],
    };

    const allCategories: RangeCategoryKey[] = [
      "premium",
      "strong",
      "medium",
      "speculative",
    ];

    for (const cat of allCategories) {
      const codes = posData[cat] ?? [];

      const hands: Hand[] = codes.map((code) => {
        // Hand の実際の構造は既存定義に依存するので最低限 code を持たせてキャスト
        return code as Hand;
      });

      buckets[cat] = hands;
    }
    result.push({
      position,
      buckets,
    });
  }

  return result;
}

/**
 * RangeData とカテゴリバケット情報をまとめてロードするヘルパー。
 *
 * - core: 既存の loadRangeData() が返す RangeData
 * - positionBuckets: core.raw または core を rawJson と見なして buildCategoryBuckets で構築
 */
export async function loadRangeDataWithCategories(): Promise<RangeDataWithCategories> {
  // ① いつもの RangeData をロード
  const core = await loadRangeData();
  // ② raw に旧 positions.* が入っていればそれを使う
  const rawJson = (core as any).raw ?? core;
  const positionBuckets = buildCategoryBuckets(rawJson as unknown);

  return {
    core,
    positionBuckets,
  };
}

/**
 * PositionCategoryBuckets[] から HandCategoryIndex を構築する。
 *
 * - 同じ handCode が複数カテゴリに現れた場合は、後勝ち（最後に見つけたカテゴリで上書き）とする。
 * ※ そんなケースは基本ない想定なのでシンプルにしている。
 */
export function buildHandCategoryIndex(
  buckets: PositionCategoryBuckets[],
): HandCategoryIndex {
  // 全 Position 分を初期化
  const index: HandCategoryIndex = {
    UTG: {},
    "UTG+1": {},
    MP: {},
    HJ: {},
    CO: {},
    BTN: {},
    SB: {},
    BB: {},
  };
  for (const bucket of buckets) {
    const pos = bucket.position;
    const target = index[pos] ?? (index[pos] = {});

    const allCategories: RangeCategoryKey[] = [
      "premium",
      "strong",
      "medium",
      "speculative",
    ];

    for (const cat of allCategories) {
      const hands = bucket.buckets[cat] ?? [];
      for (const hand of hands) {
        const code = hand as string;
        if (!code) continue;
        target[code] = cat;
      }
    }
  }

  return index;
}

// HandCategoryIndex のキャッシュ
let handCategoryIndexCache: HandCategoryIndex | null = null;

/**
 * PositionCategoryBuckets から HandCategoryIndex を構築してキャッシュし、
 * Trainer / Stats などから共通で使えるようにするヘルパー。
 */
export async function loadHandCategoryIndex(): Promise<HandCategoryIndex> {
  if (handCategoryIndexCache) {
    return handCategoryIndexCache;
  }

  const { positionBuckets } = await loadRangeDataWithCategories();
  const index = buildHandCategoryIndex(positionBuckets);
  handCategoryIndexCache = index;
  return index;
}

type RankedHandsFile = {
  hands?: {
    hand: string;
  }[];
};

/**
 * JSON から読んだ手リストを
 * - 重複削除
 * - 169 ハンド（pairs / suited / offsuit）の「抜け」を generateHandGridOrder で補完
 */
function normalizeRankedHandsFromJson(input: string[]): string[] {
  // じぃじが指定した順番を優先
  const baseOrder = generateHandGridOrder();
  const seen = new Set<string>();
  const result: string[] = [];

  // 1) JSON に書いてあるハンドをそのまま順番維持して追加（重複は除外）
  for (const h of input) {
    if (typeof h !== "string" || h.length === 0) continue;
    if (seen.has(h)) continue;
    seen.add(h);
    result.push(h);
  }

  // 2) 足りないハンドを標準グリッド順で埋める
  for (const h of baseOrder) {
    if (!seen.has(h)) {
      seen.add(h);
      result.push(h);
    }
  }

  return result;
}

/**
 * ranges_6max.json 内の hands[] を「ファイルの並び順のまま」返す。
 * ＝ じぃじがランク順に並べた通りの順番。
 *
 * ただし JSON に存在しないハンドも、
 * generateHandGridOrder() から補完して 169 ハンドすべて含める。
 */
export async function loadRankedHands(): Promise<string[]> {
  // 1️⃣ まずは localStorage のキャッシュを見に行く
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("poker-gto-ranked-hands");
      if (raw) {
        const json = JSON.parse(raw) as RankedHandsFile;
        if (Array.isArray(json.hands) && json.hands.length > 0) {
          const initial = json.hands
            .map((h) => h.hand)
            .filter(
              (h): h is string =>
                typeof h === "string" && h.length > 0
            );
          // ★ キャッシュから読んだ場合も「全ハンド補完」する
          return normalizeRankedHandsFromJson(initial);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to read ranked hands from localStorage", e);
    }
  }

  // 2️⃣ なければ /public/data/ranges_6max.json を fetch
  const response = await fetch(RANGE_DATA_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load ranked hands: ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as RankedHandsFile;
  const hands = Array.isArray(json.hands) ? json.hands : [];

  const initial = hands
    .map((h) => h.hand)
    .filter(
      (h): h is string =>
        typeof h === "string" && h.length > 0
    );

  // ★ JSON に書いてないハンドもここで補完される
  const ranked = normalizeRankedHandsFromJson(initial);

  // 3️⃣ キャッシュして次回以降軽くする
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "poker-gto-ranked-hands",
        JSON.stringify({ hands })
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to cache ranked hands", e);
  }

  return ranked;
}

/**
 * handCategoryIndex から position + handCode でカテゴリを引くヘルパー。
 *
 * - index が無い / position が無い / hand が登録されていない場合は null を返す。
 */
export function getHandCategoryFor(
  index: HandCategoryIndex | null | undefined,
  position: Position,
  handCode: string,
): RangeCategoryKey | null {
  if (!index) return null;
  const byPos = index[position];
  if (!byPos) return null;

  const cat = byPos[handCode];
  return (cat ?? null) as RangeCategoryKey | null;
}
