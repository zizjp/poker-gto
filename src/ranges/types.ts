// src/ranges/types.ts
// ------------------------------------------------------
// レンジ関連の共通型定義
// - HandCode / Position / Rank / Action / RangeData
// - EquityMatrix / RangeFocusContext など
// ------------------------------------------------------

// プリフロップのポジション
// Editor では "UTG+1" / "HJ" も使うので含めておく
export type Position =
  | "UTG"
  | "UTG+1"
  | "MP"
  | "HJ"
  | "CO"
  | "BTN"
  | "SB"
  | "BB";

// ランク（ハンドグリッド用）
export type Rank =
  | "A"
  | "K"
  | "Q"
  | "J"
  | "T"
  | "9"
  | "8"
  | "7"
  | "6"
  | "5"
  | "4"
  | "3"
  | "2";

// "AKs", "QQ", "T9s" など
export type Hand = string;
export type HandCode = string;

// RangeVisualizer / Trainer で使うアクション
export type Action = "open" | "call" | "jam" | "fold";

// カテゴリラベル
export type RangeCategoryKey =
  | "premium"
  | "strong"
  | "medium"
  | "speculative";

// Position ごとのレンジ定義（RangeGrid 用）
export interface PositionRange {
  position: Position;
  open: Hand[];
  call3bet?: Hand[];
  call4bet?: Hand[];
  jam?: Hand[];
}

// `/public/data/ranges_6max.json` を正規化した結果
export interface RangeData {
  // PositionRange[] に正規化したもの
  ranges: PositionRange[];
  // 元の JSON（EV や vs3bet など）も保持しておく
  raw?: unknown;
  // ハンドごとの 期待EV マップ
  evByPosition?: Record<Position, Record<HandCode, number>>;
}

// 位置ごとのカテゴリバケット
export interface PositionCategoryBuckets {
  position: Position;
  buckets: Record<RangeCategoryKey, Hand[]>;
}

// RangeData + カテゴリ情報
export interface RangeDataWithCategories {
  core: RangeData;
  positionBuckets: PositionCategoryBuckets[];
}

// handCategoryIndex[position][handCode] = "premium" など
export type HandCategoryIndex = Record<
  Position,
  Record<string, RangeCategoryKey>
>;

// EquityMatrix: hands配列 + 2次元matrix（RangeGrid / equityMatrix.ts が期待）
export interface EquityMatrix {
  hands: Hand[];
  matrix: number[][];
}

// RangeVisualizer で「どのポジ / どのアクション / どのハンドをフォーカスしているか」
export interface RangeFocusContext {
  position: Position;
  action: Action;
  hand?: Hand; // フォーカスしているハンド（任意）
}
