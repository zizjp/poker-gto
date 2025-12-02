import React, { useState } from "react";

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface SwipeCardProps {
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
  onSwipeCommit: (direction: SwipeDirection, strength: number) => void;
  onSwipeCancel?: () => void;
  /** カードが飛び出しアニメ終了後に呼ばれる */
  onRemove?: () => void;
}

/** 移動量からメイン方向を決める */
function getDirection(dx: number, dy: number): SwipeDirection | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < 4 && absY < 4) return null;

  if (absX > absY) {
    return dx > 0 ? "right" : "left";
  } else {
    return dy > 0 ? "down" : "up";
  }
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  children,
  disabled = false,
  threshold = 80,
  onSwipeCommit,
  onSwipeCancel,
  onRemove,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [delta, setDelta] = useState({ x: 0, y: 0 });

  /** 回答が確定し、カードが飛んでいくアニメーション状態 */
  const [flyDirection, setFlyDirection] = useState<SwipeDirection | null>(null);

  const handlePointerDown = (x: number, y: number) => {
    if (disabled || flyDirection !== null) return;
    setIsDragging(true);
    setStart({ x, y });
    setDelta({ x: 0, y: 0 });
  };

  const handlePointerMove = (x: number, y: number) => {
    if (!isDragging || !start) return;
    setDelta({ x: x - start.x, y: y - start.y });
  };

  const resetDrag = () => {
    setIsDragging(false);
    setStart(null);
    setDelta({ x: 0, y: 0 });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;

    const { x: dx, y: dy } = delta;
    const distance = Math.hypot(dx, dy);

    if (distance < threshold) {
      resetDrag();
      onSwipeCancel?.();
      return;
    }

    const direction = getDirection(dx, dy);
    if (!direction) {
      resetDrag();
      return;
    }

    const maxDistance = 160;
    const strength = Math.min(1, distance / maxDistance);

    // まず回答を確定させる（トレーナー側のロジックに通知）
    onSwipeCommit(direction, strength);

    // その後、カードを飛ばすアニメーションに入る
    setFlyDirection(direction);

    resetDrag();
  };

  // ------------------------------
  // transform の計算（ドラッグ中）
  // ------------------------------
  const dx = delta.x;
  const dy = delta.y;
  const dragRotation = dx * 0.05;
  const dragTransform = `translate3d(${dx}px, ${dy}px, 0) rotate(${dragRotation}deg)`;

  // ------------------------------
  // CSSクラス決定（飛びアニメ用）
  // ------------------------------
  let flyClass = "";

  if (flyDirection === "left") flyClass = "swipe-card--fly-left";
  if (flyDirection === "right") flyClass = "swipe-card--fly-right";
  if (flyDirection === "up") flyClass = "swipe-card--fly-up";
  if (flyDirection === "down") flyClass = "swipe-card--fly-down";

  const handleAnimationEnd = () => {
    if (flyDirection !== null) {
      onRemove?.();
    }
  };

  return (
    <div
      className="swipe-card-wrapper"
      // Pointer & Touch handlers
      onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={isDragging ? handlePointerUp : undefined}
      onTouchStart={(e) => {
        const t = e.touches[0];
        handlePointerDown(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        handlePointerMove(t.clientX, t.clientY);
        e.preventDefault();
      }}
      onTouchEnd={handlePointerUp}
    >
      <div
        className={[
          "swipe-card",
          isDragging ? "swipe-card--dragging" : "",
          flyClass,
        ].join(" ")}
        style={flyDirection ? {} : { transform: dragTransform }}
        onAnimationEnd={handleAnimationEnd}
      >
        {children}
      </div>
    </div>
  );
};
