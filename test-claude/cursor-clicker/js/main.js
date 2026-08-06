// Einstiegspunkt: lädt den Spielstand, initialisiert alle UI-Module und verdrahtet
// globale Abläufe (Autosave, Achievement-Toasts, tägliche Belohnung).
import { state } from "./core/state.js";
import { loadGame, saveGame } from "./core/save.js";
import { events } from "./core/events.js";
import { startPlaytimeTracking } from "./core/stats.js";
import { checkAchievements } from "./core/achievements.js";
import { canClaimDailyReward, getNextRewardAmount, getPreviewStreak, claimDailyReward } from "./core/dailyReward.js";
import { syncMusicWithSettings, playAchievementSound } from "./audio.js";

import { initTabs } from "./ui/tabs.js";
import { renderHud } from "./ui/hud.js";
import { initMainPanel, updateEquippedVisual } from "./ui/mainPanel.js";
import { initBoxesPanel, renderBoxesPanel } from "./ui/boxesPanel.js";
import { initInventoryPanel, renderInventoryPanel } from "./ui/inventoryPanel.js";
import { initStatsPanel, renderStatsPanel } from "./ui/statsPanel.js";
import { initAchievementsPanel, renderAchievementsPanel } from "./ui/achievementsPanel.js";
import { initSettingsPanel, renderSettingsPanel } from "./ui/settingsPanel.js";
import { showDailyRewardModal } from "./ui/modals.js";
import { showToast } from "./ui/toast.js";

const AUTOSAVE_INTERVAL_MS = 8000;

function renderAll() {
  renderHud();
  updateEquippedVisual();
  renderBoxesPanel();
  renderInventoryPanel();
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

  document.getElementById("daily-reward-btn").addEventListener("click", openDailyRewardModal);

  window.addEventListener("beforeunload", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  setInterval(saveGame, AUTOSAVE_INTERVAL_MS);
}

function init() {
  loadGame();

  initTabs();
  initMainPanel();
  initBoxesPanel();
  initInventoryPanel();
  initStatsPanel();
  initAchievementsPanel();
  initSettingsPanel();

  renderAll();
  syncMusicWithSettings();
  startPlaytimeTracking();
  wireGlobalEvents();
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
