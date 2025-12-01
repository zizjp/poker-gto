import { loadJSON, saveJSON, STORAGE_KEYS } from "./storage";
import type { AppSettings, JudgeMode } from "./types";

export function getDefaultSettings(): AppSettings {
  return {
    judgeMode: "FREQUENCY",
    activeRangeSetId: null,
    activeScenarioId: null,
    usePresetScopeId: null,
    customScopeHands: [],
    hapticFeedback: true
  };
}

export function loadSettings(): AppSettings {
  return loadJSON<AppSettings>(STORAGE_KEYS.SETTINGS, getDefaultSettings());
}

export function saveSettings(s: AppSettings) {
  saveJSON(STORAGE_KEYS.SETTINGS, s);
}

export function setJudgeMode(mode: JudgeMode) {
  const s = loadSettings();
  s.judgeMode = mode;
  saveSettings(s);
}

export function setHaptic(enabled: boolean) {
  const s = loadSettings();
  s.hapticFeedback = enabled;
  saveSettings(s);
}
