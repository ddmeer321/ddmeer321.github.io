// Der große klickbare Cursor: Klick-Handling, fliegende "+N"-Zahlen, Glyph +
// Glow passend zum ausgerüsteten Cursor (inkl. Level/Mutation/Cosmetic).
import { state } from "../core/state.js";
import { registerClick } from "../core/economy.js";
import { getEquippedLoadout } from "../core/loadout.js";
import { checkAchievements } from "../core/achievements.js";
import { playClickSound } from "../audio.js";
import { formatNumber } from "./format.js";
import { getRarity } from "../data/rarities.js";
import { getCursorMaterial } from "../data/cursorMaterials.js";
import { getEquippedAura } from "../core/auras.js";
import { renderCursorGlyph } from "./cursorGlyph.js";
import { renderAuraLayer } from "./auraGlyph.js";
import { playClickEffect } from "./effectRenderer.js";

let button;
let iconSlot;
let floatLayer;
let auraLayerSlot;
let comboPill;
let comboValue;
let comboCount = 0;
let comboResetTimer = null;
let lastRenderedAuraId; // undefined bis zum ersten Render, damit dieses immer läuft
let lastCosmeticClass = null;

const COMBO_RESET_MS = 1600;

// Rein visuelles Feedback (keine Coin-Auswirkung) — bewusst UI-lokal, nicht im State.
function registerComboClick() {
  comboCount += 1;
  comboValue.textContent = comboCount;
  comboPill.classList.add("cc-combo-pill-visible");
  clearTimeout(comboResetTimer);
  comboResetTimer = setTimeout(() => {
    comboCount = 0;
    comboPill.classList.remove("cc-combo-pill-visible");
  }, COMBO_RESET_MS);
}

function spawnFloatingGain(gain, clientX, clientY) {
  if (!state.settings.animations) return;
  const stageRect = floatLayer.getBoundingClientRect();
  const el = document.createElement("span");
  el.className = "cc-float-gain";
  el.textContent = "+" + formatNumber(gain);
  el.style.left = clientX - stageRect.left + "px";
  el.style.top = clientY - stageRect.top + "px";
  floatLayer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function updateEquippedVisual() {
  const loadout = getEquippedLoadout();
  const rarity = loadout.cursor ? getRarity(loadout.cursor.rarity) : null;

  iconSlot.innerHTML = renderCursorGlyph({
    cursor: loadout.cursor,
    material: loadout.cursor ? getCursorMaterial(loadout.cursor.id) : null,
    color: rarity ? rarity.color : "#7c5cff",
    extraClasses: loadout.visualClasses,
  });

  // Cosmetic = Hintergrund/Rahmen des Kreises, nicht des Glyphen — Klasse
  // sitzt direkt auf dem Button (siehe mutations-cosmetics.css).
  if (loadout.cosmeticClass !== lastCosmeticClass) {
    if (lastCosmeticClass) button.classList.remove(lastCosmeticClass);
    if (loadout.cosmeticClass) button.classList.add(loadout.cosmeticClass);
    lastCosmeticClass = loadout.cosmeticClass;
  }

  // Der Aura-Layer arbeitet mit dauerhaft laufenden CSS-Animationen (Partikel
  // treiben/umkreisen/blitzen). updateEquippedVisual() läuft bei JEDER
  // state:changed-Änderung, also auch bei jedem Klick — ohne dieses Caching
  // würde der Layer bei jedem Klick neu erzeugt und alle Animationen sprången
  // zurück auf Frame 0 ("Sägezahn"-Ruckeln). Nur neu rendern, wenn sich die
  // ausgerüstete Aura tatsächlich geändert hat.
  const aura = getEquippedAura();
  const auraId = aura ? aura.id : null;
  if (auraId !== lastRenderedAuraId) {
    auraLayerSlot.innerHTML = renderAuraLayer(aura);
    lastRenderedAuraId = auraId;
  }

  button.style.setProperty("--equipped-glow", rarity ? rarity.glow : "rgba(124,92,255,0.55)");
  button.style.setProperty("--equipped-color", rarity ? rarity.color : "#7c5cff");
}

export function initMainPanel() {
  button = document.getElementById("big-cursor-btn");
  iconSlot = document.getElementById("big-cursor-icon");
  floatLayer = document.getElementById("click-float-layer");
  auraLayerSlot = document.getElementById("aura-layer-slot");
  comboPill = document.getElementById("combo-pill");
  comboValue = document.getElementById("combo-value");

  button.addEventListener("click", (event) => {
    const gained = registerClick();
    spawnFloatingGain(gained, event.clientX, event.clientY);
    playClickEffect(getEquippedLoadout().particle, event.clientX, event.clientY, floatLayer);
    registerComboClick();
    playClickSound();
    checkAchievements();
    button.classList.remove("cc-cursor-pulse");
    void button.offsetWidth; // Animation neu triggern
    if (state.settings.animations) button.classList.add("cc-cursor-pulse");
  });

  updateEquippedVisual();
}
