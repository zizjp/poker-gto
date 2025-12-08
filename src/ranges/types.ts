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
