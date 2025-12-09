import React, { useEffect, useState } from 'react';
import { RangeGrid } from './RangeGrid';
import {
  loadRangeDataWithCategories,
  buildHandCategoryIndex,
} from './rangeData';
import type {
  Position,
  Hand,
  RangeData,
  HandCategoryIndex,
} from './types';
import { consumeRangeFocus } from './rangeFocus';

export const EditorRoot: React.FC = () => {
  const handleBackToTrainer = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('poker-gto:switch-tab', {
          detail: 'trainer',
        }),
      );
    }
  };

  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [handCategoryIndex, setHandCategoryIndex] =
    useState<HandCategoryIndex | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [initialPosition, setInitialPosition] =
    useState<Position | null>(null);
  const [initialHand, setInitialHand] = useState<Hand | null>(null);

  // レンジデータ＋カテゴリ情報のロード
  useEffect(() => {
    loadRangeDataWithCategories()
      .then(({ core, positionBuckets }) => {
        setRangeData(core);
        const index = buildHandCategoryIndex(positionBuckets);
        setHandCategoryIndex(index);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(
          'Failed to load range data with categories in EditorRoot',
          err,
        );
      });
  }, []);

  // Trainer からのフォーカス情報を反映
  useEffect(() => {
    const ctx = consumeRangeFocus();
    if (ctx) {
      setInitialPosition(ctx.position);
      setInitialHand(ctx.hand);
    }
  }, []);

  // 未保存の変更があるとき、タブを閉じる前に警告
  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      // Chrome 用
      // eslint-disable-next-line no-param-reassign
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirty]);

  const handleRangeChange = (data: RangeData): void => {
    setRangeData(data);
    setDirty(true);
  };

  const handleSave = (): void => {
    if (!rangeData) return;

    setSaving(true);
    try {
      localStorage.setItem(
        'poker-gto-range-data',
        JSON.stringify(rangeData),
      );
      setDirty(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        'Failed to save range data to localStorage',
        e,
      );
    } finally {
      setTimeout(() => setSaving(false), 400);
    }
  };

  if (!rangeData) {
    return (
      <div style={{ color: '#e5e7eb' }}>
        レンジデータ読込中...
      </div>
    );
  }

  return (
    <div className="editor-root">
      <h2 className="editor-title">プリフロップレンジ編集</h2>
      <RangeGrid
        externalRangeData={rangeData}
        onRangeChange={handleRangeChange}
        focusPosition={initialPosition ?? undefined}
        focusHand={initialHand ?? undefined}
        handCategoryIndex={handCategoryIndex ?? undefined}
      />

      <div
        className="editor-actions"
        style={{
          marginTop: '8px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <div className="editor-header">
          <button
            type="button"
            className="editor-back-btn"
            onClick={handleBackToTrainer}
          >
            ◀ クイズに戻る
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="editor-save-btn"
          disabled={!dirty && !saving}
        >
          {saving
            ? '保存中...'
            : dirty
            ? '変更を保存する'
            : '保存済み ✔'}
        </button>
        {dirty && !saving && (
          <span className="editor-dirty-label">
            未保存の変更あり
          </span>
        )}
      </div>
    </div>
  );
};
