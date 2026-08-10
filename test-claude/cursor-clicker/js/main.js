// Einstiegspunkt: lädt den Spielstand, initialisiert alle UI-Module und verdrahtet
// globale Abläufe (Autosave, Achievement-Toasts, tägliche Belohnung).
import { state, SAVE_VERSION } from "./core/state.js";
import { loadGame, saveGame, quickSaveGame } from "./core/save.js";
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

// Kleine, bewusst stabile externe Schnittstelle für spätere Systeme (Quests,
// Cloud-Saves, ein gemeinsames Bibliotheks-Inventar o.ä.), ohne dass diese
// Systeme die internen Module direkt importieren müssten.
function exposeExternalApi() {
  window.CursorClicker = {
    getSnapshot: () => structuredClone(state),
    addCoins: (amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      addCoins(amount);
      saveGame();
    },
    version: SAVE_VERSION,
  };
}

function init() {
  // test-gate.js prüft Zugriff asynchron und kann die Seite währenddessen durch
  // "Kein Zugriff" ersetzen. Bricht das hier bereits passiert, gibt es nichts
  // mehr zu initialisieren.
  if (!document.getElementById("big-cursor-btn")) return;

  loadGame();

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
  exposeExternalApi();
  checkAchievements();

  if (canClaimDailyReward()) {
    openDailyRewardModal();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
