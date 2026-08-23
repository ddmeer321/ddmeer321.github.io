// Boxen-Shop: Karten aus data/boxes.js rendern, Kauf + Öffnungssequenz anstoßen.
// Zeigt die Drop-Chancen direkt sichtbar an (Balken je Seltenheit).
import { BOXES } from "../data/boxes.js";
import { getRarity } from "../data/rarities.js";
import { canAfford } from "../core/economy.js";
import { openBox } from "../core/gacha.js";
import { checkAchievements } from "../core/achievements.js";
import { formatNumber } from "./format.js";
import { renderOddsRows } from "./oddsDisplay.js";
import { playBoxOpen } from "./modals.js";

let grid;

function boxOddsRows(box) {
  return Object.entries(box.odds)
    .map(([rarityId, percent]) => ({ label: getRarity(rarityId).label, percent, color: getRarity(rarityId).color }))
    .sort((a, b) => b.percent - a.percent);
}

function renderBoxCard(box) {
  const card = document.createElement("div");
  card.className = "cc-box-card";
  card.innerHTML =
    '<div class="cc-box-icon">' + box.icon + "</div>" +
    "<h3>" + box.name + "</h3>" +
    '<p class="cc-box-desc">' + box.description + "</p>" +
    '<div class="cc-odds-list">' + renderOddsRows(boxOddsRows(box)) + "</div>" +
    '<button class="cc-btn cc-btn-primary cc-box-buy" type="button">' + formatNumber(box.price) + " Coins</button>";

  const buyBtn = card.querySelector(".cc-box-buy");
  buyBtn.disabled = !canAfford(box.price);
  buyBtn.addEventListener("click", () => {
    const result = openBox(box.id);
    if (!result) return;
    playBoxOpen(result);
    checkAchievements();
  });

  return card;
}

export function renderBoxesPanel() {
  grid.replaceChildren(...BOXES.map(renderBoxCard));
}

export function initBoxesPanel() {
  grid = document.getElementById("box-grid");
  renderBoxesPanel();
}
