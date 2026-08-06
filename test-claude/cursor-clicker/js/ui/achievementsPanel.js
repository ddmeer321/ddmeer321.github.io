// Achievement-Übersicht: freigeschaltete Erfolge farbig, gesperrte ausgegraut.
import { state } from "../core/state.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { formatDate } from "./format.js";

let grid;
let progressText;

function renderCard(achievement) {
  const unlockedAt = state.unlockedAchievements[achievement.id];
  const card = document.createElement("div");
  card.className = "cc-achievement-card" + (unlockedAt ? " cc-achievement-unlocked" : " cc-achievement-locked");
  card.innerHTML =
    '<div class="cc-achievement-icon">' + (unlockedAt ? achievement.icon : "🔒") + "</div>" +
    "<h3>" + achievement.name + "</h3>" +
    '<p class="cc-achievement-desc">' + achievement.description + "</p>" +
    (unlockedAt ? '<p class="cc-achievement-date">Freigeschaltet am ' + formatDate(unlockedAt) + "</p>" : "");
  return card;
}

export function renderAchievementsPanel() {
  grid.replaceChildren(...ACHIEVEMENTS.map(renderCard));
  const unlockedCount = Object.keys(state.unlockedAchievements).length;
  progressText.textContent = unlockedCount + " / " + ACHIEVEMENTS.length + " freigeschaltet";
}

export function initAchievementsPanel() {
  grid = document.getElementById("achievement-grid");
  progressText = document.getElementById("achievements-progress");
  renderAchievementsPanel();
}
