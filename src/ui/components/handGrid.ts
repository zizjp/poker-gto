import type { RangeScenario, HandCode, RangeSet, Position } from "../../core/types";
import { saveRangeSets } from "../../core/ranges";
import { generateHandGridOrder } from "../../core/handOrder";
import { loadRangeData } from "../../ranges/rangeData";

const RANKS: string[] = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

/**
 * シナリオに紐づく有効ハンドグリッドのセクションHTMLを返す
 */
export function renderHandGridSection(scenario: RangeScenario): string {
  const enabled = new Set<HandCode>(scenario.enabledHandCodes);

  const cellsHtml: string[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      const rowRank = RANKS[i];
      const colRank = RANKS[j];
      let code: HandCode;
      if (i === j) {
        code = (rowRank + colRank) as HandCode; // AA, KK, ...
      } else if (i < j) {
        // 上三角: suited
        code = (rowRank + colRank + "s") as HandCode; // AKs
      } else {
        // 下三角: offsuit
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

/**
 * グリッドのクリックイベントなどを初期化
 * editorView 側から rangeSets / rangeSet / scenario を渡して呼ぶ
 */
export function initHandGridEvents(
  rangeSets: RangeSet[],
  rangeSet: RangeSet,
  scenario: RangeScenario
) {
  const enabled = new Set<HandCode>(scenario.enabledHandCodes);

  const cells = document.querySelectorAll<HTMLDivElement>(".hand-grid-cell");
  cells.forEach((cell) => {
    const code = cell.getAttribute("data-hand") as HandCode | null;
    if (!code) return;
    cell.addEventListener("click", () => {
      if (enabled.has(code)) {
        enabled.delete(code);
        cell.classList.remove("active");
      } else {
        enabled.add(code);
        cell.classList.add("active");
      }
      persistEnabled(rangeSets, rangeSet, scenario, enabled);
    });
  });

  const allOnBtn = document.getElementById("handGridAllOnBtn") as HTMLButtonElement | null;
  const allOffBtn = document.getElementById("handGridAllOffBtn") as HTMLButtonElement | null;
  const preset25Btn = document.getElementById("handGridPreset25") as HTMLButtonElement | null;
  const preset45Btn = document.getElementById("handGridPreset45") as HTMLButtonElement | null;
  const preset50Btn = document.getElementById("handGridPreset50") as HTMLButtonElement | null;
  const preset75Btn = document.getElementById("handGridPreset75") as HTMLButtonElement | null;

  if (allOnBtn) {
    allOnBtn.addEventListener("click", () => {
      enabled.clear();
      const allCodes = getAllHandCodes();
      allCodes.forEach((c) => enabled.add(c));
      syncCellsFromSet(enabled);
      persistEnabled(rangeSets, rangeSet, scenario, enabled);
    });
  }

  if (allOffBtn) {
    allOffBtn.addEventListener("click", () => {
      enabled.clear();
      syncCellsFromSet(enabled);
      persistEnabled(rangeSets, rangeSet, scenario, enabled);
    });
  }

  if (preset25Btn) {
    preset25Btn.addEventListener("click", () => {
      applyHandGridPreset(0.25, enabled, rangeSets, rangeSet, scenario);
    });
  }
  if (preset45Btn) {
    preset45Btn.addEventListener("click", () => {
      applyHandGridPreset(0.45, enabled, rangeSets, rangeSet, scenario);
    });
  }
  if (preset50Btn) {
    preset50Btn.addEventListener("click", () => {
      applyHandGridPreset(0.5, enabled, rangeSets, rangeSet, scenario);
    });
  }
  if (preset75Btn) {
    preset75Btn.addEventListener("click", () => {
      applyHandGridPreset(1.0, enabled, rangeSets, rangeSet, scenario);
    });
  }
}

function persistEnabled(
  rangeSets: RangeSet[],
  rangeSet: RangeSet,
  scenario: RangeScenario,
  enabled: Set<HandCode>
) {
  const ordered = orderHandCodes(Array.from(enabled));
  scenario.enabledHandCodes = ordered;
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

/**
 * enabledHandCodes をペア→スーテッド→オフスート順にソート
 */
function orderHandCodes(codes: HandCode[]): HandCode[] {
  const order = generateHandGridOrder();
  const indexMap = new Map<HandCode, number>();
  order.forEach((c, idx) => indexMap.set(c, idx));
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

/**
 * EV順プリセット:
 * - まず scenario.handEvs を見る
 * - 無ければ ranges_6max.json の evByPosition[position][hand] を使う
 * - それも無ければ generateHandGridOrder() にフォールバック
 */
function applyHandGridPreset(
  ratio: number,
  enabled: Set<HandCode>,
  rangeSets: RangeSet[],
  rangeSet: RangeSet,
  scenario: RangeScenario
): void {
  const heroPos = (scenario.heroPosition ??
    scenario.position ??
    "UTG") as Position;

  const applyOrder = (order: HandCode[]) => {
    if (!order || order.length === 0) return;

    const total = order.length || 1;
    const count = Math.max(1, Math.round(total * ratio));

    const selected = order.slice(0, count) as HandCode[];

    enabled.clear();
    selected.forEach((c) => enabled.add(c));

    syncCellsFromSet(enabled);
    persistEnabled(rangeSets, rangeSet, scenario, enabled);
  };

  // ① scenario.handEvs を優先
  if (scenario.handEvs && Object.keys(scenario.handEvs).length > 0) {
    const evEntries = Object.entries(scenario.handEvs) as [HandCode, number][];
    const evSorted = evEntries
      .filter(([, ev]) => typeof ev === "number" && !Number.isNaN(ev))
      .sort(([, evA], [, evB]) => evB - evA) // EV 高い順
      .map(([code]) => code);

    if (evSorted.length > 0) {
      applyOrder(evSorted);
      return;
    }
  }

  // ② ranges_6max.json からEVを使う
  loadRangeData()
    .then((data) => {
      const byPos = data.evByPosition?.[heroPos];
      if (byPos && Object.keys(byPos).length > 0) {
        const evEntries = Object.entries(byPos) as [HandCode, number][];
        const evSorted = evEntries
          .filter(([, ev]) => typeof ev === "number" && !Number.isNaN(ev))
          .sort(([, evA], [, evB]) => evB - evA)
          .map(([code]) => code);

        if (evSorted.length > 0) {
          applyOrder(evSorted);
          return;
        }
      }

      // ③ EV 情報が無ければ従来の強さ順へフォールバック
      const defaultOrder = generateHandGridOrder() as HandCode[];
      applyOrder(defaultOrder);
    })
    .catch(() => {
      const defaultOrder = generateHandGridOrder() as HandCode[];
      applyOrder(defaultOrder);
    });
}
