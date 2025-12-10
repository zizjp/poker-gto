import React from 'react';
import ReactDOM from 'react-dom/client';
import { EditorRoot } from '../ranges/EditorRoot';
import { loadRankedHands } from "../ranges/rangeData";
import { generateHandGridOrder } from "../core/handOrder";
import { loadSettings, saveSettings } from "../core/settings";
import {
  loadRangeSets,
  saveRangeSets,
  findRangeSetById,
  findScenarioById
} from "../core/ranges";
import type {
  RangeSet,
  RangeScenario,
  Position,
  ScenarioType,
  HandCode,
  HandDecision
} from "../core/types";

// Vite の BASE_URL を考慮して ranges_6max.json にアクセスするためのヘルパー
interface ImportMetaEnvLike {
  env?: {
    BASE_URL?: string;
  };
}

const EDITOR_BASE_URL =
  ((import.meta as unknown as ImportMetaEnvLike).env?.BASE_URL) ?? "/";
const EDITOR_RANGE_DATA_URL = `${EDITOR_BASE_URL}data/ranges_6max.json`;

type RankedJsonHand = {
  hand: string;
  rank?: number;
};

export function initEditorReact() {
  const rootEl = document.getElementById('editor-react-root');
  if (!rootEl) return;
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(EditorRoot));
}

const POSITIONS: Position[] = ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"];

const SCENARIO_TYPES: { value: ScenarioType; label: string }[] = [
  { value: "OPEN", label: "オープン" },
  { value: "THREE_BET", label: "3Bet" },
  { value: "FOUR_BET", label: "4Bet" }
];

const RANKS: string[] = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

// hand grid のグローバルイベントを一度だけ貼るためのフラグ
let handGridGlobalEventsInitialized = false;

export function renderEditorView(): string {
  const settings = loadSettings();
  const rangeSets = loadRangeSets();

  if (rangeSets.length === 0) {
    return `
      <div class="section">
        <h3>レンジエディター</h3>
        <p style="font-size:13px;color:#6b7280;">
          レンジセットが存在しません。アプリ再起動かデータリセットを試してください。
        </p>
      </div>
    `;
  }

  let activeRangeSet: RangeSet | null = findRangeSetById(rangeSets, settings.activeRangeSetId);
  if (!activeRangeSet) {
    activeRangeSet = rangeSets[0];
    settings.activeRangeSetId = activeRangeSet.meta.id;
    saveSettings(settings);
  }

  const rangeOptions = rangeSets
    .map((rs) => {
      const selected = activeRangeSet && rs.meta.id === activeRangeSet.meta.id ? "selected" : "";
      return `<option value="${rs.meta.id}" ${selected}>${rs.meta.name}</option>`;
    })
    .join("");

const activeScenario: RangeScenario | null =
  activeRangeSet
    ? findScenarioById([activeRangeSet], settings.activeScenarioId)
    : null;

  const scenarioOptions = activeRangeSet.scenarios
    .map((sc) => {
      const selected = activeScenario && sc.id === activeScenario.id ? "selected" : "";
      return `<option value="${sc.id}" ${selected}>${sc.name}</option>`;
    })
    .join("");

  const canDeleteRangeSet = rangeSets.length > 1;
  const hasScenario = activeRangeSet.scenarios.length > 0;

  const scenarioDetailHtml = activeScenario
    ? renderScenarioDetail(activeScenario)
    : `
      <div class="section">
        <h3>シナリオ詳細</h3>
        <p style="font-size:13px;color:#6b7280;">
          このレンジセットにはまだシナリオがありません。<br>
          下のフォームから新規シナリオを作成してください。
        </p>
      </div>
    `;

  const handEditorHtml = activeScenario ? renderHandEditor(activeScenario) : "";
  const handGridHtml = activeScenario ? renderHandGridSection(activeScenario) : "";

  const activeRangeSetName = activeRangeSet.meta.name;
  const activeScenarioName = activeScenario ? activeScenario.name : "";

  return `
    <div class="section">
      <h3>レンジセット</h3>

      <div class="settings-row">
        <div class="label">選択中のレンジセット</div>
        <select id="editorRangeSetSelect" class="select">
          ${rangeOptions}
        </select>
      </div>

      <!-- ★ 追加: レンジセット名の編集行 -->
      <div class="settings-row">
        <div class="label">レンジセット名</div>
        <div class="row" style="gap:6px;">
          <input
            id="currentRangeSetNameInput"
            class="input"
            type="text"
            value="${escapeHtml(activeRangeSetName)}"
          />
          <button id="saveRangeSetNameBtn" class="button button-secondary">
            名前を保存
          </button>
        </div>
      </div>

      <div class="settings-row">
        <input
          id="newRangeSetNameInput"
          class="input"
          placeholder="新規レンジセット名（例: 3Bet vs UTG）"
        />
      </div>
      <div class="row">
        <button id="createRangeSetBtn" class="button button-secondary">新規レンジセット</button>
        <button id="deleteRangeSetBtn" class="button button-secondary" ${canDeleteRangeSet ? "" : "disabled"}>
          削除
        </button>
      </div>
      <div class="row" style="margin-top:8px;gap:6px;">
        <button id="exportRangeSetBtn" class="button button-secondary" type="button">
          エクスポート
        </button>
        <button id="importRangeSetBtn" class="button button-secondary" type="button">
          インポート
        </button>
        <input
          id="importRangeFileInput"
          type="file"
          accept="application/json"
          style="display:none;"
        />
      </div>
    </div>

    <div class="section">
      <h3>シナリオ</h3>
      <div class="settings-row">
        <div class="label">選択中のシナリオ</div>
        <select id="editorScenarioSelect" class="select">
          ${scenarioOptions || `<option value="">（シナリオなし）</option>`}
        </select>
      </div>

      <!-- ★ 追加: シナリオ名の編集行 -->
      <div class="settings-row">
        <div class="label">シナリオ名</div>
        <div class="row" style="gap:6px;">
          <input
            id="currentScenarioNameInput"
            class="input"
            type="text"
            value="${escapeHtml(activeScenarioName)}"
            ${hasScenario ? "" : "disabled"}
          />
          <button
            id="saveScenarioNameBtn"
            class="button button-secondary"
            ${hasScenario ? "" : "disabled"}
          >
            名前を保存
          </button>
        </div>
      </div>

      <div class="settings-row">
        <div class="label">新規シナリオ作成</div>
        <input
          id="newScenarioNameInput"
          class="input"
          placeholder="シナリオ名（例: BTN 3Bet vs UTG）"
        />
      </div>

      <div class="settings-row">
        <div class="row">
          <div>
            <div class="label">自分のポジション</div>
            <select id="newScenarioHeroPosition" class="select">
              ${POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join("")}
            </select>
          </div>
          <div>
            <div class="label">相手のポジション</div>
            <select id="newScenarioVillainPosition" class="select">
              <option value="">（なし）</option>
              ${POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div class="row">
          <div>
            <div class="label">シナリオタイプ</div>
            <select id="newScenarioType" class="select">
              ${SCENARIO_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("")}
            </select>
          </div>
          <div>
            <div class="label">スタックBB</div>
            <input
              id="newScenarioStackSize"
              class="input"
              type="number"
              inputmode="numeric"
              pattern="[0-9]*"
              value="40"
            />
          </div>
        </div>
      </div>

      <div class="row">
        <button id="createScenarioBtn" class="button button-secondary">新規シナリオ</button>
        <button id="deleteScenarioBtn" class="button button-secondary" ${hasScenario ? "" : "disabled"}>
          シナリオ削除
        </button>
      </div>
    </div>

    ${scenarioDetailHtml}
    ${handEditorHtml}
    ${handGridHtml}
    
    <div class="section">
      <h3>レンジビジュアライザー（React版）</h3>
      <div id="editor-react-root" class="editor-react-root"></div>
    </div>
    `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderScenarioDetail(s: RangeScenario): string {
  const handCount = Object.keys(s.hands).length;

  // ★ フォールバックを定義
  const heroPos = (s as any).heroPosition ?? s.position ?? "（未設定）";
  const villainPos = (s as any).villainPosition ?? "（なし）";
  const scenarioType: ScenarioType =
    (s.scenarioType as ScenarioType) ?? "OPEN";
  const stackSize = s.stackSizeBB ?? 100;

  return `
    <div class="section">
      <h3>シナリオ詳細</h3>
      <p style="font-size:13px;">
        名前: <strong>${s.name}</strong><br>
        自分のポジション: <strong>${heroPos}</strong><br>
        相手のポジション: <strong>${villainPos}</strong><br>
        タイプ: <strong>${scenarioTypeLabel(scenarioType)}</strong><br>
        スタック: <strong>${stackSize} BB</strong><br>
        登録ハンド数: <strong>${handCount}</strong>
      </p>
    </div>
  `;
}

function scenarioTypeLabel(t: ScenarioType): string {
  const found = SCENARIO_TYPES.find((x) => x.value === t);
  return found ? found.label : t;
}

function renderHandEditor(s: RangeScenario): string {
  const hands = s.hands;

  // 🔹 13×13グリッド順（AA, KK, ..., 22 / suited / offsuit）の全ハンド
  const order = generateHandGridOrder();

  const rowsHtml = order
    .map((code: HandCode, index: number) => {
      // シナリオに既にあるハンドはそれを使う、なければデフォルト 0/0/100
      const d: HandDecision | undefined = hands[code];
      const raise = d?.raise ?? 0;
      const call = d?.call ?? 0;
      const fold = d?.fold ?? Math.max(0, 100 - raise - call);

      return `
      <div class="hand-row" data-hand="${code}" data-index="${index}">
        <button class="hand-row-header" type="button">
          <div class="hand-row-header-left">
            <span class="hand-row-code">${code}</span>
            <span class="hand-row-summary">R ${raise}% / C ${call}% / F ${fold}%</span>
          </div>
          <span class="hand-row-toggle">▼</span>
        </button>
        <div class="hand-row-body" style="display:none;">
          <div class="settings-row">
            <div class="label">RAISE (%)</div>
            <input
              type="number"
              inputmode="numeric"
              pattern="[0-9]*"
              min="0"
              max="100"
              class="input hand-raise-input"
              value="${raise}"
            />
          </div>
          <div class="settings-row">
            <div class="label">CALL (%)</div>
            <input
              type="number"
              inputmode="numeric"
              pattern="[0-9]*"
              min="0"
              max="100"
              class="input hand-call-input"
              value="${call}"
            />
          </div>
          <div class="settings-row">
            <div class="label">FOLD (%)</div>
            <div class="input" style="background:#f3f4f6;border-style:dashed;">
              <span class="hand-fold-display">${fold}</span>%
            </div>
          </div>
          <div class="hand-error" style="display:none;"></div>
          <div class="hand-save-row">
            <button class="button hand-save-button">保存して次へ</button>
          </div>
        </div>
      </div>
      `;
    })
    .join("");

  return `
  <div class="section">
    <h3 class="hand-editor-section-title">ハンド編集</h3>
    <p style="font-size:11px;color:#6b7280;margin-top:0;">
      RAISE / CALL を入力すると FOLD は自動計算されます。<br>
      RAISE + CALL が 100 を超えるとエラーになります。
    </p>
    <div class="hand-accordion-list">
      ${rowsHtml}
    </div>
  </div>
  `;
}

function renderHandGridSection(scenario: RangeScenario): string {
  const enabled = new Set<HandCode>(scenario.enabledHandCodes ?? []);

  const cellsHtml: string[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      const rowRank = RANKS[i];
      const colRank = RANKS[j];

      let code: HandCode;
      if (i === j) {
        code = (rowRank + colRank) as HandCode; // AA, KK, ...
      } else if (i < j) {
        code = (rowRank + colRank + "s") as HandCode; // AKs
      } else {
        code = (colRank + rowRank + "o") as HandCode; // AKo
      }

      const isActive = enabled.has(code);
      cellsHtml.push(`
        <div class="hand-grid-cell ${isActive ? "active" : ""}" data-hand="${code}">
          ${code}
        </div>
      `);
    }
  }

  return `
    <div class="section">
      <h3 class="hand-grid-section-title">ハンドグリッド（出題範囲）</h3>
      <p class="hand-grid-description">
        タップでハンドのON/OFFを切り替えできます。<br>
        ONのハンドだけがこのシナリオで出題候補になります。
      </p>
      <div class="hand-grid-toolbar" style="display:flex;flex-direction:column;gap:6px;">
        <div class="row" style="gap:4px;flex-wrap:wrap;">
          <button id="handGridPreset25" class="button button-secondary" type="button">Top 25%</button>
          <button id="handGridPreset45" class="button button-secondary" type="button">Top 45%</button>
          <button id="handGridPreset50" class="button button-secondary" type="button">Top 50%</button>
          <button id="handGridPreset75" class="button button-secondary" type="button">Top 75%</button>
        </div>
        <div class="row" style="gap:4px;">
          <button id="handGridAllOnBtn" class="button button-secondary" type="button">全てON</button>
          <button id="handGridAllOffBtn" class="button button-secondary" type="button">全てOFF</button>
        </div>
      </div>
      <div class="hand-grid">
        ${cellsHtml.join("")}
      </div>
    </div>
  `;
}

export function initEditorViewEvents() {
  const rangeSetSelect = document.getElementById("editorRangeSetSelect") as HTMLSelectElement | null;
  const newRangeSetNameInput = document.getElementById("newRangeSetNameInput") as HTMLInputElement | null;
  const createRangeSetBtn = document.getElementById("createRangeSetBtn") as HTMLButtonElement | null;
  const deleteRangeSetBtn = document.getElementById("deleteRangeSetBtn") as HTMLButtonElement | null;

  const exportRangeSetBtn = document.getElementById("exportRangeSetBtn") as HTMLButtonElement | null;
  const importRangeSetBtn = document.getElementById("importRangeSetBtn") as HTMLButtonElement | null;
  const importRangeFileInput = document.getElementById("importRangeFileInput") as HTMLInputElement | null;

  const scenarioSelect = document.getElementById("editorScenarioSelect") as HTMLSelectElement | null;
  const newScenarioNameInput = document.getElementById("newScenarioNameInput") as HTMLInputElement | null;
  const heroSelect = document.getElementById("newScenarioHeroPosition") as HTMLSelectElement | null;
  const villainSelect = document.getElementById("newScenarioVillainPosition") as HTMLSelectElement | null;
  const typeSelect = document.getElementById("newScenarioType") as HTMLSelectElement | null;
  const stackInput = document.getElementById("newScenarioStackSize") as HTMLInputElement | null;
  const createScenarioBtn = document.getElementById("createScenarioBtn") as HTMLButtonElement | null;
  const deleteScenarioBtn = document.getElementById("deleteScenarioBtn") as HTMLButtonElement | null;

  // 名前編集用
  const currentRangeSetNameInput = document.getElementById(
    "currentRangeSetNameInput"
  ) as HTMLInputElement | null;
  const saveRangeSetNameBtn = document.getElementById(
    "saveRangeSetNameBtn"
  ) as HTMLButtonElement | null;

  const currentScenarioNameInput = document.getElementById(
    "currentScenarioNameInput"
  ) as HTMLInputElement | null;
  const saveScenarioNameBtn = document.getElementById(
    "saveScenarioNameBtn"
  ) as HTMLButtonElement | null;

  // レンジセット選択変更
  if (rangeSetSelect) {
    rangeSetSelect.addEventListener("change", () => {
      const settings = loadSettings();
      settings.activeRangeSetId = rangeSetSelect.value || null;
      settings.activeScenarioId = null;
      saveSettings(settings);
      rerenderEditorView();
    });
  }

  // レンジセット名の保存
  if (currentRangeSetNameInput && saveRangeSetNameBtn && rangeSetSelect) {
    saveRangeSetNameBtn.addEventListener("click", () => {
      const newName = currentRangeSetNameInput.value.trim();
      if (!newName) {
        alert("レンジセット名を入力してください。");
        return;
      }

      const rangeSetId = rangeSetSelect.value;
      const rangeSets = loadRangeSets();
      const target = findRangeSetById(rangeSets, rangeSetId);

      if (!target) {
        alert("レンジセットが見つかりません。");
        return;
      }

      target.meta.name = newName;
      target.meta.updatedAt = new Date().toISOString();
      saveRangeSets(rangeSets);

      const settings = loadSettings();
      settings.activeRangeSetId = rangeSetId;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // 新規レンジセット作成
  if (createRangeSetBtn) {
    createRangeSetBtn.addEventListener("click", () => {
      const settings = loadSettings();
      const rangeSets = loadRangeSets();

      const name = (newRangeSetNameInput?.value.trim() || "") || "新規レンジセット";
      const now = new Date().toISOString();
      const id = `rangeset_${Date.now()}`;

      const newSet: RangeSet = {
        meta: {
          id,
          name,
          description: "",
          createdAt: now,
          updatedAt: now,
          gameType: "8max_BB_ante",
          version: 1
        },
        scenarios: []
      };

      rangeSets.push(newSet);
      saveRangeSets(rangeSets);

      settings.activeRangeSetId = id;
      settings.activeScenarioId = null;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // レンジセット削除
  if (deleteRangeSetBtn) {
    deleteRangeSetBtn.addEventListener("click", () => {
      const settings = loadSettings();
      const rangeSets = loadRangeSets();
      if (rangeSets.length <= 1) {
        alert("最後のレンジセットは削除できません。");
        return;
      }

      const currentId = settings.activeRangeSetId ?? rangeSets[0].meta.id;
      const rs = rangeSets.find((r) => r.meta.id === currentId);
      if (!rs) return;

      const ok = confirm(`レンジセット「${rs.meta.name}」を削除しますか？\n元に戻せません。`);
      if (!ok) return;

      const filtered = rangeSets.filter((r) => r.meta.id !== rs.meta.id);
      saveRangeSets(filtered);

      const newActive = filtered[0];
      settings.activeRangeSetId = newActive?.meta.id ?? null;
      settings.activeScenarioId = null;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // レンジセット エクスポート
  if (exportRangeSetBtn) {
    exportRangeSetBtn.addEventListener("click", () => {
      const settings = loadSettings();
      const rangeSets = loadRangeSets();

      let rangeSet = findRangeSetById(rangeSets, settings.activeRangeSetId);
      if (!rangeSet && rangeSets.length > 0) {
        rangeSet = rangeSets[0];
      }
      if (!rangeSet) {
        alert("エクスポートするレンジセットがありません。");
        return;
      }

      const json = JSON.stringify(rangeSet, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      a.href = url;
      a.download = `rangeset_${rangeSet.meta.id}_${y}${m}${d}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // レンジセット インポート
  if (importRangeSetBtn && importRangeFileInput) {
    importRangeSetBtn.addEventListener("click", () => {
      importRangeFileInput.value = "";
      importRangeFileInput.click();
    });

    importRangeFileInput.addEventListener("change", () => {
      const file = importRangeFileInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          const raw = JSON.parse(text);
          const imported = validateImportedRangeSet(raw);

          const rangeSets = loadRangeSets();
          const existingIndex = rangeSets.findIndex(
            (rs) => rs.meta.id === imported.meta.id
          );

          const now = new Date().toISOString();
          if (!imported.meta.createdAt) imported.meta.createdAt = now;
          imported.meta.updatedAt = now;
          if (!imported.meta.version) imported.meta.version = 1;
          if (!imported.meta.gameType) imported.meta.gameType = "8max_BB_ante";

          if (existingIndex >= 0) {
            const overwrite = window.confirm(
              `同じIDのレンジセット「${rangeSets[existingIndex].meta.name}」が存在します。\n\nOK: 上書き\nキャンセル: 新しいIDで追加`
            );
            if (overwrite) {
              rangeSets[existingIndex] = imported;
            } else {
              imported.meta.id = `import_${Date.now()}`;
              imported.meta.name = `${imported.meta.name} (imported)`;
              rangeSets.push(imported);
            }
          } else {
            rangeSets.push(imported);
          }

          saveRangeSets(rangeSets);

          const settings = loadSettings();
          settings.activeRangeSetId = imported.meta.id;
          settings.activeScenarioId = imported.scenarios[0]?.id ?? null;
          saveSettings(settings);

          rerenderEditorView();
          alert("レンジセットをインポートしました。");
        } catch (e) {
          console.error(e);
          alert("レンジセットJSONの読み込みまたは形式チェックに失敗しました。ファイル内容を確認してください。");
        }
      };

      reader.onerror = () => {
        alert("ファイルの読み込み中にエラーが発生しました。");
      };

      reader.readAsText(file);
    });
  }

  // シナリオ名の保存
  if (currentScenarioNameInput && saveScenarioNameBtn && rangeSetSelect && scenarioSelect) {
    saveScenarioNameBtn.addEventListener("click", () => {
      const newName = currentScenarioNameInput.value.trim();
      if (!newName) {
        alert("シナリオ名を入力してください。");
        return;
      }

      const rangeSetId = rangeSetSelect.value;
      const scenarioId = scenarioSelect.value;

      const rangeSets = loadRangeSets();
      const target = findRangeSetById(rangeSets, rangeSetId);
      if (!target) {
        alert("レンジセットが見つかりません。");
        return;
      }

      const scenario = findScenarioById([target], scenarioId);
      if (!scenario) {
        alert("シナリオが見つかりません。");
        return;
      }

      scenario.name = newName;
      target.meta.updatedAt = new Date().toISOString();
      saveRangeSets(rangeSets);

      const settings = loadSettings();
      settings.activeRangeSetId = rangeSetId;
      settings.activeScenarioId = scenarioId;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // シナリオ選択変更
  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", () => {
      const settings = loadSettings();
      settings.activeScenarioId = scenarioSelect.value || null;
      saveSettings(settings);
      rerenderEditorView();
    });
  }

  // 新規シナリオ作成
  if (createScenarioBtn) {
    createScenarioBtn.addEventListener("click", () => {
      const settings = loadSettings();
      const rangeSets = loadRangeSets();
      const rangeSet = findRangeSetById(rangeSets, settings.activeRangeSetId);
      if (!rangeSet) {
        alert("先にレンジセットを選択してください。");
        return;
      }

      const name = (newScenarioNameInput?.value.trim() || "") || "新規シナリオ";
      const hero = (heroSelect?.value || "BTN") as Position;
      const villainRaw = villainSelect?.value || "";
      const villain = (villainRaw || undefined) as Position | undefined;
      const type = (typeSelect?.value || "OPEN") as ScenarioType;
      const stack = parseInt(stackInput?.value || "40", 10) || 40;

      const id = `sc_${Date.now()}`;
      const now = new Date().toISOString();

      const newScenario: RangeScenario = {
        id,
        name,
        heroPosition: hero,
        villainPosition: villain,
        scenarioType: type,
        stackSizeBB: stack,
        hands: {},
        enabledHandCodes: []
      };

      rangeSet.scenarios.push(newScenario);
      rangeSet.meta.updatedAt = now;
      saveRangeSets(rangeSets);

      settings.activeScenarioId = id;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // シナリオ削除
  if (deleteScenarioBtn) {
    deleteScenarioBtn.addEventListener("click", () => {
      const settings = loadSettings();
      const rangeSets = loadRangeSets();
      const rangeSet = findRangeSetById(rangeSets, settings.activeRangeSetId);
      if (!rangeSet) return;

      if (rangeSet.scenarios.length === 0) return;

    const currentScenario =
      findScenarioById([rangeSet], settings.activeScenarioId) ??
      rangeSet.scenarios[0];
      if (!currentScenario) return;

      const ok = confirm(`シナリオ「${currentScenario.name}」を削除しますか？\n元に戻せません。`);
      if (!ok) return;

      rangeSet.scenarios = rangeSet.scenarios.filter((sc) => sc.id !== currentScenario.id);
      rangeSet.meta.updatedAt = new Date().toISOString();
      saveRangeSets(rangeSets);

      const nextScenario = rangeSet.scenarios[0];
      settings.activeScenarioId = nextScenario?.id ?? null;
      saveSettings(settings);

      rerenderEditorView();
    });
  }

  // ハンドエディターのイベント
  const settingsForDetail = loadSettings();
  const rangeSetsForDetail = loadRangeSets();
  const rangeSetForDetail = findRangeSetById(
    rangeSetsForDetail,
    settingsForDetail.activeRangeSetId
  );

  const scenarioForDetail =
    rangeSetForDetail
      ? findScenarioById([rangeSetForDetail], settingsForDetail.activeScenarioId)
      : null;

  if (rangeSetForDetail && scenarioForDetail) {
    initHandEditorEvents(rangeSetsForDetail, rangeSetForDetail, scenarioForDetail);
  }

  // hand grid のグローバルイベントを一度だけ貼る
  initGlobalHandGridEvents();

  // React レンジビジュアライザーをマウント
  initEditorReact();
}

function initHandEditorEvents(
  rangeSets: RangeSet[],
  rangeSet: RangeSet,
  scenario: RangeScenario
) {
  const rows = document.querySelectorAll<HTMLDivElement>(".hand-row");

  rows.forEach((row, index) => {
    const code = row.getAttribute("data-hand") as HandCode | null;
    if (!code) return;

    const header = row.querySelector<HTMLButtonElement>(".hand-row-header");
    const body = row.querySelector<HTMLDivElement>(".hand-row-body");
    const raiseInput = row.querySelector<HTMLInputElement>(".hand-raise-input");
    const callInput = row.querySelector<HTMLInputElement>(".hand-call-input");
    const foldDisplay = row.querySelector<HTMLSpanElement>(".hand-fold-display");
    const errorEl = row.querySelector<HTMLDivElement>(".hand-error");
    const saveBtn = row.querySelector<HTMLButtonElement>(".hand-save-button");
    const summaryEl = row.querySelector<HTMLSpanElement>(".hand-row-summary");

    if (!header || !body || !raiseInput || !callInput || !foldDisplay || !errorEl || !saveBtn || !summaryEl) return;

    header.addEventListener("click", () => {
      const isOpen = body.style.display !== "none";
      body.style.display = isOpen ? "none" : "block";
      const toggle = header.querySelector<HTMLSpanElement>(".hand-row-toggle");
      if (toggle) toggle.textContent = isOpen ? "▼" : "▲";
    });

    const updateFoldAndValidate = () => {
      const r = clampInt(raiseInput.value);
      const c = clampInt(callInput.value);
      const sum = r + c;
      let valid = true;

      if (sum > 100) {
        errorEl.style.display = "block";
        errorEl.textContent = `RAISE と CALL の合計は 100% 以下にしてください。（現在 ${sum}%）`;
        valid = false;
      } else {
        errorEl.style.display = "none";
        const f = 100 - sum;
        foldDisplay.textContent = String(f);
      }

      saveBtn.disabled = !valid;
    };

    raiseInput.addEventListener("input", updateFoldAndValidate);
    callInput.addEventListener("input", updateFoldAndValidate);

    updateFoldAndValidate();

    saveBtn.addEventListener("click", () => {
      const r = clampInt(raiseInput.value);
      const c = clampInt(callInput.value);
      const sum = r + c;

      if (sum > 100) {
        errorEl.style.display = "block";
        errorEl.textContent = `RAISE と CALL の合計は 100% 以下にしてください。（現在 ${sum}%）`;
        return;
      }

      const f = 100 - sum;

      scenario.hands[code] = { raise: r, call: c, fold: f };
      if (!scenario.enabledHandCodes.includes(code)) {
        scenario.enabledHandCodes.push(code);
      }
      rangeSet.meta.updatedAt = new Date().toISOString();
      saveRangeSets(rangeSets);

      summaryEl.textContent = `R ${r}% / C ${c}% / F ${f}%`;

      body.style.display = "none";
      const toggle = header.querySelector<HTMLSpanElement>(".hand-row-toggle");
      if (toggle) toggle.textContent = "▼";

      const nextRow = rows[index + 1];
      if (nextRow) {
        const nextHeader = nextRow.querySelector<HTMLButtonElement>(".hand-row-header");
        const nextBody = nextRow.querySelector<HTMLDivElement>(".hand-row-body");
        if (nextHeader && nextBody) {
          nextBody.style.display = "block";
          const t = nextHeader.querySelector<HTMLSpanElement>(".hand-row-toggle");
          if (t) t.textContent = "▲";
        }
      }
    });
  });
}

function initGlobalHandGridEvents() {
  if (handGridGlobalEventsInitialized) return;
  handGridGlobalEventsInitialized = true;

  document.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    // セルクリック
    const cell = target.closest<HTMLDivElement>(".hand-grid-cell");
    if (cell) {
      const code = cell.getAttribute("data-hand") as HandCode | null;
      if (!code) return;

      const { rangeSets, rangeSet, scenario } = getActiveRangeSetAndScenario();
      if (!rangeSets || !rangeSet || !scenario) return;

      const enabled = new Set<HandCode>(scenario.enabledHandCodes ?? []);

      if (enabled.has(code)) {
        enabled.delete(code);
        cell.classList.remove("active");
      } else {
        enabled.add(code);
        cell.classList.add("active");
      }

      persistEnabled(rangeSets, rangeSet, scenario, enabled);
      return;
    }

    // 全てON
    const allOnBtn = target.closest<HTMLButtonElement>("#handGridAllOnBtn");
    if (allOnBtn) {
      const { rangeSets, rangeSet, scenario } = getActiveRangeSetAndScenario();
      if (!rangeSets || !rangeSet || !scenario) return;

      const enabled = new Set<HandCode>();
      const allCodes = getAllHandCodes();
      allCodes.forEach((c) => enabled.add(c));

      syncCellsFromSet(enabled);
      persistEnabled(rangeSets, rangeSet, scenario, enabled);
      return;
    }

    // 全てOFF
    const allOffBtn = target.closest<HTMLButtonElement>("#handGridAllOffBtn");
    if (allOffBtn) {
      const { rangeSets, rangeSet, scenario } = getActiveRangeSetAndScenario();
      if (!rangeSets || !rangeSet || !scenario) return;

      const enabled = new Set<HandCode>();

      syncCellsFromSet(enabled);
      persistEnabled(rangeSets, rangeSet, scenario, enabled);
      return;
    }

    // プリセットボタン
    const preset25Btn = target.closest<HTMLButtonElement>("#handGridPreset25");
    if (preset25Btn) {
      applyHandGridPreset(0.25);
      return;
    }

    const preset45Btn = target.closest<HTMLButtonElement>("#handGridPreset45");
    if (preset45Btn) {
      applyHandGridPreset(0.45);
      return;
    }

    const preset50Btn = target.closest<HTMLButtonElement>("#handGridPreset50");
    if (preset50Btn) {
      applyHandGridPreset(0.5);
      return;
    }

    const preset75Btn = target.closest<HTMLButtonElement>("#handGridPreset75");
    if (preset75Btn) {
      applyHandGridPreset(0.75);
      return;
    }
  });
}

/**
 * プリセットボタン用：
 * ratio に応じて JSON の rank でしきい値を決めて、
 * rank <= しきい値 のハンドをすべて有効にする。
 *
 * 例:
 *  - ratio = 0.25 → rank <= 25
 *  - ratio = 0.50 → rank <= 50
 */
async function applyHandGridPreset(ratio: number) {
  const { rangeSets, rangeSet, scenario } = getActiveRangeSetAndScenario();
  if (!rangeSets || !rangeSet || !scenario) return;

  try {
    const res = await fetch(EDITOR_RANGE_DATA_URL);
    if (!res.ok) {
      console.error(
        "Failed to load ranges_6max.json for preset",
        res.status,
        res.statusText,
      );
      return;
    }

    const json = (await res.json()) as { hands?: RankedJsonHand[] };
    const hands = Array.isArray(json.hands) ? json.hands : [];

    // rank が付いているハンドだけ対象にする
    const rankedHands = hands.filter(
      (h) => typeof h.rank === "number" && typeof h.hand === "string",
    );

    if (rankedHands.length === 0) {
      console.warn("No ranked hands found in ranges_6max.json");
      return;
    }

    // 169ハンドを前提に、rank 上位 ratio 分を選択する。
    //  0.25 → 上位 42 ハンド前後
    //  0.50 → 上位 84 ハンド前後
    //  0.75 → 上位 127 ハンド前後
    const TOTAL_HANDS = 169;

    // ratio からしきい値 rank を計算
    const threshold = Math.max(1, Math.round(TOTAL_HANDS * ratio));

    const enabled = new Set<HandCode>();

    for (const h of rankedHands) {
      const r = h.rank;
      if (typeof r === "number" && r <= threshold) {
        enabled.add(h.hand.trim() as HandCode);
      }
    }

    // グリッドUIに反映 & RangeSet に保存
    syncCellsFromSet(enabled);
    persistEnabled(rangeSets, rangeSet, scenario, enabled);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to apply JSON-ranked preset", e);
  }
}

function getActiveRangeSetAndScenario(): {
  rangeSets: RangeSet[] | null;
  rangeSet: RangeSet | null;
  scenario: RangeScenario | null;
} {
  const settings = loadSettings();
  const rangeSets = loadRangeSets();
  const rangeSet = findRangeSetById(rangeSets, settings.activeRangeSetId);
  const scenario =
    rangeSet
      ? findScenarioById([rangeSet], settings.activeScenarioId)
      : null;
  if (!rangeSet || !scenario) {
    return { rangeSets: null, rangeSet: null, scenario: null };
  }
  return { rangeSets, rangeSet, scenario };
}

function persistEnabled(
  rangeSets: RangeSet[],
  rangeSet: RangeSet,
  scenario: RangeScenario,
  enabled: Set<HandCode>
) {
  const ordered = orderHandCodes(Array.from(enabled));
  scenario.enabledHandCodes = ordered;

  // ON にしたハンドで HandDecision が無いものは自動で作る（F 100%）
  for (const code of ordered) {
    if (!scenario.hands[code]) {
      scenario.hands[code] = {
        raise: 0,
        call: 0,
        fold: 100
      };
    }
  }

  rangeSet.meta.updatedAt = new Date().toISOString();
  saveRangeSets(rangeSets);
}

function getAllHandCodes(): HandCode[] {
  const result: HandCode[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      const rowRank = RANKS[i];
      const colRank = RANKS[j];

      let code: HandCode;
      if (i === j) {
        code = (rowRank + colRank) as HandCode;
      } else if (i < j) {
        code = (rowRank + colRank + "s") as HandCode;
      } else {
        code = (colRank + rowRank + "o") as HandCode;
      }
      result.push(code);
    }
  }
  return result;
}

function orderHandCodes(codes: HandCode[]): HandCode[] {
const order = generateHandGridOrder();
const indexMap = new Map<HandCode, number>();
order.forEach((c: HandCode, idx: number) => {
  indexMap.set(c, idx);
});
  return [...codes].sort((a, b) => {
    const ia = indexMap.get(a) ?? 9999;
    const ib = indexMap.get(b) ?? 9999;
    return ia - ib;
  });
}

function syncCellsFromSet(enabled: Set<HandCode>) {
  const cells = document.querySelectorAll<HTMLDivElement>(".hand-grid-cell");
  cells.forEach((cell) => {
    const code = cell.getAttribute("data-hand") as HandCode | null;
    if (!code) return;
    if (enabled.has(code)) {
      cell.classList.add("active");
    } else {
      cell.classList.remove("active");
    }
  });
}

function clampInt(value: string): number {
  const n = parseInt(value || "0", 10);
  if (isNaN(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function rerenderEditorView() {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = renderEditorView();
  initEditorViewEvents();
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toSafeInt(v: any, fallback = 0): number {
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) return fallback;
  return n;
}

/**
 * インポートした JSON を RangeSet としてざっくりバリデーション＆整形
 */
function validateImportedRangeSet(raw: any): RangeSet {
  if (!isPlainObject(raw)) {
    throw new Error("ルートがオブジェクトではありません。");
  }

  const metaRaw = raw.meta;
  const scenariosRaw = raw.scenarios;

  if (!isPlainObject(metaRaw)) {
    throw new Error("meta がオブジェクトではありません。");
  }
  if (!Array.isArray(scenariosRaw)) {
    throw new Error("scenarios が配列ではありません。");
  }

  const metaId = String(metaRaw.id ?? "").trim();
  const metaName = String(metaRaw.name ?? "").trim();

  if (!metaId) throw new Error("meta.id がありません。");
  if (!metaName) throw new Error("meta.name がありません。");

  const meta: RangeSet["meta"] = {
    id: metaId,
    name: metaName,
    description: typeof metaRaw.description === "string" ? metaRaw.description : "",
    createdAt: typeof metaRaw.createdAt === "string" ? metaRaw.createdAt : "",
    updatedAt: typeof metaRaw.updatedAt === "string" ? metaRaw.updatedAt : "",
    gameType: typeof metaRaw.gameType === "string" ? metaRaw.gameType : "8max_BB_ante",
    version: typeof metaRaw.version === "number" ? metaRaw.version : 1
  };

  const scenarios: RangeScenario[] = scenariosRaw.map((s: any, idx: number) => {
    if (!isPlainObject(s)) {
      throw new Error(`scenarios[${idx}] がオブジェクトではありません。`);
    }

    const id = String(s.id ?? `sc_import_${idx}`);
    const name = String(s.name ?? `Imported Scenario ${idx + 1}`);

    const heroPosition = s.heroPosition as Position;
    const villainPosition = (s.villainPosition ?? undefined) as Position | undefined;
    const scenarioType = s.scenarioType as ScenarioType;
    const stackSizeBB = toSafeInt(s.stackSizeBB, 40);

    const handsRaw = s.hands ?? {};
    const enabledRaw = s.enabledHandCodes ?? [];

    const hands: Record<HandCode, HandDecision> = {};
    if (isPlainObject(handsRaw)) {
      for (const key of Object.keys(handsRaw)) {
        const d = (handsRaw as any)[key] ?? {};
        let r = toSafeInt(d.raise, 0);
        let c = toSafeInt(d.call, 0);
        let f = toSafeInt(d.fold, 0);

        if (r < 0) r = 0;
        if (c < 0) c = 0;
        if (f < 0) f = 0;

        if (r + c > 100) {
          const over = r + c;
          const scale = 100 / over;
          r = Math.round(r * scale);
          c = Math.round(c * scale);
        }
        f = 100 - (r + c);

        hands[key as HandCode] = {
          raise: r,
          call: c,
          fold: f
        };
      }
    }

    let enabledHandCodes: HandCode[] = [];
    if (Array.isArray(enabledRaw)) {
      enabledHandCodes = enabledRaw.map((h: any) => String(h)) as HandCode[];
    } else {
      enabledHandCodes = Object.keys(hands) as HandCode[];
    }

    // enabledHandCodes に存在するが hands に定義が無いものは F100 で補完
    for (const code of enabledHandCodes) {
      if (!hands[code]) {
        hands[code] = { raise: 0, call: 0, fold: 100 };
      }
    }

    return {
      id,
      name,
      heroPosition,
      villainPosition,
      scenarioType,
      stackSizeBB,
      hands,
      enabledHandCodes
    };
  });

  return {
    meta,
    scenarios
  };
}
