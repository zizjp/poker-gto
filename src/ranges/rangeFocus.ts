import type { RangeFocusContext } from './types';

const STORAGE_KEY = 'poker-gto-range-focus';

export function setRangeFocus(ctx: RangeFocusContext): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to set range focus', e);
  }
}

// Editor 側で一度だけ取り出して、すぐ削除する
export function consumeRangeFocus(): RangeFocusContext | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  window.localStorage.removeItem(STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as RangeFocusContext;
    if (!parsed || !parsed.position || !parsed.hand) return null;
    return parsed;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse range focus', e);
    return null;
  }
}
