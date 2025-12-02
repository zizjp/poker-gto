// src/react/trainer/components/Tag.tsx
import React from "react";

interface TagProps {
  label: string;
}

export function Tag({ label }: TagProps) {
  return (
    <span className="tag">{label}</span>
  );
}
