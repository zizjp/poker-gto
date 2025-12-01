export const STORAGE_KEYS = {
    SETTINGS: "pftrainer_settings_v1",
    RANGE_SETS: "pftrainer_rangesets_v1",
    TRAINING_SESSIONS: "pftrainer_sessions_v1"
};
export function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        // 失敗してもアプリは落とさない
    }
}
