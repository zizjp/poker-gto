// src/react/trainer/components/HandDisplay.tsx
import React, { useMemo } from "react";

interface HandDisplayProps {
  hand: string;
}

type HandType = "suited" | "offsuit" | "pair";
type Suit = "spade" | "heart" | "diamond" | "club";

interface CardView {
  rank: string;
  suit: Suit;
}

function parseHand(hand: string): { ranks: string; type: HandType } {
  const trimmed = hand.trim();

  // "AKs" / "JTo" / "99" などを想定
  const m = trimmed.match(/^([2-9TJQKA]{2})([soSO])?$/);
  if (!m) {
    return { ranks: trimmed, type: "pair" };
  }

  const ranks = m[1];
  const suffix = m[2];

  if (suffix === "s" || suffix === "S") return { ranks, type: "suited" };
  if (suffix === "o" || suffix === "O") return { ranks, type: "offsuit" };
  return { ranks, type: "pair" };
}

const ALL_SUITS: Suit[] = ["spade", "heart", "diamond", "club"];

function pickRandomSuit(exclude?: Suit): Suit {
  const pool = exclude ? ALL_SUITS.filter((s) => s !== exclude) : ALL_SUITS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? pool[0];
}

function buildRandomCards(ranks: string, type: HandType): CardView[] {
  if (ranks.length < 2) {
    return [
      { rank: ranks.charAt(0) || "?", suit: "spade" },
      { rank: ranks.charAt(1) || "?", suit: "diamond" },
    ];
  }

  const r1 = ranks.charAt(0);
  const r2 = ranks.charAt(1);

  if (type === "suited") {
    // スーテッド：2枚とも同じスートをランダムに割り当て
    const suit = pickRandomSuit();
    return [
      { rank: r1, suit },
      { rank: r2, suit },
    ];
  }

  if (type === "offsuit") {
    // オフスート：必ず異なる2スート
    const s1 = pickRandomSuit();
    const s2 = pickRandomSuit(s1);
    return [
      { rank: r1, suit: s1 },
      { rank: r2, suit: s2 },
    ];
  }

  // ペア：見やすさ優先で異なる2スートにする
  const s1 = pickRandomSuit();
  const s2 = pickRandomSuit(s1);
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ];
}

function suitToSymbol(suit: Suit): string {
  switch (suit) {
    case "spade":
      return "♠";
    case "heart":
      return "♥";
    case "diamond":
      return "♦";
    case "club":
      return "♣";
    default:
      return "?";
  }
}

function suitToClassName(suit: Suit): string {
  switch (suit) {
    case "spade":
      return "hand-card--spade";
    case "heart":
      return "hand-card--heart";
    case "diamond":
      return "hand-card--diamond";
    case "club":
      return "hand-card--club";
    default:
      return "";
  }
}

/**
 * プリフロップハンド表示コンポーネント
 * - 1問ごとにスートをランダム割り当て
 * - ただし同じ手札表示のあいだは変わらないよう useMemo で固定
 */
export const HandDisplay: React.FC<HandDisplayProps> = ({ hand }) => {
  const { ranks, type } = useMemo(() => parseHand(hand), [hand]);

  const cards = useMemo(() => {
    return buildRandomCards(ranks, type);
  }, [ranks, type]);

  // 想定外フォーマットはそのままテキスト表示
  if (cards.length !== 2) {
    return <div className="hand-display hand-display--fallback">{hand}</div>;
  }

  return (
    <div className="hand-display">
      {cards.map((c, idx) => {
        const suitSymbol = suitToSymbol(c.suit);
        const suitClass = suitToClassName(c.suit);
        return (
          <div key={idx} className={`hand-card ${suitClass}`}>
            <span className="hand-card__rank">{c.rank}</span>
            <span className="hand-card__suit">{suitSymbol}</span>
          </div>
        );
      })}
    </div>
  );
};
