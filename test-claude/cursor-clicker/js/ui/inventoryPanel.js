// Inventar: alle gezogenen Cursor, durchsuchbar, sortierbar, favorisierbar,
// aufwertbar (Upgrades) und in jeder besessenen Variante (Basis oder mutiert
// durch Fusion) einzeln ausrüstbar.
import { state } from "../core/state.js";
import { getCursor } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";
import { getMutation } from "../data/mutations.js";
import { toggleFavorite } from "../core/economy.js";
import { equipCursor, isEquipped } from "../core/loadout.js";
import { getCursorLevel, getLevelBonusMultiplier, isMaxLevel, getUpgradeCost, canUpgrade, upgradeCursor, MAX_LEVEL, LEVEL_BONUS_PER_LEVEL } from "../core/upgrades.js";
import { checkAchievements } from "../core/achievements.js";
import { getCursorMaterial } from "../data/cursorMaterials.js";
import { renderCursorGlyph } from "./cursorGlyph.js";
import { formatNumber, formatMultiplier } from "./format.js";

function mutationBonusLabel(mutation) {
  if (!mutation) return "";
  const parts = [];
  if (mutation.effects.multiplierBonusPercent) parts.push("+" + mutation.effects.multiplierBonusPercent + "% Multiplikator");
  if (mutation.effects.coinBonusPercent) parts.push("+" + mutation.effects.coinBonusPercent + "% Coins");
  if (mutation.effects.dropChanceBonusPercent) parts.push("+" + mutation.effects.dropChanceBonusPercent + "% Fusionschance");
  return parts.length ? mutation.name + ": " + parts.join(", ") : mutation.name + ": rein kosmetisch";
}

let grid;
let searchInput;
let sortSelect;
let emptyHint;

function getOwnedEntries() {
  return Object.entries(state.ownedCursors)
    .map(([id, entry]) => ({ cursor: getCursor(id), entry }))
    .filter((row) => row.cursor);
}

function applySearch(rows, query) {
  if (!query) return rows;
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => row.cursor.name.toLowerCase().includes(needle));
}

function applySort(rows, sortBy) {
  const sorted = [...rows];
  switch (sortBy) {
    case "rarity-asc":
      sorted.sort((a, b) => getRarity(a.cursor.rarity).order - getRarity(b.cursor.rarity).order);
      break;
    case "name":
      sorted.sort((a, b) => a.cursor.name.localeCompare(b.cursor.name));
      break;
    case "count":
      sorted.sort((a, b) => b.entry.count - a.entry.count);
      break;
    case "favorite":
      sorted.sort((a, b) => Number(b.entry.favorite) - Number(a.entry.favorite));
      break;
    case "rarity-desc":
    default:
      sorted.sort((a, b) => getRarity(b.cursor.rarity).order - getRarity(a.cursor.rarity).order);
  }
  return sorted;
}

function renderVariantChip(cursor, instance) {
  const equipped = isEquipped(cursor.id, instance ? instance.instanceId : null);
  const majorMutation = instance ? getMutation(instance.major) : null;
  const minorMutation = instance ? getMutation(instance.minor) : null;
  const label = instance
    ? "✦ " + [majorMutation?.name, minorMutation?.name].filter(Boolean).join("+")
    : "Basis";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "cc-inv-variant" + (equipped ? " cc-inv-variant-active" : "");
  chip.textContent = equipped ? label + " ✓" : label;
  chip.disabled = equipped;
  if (instance) {
    // Konkrete Boni als natives Tooltip, damit die kompakte Chip-Ansicht nicht überladen wird.
    chip.title = [majorMutation, minorMutation].filter(Boolean).map(mutationBonusLabel).join(" · ");
  }
  if (!equipped) {
    chip.addEventListener("click", () => equipCursor(cursor.id, instance ? instance.instanceId : null));
  }
  return chip;
}

function renderCard({ cursor, entry }) {
  const rarity = getRarity(cursor.rarity);
  const level = getCursorLevel(cursor.id);
  const levelBonus = getLevelBonusMultiplier(cursor.id);
  const currentMultiplier = cursor.multiplier + levelBonus;
  const maxed = isMaxLevel(cursor.id);
  const nextMultiplier = maxed ? null : currentMultiplier + LEVEL_BONUS_PER_LEVEL;
  const upgradeCost = maxed ? null : getUpgradeCost(cursor.id);
  const mutatedInstances = state.mutatedCursors[cursor.id] || [];

  const card = document.createElement("div");
  card.className = "cc-inv-card";
  card.style.setProperty("--rarity-color", rarity.color);
  card.style.setProperty("--rarity-glow", rarity.glow);

  card.innerHTML =
    '<button class="cc-inv-fav" type="button" aria-label="Favorit umschalten">' + (entry.favorite ? "★" : "☆") + "</button>" +
    (entry.count > 1 ? '<span class="cc-inv-count">x' + entry.count + "</span>" : "") +
    '<div class="cc-inv-icon">' + renderCursorGlyph({ cursor, material: getCursorMaterial(cursor.id), color: rarity.color }) + "</div>" +
    '<div class="cc-inv-rarity">' + rarity.label + " · Lv. " + level + " / " + MAX_LEVEL + "</div>" +
    "<h3>" + cursor.name + "</h3>" +
    '<p class="cc-inv-desc">' + cursor.description + "</p>" +
    '<p class="cc-inv-multiplier">Aktuell ' + formatMultiplier(currentMultiplier) +
      '<span class="cc-inv-multiplier-detail"> (Basis ' + formatMultiplier(cursor.multiplier) + (levelBonus > 0 ? " + Level " + formatMultiplier(levelBonus) : "") + ")</span></p>" +
    (maxed
      ? '<p class="cc-inv-next">Maximales Level erreicht.</p>'
      : '<p class="cc-inv-next">Nächstes Level: ' + formatMultiplier(nextMultiplier) + "</p>") +
    '<button class="cc-btn cc-btn-ghost cc-inv-upgrade" type="button">' +
      (maxed ? "MAX" : "Upgrade · " + formatNumber(upgradeCost) + " Coins") +
      "</button>" +
    '<div class="cc-inv-variants"></div>';

  card.querySelector(".cc-inv-fav").addEventListener("click", () => toggleFavorite(cursor.id));

  const upgradeBtn = card.querySelector(".cc-inv-upgrade");
  upgradeBtn.disabled = maxed || !canUpgrade(cursor.id);
  if (!maxed) {
    upgradeBtn.addEventListener("click", () => {
      if (upgradeCursor(cursor.id)) checkAchievements();
    });
  }

  const variantsEl = card.querySelector(".cc-inv-variants");
  // Die Basisvariante ist nur ausrüstbar/anzeigbar, solange mindestens ein
  // unmutiertes Exemplar übrig ist — Fusion kann es auf 0 verbrauchen.
  if (entry.count > 0) variantsEl.appendChild(renderVariantChip(cursor, null));
  mutatedInstances.forEach((instance) => variantsEl.appendChild(renderVariantChip(cursor, instance)));

  return card;
}

export function renderInventoryPanel() {
  const owned = getOwnedEntries();
  const rows = applySort(applySearch(owned, searchInput.value), sortSelect.value);
  grid.replaceChildren(...rows.map(renderCard));

  emptyHint.classList.toggle("hidden", rows.length > 0);
  emptyHint.textContent =
    owned.length === 0
      ? "Noch keine Cursor gezogen. Öffne eine Box, um loszulegen!"
      : "Keine Cursor gefunden, die zu deiner Suche passen.";
}

export function initInventoryPanel() {
  grid = document.getElementById("inventory-grid");
  searchInput = document.getElementById("inventory-search");
  sortSelect = document.getElementById("inventory-sort");
  emptyHint = document.getElementById("inventory-empty");

  searchInput.addEventListener("input", renderInventoryPanel);
  sortSelect.addEventListener("change", renderInventoryPanel);

  renderInventoryPanel();
}
