// Verdrahtung: Hauptmenü, Spielablauf und das Zusammenspiel von Regeln,
// Bot und Oberfläche.
//
// Hier steht bewusst keine Spiellogik (board.js), keine Bot-Logik (bot.js)
// und kein DOM-Aufbau (ui.js) — nur die Frage, was wann passiert.

import { BOT, HUMAN, applyMove, createBoard, getOutcome, isValidMove } from "./board.js";
import { DEFAULT_STEP, getDifficultyByStep } from "./difficulty.js";
import { chooseMove } from "./bot.js";
import * as ui from "./ui.js";

// Kurze Pause vor dem Bot-Zug. Ohne sie erscheint sein Zeichen im selben
// Wimpernschlag wie das eigene, und man sieht gar nicht, dass er gezogen hat.
const BOT_DELAY_MS = 380;

const state = {
  board: createBoard(),
  difficulty: getDifficultyByStep(DEFAULT_STEP),
  locked: true,   // true, solange der Spieler nicht am Zug ist
  over: false,
  botTimer: null,
};

// --- Spielablauf -----------------------------------------------------------

function startRound() {
  clearTimeout(state.botTimer);
  state.board = createBoard();
  state.over = false;
  state.locked = false;
  ui.setGameBadge(state.difficulty);
  ui.setStatus("Du bist am Zug.");
  ui.renderBoard(state.board, { locked: false });
}

function finish(outcome) {
  state.over = true;
  state.locked = true;

  if (outcome.winner === HUMAN) ui.setStatus("Gewonnen! 🎉", "win");
  else if (outcome.winner === BOT) ui.setStatus("Verloren.", "lose");
  else ui.setStatus("Unentschieden.", "draw");

  ui.renderBoard(state.board, { locked: true, winningLine: outcome.line });
}

/** Prüft nach jedem Zug, ob die Partie vorbei ist. */
function settle(lastMove) {
  const outcome = getOutcome(state.board);
  if (outcome.over) {
    ui.renderBoard(state.board, { locked: true, lastMove });
    finish(outcome);
    return true;
  }
  return false;
}

function botTurn() {
  const move = chooseMove(state.board, state.difficulty.strategy);
  if (move === null) return;

  state.board = applyMove(state.board, move, BOT);
  if (settle(move)) return;

  state.locked = false;
  ui.setStatus("Du bist am Zug.");
  ui.renderBoard(state.board, { locked: false, lastMove: move });
}

function handleCellClick(index) {
  // Doppelte Absicherung gegen ungültige Züge: die Oberfläche sperrt die
  // Felder bereits, aber ein Klick per Tastatur oder Konsole soll ebenfalls
  // nichts bewirken.
  if (state.locked || state.over || !isValidMove(state.board, index)) return;

  state.board = applyMove(state.board, index, HUMAN);
  state.locked = true;
  if (settle(index)) return;

  ui.setStatus("Computer denkt …");
  ui.renderBoard(state.board, { locked: true, lastMove: index });
  state.botTimer = setTimeout(botTurn, BOT_DELAY_MS);
}

// --- Hauptmenü -------------------------------------------------------------

function applySliderValue() {
  state.difficulty = getDifficultyByStep(ui.elements.slider.value);
  ui.renderDifficulty(state.difficulty);
}

function openMenu() {
  clearTimeout(state.botTimer);
  state.locked = true;
  ui.showMenu();
}

// --- Start -----------------------------------------------------------------

ui.buildBoard(handleCellClick);

// "input" statt "change": der Regler muss sich schon beim Ziehen aktualisieren,
// nicht erst beim Loslassen.
ui.elements.slider.addEventListener("input", applySliderValue);
ui.elements.start.addEventListener("click", () => {
  ui.showGame();
  startRound();
});
ui.elements.again.addEventListener("click", startRound);
ui.elements.back.addEventListener("click", openMenu);

ui.elements.slider.value = String(DEFAULT_STEP);
applySliderValue();
ui.renderBoard(state.board, { locked: true });
ui.showMenu();
