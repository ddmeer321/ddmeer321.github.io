// Aura-Tab: Aura-Boxen (mit sichtbaren Drop-Chancen) öffnen, Aura-Inventar
// verwalten, maximal eine Aura gleichzeitig ausrüsten. Spiegelt bewusst den
// Aufbau von boxesPanel.js/cosmeticsPanel.js — gleiches Muster, andere Sammlung.
import { AURA_BOXES } from "../data/auraBoxes.js";
import { AURAS, getAuraFactor } from "../data/auras.js";
import { getRarity } from "../data/rarities.js";
import { canAfford } from "../core/economy.js";
import { openAuraBox } from "../core/auraGacha.js";
import { isAuraOwned, getAuraCount, equipAura, isAuraEquipped, getEquippedAura } from "../core/auras.js";
import { checkAchievements } from "../core/achievements.js";
import { renderOddsRows } from "./oddsDisplay.js";
import { renderAuraLayer } from "./auraGlyph.js";
import { renderCursorGlyph } from "./cursorGlyph.js";
import { formatNumber } from "./format.js";
import { playAuraBoxOpen } from "./modals.js";

let boxGrid;
let inventoryGrid;
let emptyHint;

function auraOddsRows(box) {
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
    '<div class="cc-odds-list">' + renderOddsRows(auraOddsRows(box)) + "</div>" +
    '<button class="cc-btn cc-btn-primary cc-box-buy" type="button">' + formatNumber(box.price) + " Coins</button>";

  const buyBtn = card.querySelector(".cc-box-buy");
  buyBtn.disabled = !canAfford(box.price);
  buyBtn.addEventListener("click", () => {
    const result = openAuraBox(box.id);
    if (!result) return;
    playAuraBoxOpen(result);
    checkAchievements();
  });

  return card;
}

// "Keine Aura" — jederzeit verfügbar, nie gesperrt. Der Spieler darf niemals
// gezwungen sein, eine Aura auszurüsten (siehe Design-Regeln).
function renderNoneAuraCard() {
  const equipped = !getEquippedAura();
  const card = document.createElement("div");
  card.className = "cc-aura-card" + (equipped ? " cc-aura-card-equipped" : "");
  card.innerHTML =
    '<div class="cc-aura-preview">' + renderCursorGlyph({ color: "#7c5cff" }) + "</div>" +
    '<div class="cc-aura-rarity">—</div>' +
    "<h3>Keine Aura</h3>" +
    '<p class="cc-aura-desc">Der Cursor bleibt ohne Umgebungs-Effekt.</p>' +
    '<button class="cc-btn ' + (equipped ? "cc-btn-ghost" : "cc-btn-primary") + ' cc-aura-equip" type="button" ' + (equipped ? "disabled" : "") + ">" + (equipped ? "Ausgerüstet" : "Ausrüsten") + "</button>";
  if (!equipped) {
    card.querySelector(".cc-aura-equip").addEventListener("click", () => equipAura(null));
  }
  return card;
}

function renderAuraCard(aura) {
  const rarity = getRarity(aura.rarity);
  const owned = isAuraOwned(aura.id);
  const count = getAuraCount(aura.id);
  const equipped = isAuraEquipped(aura.id);
  const factor = getAuraFactor(aura);

  const card = document.createElement("div");
  card.className = "cc-aura-card" + (owned ? "" : " cc-cosmetic-locked") + (equipped ? " cc-aura-card-equipped" : "");
  card.style.setProperty("--rarity-color", rarity.color);
  card.style.setProperty("--rarity-glow", rarity.glow);

  // Vorschau immer zeigen (auch gesperrt: neutraler Cursor ohne Partikel),
  // damit die Karten in der Grid gleich hoch bleiben — Layout wie cosmeticsPanel.js.
  const previewContent = owned
    ? renderAuraLayer(aura) + renderCursorGlyph({ color: "#7c5cff", extraClasses: ["cc-aura-preview-glyph"] })
    : renderCursorGlyph({ color: "#7c5cff", extraClasses: ["cc-aura-preview-glyph"] });

  card.innerHTML =
    (count > 1 ? '<span class="cc-aura-count">x' + count + "</span>" : "") +
    '<div class="cc-aura-preview">' + previewContent + "</div>" +
    '<div class="cc-aura-rarity">' + rarity.label + "</div>" +
    "<h3>" + aura.name + "</h3>" +
    '<p class="cc-aura-desc">' + aura.description + "</p>" +
    '<p class="cc-aura-bonus">Klick-Ertrag: +' + aura.clickBonus.toLocaleString("de-DE") + "×</p>" +
    '<p class="cc-aura-bonus-detail">Endgültiger Aura-Faktor: ' + factor.toLocaleString("de-DE") + "×</p>" +
    (owned
      ? '<button class="cc-btn ' + (equipped ? "cc-btn-ghost" : "cc-btn-primary") + ' cc-aura-equip" type="button" ' + (equipped ? "disabled" : "") + ">" + (equipped ? "Ausgerüstet" : "Ausrüsten") + "</button>"
      : '<p class="cc-cosmetic-locked-label">🔒 Noch nicht gezogen</p>');

  if (owned && !equipped) {
    card.querySelector(".cc-aura-equip").addEventListener("click", () => equipAura(aura.id));
  }
  return card;
}

export function renderAuraPanel() {
  boxGrid.replaceChildren(...AURA_BOXES.map(renderBoxCard));

  const ownedAuras = AURAS.filter((a) => isAuraOwned(a.id));
  inventoryGrid.replaceChildren(renderNoneAuraCard(), ...AURAS.map(renderAuraCard));
  emptyHint.classList.toggle("hidden", ownedAuras.length > 0);
}

export function initAuraPanel() {
  boxGrid = document.getElementById("aura-box-grid");
  inventoryGrid = document.getElementById("aura-inventory-grid");
  emptyHint = document.getElementById("aura-inventory-empty");
  renderAuraPanel();
}
