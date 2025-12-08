import type { EquityMatrix, Hand } from './types';

interface ImportMetaEnvLike {
  env?: {
    BASE_URL?: string;
  };
}

const BASE_URL =
  ((import.meta as unknown as ImportMetaEnvLike).env?.BASE_URL) ?? '/';
const EQUITY_MATRIX_URL = `${BASE_URL}data/equity_6max.json`;

let equityMatrixCache: EquityMatrix | null = null;
const handIndexCache = new WeakMap<EquityMatrix, Map<Hand, number>>();

export async function loadEquityMatrix(): Promise<EquityMatrix> {
  if (equityMatrixCache) {
    return equityMatrixCache;
  }

  const response = await fetch(EQUITY_MATRIX_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to load equity matrix: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as EquityMatrix;

  if (!Array.isArray(data.hands) || !Array.isArray(data.matrix)) {
    throw new Error('Invalid equity matrix format');
  }
  if (data.hands.length !== data.matrix.length) {
    throw new Error('Equity matrix dimension mismatch');
  }

  equityMatrixCache = data;
  return data;
}

function getHandIndexMap(matrix: EquityMatrix): Map<Hand, number> {
  let map = handIndexCache.get(matrix);
  if (map) return map;

  map = new Map<Hand, number>();
  matrix.hands.forEach((h: Hand, i: number) => {
    map!.set(h, i);
  });
  handIndexCache.set(matrix, map);
  return map;
}

export function getHandIndex(
  matrix: EquityMatrix,
  hand: Hand,
): number | null {
  const map = getHandIndexMap(matrix);
  const idx = map.get(hand);
  return idx ?? null;
}

export function getEquity(
  hero: Hand,
  villain: Hand,
  matrix: EquityMatrix,
): number {
  const indexMap = getHandIndexMap(matrix);
  const heroIndex = indexMap.get(hero);
  const villainIndex = indexMap.get(villain);

  if (heroIndex === undefined || villainIndex === undefined) {
    return 0.5;
  }

  const row = matrix.matrix[heroIndex];
  const value = row?.[villainIndex];
  if (typeof value !== 'number') {
    return 0.5;
  }

  return value;
}

export function getEquityColor(equity: number): string {
  if (Number.isNaN(equity)) {
    return 'var(--c-equity-even)';
  }

  if (equity >= 0.7) {
    return 'var(--c-equity-high)';
  }
  if (equity >= 0.55) {
    return 'var(--c-equity-med-high)';
  }
  if (equity > 0.45) {
    return 'var(--c-equity-even)';
  }
  if (equity >= 0.3) {
    return 'var(--c-equity-med-low)';
  }
  return 'var(--c-equity-low)';
}
