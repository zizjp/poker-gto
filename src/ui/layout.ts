import { renderTrainerView, initTrainerViewEvents } from "./trainerView";
import { renderStatsView } from "./statsView";
import { renderEditorView, initEditorViewEvents } from "./editorView";
import { renderSettingsView, initSettingsEvents } from "./settingsView";

export type TabId = "trainer" | "stats" | "editor" | "settings";

let currentTab: TabId = "trainer";

export function initLayout() {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <header id="header">プリフロップトレーナー</header>
    <main id="main"></main>
    <nav>
      <button data-tab="trainer" class="active"><span>トレーナー</span></button>
      <button data-tab="stats"><span>統計</span></button>
      <button data-tab="editor"><span>エディター</span></button>
      <button data-tab="settings"><span>設定</span></button>
    </nav>
  `;

  document.querySelectorAll("nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab") as TabId;
      switchTab(tab);
    });
  });

  switchTab("trainer");
}

function switchTab(tab: TabId) {
  currentTab = tab;

  document.querySelectorAll("nav button").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });

  const main = document.getElementById("main")!;
  const header = document.getElementById("header")!;

  if (tab === "trainer") {
    header.textContent = "プリフロップトレーナー";
    main.innerHTML = renderTrainerView();
    initTrainerViewEvents();
  }

  if (tab === "stats") {
    header.textContent = "学習統計";
    main.innerHTML = renderStatsView();
  }

  if (tab === "editor") {
    header.textContent = "レンジエディター";
    main.innerHTML = renderEditorView();
    initEditorViewEvents();
  }

  if (tab === "settings") {
    header.textContent = "設定";
    main.innerHTML = renderSettingsView();
    initSettingsEvents();
  }
}
