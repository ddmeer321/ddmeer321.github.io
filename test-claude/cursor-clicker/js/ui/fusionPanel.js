// Fusion-Menü: Cursor mit genug Duplikaten auswählen, Erfolgswahrscheinlichkeiten
// (Ergebnistyp + welche Mutation) einsehen, Fusion starten oder abbrechen.
import { getCursor } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";
import { getMutation } from "../data/mutations.js";
import { getFusableCursorIds, getFusionCost, getDuplicateCount, getFusionOddsPreview, performFusion } from "../core/fusion.js";
import { checkAchievements } from "../core/achievements.js";
import { renderCursorGlyph } from "./cursorGlyph.js";
import { renderOddsRows } from "./oddsDisplay.js";
import { playFusionSequence } from "./modals.js";

const OUTCOME_LABELS = { minorOnly: "Nur Nebenmutation", majorOnly: "Nur Hauptmutation", majorAndMinor: "Haupt- + Nebenmutation" };
const OUTCOME_COLORS = { minorOnly: "#9ca3af", majorOnly: "#a855f7", majorAndMinor: "#fbbf24" };

let cursorList;
let detailPanel;
let emptyHint;
let selectedCursorId = null;

function renderCursorItem(cursorId) {
  const cursor = getCursor(cursorId);
  const rarity = getRarity(cursor.rarity);

  const item = document.createElement("button");
  item.type = "button";
  item.className = "cc-fusion-cursor-item" + (cursorId === selectedCursorId ? " cc-fusion-cursor-active" : "");
  item.innerHTML =
    '<span class="cc-fusion-cursor-icon">' + renderCursorGlyph({ color: rarity.color, badgeIcon: cursor.icon }) + "</span>" +
    '<span class="cc-fusion-cursor-name">' + cursor.name + "</span>" +
    '<span class="cc-fusion-cursor-count">' + getDuplicateCount(cursorId) + "×</span>";
  item.addEventListener("click", () => {
    selectedCursorId = cursorId;
    renderFusionPanel();
  });
  return item;
}

function renderDetail() {
  if (!selectedCursorId) {
    detailPanel.innerHTML = '<p class="cc-empty-hint">Wähle links einen Cursor mit mindestens ' + getFusionCost() + " Duplikaten.</p>";
    return;
  }

  const cursor = getCursor(selectedCursorId);
  const rarity = getRarity(cursor.rarity);
  const cost = getFusionCost(selectedCursorId);
  const available = getDuplicateCount(selectedCursorId);
  const odds = getFusionOddsPreview(selectedCursorId);

  const outcomeRows = odds.outcome.map((row) => ({ label: OUTCOME_LABELS[row.key] || row.key, percent: row.percent, color: OUTCOME_COLORS[row.key] }));
  const majorRows = odds.major.map((row) => ({ label: getMutation(row.key).name, percent: row.percent, color: getMutation(row.key).color }));
  const minorRows = odds.minor.map((row) => ({ label: getMutation(row.key).name, percent: row.percent, color: getMutation(row.key).color }));

  detailPanel.innerHTML =
    '<div class="cc-fusion-detail-head">' +
    '<span class="cc-fusion-detail-icon">' + renderCursorGlyph({ color: rarity.color, badgeIcon: cursor.icon }) + "</span>" +
    "<div><h2>" + cursor.name + "</h2><p>" + available + " Duplikate verfügbar · Kosten je Fusion: " + cost + "</p></div>" +
    "</div>" +
    '<div class="cc-fusion-odds-group"><h3>Ergebnis</h3><div class="cc-odds-list">' + renderOddsRows(outcomeRows) + "</div></div>" +
    '<div class="cc-fusion-odds-group"><h3>Hauptmutation (falls gewürfelt)</h3><div class="cc-odds-list">' + renderOddsRows(majorRows) + "</div></div>" +
    '<div class="cc-fusion-odds-group"><h3>Nebenmutation (falls gewürfelt)</h3><div class="cc-odds-list">' + renderOddsRows(minorRows) + "</div></div>" +
    '<div class="cc-fusion-actions">' +
    '<button class="cc-btn cc-btn-ghost" id="fusion-cancel-btn" type="button">Abbrechen</button>' +
    '<button class="cc-btn cc-btn-primary" id="fusion-start-btn" type="button">Fusion starten</button>' +
    "</div>";

  document.getElementById("fusion-cancel-btn").addEventListener("click", () => {
    selectedCursorId = null;
    renderFusionPanel();
  });
  document.getElementById("fusion-start-btn").addEventListener("click", () => {
    const result = performFusion(selectedCursorId);
    if (!result) return;
    playFusionSequence(result);
    checkAchievements();
    renderFusionPanel();
  });
}

export function renderFusionPanel() {
  const fusableIds = getFusableCursorIds();
  cursorList.replaceChildren(...fusableIds.map(renderCursorItem));
  emptyHint.classList.toggle("hidden", fusableIds.length > 0);

  if (selectedCursorId && !fusableIds.includes(selectedCursorId)) selectedCursorId = null;
  renderDetail();
}

export function initFusionPanel() {
  cursorList = document.getElementById("fusion-cursor-list");
  detailPanel = document.getElementById("fusion-detail");
  emptyHint = document.getElementById("fusion-empty");
  renderFusionPanel();
}
