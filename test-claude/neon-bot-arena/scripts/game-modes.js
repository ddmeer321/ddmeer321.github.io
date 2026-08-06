import { t } from "./settings.js?v=settings9";

export const DEFAULT_GAME_MODE = "normal";

// Add future modes here. The picker builds its buttons from this registry.
export const GAME_MODES = Object.freeze([
  Object.freeze({
    id: "normal",
    labelKey: "menu.normal",
    descriptionKey: "mode.normalDescription"
  }),
  Object.freeze({
    id: "chaos",
    labelKey: "mode.chaos",
    descriptionKey: "mode.chaosDescription"
  }),
  Object.freeze({
    id: "hardcore",
    labelKey: "mode.hardcore",
    descriptionKey: "mode.hardcoreDescription"
  })
]);

export function getGameMode(modeId) {
  const normalizedModeId = modeId === "one-heart" ? "hardcore" : modeId;
  return GAME_MODES.find((mode) => mode.id === normalizedModeId)
    || GAME_MODES.find((mode) => mode.id === DEFAULT_GAME_MODE)
    || GAME_MODES[0];
}

export function calculatePlayerDamage({ mode, currentHp, amount, shielded = false, enemyDamageMultiplier = 1 }) {
  if (mode === "hardcore" || mode === "one-heart") return Math.max(1, Number(currentHp) || 1);
  const incoming = Math.max(0, Number(amount) || 0) * Math.max(0, Number(enemyDamageMultiplier) || 0);
  return shielded ? incoming * 0.28 : incoming;
}

export function setupGameModePicker(state) {
  const openButton = document.querySelector("#gameModeBtn");
  const buttonLabel = document.querySelector("#gameModeButtonLabel");
  const overlay = document.querySelector("#gameModeOverlay");
  const closeButton = document.querySelector("#gameModeCloseBtn");
  const modeList = document.querySelector("#gameModeList");

  if (!openButton || !buttonLabel || !overlay || !closeButton || !modeList) return;

  const closePicker = ({ restoreFocus = true } = {}) => {
    overlay.classList.add("hidden");
    openButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) openButton.focus();
  };

  const updateButtonLabel = () => {
    const activeMode = getGameMode(state.gameMode);
    buttonLabel.textContent = t(activeMode.labelKey);
  };

  const selectMode = (modeId) => {
    const nextMode = getGameMode(modeId);
    state.gameMode = nextMode.id;
    window.dispatchEvent(new CustomEvent("gamemodechange", {
      detail: { mode: nextMode.id }
    }));
    closePicker();
  };

  const renderModes = () => {
    const activeMode = getGameMode(state.gameMode);
    state.gameMode = activeMode.id;
    modeList.replaceChildren();

    for (const mode of GAME_MODES) {
      const button = document.createElement("button");
      const label = document.createElement("strong");
      const description = document.createElement("span");
      const isSelected = mode.id === activeMode.id;

      button.type = "button";
      button.className = `game-mode-option${isSelected ? " selected" : ""}`;
      button.dataset.gameMode = mode.id;
      button.setAttribute("aria-pressed", String(isSelected));
      label.textContent = t(mode.labelKey);
      description.textContent = t(mode.descriptionKey);
      button.append(label, description);
      button.addEventListener("click", () => selectMode(mode.id));
      modeList.append(button);
    }

    updateButtonLabel();
  };

  const openPicker = () => {
    renderModes();
    overlay.classList.remove("hidden");
    openButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => modeList.querySelector(".selected")?.focus());
  };

  openButton.addEventListener("click", openPicker);
  closeButton.addEventListener("click", () => closePicker());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePicker();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.classList.contains("hidden")) closePicker();
  });
  window.addEventListener("languagechange", renderModes);
  window.addEventListener("gamemodechange", renderModes);

  renderModes();
}
