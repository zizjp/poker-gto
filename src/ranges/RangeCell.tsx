import React from 'react';
import type { Action, Hand } from './types';

interface RangeCellProps {
  hand: Hand;
  action: Action;
  isHovered: boolean;
  isHero: boolean;
  isEdited?: boolean;        // ★ オプションにする
  equityColor?: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const RangeCell: React.FC<RangeCellProps> = ({
  hand,
  action,
  isHovered,
  isHero,
  isEdited = false,   // ★ 渡されなければ false 扱い
  equityColor,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const actionClass =
    action === 'open'
      ? 'range-cell--open'
      : action === 'call'
        ? 'range-cell--call'
        : action === 'jam'
          ? 'range-cell--jam'
          : 'range-cell--fold';

  const classes = [
    'range-cell',
    actionClass,
    isHovered ? 'range-cell--hovered' : '',
    isHero ? 'range-cell--hero' : '',
    isEdited ? 'range-cell--edited' : '',   // ★ 追加
  ]
    .filter(Boolean)
    .join(' ');

  const style: React.CSSProperties = {};
  if (equityColor) {
    style.backgroundColor = equityColor;
  }

  const ariaLabel = `${hand} ${action}`;

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="gridcell"
      tabIndex={0}
      aria-label={ariaLabel}
      className={classes}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <span className="range-cell__label">{hand}</span>
      {action === 'fold' && (
        <span className="range-cell__badge">×</span>
      )}
    </div>
  );
};
