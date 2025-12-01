import type { Rank, HandCode } from "./types";

const RANKS: Rank[] = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

export function generateHandGridOrder(): HandCode[] {
  const pairs: HandCode[] = [];
  const suited: HandCode[] = [];
  const offsuit: HandCode[] = [];

  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      const hi = RANKS[i];
      const lo = RANKS[j];
      if (i === j) {
        pairs.push(`${hi}${lo}`);
      } else if (i < j) {
        suited.push(`${hi}${lo}s`);
      } else {
        offsuit.push(`${hi}${lo}o`);
      }
    }
  }
  return [...pairs, ...suited, ...offsuit];
}
