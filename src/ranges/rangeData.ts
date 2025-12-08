import type {
  Action,
  Hand,
  Position,
  RangeData,
  PositionRange,
} from './types';

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
