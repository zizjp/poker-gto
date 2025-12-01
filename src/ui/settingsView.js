import { loadSettings, saveSettings } from "../core/settings";
export function renderSettingsView() {
    const settings = loadSettings();
    const freqChecked = settings.judgeMode === "FREQUENCY" ? "checked" : "";
    const probChecked = settings.judgeMode === "PROBABILISTIC" ? "checked" : "";
    const hapticChecked = settings.hapticFeedback ? "checked" : "";
    return `
    <div class="section">
      <h3>正誤判定モード</h3>
      <p style="font-size:11px;color:#6b7280;margin-top:0;margin-bottom:6px;">
        FREQUENCY: 一番頻度の高いアクションが正解（同率複数は全部正解扱い）<br>
        PROBABILISTIC: レンジの頻度に応じて毎回正解が揺れます。
      </p>
      <div class="settings-row">
        <label class="radio-label">
          <input
            type="radio"
            name="judgeMode"
            value="FREQUENCY"
            ${freqChecked}
          />
          <span>FREQUENCY（頻度固定）</span>
        </label>
      </div>
      <div class="settings-row">
        <label class="radio-label">
          <input
            type="radio"
            name="judgeMode"
            value="PROBABILISTIC"
            ${probChecked}
          />
          <span>PROBABILISTIC（確率的）</span>
        </label>
      </div>
    </div>

    <div class="section">
      <h3>その他設定</h3>
      <div class="settings-row">
        <label class="switch-label">
          <input
            type="checkbox"
            id="hapticToggle"
            ${hapticChecked}
          />
          <span>ハプティックフィードバック（対応端末のみ）</span>
        </label>
      </div>
    </div>

    <div class="section">
      <h3>データリセット</h3>
      <p style="font-size:11px;color:#ef4444;margin-top:0;margin-bottom:8px;">
        設定・レンジ・学習履歴をすべて削除し、初期状態に戻します。<br>
        一度実行すると元には戻せません。
      </p>
      <button id="dataResetBtn" class="button button-danger">
        すべてのデータをリセット
      </button>
    </div>
  `;
}
export function initSettingsViewEvents() {
    const settings = loadSettings();
    // 正誤判定モード
    const judgeModeInputs = document.querySelectorAll('input[name="judgeMode"]');
    judgeModeInputs.forEach((input) => {
        input.addEventListener("change", () => {
            const value = input.value === "PROBABILISTIC" ? "PROBABILISTIC" : "FREQUENCY";
            const s = loadSettings();
            s.judgeMode = value;
            saveSettings(s);
        });
    });
    // ハプティックON/OFF
    const hapticToggle = document.getElementById("hapticToggle");
    if (hapticToggle) {
        hapticToggle.checked = !!settings.hapticFeedback;
        hapticToggle.addEventListener("change", () => {
            const s = loadSettings();
            s.hapticFeedback = hapticToggle.checked;
            saveSettings(s);
            // 実装は将来的に navigator.vibrate 等で対応
        });
    }
    // データリセット
    const dataResetBtn = document.getElementById("dataResetBtn");
    if (dataResetBtn) {
        dataResetBtn.addEventListener("click", () => {
            const ok = window.confirm("本当にすべてのデータを削除して初期化しますか？\nレンジ・学習履歴・設定がすべて失われます。");
            if (!ok)
                return;
            try {
                window.localStorage.removeItem("pftrainer_settings_v1");
                window.localStorage.removeItem("pftrainer_rangesets_v1");
                window.localStorage.removeItem("pftrainer_sessions_v1");
            }
            catch (e) {
                console.error(e);
            }
            window.location.reload();
        });
    }
}
