// src/react/trainer/AnswerEffect.tsx
import React from "react";
import type { QuestionResult } from "../../core/types";

interface AnswerEffectProps {
  result: QuestionResult;
  onClick: () => void;
}

/**
 * 正解/不正解のフィードバックオーバーレイ（iOSミニマル風）
 * - 正解: 緑の柔らかいグロー + ✔アイコン
 * - 不正解: 赤のライトなフラッシュ + ✕アイコン
 */
export function AnswerEffect({ result, onClick }: AnswerEffectProps) {
  const isCorrect = result.isCorrect;

  return (
    <div className="feedback-overlay answer-effect-overlay" onClick={onClick}>
      <div
        className={
          "feedback-box answer-effect-box " +
          (isCorrect
            ? "answer-effect-box--correct"
            : "answer-effect-box--wrong")
        }
      >
        <div className="answer-effect-icon-wrap">
          <div
            className={
              "answer-effect-icon " +
              (isCorrect
                ? "answer-effect-icon--correct"
                : "answer-effect-icon--wrong")
            }
          >
            {isCorrect ? "✓" : "✕"}
          </div>
        </div>

        <div
          className={
            "feedback-title " + (isCorrect ? "correct" : "wrong")
          }
        >
          {isCorrect ? "正解！" : "不正解"}
        </div>

        <div className="feedback-body">
          正解アクション: <strong>{result.correctAction}</strong>
        </div>

        <div className="feedback-actions">
          画面タップか 1.5秒後に次の問題へ進みます。
        </div>
      </div>
    </div>
  );
}
