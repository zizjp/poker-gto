import { loadSettings, saveSettings } from "../core/settings";
import { loadRangeSets } from "../core/ranges";
import { Trainer } from "../core/trainer";
let currentSession = null;
let currentQuestion = null;
let trainer = null;
const REVIEW_HANDS_KEY = "pftrainer_review_hands_v1";
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
export function renderTrainerView() {
    const settings = loadSettings();
    const rangeSets = loadRangeSets();
    if (!trainer) {
        trainer = new Trainer(settings, rangeSets);
    }
    else {
        trainer.updateConfig(settings, rangeSets);
    }
    // アクティブレンジセットを決定（なければ先頭）
    let activeRangeSet = rangeSets.find((rs) => rs.meta.id === settings.activeRangeSetId) ?? null;
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
            const hands = JSON.parse(reviewHandsStr);
            if (hands && hands.length > 0) {
                reviewInfoHtml = `
          <p style="font-size:11px;color:#22c55e;margin-top:4px;">
            苦手ハンド復習モードが有効です（${hands.length} ハンド）。<br>
            この状態でクイズ開始すると、これらのハンドのみが出題されます。
          </p>
        `;
            }
        }
        catch {
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
          ${scenarioOptions ||
        `<option value="">（このレンジセットにはシナリオがありません）</option>`}
        </select>
      </div>
      <button id="startQuizBtn" class="button">
        クイズ開始
      </button>
      ${!hasScenario
        ? `<p style="font-size:12px;color:#ef4444;margin-top:4px;">※ シナリオが未選択か存在しません。エディターで作成してください。</p>`
        : ""}
      ${reviewInfoHtml}
    </div>

    <div id="trainerQuizArea"></div>
  `;
}
export function initTrainerViewEvents() {
    const rangeSetSelect = document.getElementById("trainerRangeSetSelect");
    const scenarioSelect = document.getElementById("trainerScenarioSelect");
    const startBtn = document.getElementById("startQuizBtn");
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
function startSession() {
    if (!trainer) {
        refreshTrainerConfig();
    }
    if (!trainer)
        return;
    const settings = loadSettings();
    const rangeSets = loadRangeSets();
    const activeRangeSet = rangeSets.find((rs) => rs.meta.id === settings.activeRangeSetId) ?? null;
    const activeScenario = activeRangeSet?.scenarios.find((sc) => sc.id === settings.activeScenarioId) ?? null;
    if (!activeRangeSet || !activeScenario) {
        alert("レンジセットとシナリオを選択してください。（エディタータブから作成もできます）");
        return;
    }
    // 苦手ハンド復習モードがあれば、ここで読んで適用
    let options = undefined;
    const reviewHandsStr = window.localStorage.getItem(REVIEW_HANDS_KEY);
    if (reviewHandsStr) {
        try {
            const hands = JSON.parse(reviewHandsStr);
            if (hands && hands.length > 0) {
                options = { hands, isReviewMode: true };
            }
        }
        catch {
            // 壊れてたら無視
        }
        // 一度使ったらクリア
        window.localStorage.removeItem(REVIEW_HANDS_KEY);
    }
    try {
        currentSession = trainer.startSession(options);
    }
    catch (e) {
        alert(e.message);
        return;
    }
    nextQuestion();
}
function nextQuestion() {
    if (!trainer || !currentSession)
        return;
    const q = trainer.nextQuestion(currentSession);
    currentQuestion = q;
    const quizArea = document.getElementById("trainerQuizArea");
    if (!quizArea)
        return;
    if (!q) {
        const finished = trainer.finishSession(currentSession);
        showSessionResult(finished);
        currentSession = finished;
        currentQuestion = null;
        return;
    }
    quizArea.innerHTML = `
    <div class="swipe-card-container">
      <div class="swipe-card" id="quizCard">
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
function initQuestionEvents() {
    const quizCard = document.getElementById("quizCard");
    if (!quizCard)
        return;
    let startX = 0;
    let startY = 0;
    quizCard.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
    }, { passive: true });
    // ★ スワイプ中にブラウザ側スクロールが動かないようにする
    quizCard.addEventListener("touchmove", (e) => {
        e.preventDefault(); // JSで処理するのでネイティブスクロール禁止
    }, { passive: false });
    quizCard.addEventListener("touchend", (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 30 && absY < 30)
            return;
        let answer = null;
        if (absX > absY) {
            answer = dx > 0 ? "CALL" : "FOLD";
        }
        else {
            answer = dy < 0 ? "RAISE" : null;
        }
        if (answer && currentSession && currentQuestion && trainer) {
            handleAnswer(answer);
        }
    }, { passive: true });
    const buttons = document.querySelectorAll(".answer-button");
    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const answer = btn.getAttribute("data-answer");
            if (!answer)
                return;
            if (currentSession && currentQuestion && trainer) {
                handleAnswer(answer);
            }
        });
    });
}
const buttons = document.querySelectorAll(".answer-button");
buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const answer = btn.getAttribute("data-answer");
        if (!answer)
            return;
        if (currentSession && currentQuestion && trainer) {
            handleAnswer(answer);
        }
    });
});
function handleAnswer(answer) {
    if (!trainer || !currentSession || !currentQuestion)
        return;
    const result = trainer.answerQuestion(currentSession, currentQuestion, answer);
    const quizArea = document.getElementById("trainerQuizArea");
    if (!quizArea)
        return;
    const title = result.isCorrect ? "正解！" : "不正解";
    const titleClass = result.isCorrect ? "correct" : "wrong";
    quizArea.insertAdjacentHTML("beforeend", `
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
  `);
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
function showSessionResult(session) {
    const quizArea = document.getElementById("trainerQuizArea");
    if (!quizArea)
        return;
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
    const backBtn = document.getElementById("trainerBackToConfigBtn");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            const main = document.getElementById("main");
            if (!main)
                return;
            main.innerHTML = renderTrainerView();
            initTrainerViewEvents();
        });
    }
}
function rerenderTrainerView() {
    const main = document.getElementById("main");
    if (!main)
        return;
    main.innerHTML = renderTrainerView();
    initTrainerViewEvents();
}
