import React, { useEffect, useMemo, useState } from 'react';
import './RangeGrid.css';
import type {
  Action,
  Hand,
  Position,
  RangeData,
  EquityMatrix,
  Rank,
} from './types';
import { RANKS, getHandAt } from './handUtils';
import {
  loadRangeData,
  deriveActionForHand,
  toggleHandInRange,
} from './rangeData';
import {
  loadEquityMatrix,
  getEquity,
  getEquityColor,
  getHandIndex,
} from './equityMatrix';
import { RangeCell } from './RangeCell';
import { PositionSelector } from './PositionSelector';
import { RangeControls } from './RangeControls';
import { EquityTooltip } from './EquityTooltip';

interface RangeGridProps {
  externalRangeData?: RangeData;
  onRangeChange?: (data: RangeData) => void;

  // ★ ここを追加
  focusPosition?: Position;
  focusHand?: Hand;
}

export const RangeGrid: React.FC<RangeGridProps> = ({
  externalRangeData,
  onRangeChange,
  focusPosition,
  focusHand,
}) => {
  const [innerRangeData, setInnerRangeData] = useState<RangeData | null>(
    externalRangeData ?? null,
  );
  const [equityMatrix, setEquityMatrix] = useState<EquityMatrix | null>(null);
  const [selectedPosition, setSelectedPosition] =
    useState<Position>(focusPosition ?? 'BTN');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedAction, setSelectedAction] =
    useState<Action>('open');
  const [hoveredHand, setHoveredHand] = useState<Hand | null>(
    focusHand ?? null,
  );
  const [lastEditedHand, setLastEditedHand] = useState<Hand | null>(null); // ★ 追加
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

  const rangeData: RangeData | null =
    externalRangeData ?? innerRangeData;

  useEffect(() => {
    let isMounted = true;

    const init = async (): Promise<void> => {
      try {
        setLoading(true);

        const rangePromise = externalRangeData
          ? Promise.resolve(externalRangeData)
          : loadRangeData();

        const [ranges, matrix] = await Promise.all([
          rangePromise,
          loadEquityMatrix(),
        ]);

        if (!isMounted) return;

        if (!externalRangeData) {
          setInnerRangeData(ranges);
        }

        setEquityMatrix(matrix);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        if (isMounted) {
          setErrorMessage('Failed to load range or equity data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [externalRangeData]);

    useEffect(() => {
    // Trainer や EditorRoot からフォーカス指定が来たときに反映
    if (focusPosition) {
      setSelectedPosition(focusPosition);
    }
    if (focusHand) {
      setHoveredHand(focusHand);
    }
  }, [focusPosition, focusHand]);


  const heroHand = hoveredHand;

  const positionStats = useMemo(() => {
    if (!rangeData) return null;

    const totalHands = 13 * 13; // 169

    let openCount = 0;
    let callCount = 0;
    let jamCount = 0;
    let foldCount = 0;

    for (let row = 0; row < 13; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        const hand = getHandAt(row, col);
        const action = deriveActionForHand(
          rangeData,
          selectedPosition,
          hand,
        );
        switch (action) {
          case 'open':
            openCount += 1;
            break;
          case 'call':
            callCount += 1;
            break;
          case 'jam':
            jamCount += 1;
            break;
          case 'fold':
            foldCount += 1;
            break;
          default:
            break;
        }
      }
    }

    if (openCount + callCount + jamCount + foldCount === 0) {
      return null;
    }

    const pct = (n: number): number => (n / totalHands) * 100;

    return {
      openCount,
      callCount,
      jamCount,
      foldCount,
      openPct: pct(openCount),
      callPct: pct(callCount),
      jamPct: pct(jamCount),
      foldPct: pct(foldCount),
    };
  }, [rangeData, selectedPosition]);

  const equityStats = useMemo(() => {
    if (!heroHand || !equityMatrix) {
      return {
        vsRandom: null as number | null,
        vsRange: null as number | null,
      };
    }

    const heroIndex = getHandIndex(equityMatrix, heroHand);
    if (heroIndex === null) {
      return {
        vsRandom: null as number | null,
        vsRange: null as number | null,
      };
    }

    const row = equityMatrix.matrix[heroIndex] ?? [];
    const vsRandom =
      row.length > 0
        ? row.reduce(
            (sum: number, v: number) =>
              sum + (typeof v === 'number' ? v : 0),
            0,
          ) / row.length
        : null;

    let vsRange: number | null = null;
    if (rangeData) {
      const posRange = rangeData.ranges.find(
        (r: { position: Position }) =>
          r.position === selectedPosition,
      );
      const openHands: Hand[] = posRange?.open ?? [];
      if (openHands.length > 0) {
        let total = 0;
        let count = 0;
        openHands.forEach((villainHand: Hand) => {
          const villainIndex = getHandIndex(
            equityMatrix,
            villainHand,
          );
          if (villainIndex !== null) {
            const value =
              equityMatrix.matrix[heroIndex]?.[villainIndex];
            if (typeof value === 'number') {
              total += value;
              count += 1;
            }
          }
        });
        vsRange = count > 0 ? total / count : null;
      }
    }

    return { vsRandom, vsRange };
  }, [heroHand, equityMatrix, rangeData, selectedPosition]);

  const updateRangeData = (
    updater: (prev: RangeData) => RangeData,
  ): void => {
    if (!rangeData) return;
    const next = updater(rangeData);
    if (onRangeChange) {
      onRangeChange(next);
    }
    if (!externalRangeData) {
      setInnerRangeData(next);
    }
  };

  const handleCellClick = (hand: Hand): void => {
    if (!rangeData) return;

    if (editMode) {
      updateRangeData((prev: RangeData) =>
        toggleHandInRange(
          prev,
          selectedPosition,
          selectedAction,
          hand,
        ),
      );

      // 編集したハンドを一瞬ハイライト
      setLastEditedHand(hand);
      window.setTimeout(() => {
        setLastEditedHand((current) => (current === hand ? null : current));
      }, 300);

      return;
    }

    // 編集モードOFF時はクリックでホバー対象固定 (モバイル操作想定)
    setHoveredHand(hand);
  };

  const handleCellMouseEnter = (hand: Hand): void => {
    if (!editMode) {
      setHoveredHand(hand);
    }
  };

  const handleCellMouseLeave = (): void => {
    if (!editMode) {
      setHoveredHand(null);
    }
  };

  const handleRangeDataChange = (data: RangeData): void => {
    if (onRangeChange) {
      onRangeChange(data);
    }
    if (!externalRangeData) {
      setInnerRangeData(data);
    }
  };

  if (loading) {
    return (
      <div className="range-grid range-grid--loading">
        Loading ranges...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="range-grid range-grid--error">
        {errorMessage}
      </div>
    );
  }

  if (!rangeData) {
    return (
      <div className="range-grid range-grid--error">
        No range data available.
      </div>
    );
  }

  return (
    <div className="range-grid">
      <div className="range-grid__header">
        <PositionSelector
          selected={selectedPosition}
          onChange={(pos: Position) => setSelectedPosition(pos)}
        />
        <RangeControls
          editMode={editMode}
          onEditModeChange={setEditMode}
          selectedAction={selectedAction}
          onActionChange={setSelectedAction}
          rangeData={rangeData}
          onRangeDataChange={handleRangeDataChange}
        />
      </div>
      
      {positionStats && (
        <div className="range-grid__stats">
          <span className="range-grid__stats-pos">
            {selectedPosition}
          </span>
          <span className="range-grid__stats-item range-grid__stats-item--open">
            OPEN {positionStats.openCount} (
            {positionStats.openPct.toFixed(1)}
            %)
          </span>
          <span className="range-grid__stats-item range-grid__stats-item--call">
            CALL {positionStats.callCount} (
            {positionStats.callPct.toFixed(1)}
            %)
          </span>
          <span className="range-grid__stats-item range-grid__stats-item--jam">
            JAM {positionStats.jamCount} (
            {positionStats.jamPct.toFixed(1)}
            %)
          </span>
          <span className="range-grid__stats-item range-grid__stats-item--fold">
            FOLD {positionStats.foldCount} (
            {positionStats.foldPct.toFixed(1)}
            %)
          </span>
        </div>
      )}

      <div
        className="range-grid__table-wrapper"
        role="grid"
        aria-label="Preflop range grid"
      >
        <div className="range-grid__row range-grid__row--header">
          <div className="range-grid__corner-cell" />
          {RANKS.map((rank: Rank) => (
            <div
              key={`col-${rank}`}
              className="range-grid__header-cell"
            >
              {rank}
            </div>
          ))}
        </div>

        {RANKS.map((rowRank: Rank, rowIndex: number) => (
          <div
            key={`row-${rowRank}`}
            className="range-grid__row"
          >
            <div className="range-grid__header-cell">
              {rowRank}
            </div>
            {RANKS.map((colRank: Rank, colIndex: number) => {
              const hand = getHandAt(rowIndex, colIndex);

              const action = deriveActionForHand(
                rangeData,
                selectedPosition,
                hand,
              );

              let equityColor: string | undefined;
              let isHero = false;

              if (hoveredHand && equityMatrix) {
                const villainEquity = getEquity(
                  hand,
                  hoveredHand,
                  equityMatrix,
                );
                equityColor = getEquityColor(villainEquity);
                if (hand === hoveredHand) {
                  isHero = true;
                }
              }

              const isHovered = hand === hoveredHand;

              return (
                <RangeCell
                  key={hand}
                  hand={hand}
                  action={action}
                  isHovered={isHovered}
                  isHero={isHero}
                  equityColor={equityColor}
                  onClick={() => handleCellClick(hand)}
                  onMouseEnter={() =>
                    handleCellMouseEnter(hand)
                  }
                  onMouseLeave={handleCellMouseLeave}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="range-grid__footer">
        <EquityTooltip
          hand={heroHand}
          equityVsRandom={equityStats.vsRandom}
          equityVsRange={equityStats.vsRange}
        />
        <div className="range-grid__legend">
          <div className="range-grid__legend-row">
            <span className="legend-swatch legend-swatch--open" />
            <span>OPEN</span>
          </div>
          <div className="range-grid__legend-row">
            <span className="legend-swatch legend-swatch--call" />
            <span>CALL</span>
          </div>
          <div className="range-grid__legend-row">
            <span className="legend-swatch legend-swatch--jam" />
            <span>JAM</span>
          </div>
          <div className="range-grid__legend-row">
            <span className="legend-swatch legend-swatch--fold" />
            <span>FOLD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
