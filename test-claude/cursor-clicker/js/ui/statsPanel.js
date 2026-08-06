// Statistik-Übersicht: Klicks, verdiente Coins, geöffnete Boxen, seltenster Cursor, Spielzeit.
import { state } from "../core/state.js";
import { getRarestOwnedCursor, formatPlaytime } from "../core/stats.js";
import { getRarity } from "../data/rarities.js";
import { formatNumber } from "./format.js";

let grid;

function statCard(label, value, color) {
  const card = document.createElement("div");
  card.className = "cc-stat-card";
  if (color) card.style.setProperty("--stat-color", color);
  card.innerHTML = '<span class="cc-stat-label">' + label + '</span><span class="cc-stat-value">' + value + "</span>";
  return card;
}

export function renderStatsPanel() {
  const rarest = getRarestOwnedCursor();
  const rarestLabel = rarest ? rarest.icon + " " + rarest.name : "—";
  const rarestColor = rarest ? getRarity(rarest.rarity).color : null;

  grid.replaceChildren(
    statCard("Gesamte Klicks", formatNumber(state.totalClicks)),
    statCard("Gesamt verdiente Coins", formatNumber(state.totalCoinsEarned)),
    statCard("Geöffnete Boxen", formatNumber(state.boxesOpened)),
    statCard("Seltenster Cursor", rarestLabel, rarestColor),
    statCard("Spielzeit", formatPlaytime(state.playtimeSeconds))
  );
}

export function initStatsPanel() {
  grid = document.getElementById("stats-grid");
  renderStatsPanel();
}
