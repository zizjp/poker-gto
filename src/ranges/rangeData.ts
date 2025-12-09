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
} from "./types";

interface ImportMetaEnvLike {
  env?: {
    BASE_URL?: string;
  };
}

const BASE_URL =
  ((import.meta as unknown as ImportMetaEnvLike).env?.BASE_URL) ?? '/';
const RANGE_DATA_URL = `${BASE_URL}data/ranges_6max.json`;
const LOCAL_STORAGE_KEY = 'poker-gto-range-data';

let rangeDataCache: RangeData | null = null;

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
  if (typeof window !== 'undefined') {
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
      console.error('Failed to read range data from localStorage', e);
    }
  }

  // 2️⃣ デフォルト JSON からロード
  const response = await fetch(RANGE_DATA_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load range data: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as RangeData;

  if (!Array.isArray(data.ranges)) {
    throw new Error('Invalid range data format');
  }

  rangeDataCache = data;

  // 3️⃣ 初回ロード時に localStorage にも保存しておく（任意）
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(data),
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to write initial range data to localStorage', e);
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
    case 'open':
      return inOpen;
    case 'call':
      return inCall;
    case 'jam':
      return inJam;
    case 'fold':
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

    if (action === 'fold') {
      return {
        ...r,
        open: open.filter((h: Hand) => h !== hand),
        call3bet: call3bet.filter((h: Hand) => h !== hand),
        call4bet: call4bet.filter((h: Hand) => h !== hand),
        jam: jam.filter((h: Hand) => h !== hand),
      };
    }

    if (action === 'open') {
      return {
        ...r,
        open: toggleInArray(open, hand),
      };
    }

    if (action === 'call') {
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
  if (isHandInRange(hand, position, 'jam', data)) return 'jam';
  if (isHandInRange(hand, position, 'call', data)) return 'call';
  if (isHandInRange(hand, position, 'open', data)) return 'open';
  return 'fold';
}

/**
 * ranges_6max.json の positions.* から PositionCategoryBuckets[] を構築する
 *
 * rawJson は fetch 直後の JSON そのままを想定:
 *
 * {
 *   ...,
 *   positions: {
 *     "UTG": {
 *       "premium": ["AA", "KK", ...],
 *       "strong": [...],
 *       ...
 *     },
 *     "CO": { ... },
 *     ...
 *   }
 * }
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
        return { code } as unknown as Hand;
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
 * - positionBuckets: core を rawJson と見なして buildCategoryBuckets で構築
 *
 * もし RangeData に positions.* が含まれていなければ positionBuckets は空配列になるが、
 * それはそれで安全（カテゴリ情報なしとして扱える）。
 */
export async function loadRangeDataWithCategories(): Promise<RangeDataWithCategories> {
  // ① いつもの RangeData をロード
  const core = await loadRangeData();

  // ② そのまま positions.* を含んでいる想定でバケット化
  const positionBuckets = buildCategoryBuckets(core as unknown);

  return {
    core,
    positionBuckets,
  };
}

/**
 * PositionCategoryBuckets[] から HandCategoryIndex を構築する。
 *
 * - 同じ handCode が複数カテゴリに現れた場合は、後勝ち（最後に見つけたカテゴリで上書き）とする。
 *   ※ そんなケースは基本ない想定なのでシンプルにしている。
 */
export function buildHandCategoryIndex(
  buckets: PositionCategoryBuckets[],
): HandCategoryIndex {
  // 全 Position 分を初期化
  const index: HandCategoryIndex = {
    UTG: {},
    MP: {},
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
        let code = "";

        if (typeof hand === "string") {
          // ★ ranges_6max.json の positions.* は "AKs" などの string
          code = hand;
        } else {
          // 将来 Hand オブジェクトに変わった場合もケア
          code =
            (hand as any).code ??
            (hand as any).id ??
            (typeof (hand as any).label === "string"
              ? (hand as any).label
              : "");
        }

        if (!code) continue;

        target[code] = cat;
      }
    }
  }

  return index;
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
