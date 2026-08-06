// Boxen-Shop: Karten aus data/boxes.js rendern, Kauf + Öffnungssequenz anstoßen.
import { state } from "../core/state.js";
import { BOXES } from "../data/boxes.js";
import { canAfford } from "../core/economy.js";
import { openBox } from "../core/gacha.js";
import { checkAchievements } from "../core/achievements.js";
import { formatNumber } from "./format.js";
import { playBoxOpen } from "./modals.js";

let grid;

function renderBoxCard(box) {
  const card = document.createElement("div");
  card.className = "cc-box-card";
  card.innerHTML =
    '<div class="cc-box-icon">' + box.icon + "</div>" +
    "<h3>" + box.name + "</h3>" +
    '<p class="cc-box-desc">' + box.description + "</p>" +
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
