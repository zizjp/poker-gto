import React from 'react';
import type { Hand } from './types';

interface EquityTooltipProps {
  hand: Hand | null;
  equityVsRandom: number | null;
  equityVsRange: number | null;
}

export const EquityTooltip: React.FC<EquityTooltipProps> = ({
  hand,
  equityVsRandom,
  equityVsRange,
}) => {
  if (!hand) {
    return (
      <div className="equity-tooltip" aria-live="polite">
        <div className="equity-tooltip__hand">ハンドをホバーすると勝率を表示</div>
      </div>
    );
  }

  const fmt = (v: number | null): string =>
    v === null ? '-' : `${(v * 100).toFixed(1)}%`;

  return (
    <div className="equity-tooltip" aria-live="polite">
      <div className="equity-tooltip__hand">{hand}</div>
      <div className="equity-tooltip__row">
        <span className="equity-tooltip__label">vs Random</span>
        <span className="equity-tooltip__value">{fmt(equityVsRandom)}</span>
      </div>
      <div className="equity-tooltip__row">
        <span className="equity-tooltip__label">vs Range</span>
        <span className="equity-tooltip__value">{fmt(equityVsRange)}</span>
      </div>
    </div>
  );
};
