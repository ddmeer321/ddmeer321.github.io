// Inventar: alle gezogenen Cursor, durchsuchbar, sortierbar, ausrüst- und favorisierbar.
import { state } from "../core/state.js";
import { getCursor } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";
import { equipCursor, toggleFavorite } from "../core/economy.js";

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

function renderCard({ cursor, entry }) {
  const rarity = getRarity(cursor.rarity);
  const isEquipped = state.equippedCursorId === cursor.id;

  const card = document.createElement("div");
  card.className = "cc-inv-card" + (isEquipped ? " cc-inv-card-equipped" : "");
  card.style.setProperty("--rarity-color", rarity.color);
  card.style.setProperty("--rarity-glow", rarity.glow);

  card.innerHTML =
    '<button class="cc-inv-fav" type="button" aria-label="Favorit umschalten">' + (entry.favorite ? "★" : "☆") + "</button>" +
    (entry.count > 1 ? '<span class="cc-inv-count">x' + entry.count + "</span>" : "") +
    '<div class="cc-inv-icon">' + cursor.icon + "</div>" +
    '<div class="cc-inv-rarity">' + rarity.label + "</div>" +
    "<h3>" + cursor.name + "</h3>" +
    '<p class="cc-inv-desc">' + cursor.description + "</p>" +
    '<p class="cc-inv-multiplier">×' + cursor.multiplier + "</p>" +
    '<button class="cc-btn ' + (isEquipped ? "cc-btn-ghost" : "cc-btn-primary") + ' cc-inv-equip" type="button" ' +
      (isEquipped ? "disabled" : "") + ">" + (isEquipped ? "Ausgerüstet" : "Ausrüsten") + "</button>";

  card.querySelector(".cc-inv-fav").addEventListener("click", () => {
    toggleFavorite(cursor.id);
  });
  const equipBtn = card.querySelector(".cc-inv-equip");
  if (!isEquipped) {
    equipBtn.addEventListener("click", () => equipCursor(cursor.id));
  }

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
