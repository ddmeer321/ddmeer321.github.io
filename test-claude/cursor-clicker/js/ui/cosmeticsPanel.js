// Cosmetics-Menü: freigeschaltete Overlays ausrüsten. Rein visuell, kein
// Gameplay-Effekt — siehe data/cosmetics.js und core/cosmetics.js.
import { state } from "../core/state.js";
import { COSMETICS } from "../data/cosmetics.js";
import { isCosmeticUnlocked, equipCosmetic } from "../core/cosmetics.js";
import { renderCursorGlyph } from "./cursorGlyph.js";

let grid;

function renderCard({ id, name, description, cssClass }) {
  const unlocked = id === null || isCosmeticUnlocked(id);
  const equipped = state.equippedCosmeticId === id;

  const card = document.createElement("div");
  card.className = "cc-cosmetic-card" + (unlocked ? "" : " cc-cosmetic-locked") + (equipped ? " cc-cosmetic-equipped" : "");
  // Cosmetic = Hintergrund/Rahmen des Kreises (siehe mutations-cosmetics.css),
  // die Klasse gehört deshalb auf den Vorschau-Kreis selbst, nicht in den Glyphen.
  const previewClass = "cc-cosmetic-preview" + (unlocked && cssClass ? " " + cssClass : "");
  card.innerHTML =
    '<div class="' + previewClass + '">' + renderCursorGlyph({ color: "#7c5cff" }) + "</div>" +
    "<h3>" + name + "</h3>" +
    '<p class="cc-cosmetic-desc">' + description + "</p>" +
    (unlocked
      ? '<button class="cc-btn ' + (equipped ? "cc-btn-ghost" : "cc-btn-primary") + ' cc-cosmetic-equip" type="button" ' + (equipped ? "disabled" : "") + ">" + (equipped ? "Ausgerüstet" : "Ausrüsten") + "</button>"
      : '<p class="cc-cosmetic-locked-label">🔒 Über Achievements freischaltbar</p>');

  if (unlocked && !equipped) {
    card.querySelector(".cc-cosmetic-equip").addEventListener("click", () => equipCosmetic(id));
  }
  return card;
}

export function renderCosmeticsPanel() {
  const entries = [
    { id: null, name: "Kein Cosmetic", description: "Der Cursor bleibt unverziert.", cssClass: null },
    ...COSMETICS,
  ];
  grid.replaceChildren(...entries.map(renderCard));
}

export function initCosmeticsPanel() {
  grid = document.getElementById("cosmetics-grid");
  renderCosmeticsPanel();
}
