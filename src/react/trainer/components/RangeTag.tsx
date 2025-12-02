// src/react/trainer/components/RangeTag.tsx
import React from "react";

interface RangeTagProps {
  label: string;
}

export const RangeTag: React.FC<RangeTagProps> = ({ label }) => {
  if (!label) return null;

  return <span className="range-tag">{label}</span>;
};
