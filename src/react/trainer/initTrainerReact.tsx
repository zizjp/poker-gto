// src/react/trainer/initTrainerReact.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { TrainerRoot } from "./TrainerRoot";

export function initTrainerReact(container: HTMLElement) {
  // タブ切り替えのたびに #main が差し替わる構造なので、
  // Trainerタブを表示するたびにそのコンテナ用の root を作る。
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <TrainerRoot />
    </React.StrictMode>
  );
}
