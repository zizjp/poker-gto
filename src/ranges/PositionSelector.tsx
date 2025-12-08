import React from 'react';
import type { Position } from './types';

interface PositionSelectorProps {
  selected: Position;
  onChange: (position: Position) => void;
}

const POSITIONS: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export const PositionSelector: React.FC<PositionSelectorProps> = ({
  selected,
  onChange,
}) => {
  return (
    <div
      className="position-selector"
      role="radiogroup"
      aria-label="Position"
    >
      {POSITIONS.map((pos: Position) => (
        <button
          key={pos}
          type="button"
          className={[
            'position-selector__btn',
            pos === selected ? 'position-selector__btn--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={pos === selected}
          onClick={() => onChange(pos)}
        >
          {pos}
        </button>
      ))}
    </div>
  );
};
