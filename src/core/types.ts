// src/core/types.ts
// ------------------------------------------------------
// アプリ全体で使う「唯一の真実」な型定義
// - RangeSet / RangeScenario
// - AppSettings / TrainingQuestion / TrainingSession など
// ------------------------------------------------------

import type {
  Position as RangesPosition,
  Rank as RangesRank,
  Hand as RangesHand,
  HandCode as RangesHandCode,
  RangeCategoryKey as RangesCategoryKey,
} from "../ranges/types";

// === カード / ポジション関連 ===

export type Position = RangesPosition;
export type Rank = RangesRank;
export type Hand = RangesHand;
export type HandCode = RangesHandCode;
export type RangeCategoryKey = RangesCategoryKey;

// ゲームタイプ（文字列でもOKにしておく）
export type GameType = "6max" | "9max" | "8max_BB_ante" | string;

// === レンジ関連 ===

export interface HandDecision {
  raise: number; // %
  call: number;  // %
  fold: number;  // %
}

export type ScenarioType =
  | "open"
  | "vs3bet"
  | "4bet"
  | "vs4bet"
  | "defend"
  | "3bet"
  | "other"
  | string;

export interface RangeScenario {
  id: string;
  name: string;

  // 旧コードでは heroPosition を主に使っているので、両方 optional にしておく
  position?: Position;
  heroPosition?: Position;
  villainPosition?: Position | null;
  scenarioType?: ScenarioType;
  stackSizeBB?: number;

  // ハンドごとの決定テーブル
  hands: Record<HandCode, HandDecision>;

  // ハンドグリッド出題範囲（有効ハンド）
  enabledHandCodes: HandCode[];

  // EV プリセット用のマップ（任意）
  handEvs?: Record<HandCode, number>;

  // 将来拡張用に余白を許容
  [key: string]: any;
}

export interface RangeSetMeta {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  version?: number | string;
  gameType?: GameType | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RangeSet {
  meta: RangeSetMeta;
  scenarios: RangeScenario[];
}

// === 設定関連 ===

export type JudgeMode = "strict" | "lenient" | "gto" | string;

export interface AppSettings {
  activeRangeSetId: string | null;
  activeScenarioId: string | null;
  judgeMode: JudgeMode;
  // 他の設定も雑に許容
  [key: string]: any;
}

// === トレーナー / セッション関連 ===

// Trainer / UI 側は "FOLD" / "CALL" / "RAISE" の大文字で扱っている
export type ActionKind = "FOLD" | "CALL" | "RAISE";

// UserAnswer は ActionKind と同じものとして扱う
export type UserAnswer = ActionKind;

export interface TrainingQuestion {
  id: string;
  hand: HandCode;
  correctAction: ActionKind;
  // trainer.ts 側では scenarioId を持っていないので optional にしておく
  scenarioId?: string;
  [key: string]: any;
}

// 互換用エイリアス（古いコードが TrainerQuestion を使っている）
export type TrainerQuestion = TrainingQuestion;

export interface QuestionResult {
  questionId: string;
  correctAction: ActionKind;
  userAnswer: UserAnswer;
  isCorrect: boolean;
  hand?: HandCode;
  scenarioId?: string;
  rangeSetId?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface TrainingSession {
  id: string;
  rangeSetId: string;
  scenarioId: string;
  // trainer.ts 側で mode を入れていないケースがあるので optional
  mode?: "normal" | "review" | string;
  startedAt: string;
  finishedAt?: string;
  // 実際に解いた問題数
  questionCount: number;
  // 各問題の結果
  results: QuestionResult[];
  [key: string]: any;
}

// === Stats 関連（詳細構造は緩く持つ） ===

export interface StatsSnapshot {
  [key: string]: any;
}

export interface GlobalStats {
  [key: string]: any;
}

export interface RangeStats {
  [key: string]: any;
}

export interface HandStats {
  [key: string]: any;
}

export interface RecentSessionSummary {
  [key: string]: any;
}
