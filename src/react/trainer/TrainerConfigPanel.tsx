// src/react/trainer/TrainerConfigPanel.tsx
import React from "react";
import type { RangeSet, RangeScenario } from "../../core/types";
import { Tag } from "./components/Tag";

interface TrainerConfigPanelProps {
  rangeSets: RangeSet[];
  activeRangeSet: RangeSet | null;
  activeScenario: RangeScenario | null;
  reviewHandsCount: number | null;

  onChangeRangeSet: (rangeSetId: string) => void;
  onChangeScenario: (scenarioId: string) => void;
  onStartQuiz: () => void;
}

export function TrainerConfigPanel({
  rangeSets,
  activeRangeSet,
  activeScenario,
  reviewHandsCount,
  onChangeRangeSet,
  onChangeScenario,
  onStartQuiz,
}: TrainerConfigPanelProps) {
  // レンジセット説明（meta.description がなければフォールバック）
  const rangeDesc: string =
    (activeRangeSet?.meta as any)?.description ?? "説明なし";

  // タグ（型定義に無くても any 経由で安全に見る）
  const rangeTags: string[] =
    ((activeRangeSet?.meta as any)?.tags as string[] | undefined) ?? [];

  const scenarioTags: string[] =
    ((activeScenario as any)?.tags as string[] | undefined) ?? [];

  // シナリオの説明は、とりあえず name を出すだけにする（型安全）
  const scenarioDesc: string =
    activeScenario?.name ?? "シナリオを選択してください";

  return (
    <div className="trainer-config">
      {/* Range Set */}
      <div className="config-card">
        <div className="config-card__label">
            <span className="config-icon">📚</span>
            レンジセット
        </div>
        <select
          className="config-select"
          value={activeRangeSet?.meta.id ?? ""}
          onChange={(e) => onChangeRangeSet(e.target.value)}
        >
          {rangeSets.map((rs) => (
            <option key={rs.meta.id} value={rs.meta.id}>
              {rs.meta.name}
            </option>
          ))}
        </select>

        {/* タグ（あれば） */}
        {rangeTags.length > 0 && (
          <div className="tag-row">
            {rangeTags.map((t: string) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        )}

        {/* 説明 */}
        <div className="config-desc">{rangeDesc}</div>
      </div>

      {/* Scenario */}
      <div className="config-card">
        <div className="config-card__label">
            <span className="config-icon">🎯</span>
            シナリオ
        </div>
        <select
          className="config-select"
          value={activeScenario?.id ?? ""}
          onChange={(e) => onChangeScenario(e.target.value)}
        >
          {activeRangeSet?.scenarios.length === 0 ? (
            <option value="">（シナリオなし）</option>
          ) : (
            activeRangeSet?.scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))
          )}
        </select>

        {/* タグ（あれば） */}
        {scenarioTags.length > 0 && (
          <div className="tag-row">
            {scenarioTags.map((t: string) => (
              <Tag key={t} label={t} />
            ))}
          </div>
        )}

        {/* 説明（いまは name をそのまま出しておく） */}
        <div className="config-desc">{scenarioDesc}</div>
      </div>

      {/* 復習モード */}
      {reviewHandsCount && reviewHandsCount > 0 && (
        <div className="config-card review-card">
        <div className="review-title">
            <span className="config-icon">🔄</span>
            復習モード
        </div>
          <div className="review-body">
            苦手ハンド数: <strong>{reviewHandsCount}</strong>
            <br />
            クイズ開始するとこれらのハンドのみ出題されます。
          </div>
        </div>
      )}

      {/* Hero / Start Section */}
      <div className="config-hero">
        <div className="config-hero-title">
        <span className="config-icon-large">🚀</span>
        Ready to Train?
        </div>

        <div className="config-hero-summary">
          <div>
            <span className="config-hero-label">レンジセット:</span>
            <span className="config-hero-value">
              {activeRangeSet?.meta.name ?? "未選択"}
            </span>
          </div>
          <div>
            <span className="config-hero-label">シナリオ:</span>
            <span className="config-hero-value">
              {activeScenario?.name ?? "未選択"}
            </span>
          </div>
        </div>

        <button className="config-start-btn" onClick={onStartQuiz}>
          クイズ開始
        </button>
      </div>
    </div>
  );
}
