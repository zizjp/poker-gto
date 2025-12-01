import type {
  TrainingSession,
  StatsSnapshot,
  GlobalStats,
  RangeStats,
  HandStats,
  RecentSessionSummary
} from "./types";

export function calcStats(sessions: TrainingSession[]): StatsSnapshot {
  const global: GlobalStats = {
    totalSessions: sessions.length,
    totalQuestions: 0,
    totalCorrect: 0,
    accuracy: 0
  };

  const byScenarioMap = new Map<string, RangeStats>();
  const byHandMap = new Map<string, HandStats>();
  const recentSessions: RecentSessionSummary[] = [];

  for (const session of sessions) {
    const questions = session.results.length; // 実際に回答した数
    const correct = session.results.filter((r) => r.isCorrect).length;

    global.totalQuestions += questions;
    global.totalCorrect += correct;

    // シナリオ別集計
    const sKey = session.scenarioId;
    const existingScenario = byScenarioMap.get(sKey);
    if (!existingScenario) {
      byScenarioMap.set(sKey, {
        scenarioId: session.scenarioId,
        scenarioName: "", // UI 側で補完
        totalQuestions: questions,
        totalCorrect: correct,
        accuracy: 0
      });
    } else {
      existingScenario.totalQuestions += questions;
      existingScenario.totalCorrect += correct;
    }

    // ハンド別集計
    for (const r of session.results) {
      const hKey = r.hand;
      const existingHand = byHandMap.get(hKey);
      if (!existingHand) {
        byHandMap.set(hKey, {
          hand: r.hand,
          totalQuestions: 1,
          totalCorrect: r.isCorrect ? 1 : 0,
          accuracy: 0
        });
      } else {
        existingHand.totalQuestions += 1;
        if (r.isCorrect) existingHand.totalCorrect += 1;
      }
    }

    // セッション概要（あとで scenarioName を UI 側で補完）
    const sessionAccuracy = questions > 0 ? correct / questions : 0;
    recentSessions.push({
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      scenarioName: "",
      accuracy: sessionAccuracy,
      questionCount: questions
    });
  }

  global.accuracy =
    global.totalQuestions > 0 ? global.totalCorrect / global.totalQuestions : 0;

  const byScenario: RangeStats[] = [];
  byScenarioMap.forEach((v) => {
    v.accuracy = v.totalQuestions > 0 ? v.totalCorrect / v.totalQuestions : 0;
    byScenario.push(v);
  });

  const byHand: HandStats[] = [];
  byHandMap.forEach((v) => {
    v.accuracy = v.totalQuestions > 0 ? v.totalCorrect / v.totalQuestions : 0;
    byHand.push(v);
  });

  // 最近セッション：新しい順に最大10件
  recentSessions.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const recent = recentSessions.slice(0, 10);

  return {
    global,
    byScenario,
    byHand,
    recentSessions: recent
  };
}

export function getWeakHands(
  stats: StatsSnapshot,
  options?: { minSample?: number; maxAccuracy?: number }
): HandStats[] {
  const minSample = options?.minSample ?? 5;
  const maxAccuracy = options?.maxAccuracy ?? 0.6;

  return stats.byHand
    .filter((h) => h.totalQuestions >= minSample && h.accuracy <= maxAccuracy)
    .sort((a, b) => a.accuracy - b.accuracy);
}
