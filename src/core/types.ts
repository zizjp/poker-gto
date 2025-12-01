// ---- 基本ドメイン型 ----

export type Rank =
  | "A" | "K" | "Q" | "J" | "T"
  | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";

export type HandCode = string;

export type Position =
  | "UTG" | "UTG+1" | "MP" | "HJ" | "CO" | "BTN" | "SB" | "BB";

export type ScenarioType = "OPEN" | "THREE_BET" | "FOUR_BET"; // 表示: オープン / 3Bet / 4Bet
export type ActionKind = "RAISE" | "CALL" | "FOLD";

export interface HandDecision {
  raise: number; // 0〜100, 整数
  call: number;  // 0〜100
  fold: number;  // 0〜100, raise+call+fold === 100
}

export interface RangeScenario {
  id: string;
  name: string;
  heroPosition: Position;
  villainPosition?: Position;
  stackSizeBB: number; // 20, 30, 40 など
  scenarioType: ScenarioType;
  hands: Record<HandCode, HandDecision>;
  enabledHandCodes: HandCode[]; // 出題対象
}

export interface RangeSetMeta {
  id: string;
  name: string;
  description?: string;
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
  gameType: string;   // "8max_BB_ante" 等
  version: number;    // スキーマバージョン
}

export interface RangeSet {
  meta: RangeSetMeta;
  scenarios: RangeScenario[];
}

// ---- 設定・スコープ ----

export type JudgeMode = "FREQUENCY" | "PROBABILISTIC";

export interface TrainingScopePreset {
  id: string;               // "p25", "p45", "p50", "all" 等
  name: string;             // "Top 25%" 等
  enabledHands: HandCode[];
}

export interface AppSettings {
  judgeMode: JudgeMode;
  activeRangeSetId: string | null;
  activeScenarioId: string | null;
  usePresetScopeId: string | null;
  customScopeHands: HandCode[];
  hapticFeedback: boolean;
}

// ---- トレーニング & 統計 ----

export type UserAnswer = ActionKind;

export interface TrainingQuestion {
  id: string;
  hand: HandCode;
  correctAction: ActionKind;
  correctProbabilities: HandDecision;
}

export interface QuestionResult {
  questionId: string;
  hand: HandCode;
  userAnswer: UserAnswer;
  isCorrect: boolean;
  correctAction: ActionKind;
  scenarioId: string;
  rangeSetId: string;
  timestamp: string;
}

export interface TrainingSession {
  id: string;
  startedAt: string;
  finishedAt?: string;
  rangeSetId: string;
  scenarioId: string;
  questionCount: number;
  results: QuestionResult[];
}

export interface GlobalStats {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number; // 0〜1
}

export interface RangeStats {
  scenarioId: string;
  scenarioName: string;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
}

export interface HandStats {
  hand: HandCode;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
}

export interface RecentSessionSummary {
  id: string;
  startedAt: string;
  finishedAt?: string;
  scenarioName: string;
  accuracy: number;
  questionCount: number;
}

export interface StatsSnapshot {
  global: GlobalStats;
  byScenario: RangeStats[];
  byHand: HandStats[];
  recentSessions: RecentSessionSummary[];
}
