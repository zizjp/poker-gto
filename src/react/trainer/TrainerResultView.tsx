// src/react/trainer/TrainerResultView.tsx
import React from "react";
import type { TrainingSession } from "../../core/types";

interface TrainerResultViewProps {
  session: TrainingSession;
  onBackToConfig: () => void;
}

export function TrainerResultView({
  session,
  onBackToConfig,
}: TrainerResultViewProps) {
  const total = session.results.length;
  const correct = session.results.filter((r) => r.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="trainer-result">
      <div className="section session-summary" style={{ marginTop: "16px" }}>
        <h2>セッション結果</h2>

        <p>
          問題数: <strong>{total}</strong>
        </p>

        <p>
          正解数: <strong>{correct}</strong>
        </p>

        <p>
          正解率: <strong>{accuracy}%</strong>
        </p>

        <button
          className="button button-secondary"
          style={{ marginTop: "12px" }}
          onClick={onBackToConfig}
        >
          設定に戻る
        </button>
      </div>
    </div>
  );
}
