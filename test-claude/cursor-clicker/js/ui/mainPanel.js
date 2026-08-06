// Der große klickbare Cursor: Klick-Handling, fliegende "+N"-Zahlen, Glow passend
// zum ausgerüsteten Cursor.
import { state } from "../core/state.js";
import { registerClick, getEquippedCursor } from "../core/economy.js";
import { checkAchievements } from "../core/achievements.js";
import { playClickSound } from "../audio.js";
import { formatNumber } from "./format.js";
import { getRarity } from "../data/rarities.js";

let button;
let icon;
let floatLayer;

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
  const equipped = getEquippedCursor();
  icon.textContent = equipped ? equipped.icon : "🖱️";
  const rarity = equipped ? getRarity(equipped.rarity) : null;
  button.style.setProperty("--equipped-glow", rarity ? rarity.glow : "rgba(124,92,255,0.55)");
  button.style.setProperty("--equipped-color", rarity ? rarity.color : "#7c5cff");
}

export function initMainPanel() {
  button = document.getElementById("big-cursor-btn");
  icon = document.getElementById("big-cursor-icon");
  floatLayer = document.getElementById("click-float-layer");

  button.addEventListener("click", (event) => {
    const gained = registerClick();
    spawnFloatingGain(gained, event.clientX, event.clientY);
    playClickSound();
    checkAchievements();
    button.classList.remove("cc-cursor-pulse");
    void button.offsetWidth; // Animation neu triggern
    if (state.settings.animations) button.classList.add("cc-cursor-pulse");
  });

  updateEquippedVisual();
}
