import type { Hand, Rank } from './types';

export const RANKS: Rank[] = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
];

/**
 * グリッド座標(row, col) → ハンド名
 * - 対角線: ペア (AA, KK, ...)
 * - 右上: スーテッド (AKs など)
 * - 左下: オフスート (AKo など)
 */
export function getHandAt(row: number, col: number): Hand {
  const r1 = RANKS[row];
  const r2 = RANKS[col];

  if (!r1 || !r2) {
    throw new Error(`Invalid row/col: ${row}, ${col}`);
  }

  if (row === col) {
    return `${r1}${r2}`;
  }

  if (row < col) {
    return `${r1}${r2}s`;
  }

  return `${r1}${r2}o`;
}

/**
 * ハンド名 → グリッド座標(row, col)
 */
export function getHandCoords(hand: Hand): [number, number] {
  if (hand.length < 2) {
    throw new Error(`Invalid hand: ${hand}`);
  }

  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const suffix = hand[2] ?? '';

  const i1 = RANKS.indexOf(r1);
  const i2 = RANKS.indexOf(r2);

  if (i1 === -1 || i2 === -1) {
    throw new Error(`Invalid ranks in hand: ${hand}`);
  }

  if (r1 === r2 || suffix === '') {
    return [i1, i1];
  }

  if (suffix === 's') {
    let row = i1;
    let col = i2;
    if (row > col) {
      [row, col] = [col, row];
    }
    return [row, col];
  }

  if (suffix === 'o') {
    const highIdx = Math.min(i1, i2);
    const lowIdx = Math.max(i1, i2);
    return [lowIdx, highIdx];
  }

  throw new Error(`Invalid suited/offsuit suffix in hand: ${hand}`);
}
