import "./styles/main.css";

import {
  renderTrainerView,
  initTrainerViewEvents,
  initTrainerInstance
} from "./ui/trainerView";
import { renderStatsView, initStatsViewEvents } from "./ui/statsView";
import { renderEditorView, initEditorViewEvents } from "./ui/editorView";
import { renderSettingsView, initSettingsViewEvents } from "./ui/settingsView";

type TabId = "trainer" | "stats" | "editor" | "settings";

function createLayout() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="app-root">
      <header class="app-header">
        <div id="appTitle" class="app-title">トレーナー</div>
      </header>
      <main id="main" class="app-main"></main>
      <nav class="app-tabbar">
        <button id="tab-trainer" class="tab-button tab-button-active">トレーナー</button>
        <button id="tab-stats" class="tab-button">統計</button>
        <button id="tab-editor" class="tab-button">エディター</button>
        <button id="tab-settings" class="tab-button">設定</button>
      </nav>
    </div>
  `;
}

function setActiveTab(tab: TabId) {
  const tabs: TabId[] = ["trainer", "stats", "editor", "settings"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    if (!btn) return;
    if (t === tab) {
      btn.classList.add("tab-button-active");
    } else {
      btn.classList.remove("tab-button-active");
    }
  });

  const titleEl = document.getElementById("appTitle");
  if (!titleEl) return;

  switch (tab) {
    case "trainer":
      titleEl.textContent = "トレーナー";
      break;
    case "stats":
      titleEl.textContent = "学習統計";
      break;
    case "editor":
      titleEl.textContent = "エディター";
      break;
    case "settings":
      titleEl.textContent = "設定";
      break;
  }
}

function renderTab(tab: TabId) {
  const main = document.getElementById("main");
  if (!main) return;

  switch (tab) {
    case "trainer": {
      main.innerHTML = renderTrainerView();
      initTrainerViewEvents();
      break;
    }
    case "stats": {
      main.innerHTML = renderStatsView();
      initStatsViewEvents();
      break;
    }
    case "editor": {
      main.innerHTML = renderEditorView();
      initEditorViewEvents();
      break;
    }
    case "settings": {
      main.innerHTML = renderSettingsView();
      initSettingsViewEvents();
      break;
    }
  }

  setActiveTab(tab);
}

function initTabBar() {
  const trainerBtn = document.getElementById("tab-trainer");
  const statsBtn = document.getElementById("tab-stats");
  const editorBtn = document.getElementById("tab-editor");
  const settingsBtn = document.getElementById("tab-settings");

  if (trainerBtn) {
    trainerBtn.addEventListener("click", () => renderTab("trainer"));
  }
  if (statsBtn) {
    statsBtn.addEventListener("click", () => renderTab("stats"));
  }
  if (editorBtn) {
    editorBtn.addEventListener("click", () => renderTab("editor"));
  }
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => renderTab("settings"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // レイアウトを構築（#app の中身を丸ごと作る）
  createLayout();

  // Trainer の内部状態初期化
  initTrainerInstance();

  // タブバーのイベント紐付け
  initTabBar();

  // 初期タブ（トレーナー）
  renderTab("trainer");
});

// ===== Service Worker registration =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // 現在のURLを基準に sw.js への相対パスを解決
    // 例: https://username.github.io/poker-gto/ → https://username.github.io/poker-gto/sw.js
    const swUrl = new URL("sw.js", window.location.href).toString();

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log("Service worker registered:", registration.scope);
      })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  });
}
