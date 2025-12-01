import { loadJSON, saveJSON, STORAGE_KEYS } from "./storage";
function nowIso() {
    return new Date().toISOString();
}
function createDefaultRangeSet() {
    const hands = {
        "AA": { raise: 100, call: 0, fold: 0 },
        "KK": { raise: 100, call: 0, fold: 0 },
        "QQ": { raise: 90, call: 10, fold: 0 },
        "AKs": { raise: 80, call: 20, fold: 0 },
        "AQs": { raise: 70, call: 20, fold: 10 },
        "AKo": { raise: 70, call: 20, fold: 10 },
        "TT": { raise: 70, call: 20, fold: 10 },
        "99": { raise: 60, call: 20, fold: 20 }
    };
    const enabledHandCodes = Object.keys(hands);
    const scenario = {
        id: "default_open_btn",
        name: "BTN オープン 40BB",
        heroPosition: "BTN",
        villainPosition: undefined,
        stackSizeBB: 40,
        scenarioType: "OPEN",
        hands,
        enabledHandCodes
    };
    const now = nowIso();
    const rangeSet = {
        meta: {
            id: "default_8max_open",
            name: "デフォルトオープンレンジ",
            description: "サンプル用デフォルトレンジ",
            createdAt: now,
            updatedAt: now,
            gameType: "8max_BB_ante",
            version: 1
        },
        scenarios: [scenario]
    };
    return rangeSet;
}
export function loadRangeSets() {
    const stored = loadJSON(STORAGE_KEYS.RANGE_SETS, []);
    if (stored.length === 0) {
        const def = createDefaultRangeSet();
        saveRangeSets([def]);
        return [def];
    }
    return stored;
}
export function saveRangeSets(rangeSets) {
    saveJSON(STORAGE_KEYS.RANGE_SETS, rangeSets);
}
export function findRangeSetById(rangeSets, id) {
    if (!id)
        return rangeSets[0] ?? null;
    return rangeSets.find(r => r.meta.id === id) ?? rangeSets[0] ?? null;
}
export function findScenarioById(rangeSet, scenarioId) {
    if (!rangeSet)
        return null;
    if (!scenarioId)
        return rangeSet.scenarios[0] ?? null;
    return rangeSet.scenarios.find(s => s.id === scenarioId) ?? rangeSet.scenarios[0] ?? null;
}
