// Verdrahtung: Hauptmenü, Spielablauf und das Zusammenspiel von Regeln,
// Bot und Oberfläche.
//
// Hier steht bewusst keine Spiellogik (board.js), keine Bot-Logik (bot.js)
// und kein DOM-Aufbau (ui.js) — nur die Frage, was wann passiert.
//
// Zwei Modi teilen sich denselben Ablauf:
//   "bot"    — X ist der Spieler, O der Computer
//   "friend" — X ist Spieler 1, O ist Spieler 2, beide an einem Gerät
// Der Unterschied ist genau eine Stelle: Wer zieht, nachdem X gesetzt hat.
// Alles andere — Regeln, Gewinnerkennung, Sperren, Anzeige — ist identisch.

import { BOT, HUMAN, applyMove, createBoard, getOutcome, isValidMove } from "./board.js";
import { DEFAULT_STEP, getDifficultyByStep } from "./difficulty.js";
import { chooseMove } from "./bot.js";
import * as ui from "./ui.js";

// Kurze Pause vor dem Bot-Zug. Ohne sie erscheint sein Zeichen im selben
// Wimpernschlag wie das eigene, und man sieht gar nicht, dass er gezogen hat.
const BOT_DELAY_MS = 380;

const state = {
  mode: "bot",            // "bot" | "friend"
  board: createBoard(),
  difficulty: getDifficultyByStep(DEFAULT_STEP),
  turn: HUMAN,            // wer ist am Zug (im Freundesmodus: X = Spieler 1)
  locked: true,           // true, solange niemand tippen darf
  over: false,
  botTimer: null,
};

const NAMES = { [HUMAN]: "Spieler 1", [BOT]: "Spieler 2" };

/** „Wer ist dran"-Text, je nach Modus. */
function turnText() {
  if (state.mode === "friend") return `${NAMES[state.turn]} ist am Zug.`;
  return state.turn === HUMAN ? "Du bist am Zug." : "Computer denkt …";
}

// --- Spielablauf -----------------------------------------------------------

function startRound() {
  clearTimeout(state.botTimer);
  state.board = createBoard();
  state.turn = HUMAN;
  state.over = false;
  state.locked = false;
  ui.renderPlayers(state.mode, state.difficulty);
  ui.setStatus(turnText());
  ui.renderBoard(state.board, { locked: false });
}

function finish(outcome) {
  state.over = true;
  state.locked = true;

  if (outcome.winner === null) {
    ui.setStatus("Unentschieden.", "draw");
  } else if (state.mode === "friend") {
    ui.setStatus(`${NAMES[outcome.winner]} gewinnt! 🎉`, "win");
  } else if (outcome.winner === HUMAN) {
    ui.setStatus("Gewonnen! 🎉", "win");
  } else {
    ui.setStatus("Verloren.", "lose");
  }

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

  state.turn = HUMAN;
  state.locked = false;
  ui.setStatus(turnText());
  ui.renderBoard(state.board, { locked: false, lastMove: move });
}

function handleCellClick(index) {
  // Doppelte Absicherung gegen ungültige Züge: die Oberfläche sperrt die
  // Felder bereits, aber ein Klick per Tastatur oder Konsole soll ebenfalls
  // nichts bewirken.
  if (state.locked || state.over || !isValidMove(state.board, index)) return;

  const mark = state.turn;
  state.board = applyMove(state.board, index, mark);
  if (settle(index)) return;

  if (state.mode === "friend") {
    // Zu zweit: einfach der andere ist dran, das Feld bleibt sofort offen.
    state.turn = mark === HUMAN ? BOT : HUMAN;
    ui.setStatus(turnText());
    ui.renderBoard(state.board, { locked: false, lastMove: index });
    return;
  }

  // Gegen den Bot: sperren, bis er gezogen hat.
  state.turn = BOT;
  state.locked = true;
  ui.setStatus(turnText());
  ui.renderBoard(state.board, { locked: true, lastMove: index });
  state.botTimer = setTimeout(botTurn, BOT_DELAY_MS);
}

// --- Hauptmenü -------------------------------------------------------------

function applySliderValue() {
  state.difficulty = getDifficultyByStep(ui.elements.slider.value);
  ui.renderDifficulty(state.difficulty);
}

function startGame(mode) {
  state.mode = mode;
  ui.showGame();
  startRound();
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
ui.elements.startBot.addEventListener("click", () => startGame("bot"));
ui.elements.startFriend.addEventListener("click", () => startGame("friend"));
ui.elements.again.addEventListener("click", startRound);
ui.elements.back.addEventListener("click", openMenu);

ui.elements.slider.value = String(DEFAULT_STEP);
applySliderValue();
ui.renderBoard(state.board, { locked: true });
ui.showMenu();
