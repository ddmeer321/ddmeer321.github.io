// Einstiegspunkt: lädt den Spielstand, initialisiert alle UI-Module und verdrahtet
// globale Abläufe (Autosave, Achievement-Toasts, tägliche Belohnung).
import { startGameSession } from "./core/session.js";
import { initFactoryEntry } from "./ui/factoryEntry.js";
import { initLoungeEntry } from "./ui/loungeEntry.js";
import { state, SAVE_VERSION } from "./core/state.js";
import { loadGame, saveGame, quickSaveGame, syncFromCloud } from "./core/save.js";
import { events } from "./core/events.js";
import { startPlaytimeTracking } from "./core/stats.js";
import { checkAchievements } from "./core/achievements.js";
import { canClaimDailyReward, getNextRewardAmount, getPreviewStreak, claimDailyReward } from "./core/dailyReward.js";
import { addCoins } from "./core/wallet.js";
import { syncMusicWithSettings, playAchievementSound } from "./audio.js";

import { initTabs } from "./ui/tabs.js";
import { renderHud } from "./ui/hud.js";
import { initMainPanel, updateEquippedVisual } from "./ui/mainPanel.js";
import { initBoxesPanel, renderBoxesPanel } from "./ui/boxesPanel.js";
import { initAuraPanel, renderAuraPanel } from "./ui/auraPanel.js";
import { initFusionPanel, renderFusionPanel } from "./ui/fusionPanel.js";
import { initInventoryPanel, renderInventoryPanel } from "./ui/inventoryPanel.js";
import { initCosmeticsPanel, renderCosmeticsPanel } from "./ui/cosmeticsPanel.js";
import { initStatsPanel, renderStatsPanel } from "./ui/statsPanel.js";
import { initAchievementsPanel, renderAchievementsPanel } from "./ui/achievementsPanel.js";
import { initSettingsPanel, renderSettingsPanel } from "./ui/settingsPanel.js";
import { showDailyRewardModal } from "./ui/modals.js";
import { showToast } from "./ui/toast.js";

const AUTOSAVE_INTERVAL_MS = 8000;
const FULL_AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000;

function renderAll() {
  renderHud();
  updateEquippedVisual();
  renderBoxesPanel();
  renderAuraPanel();
  renderFusionPanel();
  renderInventoryPanel();
  renderCosmeticsPanel();
  renderStatsPanel();
  renderAchievementsPanel();
  renderSettingsPanel();
}

function openDailyRewardModal() {
  const ready = canClaimDailyReward();
  showDailyRewardModal(
    {
      amount: getNextRewardAmount(),
      streak: ready ? getPreviewStreak() : state.dailyReward.streak,
      alreadyClaimed: !ready,
    },
    () => {
      const result = claimDailyReward();
      if (!result) return;
      showToast("Tägliche Belohnung: +" + result.amount + " Coins (Serie: Tag " + result.streak + ")", "success");
      checkAchievements();
      saveGame();
    }
  );
}

function announceUnlockedAchievements(achievements) {
  achievements.forEach((achievement) => {
    showToast("Achievement freigeschaltet: " + achievement.icon + " " + achievement.name, "achievement");
  });
  if (achievements.length) playAchievementSound();
}

function wireGlobalEvents() {
  window.addEventListener("cursor-save-error", () => showToast("Speichern fehlgeschlagen. Bitte prüfe den lokalen Browserspeicher.", "error"));
  events.on("state:changed", renderAll);
  events.on("achievements:unlocked", announceUnlockedAchievements);

  // Seltene/wertvolle Fortschritts-Events sofort vollständig sichern, statt auf
  // den nächsten 8s- oder 3min-Takt zu warten (Box-Ergebnis, Fusion, Level-Up,
  // Achievement wären sonst bis zu 3 Minuten nur im Schnellspeicherstand-losen
  // Zustand — bei einem Absturz in dem Fenster gingen sie verloren).
  events.on("box:opened", saveGame);
  events.on("auraBox:opened", saveGame);
  events.on("fusion:completed", saveGame);
  events.on("cursor:leveledUp", saveGame);
  events.on("achievements:unlocked", saveGame);

  document.getElementById("daily-reward-btn").addEventListener("click", openDailyRewardModal);

  window.addEventListener("beforeunload", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  // 8s: günstige Teilspeicherung (nur Coins/Klicks/Spielzeit) für den häufigen
  // Klick-Takt. 3min: vollständige Speicherung als Sicherheitsnetz für alles
  // andere (Ausrüstung, Einstellungen, ...), zusätzlich zu den obigen
  // Sofort-Speicherungen bei wertvollen Events.
  setInterval(quickSaveGame, AUTOSAVE_INTERVAL_MS);
  setInterval(saveGame, FULL_AUTOSAVE_INTERVAL_MS);
}

// Nur auf dem eigenen Rechner. Gleiches Prinzip wie CLOUD_SYNC_ENABLED in
// core/save.js: was beim Entwickeln nützlich ist, darf auf der Live-Seite
// nicht existieren. Die Prüfung hängt am Hostnamen und nicht an einem
// Schalter, damit sie beim Kopieren der Datei automatisch mitkommt.
const IST_LOKAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

// Kleine, bewusst stabile externe Schnittstelle für spätere Systeme (Quests,
// Cloud-Saves, ein gemeinsames Bibliotheks-Inventar o.ä.), ohne dass diese
// Systeme die internen Module direkt importieren müssten.
function exposeExternalApi() {
  window.CursorClicker = {
    getSnapshot: () => structuredClone(state),
    version: SAVE_VERSION,
  };

  // addCoins war ein Werkzeug zum lokalen Testen und ist beim Veröffentlichen
  // mitgekommen: eine Zeile in der Browser-Konsole reichte, um sich beliebig
  // viele Münzen zu geben, und saveGame() schrieb das sofort in die Cloud.
  // Münzen kaufen Kisten, Kisten geben echte Cursor -- der Weg ins Inventar
  // ging also durch die ganz normale Mechanik und fiel entsprechend nicht auf.
  if (!IST_LOKAL) return;
  window.CursorClicker.addCoins = (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    addCoins(amount);
    saveGame();
  };
}

async function init() {
  // test-gate.js prüft Zugriff asynchron und kann die Seite währenddessen durch
  // "Kein Zugriff" ersetzen. Bricht das hier bereits passiert, gibt es nichts
  // mehr zu initialisieren.
  if (!document.getElementById("big-cursor-btn")) return;

  if (!await startGameSession(saveGame)) return;
  loadGame();
  await syncFromCloud();

  initTabs();
  initMainPanel();
  initBoxesPanel();
  initAuraPanel();
  initFusionPanel();
  initInventoryPanel();
  initCosmeticsPanel();
  initStatsPanel();
  initAchievementsPanel();
  initSettingsPanel();

  renderAll();
  syncMusicWithSettings();
  startPlaytimeTracking();
  wireGlobalEvents();
  initFactoryEntry();
  initLoungeEntry();
  exposeExternalApi();
  checkAchievements();

  // Der initiale Cloud-Abgleich ist vor der Bedienung abgeschlossen oder
  // nach vier Sekunden verworfen. Keine verspätete Antwort ersetzt das Spiel.
  const loadingScreen = document.getElementById("game-loading-screen");
  function hideLoadingScreen() {
    if (!loadingScreen || loadingScreen.hidden) return;
    loadingScreen.classList.add("is-fading");
    setTimeout(() => { loadingScreen.hidden = true; }, 260);
  }
  hideLoadingScreen();

  if (canClaimDailyReward()) {
    openDailyRewardModal();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
