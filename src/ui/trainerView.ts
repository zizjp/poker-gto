import { loadSettings, saveSettings } from "../core/settings";
import { loadRangeSets } from "../core/ranges";
import { Trainer } from "../core/trainer";
import type {
  TrainingSession,
  TrainingQuestion,
  UserAnswer,
  HandCode
} from "../core/types";

let currentSession: TrainingSession | null = null;
let currentQuestion: TrainingQuestion | null = null;
let trainer: Trainer | null = null;

const REVIEW_HANDS_KEY = "pftrainer_review_hands_v1";

// ==========================
// トレーナーインスタンス初期化・更新
// ==========================

export function initTrainerInstance() {
  const settings = loadSettings();
  const rangeSets = loadRangeSets();
  trainer = new Trainer(settings, rangeSets);
}

export function refreshTrainerConfig() {
  if (!trainer) {
    initTrainerInstance();
    return;
  }
  const settings = loadSettings();
  const rangeSets = loadRangeSets();
  trainer.updateConfig(settings, rangeSets);
}

// ==========================
// ビュー描画
// ==========================

export function renderTrainerView(): string {
  const settings = loadSettings();
  const rangeSets = loadRangeSets();

  if (!trainer) {
    trainer = new Trainer(settings, rangeSets);
  } else {
    trainer.updateConfig(settings, rangeSets);
  }

  // アクティブレンジセットを決定（なければ先頭）
  let activeRangeSet =
    rangeSets.find((rs) => rs.meta.id === settings.activeRangeSetId) ?? null;
  if (!activeRangeSet && rangeSets.length > 0) {
    activeRangeSet = rangeSets[0];
    settings.activeRangeSetId = activeRangeSet.meta.id;
    saveSettings(settings);
  }

  // アクティブシナリオ決定（なければ先頭）
  let activeScenario = activeRangeSet
    ? activeRangeSet.scenarios.find((sc) => sc.id === settings.activeScenarioId) ?? null
    : null;

  if (activeRangeSet && !activeScenario && activeRangeSet.scenarios.length > 0) {
    activeScenario = activeRangeSet.scenarios[0];
    settings.activeScenarioId = activeScenario.id;
    saveSettings(settings);
  }

  const rangeSetOptions = rangeSets
    .map((rs) => {
      const selected = activeRangeSet && rs.meta.id === activeRangeSet.meta.id ? "selected" : "";
      return `<option value="${rs.meta.id}" ${selected}>${rs.meta.name}</option>`;
    })
    .join("");

  const scenarioOptions = activeRangeSet
    ? activeRangeSet.scenarios
        .map((sc) => {
          const selected = activeScenario && sc.id === activeScenario.id ? "selected" : "";
          return `<option value="${sc.id}" ${selected}>${sc.name}</option>`;
        })
        .join("")
    : "";

  const hasScenario = !!(activeRangeSet && activeScenario);

  // 復習モードがセットされているかの簡易表示
  const reviewHandsStr = window.localStorage.getItem(REVIEW_HANDS_KEY);
  let reviewInfoHtml = "";
  if (reviewHandsStr) {
    try {
      const hands = JSON.parse(reviewHandsStr) as HandCode[];
      if (hands && hands.length > 0) {
        reviewInfoHtml = `
          <p style="font-size:11px;color:#22c55e;margin-top:4px;">
            苦手ハンド復習モードが有効です（${hands.length} ハンド）。<br>
            この状態でクイズ開始すると、これらのハンドのみが出題されます。
          </p>
        `;
      }
    } catch {
      // 無視
    }
  }

  return `
    <div class="section">
      <h3>プリフロップトレーナー</h3>
      <div class="settings-row">
        <div class="label">レンジセット</div>
        <select id="trainerRangeSetSelect" class="select">
          ${rangeSetOptions}
        </select>
      </div>
      <div class="settings-row">
        <div class="label">シナリオ</div>
        <select id="trainerScenarioSelect" class="select">
          ${
            scenarioOptions ||
            `<option value="">（このレンジセットにはシナリオがありません）</option>`
          }
        </select>
      </div>
      <button id="startQuizBtn" class="button">
        クイズ開始
      </button>
      ${
        !hasScenario
          ? `<p style="font-size:12px;color:#ef4444;margin-top:4px;">※ シナリオが未選択か存在しません。エディターで作成してください。</p>`
          : ""
      }
      ${reviewInfoHtml}
    </div>

    <div id="trainerQuizArea"></div>
  `;
}

// ==========================
// イベント初期化
// ==========================

export function initTrainerViewEvents() {
  const rangeSetSelect = document.getElementById("trainerRangeSetSelect") as HTMLSelectElement | null;
  const scenarioSelect = document.getElementById("trainerScenarioSelect") as HTMLSelectElement | null;
  const startBtn = document.getElementById("startQuizBtn") as HTMLButtonElement | null;

  if (rangeSetSelect) {
    rangeSetSelect.addEventListener("change", () => {
      const settings = loadSettings();
      settings.activeRangeSetId = rangeSetSelect.value || null;
      settings.activeScenarioId = null; // レンジ変更時はシナリオリセット
      saveSettings(settings);
      rerenderTrainerView();
    });
  }

  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", () => {
      const settings = loadSettings();
      settings.activeScenarioId = scenarioSelect.value || null;
      saveSettings(settings);
      rerenderTrainerView();
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startSession();
    });
  }
}

// ==========================
// セッション制御
// ==========================

function startSession() {
  if (!trainer) {
    refreshTrainerConfig();
  }
  if (!trainer) return;

  const settings = loadSettings();
  const rangeSets = loadRangeSets();

  const activeRangeSet =
    rangeSets.find((rs) => rs.meta.id === settings.activeRangeSetId) ?? null;
  const activeScenario =
    activeRangeSet?.scenarios.find((sc) => sc.id === settings.activeScenarioId) ?? null;

  if (!activeRangeSet || !activeScenario) {
    alert("レンジセットとシナリオを選択してください。（エディタータブから作成もできます）");
    return;
  }

  // 苦手ハンド復習モードがあれば、ここで読んで適用
  let options: { hands?: HandCode[]; isReviewMode?: boolean } | undefined = undefined;
  const reviewHandsStr = window.localStorage.getItem(REVIEW_HANDS_KEY);
  if (reviewHandsStr) {
    try {
      const hands = JSON.parse(reviewHandsStr) as HandCode[];
      if (hands && hands.length > 0) {
        options = { hands, isReviewMode: true };
      }
    } catch {
      // 壊れてたら無視
    }
    // 一度使ったらクリア
    window.localStorage.removeItem(REVIEW_HANDS_KEY);
  }

  try {
    currentSession = trainer.startSession(options);
  } catch (e) {
    alert((e as Error).message);
    return;
  }

  nextQuestion();
}

function nextQuestion() {
  if (!trainer || !currentSession) return;

  const q = trainer.nextQuestion(currentSession);
  currentQuestion = q;

  const quizArea = document.getElementById("trainerQuizArea");
  if (!quizArea) return;

  if (!q) {
    const finished = trainer.finishSession(currentSession);
    showSessionResult(finished);
    currentSession = finished;
    currentQuestion = null;
    return;
  }

  quizArea.innerHTML = `
    <div class="swipe-card-container">
      <div class="swipe-card swipe-card--reset" id="quizCard">
        ${q.hand}
      </div>
      <div class="swipe-hints">
        <span>← FOLD</span>
        <span>↑ RAISE</span>
        <span>→ CALL</span>
      </div>
      <div class="answer-buttons">
        <button class="answer-button answer-button-fold" data-answer="FOLD">FOLD</button>
        <button class="answer-button answer-button-call" data-answer="CALL">CALL</button>
        <button class="answer-button answer-button-raise" data-answer="RAISE">RAISE</button>
      </div>
      <p class="answer-helper">PCではボタン、スマホではスワイプでも回答できます。</p>
    </div>
  `;

  initQuestionEvents();
}

// ==========================
// アニメーション系ヘルパー
// ==========================

// スワイプ方向に応じてカードを画面外に飛ばしてから onDone を呼ぶ
function animateSwipeAnswer(
  direction: "left" | "right",
  onDone: () => void
) {
  const card = document.getElementById("quizCard") as HTMLDivElement | null;
  if (!card) {
    onDone();
    return;
  }

  card.classList.remove(
    "swipe-card--leave-left",
    "swipe-card--leave-right",
    "swipe-card--reset"
  );

  // reflow
  void card.offsetWidth;

  const leaveClass =
    direction === "left" ? "swipe-card--leave-left" : "swipe-card--leave-right";

  card.classList.add(leaveClass);

  const handleEnd = (e: TransitionEvent) => {
    if (e.propertyName !== "transform") return;
    card.removeEventListener("transitionend", handleEnd);

    card.classList.remove(leaveClass);
    card.classList.add("swipe-card--reset");

    onDone();
  };

  card.addEventListener("transitionend", handleEnd);
}

// 正解/不正解の視覚エフェクト（緑の光・赤のシェイク）
function playAnswerEffect(isCorrect: boolean) {
  const card = document.getElementById("quizCard") as HTMLDivElement | null;
  if (!card) return;

  const correctClass = "swipe-card-correct";
  const wrongClass = "swipe-card-wrong";

  card.classList.remove(correctClass, wrongClass);
  void card.offsetWidth;

  const targetClass = isCorrect ? correctClass : wrongClass;
  card.classList.add(targetClass);

  const handleAnimationEnd = () => {
    card.classList.remove(targetClass);
    card.removeEventListener("animationend", handleAnimationEnd);
  };

  card.addEventListener("animationend", handleAnimationEnd);
}

// ==========================
// 1問分のイベントセットアップ
// ==========================

function initQuestionEvents() {
  const quizCard = document.getElementById("quizCard") as HTMLDivElement | null;
  if (!quizCard) return;

  let startX = 0;
  let startY = 0;
  let isTouching = false;
  const SWIPE_THRESHOLD = 40;

  // ---- タッチ操作（スマホ用） ----

  quizCard.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      isTouching = true;

      // 初期位置へ戻す
      quizCard.style.transform = "translateX(0) rotate(0)";
    },
    { passive: true }
  );

  quizCard.addEventListener(
    "touchmove",
    (e) => {
      if (!isTouching) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // 横スワイプ優先時のみスクロールを殺しつつ追従
      if (absX > absY) {
        e.preventDefault(); // ネイティブスクロールを抑止
        const maxTilt = 18;
        const tilt = (dx / 200) * maxTilt;
        quizCard.style.transform = `translateX(${dx}px) rotate(${tilt}deg)`;
      }
    },
    { passive: false }
  );

  quizCard.addEventListener(
    "touchend",
    (e) => {
      if (!isTouching) return;
      isTouching = false;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // タップ扱い
      if (absX < 30 && absY < 30) {
        quizCard.style.transform = "translateX(0) rotate(0)";
        return;
      }

      let answer: UserAnswer | null = null;
      let direction: "left" | "right" | null = null;

      if (absX > absY) {
        // 横スワイプ → FOLD/CALL
        if (absX >= SWIPE_THRESHOLD) {
          if (dx > 0) {
            answer = "CALL";
            direction = "right";
          } else {
            answer = "FOLD";
            direction = "left";
          }
        }
      } else {
        // 縦スワイプ → RAISE（上方向のみ）
        if (dy < -SWIPE_THRESHOLD) {
          answer = "RAISE";
        }
      }

      if (!answer) {
        // しきい値未満 → 元位置に戻す
        quizCard.style.transform = "translateX(0) rotate(0)";
        return;
      }

      if (!trainer || !currentSession || !currentQuestion) return;

      // inline transform はアニメーション前にクリア
      quizCard.style.transform = "";

      if (direction) {
        animateSwipeAnswer(direction, () => handleAnswer(answer as UserAnswer));
      } else {
        handleAnswer(answer as UserAnswer);
      }
    },
    { passive: true }
  );

  // ---- ボタン回答（PC/スマホどちらでも） ----

  const buttons = document.querySelectorAll<HTMLButtonElement>(".answer-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const answer = btn.getAttribute("data-answer") as UserAnswer | null;
      if (!answer) return;
      if (!trainer || !currentSession || !currentQuestion) return;

      let direction: "left" | "right" | null = null;
      if (answer === "FOLD") direction = "left";
      if (answer === "CALL" || answer === "RAISE") direction = "right";

      // ボタン回答でも軽くスワイプアウトさせる
      const card = document.getElementById("quizCard") as HTMLDivElement | null;
      if (card && direction) {
        card.style.transform = "";
        animateSwipeAnswer(direction, () => handleAnswer(answer));
      } else {
        handleAnswer(answer);
      }
    });
  });
}

// ==========================
// 回答処理 + フィードバック
// ==========================

function handleAnswer(answer: UserAnswer) {
  if (!trainer || !currentSession || !currentQuestion) return;

  const result = trainer.answerQuestion(currentSession, currentQuestion, answer);

  // 正解 → 緑の光 / 不正解 → 赤シェイク
  playAnswerEffect(result.isCorrect);

  const quizArea = document.getElementById("trainerQuizArea");
  if (!quizArea) return;

  const title = result.isCorrect ? "正解！" : "不正解";
  const titleClass = result.isCorrect ? "correct" : "wrong";

  quizArea.insertAdjacentHTML(
    "beforeend",
    `
    <div class="feedback-overlay" id="feedbackOverlay">
      <div class="feedback-box">
        <div class="feedback-title ${titleClass}">${title}</div>
        <div class="feedback-body">
          正解アクション: ${result.correctAction}
        </div>
        <div class="feedback-actions">
          画面タップか 1.5秒後に次の問題へ進みます。
        </div>
      </div>
    </div>
  `
  );

  const overlay = document.getElementById("feedbackOverlay");
  if (!overlay) {
    nextQuestion();
    return;
  }

  const goNext = () => {
    overlay.remove();
    nextQuestion();
  };

  overlay.addEventListener("click", goNext, { once: true });
  setTimeout(goNext, 1500);
}

// ==========================
// セッション結果
// ==========================

function showSessionResult(session: TrainingSession) {
  const quizArea = document.getElementById("trainerQuizArea");
  if (!quizArea) return;

  const total = session.results.length;
  const correct = session.results.filter((r) => r.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  quizArea.innerHTML = `
    <div class="section session-summary">
      <h2>セッション結果</h2>
      <p>問題数: <strong>${total}</strong></p>
      <p>正解数: <strong>${correct}</strong></p>
      <p>正解率: <strong>${accuracy}%</strong></p>
      <button id="trainerBackToConfigBtn" class="button button-secondary" style="margin-top:12px;">
        設定に戻る
      </button>
    </div>
  `;

  const backBtn = document.getElementById("trainerBackToConfigBtn") as HTMLButtonElement | null;
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const main = document.getElementById("main");
      if (!main) return;
      main.innerHTML = renderTrainerView();
      initTrainerViewEvents();
    });
  }
}

// ==========================
// 再描画
// ==========================

function rerenderTrainerView() {
  const main = document.getElementById("main");
  if (!main) return;
  main.innerHTML = renderTrainerView();
  initTrainerViewEvents();
}
