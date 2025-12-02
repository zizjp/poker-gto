import { loadSettings, saveSettings } from "../core/settings";
import { loadRangeSets } from "../core/ranges";
import { Trainer } from "../core/trainer";
let currentSession = null;
let currentQuestion = null;
let trainer = null;
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
// ==========================
// イベント初期化
// ==========================
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
// ==========================
// セッション制御
// ==========================
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
function animateSwipeAnswer(direction, onDone) {
    const card = document.getElementById("quizCard");
    if (!card) {
        onDone();
        return;
    }
    card.classList.remove("swipe-card--leave-left", "swipe-card--leave-right", "swipe-card--reset");
    // reflow
    void card.offsetWidth;
    const leaveClass = direction === "left" ? "swipe-card--leave-left" : "swipe-card--leave-right";
    card.classList.add(leaveClass);
    const handleEnd = (e) => {
        if (e.propertyName !== "transform")
            return;
        card.removeEventListener("transitionend", handleEnd);
        card.classList.remove(leaveClass);
        card.classList.add("swipe-card--reset");
        onDone();
    };
    card.addEventListener("transitionend", handleEnd);
}
// 正解/不正解の視覚エフェクト（緑の光・赤のシェイク）
function playAnswerEffect(isCorrect) {
    const card = document.getElementById("quizCard");
    if (!card)
        return;
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
    const quizCard = document.getElementById("quizCard");
    if (!quizCard)
        return;
    let startX = 0;
    let startY = 0;
    let isTouching = false;
    const SWIPE_THRESHOLD = 40;
    const COLOR_MAX_DIST = 80;
    const resetCardColor = () => {
        quizCard.style.backgroundColor = "";
        quizCard.style.borderColor = "";
    };
    const applySwipeColor = (dx, dy) => {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        // 初期は白
        resetCardColor();
        // 横優勢 → FOLD/CALL
        if (absX > absY && absX > 10) {
            const strength = Math.min(absX / COLOR_MAX_DIST, 1);
            if (dx > 0) {
                // → CALL (緑)
                const bgAlpha = 0.12 + 0.28 * strength;
                const borderAlpha = 0.5 + 0.5 * strength;
                quizCard.style.backgroundColor = `rgba(34, 197, 94, ${bgAlpha})`; // green
                quizCard.style.borderColor = `rgba(22, 163, 74, ${borderAlpha})`;
            }
            else {
                // ← FOLD (青)
                const bgAlpha = 0.12 + 0.28 * strength;
                const borderAlpha = 0.5 + 0.5 * strength;
                quizCard.style.backgroundColor = `rgba(59, 130, 246, ${bgAlpha})`; // blue
                quizCard.style.borderColor = `rgba(37, 99, 235, ${borderAlpha})`;
            }
            return;
        }
        // 縦優勢かつ上方向 → RAISE (赤)
        if (absY > absX && absY > 10 && dy < 0) {
            const strength = Math.min(absY / COLOR_MAX_DIST, 1);
            const bgAlpha = 0.12 + 0.28 * strength;
            const borderAlpha = 0.5 + 0.5 * strength;
            quizCard.style.backgroundColor = `rgba(248, 113, 113, ${bgAlpha})`; // red-ish
            quizCard.style.borderColor = `rgba(239, 68, 68, ${borderAlpha})`;
            return;
        }
        // それ以外は白に戻す
        resetCardColor();
    };
    // ---- タッチ操作（スマホ用） ----
    quizCard.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        isTouching = true;
        resetCardColor();
    }, { passive: true });
    quizCard.addEventListener("touchmove", (e) => {
        if (!isTouching)
            return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        // カラーだけ更新（スクロールは殺さない）
        applySwipeColor(dx, dy);
    }, { passive: true });
    quizCard.addEventListener("touchend", (e) => {
        if (!isTouching)
            return;
        isTouching = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        // タップ扱い
        if (absX < 30 && absY < 30) {
            resetCardColor();
            return;
        }
        let answer = null;
        let direction = null;
        if (absX > absY) {
            // 横スワイプ → FOLD/CALL
            if (absX >= SWIPE_THRESHOLD) {
                if (dx > 0) {
                    answer = "CALL";
                    direction = "right";
                }
                else {
                    answer = "FOLD";
                    direction = "left";
                }
            }
        }
        else {
            // 縦スワイプ → RAISE（上方向のみ）
            if (dy < -SWIPE_THRESHOLD) {
                answer = "RAISE";
            }
        }
        if (!answer) {
            // しきい値未満 → 白に戻す
            resetCardColor();
            return;
        }
        if (!trainer || !currentSession || !currentQuestion) {
            resetCardColor();
            return;
        }
        // 回答確定時は色を一旦リセット（その後のエフェクトに任せる）
        resetCardColor();
        if (direction) {
            animateSwipeAnswer(direction, () => handleAnswer(answer));
        }
        else {
            handleAnswer(answer);
        }
    }, { passive: true });
    // ---- ボタン回答（PC/スマホどちらでも） ----
    const buttons = document.querySelectorAll(".answer-button");
    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const answer = btn.getAttribute("data-answer");
            if (!answer)
                return;
            if (!trainer || !currentSession || !currentQuestion)
                return;
            let direction = null;
            if (answer === "FOLD")
                direction = "left";
            if (answer === "CALL" || answer === "RAISE")
                direction = "right";
            const card = document.getElementById("quizCard");
            if (card) {
                card.style.backgroundColor = "";
                card.style.borderColor = "";
            }
            if (card && direction) {
                animateSwipeAnswer(direction, () => handleAnswer(answer));
            }
            else {
                handleAnswer(answer);
            }
        });
    });
}
// ==========================
// 回答処理 + フィードバック
// ==========================
function handleAnswer(answer) {
    if (!trainer || !currentSession || !currentQuestion)
        return;
    const result = trainer.answerQuestion(currentSession, currentQuestion, answer);
    // 正解 → 緑の光 / 不正解 → 赤シェイク
    playAnswerEffect(result.isCorrect);
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
// ==========================
// セッション結果
// ==========================
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
// ==========================
// 再描画
// ==========================
function rerenderTrainerView() {
    const main = document.getElementById("main");
    if (!main)
        return;
    main.innerHTML = renderTrainerView();
    initTrainerViewEvents();
}
