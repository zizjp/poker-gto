import { loadRangeSets } from "../core/ranges";
import { loadSessions } from "../core/trainer";
import { calcStats, getWeakHands, calcCategoryStats } from "../core/stats";
import type {
  RangeSet,
  HandCode,
  TrainingSession
} from "../core/types";
import {
  loadRangeDataWithCategories,
  buildHandCategoryIndex
} from "../ranges/rangeData";
import type { Position, Hand } from "../ranges/types";

const REVIEW_HANDS_KEY = "pftrainer_review_hands_v1";
const WEAK_HANDS_PREV_COUNT_KEY = "pftrainer_prev_weak_count_v1";

export function renderStatsView(): string {
  const sessions = loadSessions();
  if (sessions.length === 0) {
    return `
<div class="section">
  <h3>学習統計</h3>
  <p style="font-size:13px;color:#6b7280;">
    まだ学習セッションがありません。<br>
    トレーナータブからクイズを開始すると、ここに成績が表示されます。
  </p>
</div>
`;
  }

  const rangeSets = loadRangeSets();
  const stats = calcStats(sessions);

  // シナリオID → 名前
  const scenarioNameMap = buildScenarioNameMap(rangeSets);
  // シナリオ別統計に名前を埋める
  stats.byScenario.forEach((s: any) => {
    s.scenarioName = scenarioNameMap.get(s.scenarioId) ?? s.scenarioId;
  });

  const global = stats.global;

  // ==== Phase 5.1 ①：成長スコア（前回比） ====
  const growth = computeGrowthMetrics(sessions);
  const growthHtml = renderGrowthCard(growth);

  // ==== Phase 5.1 ③：連続学習ストリーク ====
  const streakDays = computeStreakDays(sessions);
  const streakHtml = renderStreakCard(streakDays);

  // シナリオ別テーブル
  const scenarioRows = stats.byScenario
    .sort((a: any, b: any) => b.totalQuestions - a.totalQuestions)
    .map((s: any) => {
      const acc = s.totalQuestions > 0 ? Math.round((s.accuracy || 0) * 100) : 0;
      return `
      <tr>
        <td>${escapeHtml(s.scenarioName || s.scenarioId)}</td>
        <td style="text-align:right;">${s.totalQuestions}</td>
        <td style="text-align:right;">${s.totalCorrect}</td>
        <td style="text-align:right;">${acc}%</td>
      </tr>
      `;
    })
    .join("");

  // 苦手ハンド（Phase 5.1 ②：克服の実感用）
  const weakHands = getWeakHands(stats, { minSample: 5, maxAccuracy: 0.6 });
  const weakHandRows =
    weakHands.length === 0
      ? `<tr><td colspan="3" style="text-align:center;font-size:13px;color:#6b7280;">条件に合う苦手ハンドはありません。</td></tr>`
      : weakHands
          .map((h) => {
            const acc = h.totalQuestions > 0 ? Math.round(h.accuracy * 100) : 0;
            const blocks = Math.max(0, Math.min(10, Math.round(acc / 10)));
            const bar = "■".repeat(blocks) + "□".repeat(10 - blocks);
            return `
      <tr>
        <td>${h.hand}</td>
        <td style="text-align:right;">${h.totalQuestions}</td>
        <td style="text-align:right;">
          <span style="font-family:monospace;font-size:11px;">${bar}</span><br/>
          ${acc}%
        </td>
      </tr>
      `;
          })
          .join("");

  const weakHandsJson =
    weakHands.length > 0
      ? escapeHtml(JSON.stringify(weakHands.map((h) => h.hand as HandCode)))
      : "[]";

  // 苦手ハンド数の変化（前回統計との差分）
  const { previousCount, diff } = getWeakHandsDiff(weakHands.length);
  const weakChangeMessage = renderWeakHandsChangeMessage(
    weakHands.length,
    previousCount,
    diff
  );

  // 最近のセッション（StatsSnapshotではなく生データから算出しなおす）
  const recentRows = renderRecentSessionsTableRows(sessions, scenarioNameMap);
  const globalAcc =
    global.totalQuestions > 0 ? Math.round((global.accuracy || 0) * 100) : 0;

  return `
<div class="section">
  <h3>学習サマリー</h3>
  <div class="stats-summary-grid">
    <div class="stats-summary-item">
      <div class="stats-summary-label">総セッション数</div>
      <div class="stats-summary-value">${global.totalSessions}</div>
    </div>
    <div class="stats-summary-item">
      <div class="stats-summary-label">総問題数</div>
      <div class="stats-summary-value">${global.totalQuestions}</div>
    </div>
    <div class="stats-summary-item">
      <div class="stats-summary-label">総正解数</div>
      <div class="stats-summary-value">${global.totalCorrect}</div>
    </div>
    <div class="stats-summary-item">
      <div class="stats-summary-label">全体正解率</div>
      <div class="stats-summary-value">${globalAcc}%</div>
    </div>
  </div>
  ${growthHtml}
  ${streakHtml}
</div>

<div class="section">
  <h3>シナリオ別成績</h3>
  <div class="table-wrapper">
    <table class="stats-table">
      <thead>
        <tr>
          <th>シナリオ</th>
          <th style="text-align:right;">出題数</th>
          <th style="text-align:right;">正解数</th>
          <th style="text-align:right;">正解率</th>
        </tr>
      </thead>
      <tbody>
        ${scenarioRows || `<tr><td colspan="4" style="text-align:center;">データなし</td></tr>`}
      </tbody>
    </table>
  </div>
</div>

<div class="section" id="statsCategorySection">
  <!-- カテゴリ別成績は initStatsViewEvents() 内で非同期に描画 -->
</div>

<div class="section">
  <h3>苦手ハンド</h3>
  <p style="font-size:11px;color:#6b7280;margin-top:0;margin-bottom:6px;">
    出題数が 5問以上 かつ 正解率60%以下 のハンドを表示しています。<br>
    正解率が上がるほど「■」が増え、克服度が視覚的にわかります。
  </p>
  <div class="table-wrapper">
    <table class="stats-table">
      <thead>
        <tr>
          <th>ハンド</th>
          <th style="text-align:right;">出題数</th>
          <th style="text-align:right;">克服度</th>
        </tr>
      </thead>
      <tbody>
        ${weakHandRows}
      </tbody>
    </table>
  </div>
  ${weakChangeMessage}
  ${
    weakHands.length > 0
      ? `
  <button
    id="statsReviewWeakBtn"
    class="button"
    data-weak-hands='${weakHandsJson}'
    style="margin-top:8px;"
  >
    苦手ハンドだけで復習セッション開始
  </button>
  <p style="font-size:11px;color:#6b7280;margin-top:4px;">
    ボタンを押すと「苦手ハンドリスト」が記録されます。<br>
    トレーナータブで「クイズ開始」を押すと、このハンドだけが出題されます。
  </p>
  `
      : `<p style="font-size:11px;color:#16a34a;margin-top:6px;">
    現在、条件に合う「苦手ハンド」はありません。かなり仕上がってきています。
  </p>`
  }
</div>

<div class="section">
  <h3>最近のセッション</h3>
  <div class="table-wrapper">
    <table class="stats-table">
      <thead>
        <tr>
          <th>日時</th>
          <th>シナリオ</th>
          <th style="text-align:right;">問題数</th>
          <th style="text-align:right;">正解率</th>
        </tr>
      </thead>
      <tbody>
        ${
          recentRows ||
          `<tr><td colspan="4" style="text-align:center;">最近のセッションデータがありません。</td></tr>`
        }
      </tbody>
    </table>
  </div>
</div>
`;
}

export function initStatsViewEvents() {
  const reviewBtn = document.getElementById("statsReviewWeakBtn") as
    | HTMLButtonElement
    | null;

  if (reviewBtn) {
    reviewBtn.addEventListener("click", () => {
      const handsAttr = reviewBtn.getAttribute("data-weak-hands") || "[]";
      try {
        const hands = JSON.parse(handsAttr) as HandCode[];
        handleStartWeakHandsReview(hands);
      } catch (e) {
        console.error(e);
        alert("苦手ハンドリストの読み込みに失敗しました。");
      }
    });
  }

  // カテゴリ別成績は非同期で初期化
  initCategoryStatsSection().catch((e) => {
    console.error("[statsView] initCategoryStatsSection error", e);
  });
}

// ===== 内部ユーティリティ =====

function buildScenarioNameMap(rangeSets: RangeSet[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rs of rangeSets) {
    for (const sc of rs.scenarios) {
      map.set(sc.id, sc.name);
    }
  }
  return map;
}

function buildScenarioIndex(
  rangeSets: RangeSet[]
): Map<string, RangeSet["scenarios"][number]> {
  const map = new Map<string, RangeSet["scenarios"][number]>();
  for (const rs of rangeSets) {
    for (const sc of rs.scenarios) {
      map.set(sc.id, sc);
    }
  }
  return map;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

// ランク順（右に行くほど強い）
const RANK_ORDER = "23456789TJQKA" as const;
type CardRankChar = (typeof RANK_ORDER)[number];
type CardSuitChar = "s" | "h" | "d" | "c";

/**
 * HandCode -> 169ハンド表記("AKs", "AKo", "QQ" など) に変換
 *
 * 対応フォーマット:
 * - "AKs" / "AKo" / "QQ" など既に169表記 → そのまま返す
 * - "AhKh" / "AsKd" / "QcQd" など実カード表記 → AKs / AKo / QQ に変換
 * それ以外は null を返す
 */
function convertHandCodeToGridHand(handCode: HandCode): Hand | null {
  const raw = String(handCode).trim();

  // すでに 169 ハンド表記ならそのまま
  if (/^[2-9TJQKA]{2}[so]?$/.test(raw)) {
    return raw as Hand;
  }

  // "AhKh" / "AsKd" / "QcQd" 形式
  const cardPattern =
    /^([2-9TJQKA])([shdc])([2-9TJQKA])([shdc])$/i;
  const m = raw.match(cardPattern);
  if (!m) {
    return null;
  }

  const r1 = m[1].toUpperCase() as CardRankChar;
  const s1 = m[2].toLowerCase() as CardSuitChar;
  const r2 = m[3].toUpperCase() as CardRankChar;
  const s2 = m[4].toLowerCase() as CardSuitChar;

  // ペア
  if (r1 === r2) {
    return (r1 + r2) as Hand; // "QQ" など
  }

  const suited = s1 === s2;
  const idx1 = RANK_ORDER.indexOf(r1);
  const idx2 = RANK_ORDER.indexOf(r2);
  if (idx1 === -1 || idx2 === -1) {
    return null;
  }

  // 169 ハンド表では「強いランクが先」
  const high = idx1 > idx2 ? r1 : r2;
  const low = idx1 > idx2 ? r2 : r1;

  const suffix = suited ? "s" : "o";
  const gridHand = `${high}${low}${suffix}` as Hand; // "AKs" / "AKo" など

  return gridHand;
}

/**
 * カテゴリ別成績セクションを非同期に構築
 * - ranges_6max.json のカテゴリ（premium / strong / medium / speculative）と
 *   セッション履歴を突き合わせて集計
 */
async function initCategoryStatsSection(): Promise<void> {
  const container = document.getElementById("statsCategorySection");
  if (!container) return;

  try {
    const sessions = loadSessions();
    if (sessions.length === 0) {
      container.innerHTML = "";
      return;
    }

    const rangeSets = loadRangeSets();
    if (!rangeSets || rangeSets.length === 0) {
      container.innerHTML = `
<h3>ポジション×カテゴリ別成績</h3>
<p style="font-size:13px;color:#6b7280;">
  レンジセットが見つからないため、カテゴリ別成績は表示できません。
</p>
`;
      return;
    }

    const { positionBuckets } = await loadRangeDataWithCategories();
    const index = buildHandCategoryIndex(positionBuckets);
    const scenarioIndex = buildScenarioIndex(rangeSets);

    const categoryStats = calcCategoryStats(sessions, (r) => {
      const sc = scenarioIndex.get(r.scenarioId);
      if (!sc) return null;

      const heroPos = sc.heroPosition as Position | undefined;
      if (!heroPos) return null;

      const gridHand = convertHandCodeToGridHand(r.hand as HandCode);
      if (!gridHand) return null;

      const posIndex = index[heroPos];
      if (!posIndex) return null;

      const cat = posIndex[gridHand];
      if (!cat) return null;

      // 内部キー: "UTG:premium" など
      return `${heroPos}:${cat}`;
    });

    if (!categoryStats || categoryStats.length === 0) {
      container.innerHTML = `
<h3>ポジション×カテゴリ別成績</h3>
<p style="font-size:13px;color:#6b7280;">
  レンジカテゴリ情報と学習履歴の組み合わせがまだ十分ではないため、カテゴリ別成績は表示していません。
</p>
`;
      return;
    }

    container.innerHTML = renderCategoryStatsTable(categoryStats);
  } catch (e) {
    console.error("[statsView] initCategoryStatsSection error", e);
    container.innerHTML = `
<h3>ポジション×カテゴリ別成績</h3>
<p style="font-size:13px;color:#ef4444;">
  カテゴリ別成績の計算中にエラーが発生しました。
</p>
`;
  }
}

interface CategoryStats {
  categoryKey: string;
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
}

/**
 * カテゴリ別成績テーブル描画
 */
function renderCategoryStatsTable(stats: CategoryStats[]): string {
  type Row = {
    position: Position;
    category: string;
    totalQuestions: number;
    accuracy: number;
  };

  const posOrder: Position[] = ["UTG", "MP", "CO", "BTN", "SB", "BB"];
  const catOrder: Record<string, number> = {
    premium: 0,
    strong: 1,
    medium: 2,
    speculative: 3
  };

  const rows: Row[] = [];

  for (const s of stats) {
    const [posRaw, catRaw] = s.categoryKey.split(":") as [Position, string];
    const position = posRaw;
    const category = catRaw;

    rows.push({
      position,
      category,
      totalQuestions: s.totalQuestions,
      accuracy:
        s.totalQuestions > 0 ? Math.round((s.accuracy || 0) * 100) : 0
    });
  }

  rows.sort((a, b) => {
    const pa = posOrder.indexOf(a.position);
    const pb = posOrder.indexOf(b.position);
    if (pa !== pb) return pa - pb;

    const ca = catOrder[a.category] ?? 99;
    const cb = catOrder[b.category] ?? 99;
    return ca - cb;
  });

  const body =
    rows.length === 0
      ? `<tr><td colspan="4" style="text-align:center;">データなし</td></tr>`
      : rows
          .map(
            (r) => `
<tr>
  <td>${r.position}</td>
  <td>${renderCategoryLabel(r.category)}</td>
  <td style="text-align:right;">${r.totalQuestions}</td>
  <td style="text-align:right;">${r.accuracy}%</td>
</tr>
`
          )
          .join("");

  return `
<h3>ポジション×カテゴリ別成績</h3>
<p style="font-size:11px;color:#6b7280;margin-top:0;margin-bottom:6px;">
  ranges_6max.json のカテゴリ（premium / strong / medium / speculative）ごとの成績です。<br>
  出題数が多い順 &amp; ポジション順で並べています。
</p>
<div class="table-wrapper">
  <table class="stats-table">
    <thead>
      <tr>
        <th>ポジション</th>
        <th>カテゴリ</th>
        <th style="text-align:right;">出題数</th>
        <th style="text-align:right;">正解率</th>
      </tr>
    </thead>
    <tbody>
      ${body}
    </tbody>
  </table>
</div>
`;
}

function renderCategoryLabel(key: string): string {
  switch (key) {
    case "premium":
      return "premium（EV +1.5〜+2.5BB）";
    case "strong":
      return "strong（EV +0.8〜+1.5BB）";
    case "medium":
      return "medium（EV +0.3〜+0.8BB）";
    case "speculative":
      return "speculative（EV -0.1〜+0.3BB）";
    default:
      return escapeHtml(key);
  }
}

/**
 * 苦手ハンド復習モード開始：
 * - localStorage にハンドリストを保存
 * - 実際の適用は trainerView.ts 側で行う
 */
function handleStartWeakHandsReview(hands: HandCode[]) {
  if (!hands || hands.length === 0) {
    alert("苦手ハンドがありません。");
    return;
  }
  try {
    window.localStorage.setItem(REVIEW_HANDS_KEY, JSON.stringify(hands));
    alert(
      `苦手ハンド ${hands.length} 個を復習モードとして記録しました。\n\nトレーナータブに移動して「クイズ開始」を押すと、このハンドだけが出題されます。`
    );
  } catch (e) {
    console.error(e);
    alert(
      "復習モードの設定に失敗しました。ストレージ容量を確認してください。"
    );
  }
}

// ====== Phase 5.1: 成長スコア / ストリーク / 苦手数差分 ======

interface GrowthMetrics {
  hasEnoughData: boolean;
  latestAccuracy: number | null; // 0〜1
  baselineAccuracy: number | null; // 0〜1
  diff: number | null; // latest - baseline
  latestQuestions: number;
}

function computeSessionAccuracy(session: TrainingSession): number {
  const total = session.results.length;
  if (total === 0) return 0;
  const correct = session.results.filter((r) => r.isCorrect).length;
  return correct / total;
}

function computeGrowthMetrics(sessions: TrainingSession[]): GrowthMetrics {
  if (sessions.length === 0) {
    return {
      hasEnoughData: false,
      latestAccuracy: null,
      baselineAccuracy: null,
      diff: null,
      latestQuestions: 0
    };
  }

  // startedAt で昇順ソート
  const sorted = [...sessions].sort((a, b) =>
    a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0
  );

  const latest = sorted[sorted.length - 1];
  const prev = sorted.slice(0, -1);
  const latestAcc = computeSessionAccuracy(latest);
  const latestQuestions = latest.results.length;

  if (prev.length === 0) {
    return {
      hasEnoughData: false,
      latestAccuracy: latestAcc,
      baselineAccuracy: null,
      diff: null,
      latestQuestions
    };
  }

  // 直近10セッション分をベースラインとする
  const baselineSessions = prev.slice(-10);
  const baselineAcc =
    baselineSessions.reduce(
      (sum, s) => sum + computeSessionAccuracy(s),
      0
    ) / baselineSessions.length;
  return {
    hasEnoughData: true,
    latestAccuracy: latestAcc,
    baselineAccuracy: baselineAcc,
    diff: latestAcc - baselineAcc,
    latestQuestions
  };
}

function renderGrowthCard(g: GrowthMetrics): string {
  const wrapperStyle =
    "margin-top:12px;padding:8px;border-radius:8px;background:#f1f5f9;font-size:13px;";
  if (!g.latestAccuracy && !g.hasEnoughData) {
    return `
<div style="${wrapperStyle}">
  <div style="font-weight:600;margin-bottom:4px;">最近の成長</div>
  <div>まだ比較できるデータがありません。もう少しセッションをこなすと成長が表示されます。</div>
</div>
`;
  }

  const latestPct =
    g.latestAccuracy !== null ? Math.round(g.latestAccuracy * 100) : 0;
  const baselinePct =
    g.baselineAccuracy !== null
      ? Math.round(g.baselineAccuracy * 100)
      : null;
  const diffPct = g.diff !== null ? Math.round(g.diff * 100) : null;
  let mainLine = "";
  let subLine = "";
  if (!g.hasEnoughData || baselinePct === null || diffPct === null) {
    mainLine = `直近セッションの正解率は <strong>${latestPct}%</strong> です。`;
    subLine = `過去データが少ないため、成長比較はまだ行っていません。`;
  } else if (diffPct > 0) {
    mainLine = `直近セッションの正解率 <strong>${latestPct}%</strong>（過去平均 ${baselinePct}%）。`;
    subLine = `<span style="color:#16a34a;font-weight:600;">+${diffPct}% 成長しています。かなり良いペースです。</span>`;
  } else if (diffPct === 0) {
    mainLine = `直近セッションの正解率 <strong>${latestPct}%</strong>（過去平均 ${baselinePct}%）。`;
    subLine = `正解率は横ばいですが、継続できている時点で十分価値があります。`;
  } else {
    const down = Math.abs(diffPct);
    mainLine = `直近セッションの正解率 <strong>${latestPct}%</strong>（過去平均 ${baselinePct}%）。`;
    subLine = `<span style="color:#f97316;font-weight:600;">-${down}% ですが、ブレの範囲内です。苦手ハンド復習で戻していきましょう。</span>`;
  }
  return `
<div style="${wrapperStyle}">
  <div style="font-weight:600;margin-bottom:4px;">最近の成長</div>
  <div>${mainLine}</div>
  <div style="margin-top:2px;">${subLine}</div>
</div>
`;
}

function computeStreakDays(sessions: TrainingSession[]): number {
  if (sessions.length === 0) return 0;
  // 日付単位にまとめる（YYYY-MM-DD）
  const daysSet = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    daysSet.add(key);
  }
  const days = Array.from(daysSet)
    .map((key) => {
      const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    })
    .sort((a, b) => b.getTime() - a.getTime()); // 新しい順

  if (days.length === 0) return 0;

  let streak = 1;
  let last = days[0];

  for (let i = 1; i < days.length; i++) {
    const cur = days[i];
    const diffMs = last.getTime() - cur.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak += 1;
      last = cur;
    } else if (diffDays >= 2) {
      break;
    } else {
      // 同じ日とか想定外は無視
      last = cur;
    }
  }

  return streak;
}

function renderStreakCard(streakDays: number): string {
  const wrapperStyle =
    "margin-top:8px;padding:8px;border-radius:8px;background:#fef3c7;font-size:13px;";
  if (streakDays <= 0) {
    return `
<div style="${wrapperStyle}">
  <div style="font-weight:600;margin-bottom:4px;">連続学習日数</div>
  <div>まだ連続学習の記録はありません。</div>
</div>
`;
  }

  if (streakDays === 1) {
    return `
<div style="${wrapperStyle}">
  <div style="font-weight:600;margin-bottom:4px;">連続学習日数</div>
  <div><strong>1日目</strong> の学習、お疲れさまです。まずは「途切れさせないこと」を意識してみてください。</div>
</div>
`;
  }
  return `
<div style="${wrapperStyle}">
  <div style="font-weight:600;margin-bottom:4px;">連続学習日数</div>
  <div>
    現在、<strong>${streakDays}日連続</strong>で学習できています。<br>
    ここまで続けられているのは普通にすごいです。
  </div>
</div>
`;
}

/**
 * 前回表示時からの「苦手ハンド数」の変化を求める。
 * diff = previousCount - currentCount（プラスなら減っている）。
 * 呼び出し時に current を localStorage に保存して次回の基準にする。
 */
function getWeakHandsDiff(
  currentCount: number
): { previousCount: number | null; diff: number | null } {
  let previousCount: number | null = null;
  try {
    const raw = window.localStorage.getItem(WEAK_HANDS_PREV_COUNT_KEY);
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) {
        previousCount = n;
      }
    }
  } catch {
    // 無視
  }
  let diff: number | null = null;
  if (previousCount !== null) {
    diff = previousCount - currentCount;
  }

  // 次回比較用に、今回の値を保存
  try {
    window.localStorage.setItem(
      WEAK_HANDS_PREV_COUNT_KEY,
      String(currentCount)
    );
  } catch {
    // 無視
  }

  return { previousCount, diff };
}

function renderWeakHandsChangeMessage(
  current: number,
  previous: number | null,
  diff: number | null
): string {
  if (previous === null || diff === null) {
    return `
<p style="font-size:11px;color:#6b7280;margin-top:6px;">
  苦手ハンド数の変化は、次回以降ここに表示されます。
</p>
`;
  }

  if (diff > 0) {
    return `
<p style="font-size:12px;color:#16a34a;margin-top:6px;">
  前回より <strong>${diff} 個</strong> 苦手ハンドが減りました。（${previous} → ${current}）<br>
  苦手をちゃんと潰せてきています。かなり良い流れです。
</p>
`;
  }
  if (diff < 0) {
    const inc = Math.abs(diff);
    return `
<p style="font-size:12px;color:#f97316;margin-top:6px;">
  苦手ハンドが <strong>${inc} 個</strong> 増えています。（${previous} → ${current}）<br>
  新しいレンジに取り組んでいるか、たまたまブレた可能性があります。復習モードを使って整えていきましょう。
</p>
`;
  }

  return `
<p style="font-size:11px;color:#6b7280;margin-top:6px;">
  苦手ハンドの個数は前回から変化していません。（${current} 個）
</p>
`;
}

function renderRecentSessionsTableRows(
  sessions: TrainingSession[],
  scenarioNameMap: Map<string, string>
): string {
  if (sessions.length === 0) return "";

  const sorted = [...sessions].sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0
  );

  const top = sorted.slice(0, 10);
  return top
    .map((s) => {
      const total = s.results.length;
      const acc =
        total > 0 ? Math.round(computeSessionAccuracy(s) * 100) : 0;
      const dt = formatDateTime(s.finishedAt || s.startedAt);

      const scenarioName =
        scenarioNameMap.get(s.scenarioId as string) ??
        (s.scenarioId ? String(s.scenarioId) : "");
      return `
<tr>
  <td>${dt}</td>
  <td>${escapeHtml(scenarioName)}</td>
  <td style="text-align:right;">${total}</td>
  <td style="text-align:right;">${acc}%</td>
</tr>
`;
    })
    .join("");
}
