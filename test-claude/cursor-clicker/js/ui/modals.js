// Modale Dialoge: Box-Öffnungsanimation, Cursor-Reveal (mit Extra-Feier bei seltenen
// Drops), täglicher Bonus und ein generischer Bestätigungsdialog.
import { state } from "../core/state.js";
import { getRarity, isRareDrop } from "../data/rarities.js";
import { formatNumber } from "./format.js";
import { playBoxOpenSound, playRareDropSound } from "../audio.js";

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function spawnCelebrationParticles(container, color) {
  if (!state.settings.animations) return;
  for (let i = 0; i < 18; i++) {
    const particle = document.createElement("span");
    particle.className = "cc-particle";
    particle.style.setProperty("--angle", Math.random() * 360 + "deg");
    particle.style.setProperty("--distance", 60 + Math.random() * 90 + "px");
    particle.style.background = color;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 1200);
  }
}

export function playBoxOpen(result) {
  const { box, cursor, isNew } = result;
  const openingModal = document.getElementById("modal-box-opening");
  const spinIcon = document.getElementById("box-spin-icon");
  const modalText = document.getElementById("box-modal-text");

  spinIcon.textContent = box.icon;
  modalText.textContent = box.name + " wird geöffnet…";
  show(openingModal);
  playBoxOpenSound();

  const spinDuration = state.settings.animations ? 1100 : 200;
  setTimeout(() => {
    hide(openingModal);
    revealDrop(cursor, isNew);
  }, spinDuration);
}

function revealDrop(cursor, isNew) {
  const rarity = getRarity(cursor.rarity);
  const modal = document.getElementById("modal-drop-reveal");
  const card = document.getElementById("drop-modal-card");

  document.getElementById("drop-rarity-label").textContent = rarity.label;
  document.getElementById("drop-rarity-label").style.color = rarity.color;
  document.getElementById("drop-icon").textContent = cursor.icon;
  document.getElementById("drop-name").textContent = cursor.name;
  document.getElementById("drop-description").textContent = cursor.description;
  document.getElementById("drop-multiplier").textContent = "×" + cursor.multiplier + " Coins pro Klick";

  const newBadge = document.getElementById("drop-new-badge");
  const dupeBadge = document.getElementById("drop-dupe-badge");
  newBadge.classList.toggle("hidden", !isNew);
  dupeBadge.classList.toggle("hidden", isNew);
  if (!isNew) {
    const count = state.ownedCursors[cursor.id]?.count || 1;
    dupeBadge.textContent = "Duplikat (x" + count + ")";
  }

  card.style.setProperty("--rarity-color", rarity.color);
  card.style.setProperty("--rarity-glow", rarity.glow);
  card.classList.toggle("cc-drop-rare", isRareDrop(cursor.rarity));
  card.classList.toggle("cc-drop-secret", cursor.rarity === "secret");

  card.querySelectorAll(".cc-particle").forEach((p) => p.remove());
  if (isRareDrop(cursor.rarity)) {
    spawnCelebrationParticles(card, rarity.color);
    playRareDropSound(rarity.order);
  }

  show(modal);

  const continueBtn = document.getElementById("drop-continue-btn");
  const closeHandler = () => {
    hide(modal);
    continueBtn.removeEventListener("click", closeHandler);
  };
  continueBtn.addEventListener("click", closeHandler);
}

export function showDailyRewardModal({ amount, streak, alreadyClaimed }, onClaim) {
  const modal = document.getElementById("modal-daily-reward");
  const text = document.getElementById("daily-modal-text");
  const streakText = document.getElementById("daily-modal-streak");
  const claimBtn = document.getElementById("daily-modal-claim-btn");
  const closeBtn = document.getElementById("daily-modal-close-btn");

  if (alreadyClaimed) {
    text.textContent = "Du hast deine Belohnung heute schon abgeholt. Komm morgen wieder!";
    streakText.textContent = "Aktuelle Serie: " + streak + " Tag(e)";
    claimBtn.classList.add("hidden");
  } else {
    text.textContent = "Hol dir deine Belohnung für heute ab!";
    streakText.textContent = "Serie: Tag " + streak + " · +" + formatNumber(amount) + " Coins";
    claimBtn.classList.remove("hidden");
  }

  show(modal);

  const claimHandler = () => {
    onClaim();
    hide(modal);
    claimBtn.removeEventListener("click", claimHandler);
  };
  const closeHandler = () => {
    hide(modal);
    closeBtn.removeEventListener("click", closeHandler);
  };
  claimBtn.addEventListener("click", claimHandler);
  closeBtn.addEventListener("click", closeHandler);
}

export function showConfirm(title, text) {
  const modal = document.getElementById("modal-confirm");
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-text").textContent = text;
  show(modal);

  return new Promise((resolve) => {
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    const cleanup = (result) => {
      hide(modal);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}
