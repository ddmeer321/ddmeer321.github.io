// Spielfeld und Gewinnerkennung.
//
// Diese Datei enthält bewusst KEIN DOM und KEINE Bot-Logik — nur die Regeln
// des Spiels. Dadurch kann der Bot dieselben Funktionen benutzen, um
// Spielzüge durchzurechnen, ohne dass dabei irgendetwas auf der Seite
// passiert.
//
// Das Spielfeld ist ein Array mit 9 Feldern, von links oben nach rechts
// unten gezählt:
//
//     0 | 1 | 2
//    ---+---+---
//     3 | 4 | 5
//    ---+---+---
//     6 | 7 | 8

export const EMPTY = "";
export const HUMAN = "X";
export const BOT = "O";

// Alle acht Gewinnreihen: drei Zeilen, drei Spalten, zwei Diagonalen.
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Zeilen
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Spalten
  [0, 4, 8], [2, 4, 6],            // Diagonalen
];

export const CENTER = 4;
export const CORNERS = [0, 2, 6, 8];
export const EDGES = [1, 3, 5, 7];

export function createBoard() {
  return Array(9).fill(EMPTY);
}

export function availableMoves(board) {
  const free = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) free.push(i);
  }
  return free;
}

export function isValidMove(board, index) {
  return Number.isInteger(index) && index >= 0 && index < 9 && board[index] === EMPTY;
}

/**
 * Setzt einen Zug und liefert ein NEUES Spielfeld zurück.
 *
 * Bewusst ohne Veränderung des übergebenen Feldes: der Minimax-Algorithmus
 * probiert tausende Züge durch, und ein versehentlich geändertes Feld wäre
 * dort der klassische, sehr schwer zu findende Fehler.
 */
export function applyMove(board, index, mark) {
  const next = board.slice();
  next[index] = mark;
  return next;
}

/** Liefert die gewinnende Reihe samt Zeichen, sonst null. */
export function findWinningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== EMPTY && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  return null;
}

export function isFull(board) {
  return board.every((cell) => cell !== EMPTY);
}

/**
 * Zustand der Partie.
 *
 * @returns {{ over: boolean, winner: string|null, line: number[]|null }}
 *          winner ist null bei Unentschieden und bei laufender Partie —
 *          zu unterscheiden sind die beiden über `over`.
 */
export function getOutcome(board) {
  const win = findWinningLine(board);
  if (win) return { over: true, winner: win.mark, line: win.line };
  if (isFull(board)) return { over: true, winner: null, line: null };
  return { over: false, winner: null, line: null };
}

export function opponentOf(mark) {
  return mark === HUMAN ? BOT : HUMAN;
}
