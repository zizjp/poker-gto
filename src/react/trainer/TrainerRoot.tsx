import { useRef, useState, useEffect } from "react";
import { Trainer } from "../../core/trainer";
import { loadSettings, saveSettings } from "../../core/settings";
import { loadRangeSets } from "../../core/ranges";
import type {
  TrainingSession,
  TrainingQuestion,
  QuestionResult,
  RangeSet,
  RangeScenario,
  HandCode,
  UserAnswer
} from "../../core/types";
import { TrainerConfigPanel } from "./TrainerConfigPanel";
import { TrainerQuizView } from "./TrainerQuizView";
import { TrainerResultView } from "./TrainerResultView";
import { setRangeFocus } from "../../ranges/rangeFocus";
import type { Position, Hand } from "../../ranges/types";

export type TrainerPhase = "CONFIG" | "QUIZ" | "FEEDBACK" | "RESULT";

const REVIEW_HANDS_KEY = "pftrainer_review_hands_v1";

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
const convertHandCodeToGridHand = (handCode: HandCode): Hand | null => {
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
    // 想定外フォーマットは無視
    // eslint-disable-next-line no-console
    console.warn("[TrainerRoot] unsupported HandCode format for grid:", raw);
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
    // eslint-disable-next-line no-console
    console.warn("[TrainerRoot] invalid rank in HandCode:", raw);
    return null;
  }

  // 169 ハンド表では「強いランクが先」
  const high = idx1 > idx2 ? r1 : r2;
  const low = idx1 > idx2 ? r2 : r1;

  const suffix = suited ? "s" : "o";
  const gridHand = `${high}${low}${suffix}` as Hand; // "AKs" / "AKo" など

  return gridHand;
};

export function TrainerRoot() {
  const trainerRef = useRef<Trainer | null>(null);
  const [phase, setPhase] = useState<TrainerPhase>("CONFIG");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [currentQuestion, setCurrentQuestion] =
    useState<TrainingQuestion | null>(null);
  const [rangeSets, setRangeSets] = useState<RangeSet[]>([]);
  const [activeRangeSet, setActiveRangeSet] =
    useState<RangeSet | null>(null);
  const [activeScenario, setActiveScenario] =
    useState<RangeScenario | null>(null);
  const [feedback, setFeedback] = useState<QuestionResult | null>(null);
  const [reviewHandsCount, setReviewHandsCount] =
    useState<number | null>(null);

  // 初期ロード＆Trainerインスタンス生成
  useEffect(() => {
    console.log("[TrainerRoot] mount");
    const settings = loadSettings();
    const rs = loadRangeSets();
    setRangeSets(rs);
    let activeRs =
      rs.find((x) => x.meta.id === settings.activeRangeSetId) ??
      (rs[0] ?? null);
    let activeSc =
      activeRs?.scenarios.find(
        (x) => x.id === settings.activeScenarioId,
      ) ??
      (activeRs?.scenarios[0] ?? null) ??
      null;

    if (activeRs && settings.activeRangeSetId !== activeRs.meta.id) {
      settings.activeRangeSetId = activeRs.meta.id;
      saveSettings(settings);
    }
    if (activeSc && settings.activeScenarioId !== activeSc.id) {
      settings.activeScenarioId = activeSc.id;
      saveSettings(settings);
    }

    setActiveRangeSet(activeRs);
    setActiveScenario(activeSc ?? null);
    trainerRef.current = new Trainer(settings, rs);

    // 苦手ハンド復習モードがセットされているか簡易チェック
    try {
      const reviewHandsStr = window.localStorage.getItem(
        REVIEW_HANDS_KEY,
      );
      if (reviewHandsStr) {
        const hands = JSON.parse(reviewHandsStr) as HandCode[];
        if (Array.isArray(hands) && hands.length > 0) {
          setReviewHandsCount(hands.length);
          console.log(
            "[TrainerRoot] review mode detected:",
            hands.length,
          );
        }
      }
    } catch (e) {
      console.error(
        "[TrainerRoot] failed to read review hands",
        e,
      );
      setReviewHandsCount(null);
    }
  }, []);

  // レンジセット変更
  const handleChangeRangeSet = (rangeSetId: string) => {
    const settings = loadSettings();
    settings.activeRangeSetId = rangeSetId || null;
    settings.activeScenarioId = null;
    saveSettings(settings);

    const rs = loadRangeSets();
    setRangeSets(rs);

    const newRs =
      rs.find((x) => x.meta.id === rangeSetId) ?? null;
    const firstScenario = newRs?.scenarios[0] ?? null;
    setActiveRangeSet(newRs);
    setActiveScenario(firstScenario);

    if (trainerRef.current) {
      trainerRef.current.updateConfig(settings, rs);
    } else {
      trainerRef.current = new Trainer(settings, rs);
    }
  };

  // シナリオ変更
  const handleChangeScenario = (scenarioId: string) => {
    const settings = loadSettings();
    settings.activeScenarioId = scenarioId || null;
    saveSettings(settings);
    const rs = loadRangeSets();
    setRangeSets(rs);
    const currentRs =
      rs.find((x) => x.meta.id === settings.activeRangeSetId) ??
      null;
    const newSc =
      currentRs?.scenarios.find((x) => x.id === scenarioId) ??
      null;

    setActiveRangeSet(currentRs);
    setActiveScenario(newSc);

    if (trainerRef.current) {
      trainerRef.current.updateConfig(settings, rs);
    } else {
      trainerRef.current = new Trainer(settings, rs);
    }
  };

  // 次の問題へ進む
  const goNextQuestion = () => {
    const trainer = trainerRef.current;
    if (!trainer || !session) return;

    const nextQ = trainer.nextQuestion(session);

    if (!nextQ) {
      const finished = trainer.finishSession(session);
      setSession({ ...finished });
      setCurrentQuestion(null);
      setFeedback(null);
      setPhase("RESULT");
    } else {
      setCurrentQuestion(nextQ);
      setFeedback(null);
      setPhase("QUIZ");
    }
  };

  // フィードバック表示中の自動遷移
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      goNextQuestion();
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  // クイズ開始
  const handleStartQuiz = () => {
    const trainer = trainerRef.current;
    if (!trainer) return;
    const settings = loadSettings();
    const rs = loadRangeSets();
    trainer.updateConfig(settings, rs);
    let options:
      | { hands?: HandCode[]; isReviewMode?: boolean }
      | undefined;

    // 苦手ハンド復習モード適用
    try {
      const reviewHandsStr = window.localStorage.getItem(
        REVIEW_HANDS_KEY,
      );
      if (reviewHandsStr) {
        const hands = JSON.parse(reviewHandsStr) as HandCode[];
        if (Array.isArray(hands) && hands.length > 0) {
          options = { hands, isReviewMode: true };
          console.log(
            "[TrainerRoot] startQuiz with review mode:",
            hands.length,
          );
        }
      }
    } catch (e) {
      console.error(
        "[TrainerRoot] failed to read review hands on startQuiz",
        e,
      );
    }

    // 一度使ったら必ずクリア
    window.localStorage.removeItem(REVIEW_HANDS_KEY);
    setReviewHandsCount(null);

    let newSession: TrainingSession;
    try {
      newSession = trainer.startSession(options);
    } catch (e) {
      alert((e as Error).message);
      return;
    }
    const firstQ = trainer.nextQuestion(newSession);
    setSession(newSession);
    setCurrentQuestion(firstQ);
    setFeedback(null);
    setPhase("QUIZ");
  };

  // 回答処理
  const handleAnswer = (answer: UserAnswer) => {
    const trainer = trainerRef.current;
    if (!trainer || !session || !currentQuestion) return;
    const result = trainer.answerQuestion(
      session,
      currentQuestion,
      answer,
    );
    setSession({ ...session });
    setFeedback(result);
    setPhase("FEEDBACK");
  };

  // このハンドをレンジ表で見る
  const handleViewInRange = () => {
    if (!currentQuestion) return;

    const heroHand = convertHandCodeToGridHand(currentQuestion.hand);
    if (!heroHand) {
      return;
    }

    const heroPosRaw = activeScenario?.heroPosition;
    const validPositions: Position[] = [
      "UTG",
      "MP",
      "CO",
      "BTN",
      "SB",
      "BB",
    ];
    const heroPosition: Position = validPositions.includes(
      heroPosRaw as Position,
    )
      ? (heroPosRaw as Position)
      : "BTN";

    setRangeFocus({
      position: heroPosition,
      hand: heroHand,
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("poker-gto:switch-tab", {
          detail: "editor",
        }),
      );
    }
  };

  // CONFIG 画面でレンジセットが無い場合
  if (!activeRangeSet) {
    return (
      <div className="section section-trainer">
        <h3>プリフロップトレーナー</h3>
        <p style={{ fontSize: "13px", color: "#6b7280" }}>
          レンジセットがありません。エディタータブからレンジセットとシナリオを作成してください。
        </p>
      </div>
    );
  }

  return (
    <div className="section section-trainer">
      <h3>プリフロップトレーナー（React）</h3>
      <div className="section-trainer-content">
        {/* CONFIG 画面 */}
        <div
          className={
            "fade-panel " +
            (phase === "CONFIG" ? "fade-in" : "fade-out")
          }
        >
          {phase === "CONFIG" && (
            <TrainerConfigPanel
              rangeSets={rangeSets}
              activeRangeSet={activeRangeSet}
              activeScenario={activeScenario}
              reviewHandsCount={reviewHandsCount}
              onChangeRangeSet={handleChangeRangeSet}
              onChangeScenario={handleChangeScenario}
              onStartQuiz={handleStartQuiz}
            />
          )}
        </div>

        {/* QUIZ / FEEDBACK */}
        <div
          className={
            "fade-panel " +
            (phase === "QUIZ" || phase === "FEEDBACK"
              ? "fade-in"
              : "fade-out")
          }
        >
          {currentQuestion && (
            <>
              <TrainerQuizView
                key={currentQuestion.hand}
                question={currentQuestion}
                scenarioName={activeScenario?.name ?? null}
                spotLabel={null}
                phase={phase}
                feedback={feedback}
                onSwipeAnswer={handleAnswer}
                onButtonAnswer={handleAnswer}
                onFeedbackClick={() => goNextQuestion()}
              />
              <div className="trainer-view-range">
                <button
                  type="button"
                  className="trainer-view-range-btn"
                  onClick={handleViewInRange}
                >
                  このハンドをレンジ表で見る
                </button>
              </div>
            </>
          )}
        </div>

        {/* RESULT */}
        <div
          className={
            "fade-panel " +
            (phase === "RESULT" ? "fade-in" : "fade-out")
          }
        >
          {session && (
            <TrainerResultView
              session={session}
              onBackToConfig={() => {
                setPhase("CONFIG");
                setSession(null);
                setCurrentQuestion(null);
                setFeedback(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
