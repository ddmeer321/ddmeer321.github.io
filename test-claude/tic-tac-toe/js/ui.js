// Benutzeroberfläche: alles, was das DOM anfasst.
//
// Diese Datei kennt keine Spielregeln und keinen Bot. Sie bekommt fertige
// Zustände übergeben und zeichnet sie. Umgekehrt meldet sie Klicks nur
// weiter — was daraus folgt, entscheidet main.js.

import { BOT, HUMAN } from "./board.js";

const el = {
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  slider: document.getElementById("difficulty-slider"),
  emoji: document.getElementById("difficulty-emoji"),
  name: document.getElementById("difficulty-name"),
  description: document.getElementById("difficulty-description"),
  badge: document.getElementById("game-difficulty"),
  status: document.getElementById("status"),
  board: document.getElementById("board"),
  start: document.getElementById("btn-start"),
  again: document.getElementById("btn-again"),
  back: document.getElementById("btn-menu"),
};

export const elements = el;

/** Legt die neun Felder einmalig an. */
export function buildBoard(onCellClick) {
  el.board.replaceChildren();
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.index = String(i);
    cell.setAttribute("role", "gridcell");
    cell.addEventListener("click", () => onCellClick(i));
    el.board.appendChild(cell);
  }
}

const CELL_NAMES = [
  "oben links", "oben mitte", "oben rechts",
  "mitte links", "mitte", "mitte rechts",
  "unten links", "unten mitte", "unten rechts",
];

/**
 * Zeichnet das Spielfeld.
 *
 * @param {string[]} board
 * @param {object}   options
 * @param {boolean}  options.locked      Eingaben gesperrt (Bot denkt / Partie vorbei)
 * @param {number[]} options.winningLine Felder der Gewinnreihe, sonst null
 * @param {number}   options.lastMove    zuletzt gesetztes Feld (für die Animation)
 */
export function renderBoard(board, { locked = false, winningLine = null, lastMove = null } = {}) {
  [...el.board.children].forEach((cell, i) => {
    const mark = board[i];
    cell.textContent = mark;
    cell.classList.toggle("is-x", mark === HUMAN);
    cell.classList.toggle("is-o", mark === BOT);
    cell.classList.toggle("is-win", Boolean(winningLine && winningLine.includes(i)));

    // Ungültige Züge sind gar nicht erst anklickbar — die Sperre steckt
    // zusätzlich in main.js, hier geht es nur um die Bedienbarkeit.
    cell.disabled = locked || mark !== "";

    cell.setAttribute(
      "aria-label",
      mark ? `${CELL_NAMES[i]}: ${mark}` : `${CELL_NAMES[i]}, frei`
    );

    // Animation nur für das eben gesetzte Feld neu starten.
    if (i === lastMove) {
      cell.classList.remove("just-placed");
      void cell.offsetWidth; // erzwingt einen Reflow, sonst greift die Klasse nicht erneut
      cell.classList.add("just-placed");
    }
  });
}

export function setStatus(text, tone = "neutral") {
  el.status.textContent = text;
  el.status.dataset.tone = tone; // neutral | win | lose | draw
}

/** Emoji, Name und Beschreibung der Stufe — mit kleiner Animation. */
export function renderDifficulty(difficulty) {
  if (el.emoji.textContent !== difficulty.emoji) {
    el.emoji.classList.remove("pop");
    void el.emoji.offsetWidth;
    el.emoji.classList.add("pop");
  }
  el.emoji.textContent = difficulty.emoji;
  el.name.textContent = difficulty.label;
  el.description.textContent = difficulty.description;
  el.slider.setAttribute("aria-valuetext", difficulty.label);
}

export function setGameBadge(difficulty) {
  el.badge.textContent = `${difficulty.emoji} ${difficulty.label}`;
}

export function showMenu() {
  el.game.hidden = true;
  el.menu.hidden = false;
  el.start.focus();
}

export function showGame() {
  el.menu.hidden = true;
  el.game.hidden = false;
}
