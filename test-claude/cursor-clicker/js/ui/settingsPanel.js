// Einstellungen: Musik/SFX/Animationen umschalten, Spielstand zurücksetzen.
import { state } from "../core/state.js";
import { events } from "../core/events.js";
import { hardReset, saveGame } from "../core/save.js";
import { syncMusicWithSettings } from "../audio.js";
import { showConfirm } from "./modals.js";

const TOGGLES = [
  { buttonId: "toggle-music", key: "music" },
  { buttonId: "toggle-sfx", key: "sfx" },
  { buttonId: "toggle-animations", key: "animations" },
];

function syncToggleButton(buttonId, key) {
  const btn = document.getElementById(buttonId);
  const active = state.settings[key];
  btn.classList.toggle("cc-toggle-on", active);
  btn.setAttribute("aria-pressed", String(active));
}

function applyAnimationsSetting() {
  document.body.classList.toggle("cc-no-animations", !state.settings.animations);
}

// Wird bei jeder state:changed-Aktualisierung erneut aufgerufen (z.B. nach einem
// Reset), damit die Schalter nie von den echten Einstellungen abweichen.
export function renderSettingsPanel() {
  TOGGLES.forEach(({ buttonId, key }) => syncToggleButton(buttonId, key));
  applyAnimationsSetting();
}

export function initSettingsPanel() {
  TOGGLES.forEach(({ buttonId, key }) => {
    document.getElementById(buttonId).addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      if (key === "music") syncMusicWithSettings();
      saveGame();
      events.emit("state:changed", state);
    });
  });

  document.getElementById("reset-save-btn").addEventListener("click", async () => {
    const confirmed = await showConfirm(
      "Spielstand wirklich zurücksetzen?",
      "Alle Coins, Cursor, Achievements und Statistiken gehen unwiderruflich verloren."
    );
    if (confirmed) hardReset();
  });

  renderSettingsPanel();
}
