import { loadJSON, saveJSON, STORAGE_KEYS } from "./storage";
export function getDefaultSettings() {
    return {
        judgeMode: "FREQUENCY",
        activeRangeSetId: null,
        activeScenarioId: null,
        usePresetScopeId: null,
        customScopeHands: [],
        hapticFeedback: true
    };
}
export function loadSettings() {
    return loadJSON(STORAGE_KEYS.SETTINGS, getDefaultSettings());
}
export function saveSettings(s) {
    saveJSON(STORAGE_KEYS.SETTINGS, s);
}
export function setJudgeMode(mode) {
    const s = loadSettings();
    s.judgeMode = mode;
    saveSettings(s);
}
export function setHaptic(enabled) {
    const s = loadSettings();
    s.hapticFeedback = enabled;
    saveSettings(s);
}
