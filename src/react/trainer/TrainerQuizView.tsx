import React from "react";
import type { TrainingQuestion, QuestionResult } from "../../core/types";
import type { TrainerPhase } from "./TrainerRoot"; // ← 追加（相対パスは環境に応じて合わせて）

import { SwipeCard, type SwipeDirection } from "./components/SwipeCard";
import { HandDisplay } from "./components/HandDisplay";
import { AnswerEffect } from "./AnswerEffect";

interface TrainerQuizViewProps {
  question: TrainingQuestion;
  scenarioName: string | null;
  spotLabel: string | null;
  phase: TrainerPhase; // ← ここを修正
  feedback: QuestionResult | null;

  onSwipeAnswer: (answer: "FOLD" | "CALL" | "RAISE") => void;
  onButtonAnswer: (answer: "FOLD" | "CALL" | "RAISE") => void;
  onFeedbackClick: () => void;
}

export function TrainerQuizView({
  question,
  scenarioName,
  spotLabel,
  phase,
  feedback,
  onSwipeAnswer,
  onButtonAnswer,
  onFeedbackClick,
}: TrainerQuizViewProps) {
  const disabled = phase !== "QUIZ";

  const handleSwipeCommit = (
    direction: SwipeDirection,
    strength: number
  ) => {
    if (disabled) return;

    let ans: "FOLD" | "CALL" | "RAISE" | null = null;

    if (direction === "left") ans = "FOLD";

    // 上下どっちも CALL
    if (direction === "up" || direction === "down") ans = "CALL";

    // 右は RAISE
    if (direction === "right") ans = "RAISE";

    // "down" は無視（ans が null のまま）
    if (!ans) return;

    onSwipeAnswer(ans);
  };

  const handleSwipeCancel = () => {
    // 何もしない。カードは自動的に戻る。
  };

  return (
    <div className="trainer-quiz">
      <div className="trainer-quiz__header">
        {scenarioName && (
          <div className="trainer-quiz__title">{scenarioName}</div>
        )}
        {spotLabel && (
          <div className="trainer-quiz__subtitle">{spotLabel}</div>
        )}
      </div>

      <div className="trainer-quiz__card-area">
        <SwipeCard
          key={question.hand}
          threshold={80}
          disabled={disabled}
          onSwipeCommit={handleSwipeCommit}
          onSwipeCancel={handleSwipeCancel}
          onRemove={() => {}}
        >
          <div className="trainer-card trainer-card--appear">
            <div className="trainer-card__center">
              <HandDisplay hand={question.hand} />
            </div>

            <div className="trainer-card__bottom">
              <div className="trainer-card__hint">
                ← FOLD　/　↑↓ CALL　/　→ RAISE
              </div>
            </div>
          </div>
        </SwipeCard>
      </div>

      {/* PCボタン */}
      <div className="trainer-quiz__buttons">
        <button
          className="trainer-quiz-btn trainer-quiz-btn--fold"
          disabled={disabled}
          onClick={() => onButtonAnswer("FOLD")}
        >
          FOLD
        </button>
        <button
          className="trainer-quiz-btn trainer-quiz-btn--call"
          disabled={disabled}
          onClick={() => onButtonAnswer("CALL")}
        >
          CALL
        </button>
        <button
          className="trainer-quiz-btn trainer-quiz-btn--raise"
          disabled={disabled}
          onClick={() => onButtonAnswer("RAISE")}
        >
          RAISE
        </button>
      </div>

      {/* FEEDBACK 表示（iOSミニマル演出） */}
      {phase === "FEEDBACK" && feedback && (
        <AnswerEffect result={feedback} onClick={onFeedbackClick} />
      )}
    </div>
  );
}
