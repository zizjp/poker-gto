function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function getBestActions(decision) {
    const entries = [
        ["RAISE", decision.raise],
        ["CALL", decision.call],
        ["FOLD", decision.fold]
    ];
    const max = Math.max(decision.raise, decision.call, decision.fold);
    return entries.filter(([, v]) => v === max).map(([k]) => k);
}
export class Trainer {
    settings;
    rangeSets;
    // セッションごとの出題キュー
    questionQueues = new Map();
    defaultQuestionCount = 20;
    constructor(settings, rangeSets) {
        this.settings = settings;
        this.rangeSets = rangeSets;
    }
    updateConfig(settings, rangeSets) {
        this.settings = settings;
        this.rangeSets = rangeSets;
    }
    /**
     * セッション開始
     * options.hands が指定されていれば、そのハンドだけを出題候補にする（復習モード用）
     */
    startSession(options) {
        const scenario = this.getActiveScenario();
        if (!scenario) {
            throw new Error("アクティブなシナリオが選択されていません。");
        }
        const rangeSet = this.getActiveRangeSet();
        if (!rangeSet) {
            throw new Error("アクティブなレンジセットが選択されていません。");
        }
        // ▼ 出題候補ハンドを決定
        let baseHands;
        if (options?.hands && options.hands.length > 0) {
            // 苦手ハンド復習モードなど：指定されたハンドだけを使う
            baseHands = [...options.hands];
        }
        else if (scenario.enabledHandCodes && scenario.enabledHandCodes.length > 0) {
            baseHands = [...scenario.enabledHandCodes];
        }
        else {
            baseHands = Object.keys(scenario.hands);
        }
        // 手札候補がゼロならエラー
        if (baseHands.length === 0) {
            throw new Error("このシナリオには出題可能なハンドがありません。\nハンドグリッドかハンド編集からハンドを登録してください。");
        }
        // 安全のため、ハンド定義がなくても動くようにする
        const poolHands = [...baseHands];
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        // ▼ 出題順を決める（プールをシャッフルしてループ）
        const targetCount = this.defaultQuestionCount;
        const shuffled = shuffle(poolHands);
        const questionHands = [];
        while (questionHands.length < targetCount) {
            questionHands.push(...shuffled);
        }
        const finalHands = questionHands.slice(0, targetCount);
        const questions = finalHands.map((hand, index) => {
            // 定義がなければデフォルト decision を用意（FOLD 100%）
            const d = scenario.hands[hand] ?? { raise: 0, call: 0, fold: 100 };
            const decision = {
                raise: d.raise,
                call: d.call,
                fold: d.fold
            };
            const correctAction = this.pickCorrectAction(decision, this.settings.judgeMode);
            return {
                id: `${sessionId}_q${index}`,
                hand,
                correctAction,
                correctProbabilities: decision
            };
        });
        const session = {
            id: sessionId,
            startedAt: now,
            finishedAt: undefined,
            rangeSetId: rangeSet.meta.id,
            scenarioId: scenario.id,
            questionCount: questions.length,
            results: []
        };
        this.questionQueues.set(sessionId, questions);
        return session;
    }
    nextQuestion(session) {
        const queue = this.questionQueues.get(session.id);
        if (!queue)
            return null;
        const index = session.results.length;
        if (index >= queue.length)
            return null;
        return queue[index];
    }
    answerQuestion(session, question, userAnswer) {
        // question.correctProbabilities を正として使う（シナリオの変化に影響されない）
        const decision = question.correctProbabilities;
        let isCorrect;
        if (this.settings.judgeMode === "FREQUENCY") {
            const best = getBestActions(decision);
            isCorrect = best.includes(userAnswer);
        }
        else {
            isCorrect = userAnswer === question.correctAction;
        }
        const result = {
            questionId: question.id,
            hand: question.hand,
            userAnswer,
            isCorrect,
            correctAction: question.correctAction,
            scenarioId: session.scenarioId,
            rangeSetId: session.rangeSetId,
            timestamp: new Date().toISOString()
        };
        session.results.push(result);
        return result;
    }
    finishSession(session) {
        session.finishedAt = new Date().toISOString();
        // 念のため、実際に回答した数で上書き
        session.questionCount = session.results.length;
        this.questionQueues.delete(session.id);
        return session;
    }
    // ===== 内部ユーティリティ =====
    getActiveRangeSet() {
        if (!this.settings.activeRangeSetId)
            return null;
        return this.rangeSets.find((rs) => rs.meta.id === this.settings.activeRangeSetId) ?? null;
    }
    getActiveScenario() {
        const rs = this.getActiveRangeSet();
        if (!rs || !this.settings.activeScenarioId)
            return null;
        return rs.scenarios.find((sc) => sc.id === this.settings.activeScenarioId) ?? null;
    }
    pickCorrectAction(decision, mode) {
        if (mode === "FREQUENCY") {
            const best = getBestActions(decision);
            return randomChoice(best);
        }
        else {
            const r = decision.raise;
            const c = decision.call;
            const f = decision.fold;
            const total = r + c + f;
            if (total <= 0)
                return "FOLD";
            const x = Math.random() * total;
            if (x < r)
                return "RAISE";
            if (x < r + c)
                return "CALL";
            return "FOLD";
        }
    }
}
// ===== セッション永続化用ユーティリティ =====
const SESSIONS_STORAGE_KEY = "pftrainer_sessions_v1";
/**
 * localStorage からトレーニングセッション一覧を読み込む
 */
export function loadSessions() {
    try {
        const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed;
    }
    catch {
        return [];
    }
}
/**
 * トレーニングセッション一覧を localStorage に保存
 */
export function saveSessions(sessions) {
    try {
        window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
    catch {
        // 保存失敗時は黙って無視（ストレージ容量オーバーなど）
    }
}
