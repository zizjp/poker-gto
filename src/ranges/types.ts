export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export type Action = 'open' | 'fold' | 'call' | 'jam';

export type GameType = '6max' | '8max';

export type Hand = string;

export type Rank =
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'T'
  | '9'
  | '8'
  | '7'
  | '6'
  | '5'
  | '4'
  | '3'
  | '2';

export interface PositionRange {
  position: Position;
  open: Hand[];
  call3bet?: Hand[];
  call4bet?: Hand[];
  jam?: Hand[];
}

export interface RangeData {
  version: string;
  gameType: GameType;
  stackSize: number;
  rake: number;
  ranges: PositionRange[];
  metadata?: {
    lastModified?: string;
    author?: string;
  };
}

export interface EquityMatrix {
  version: string;
  hands: Hand[];
  matrix: number[][];
}

export interface RangeGridState {
  selectedPosition: Position;
  editMode: boolean;
  selectedAction: Action;
  hoveredHand: Hand | null;
  multiSelect: Set<Hand>;
}

// Trainer などから「どのポジションのどのハンドを見たいか」を渡すためのコンテキスト
export interface RangeFocusContext {
  position: Position;
  hand: Hand;
}

// ========================================
// レンジ強度カテゴリまわりの型
// ========================================

/**
 * ranges_6max.json の metadata.categories / positions.* のキーに対応
 */
export type RangeCategoryKey =
  | "premium"
  | "strong"
  | "medium"
  | "speculative";

/**
 * カテゴリごとの説明（例: "EV +1.5~+2.5BB (Dark Red)" など）
 */
export interface RangeCategoryMeta {
  key: RangeCategoryKey;
  description: string;
}

/**
 * 1ポジション分のカテゴリバケット
 * - buckets[category] に、そのカテゴリに属する Hand[] が入る
 */
export interface PositionCategoryBuckets {
  position: Position;
  buckets: Record<RangeCategoryKey, Hand[]>;
}

// ========================================
// RangeData + カテゴリ情報のラッパー
// ========================================

/**
 * レンジ本体（RangeData）に、ポジション別カテゴリバケットを付与した構造。
 * - core: 既存の RangeData そのまま
 * - positionBuckets: buildCategoryBuckets() で構築したカテゴリ情報
 */
export interface RangeDataWithCategories {
  core: RangeData;
  positionBuckets: PositionCategoryBuckets[];
}

// ========================================
// ハンド → カテゴリLookup用インデックス
// ========================================

/**
 * position + handCode("AKs"など) から RangeCategoryKey を即引きするためのインデックス。
 *
 * handCategoryIndex[Position]["AKs"] => "premium" | "strong" | ... | undefined
 */
export type HandCategoryIndex = Record<
  Position,
  Record<string, RangeCategoryKey | undefined>
>;
