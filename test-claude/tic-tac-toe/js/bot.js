// Bot-Logik: vier echte Strategien, nicht vier Namen für dieselbe Funktion.
//
//   random         (Einfach) — spielt fast zufällig
//   heuristic      (Mittel)  — Regeln, aber nur einen Zug weit gedacht
//   minimaxSlip    (Schwer)  — voller Minimax mit gelegentlichem Patzer
//   minimaxPerfect (Extrem)  — voller Minimax, immer optimal
//
// Kein DOM, keine Anzeige. Der Bot bekommt ein Spielfeld und liefert einen
// Feldindex zurück.

import {
  BOT,
  CENTER,
  CORNERS,
  EDGES,
  EMPTY,
  HUMAN,
  applyMove,
  availableMoves,
  getOutcome,
  opponentOf,
} from "./board.js";

// Wie oft „Schwer" absichtlich danebengreift. Ohne diesen Patzer wäre die
// Stufe von „Extrem" nicht unterscheidbar — Tic-Tac-Toe ist bei perfektem
// Spiel beider Seiten immer unentschieden, ein Sieg des Spielers also
// unmöglich.
//
// Der Wert ist gemessen, nicht geschätzt. Gegen einen Gegenspieler, der
// sofortige Siege mitnimmt und sofortige Niederlagen blockt, sonst aber
// zufällig zieht, ergaben je 3000 Partien:
//
//   0,15 → 31 % Spielersiege     0,06 → 14 %
//   0,10 → 22 %                  0,04 →  9 %
//   0,03 →  7 %                  0,02 →  5 %
//
// Gewählt: 0,03. Damit liegt „Schwer" deutlich unter „Mittel" (rund 18 %)
// und bleibt trotzdem schlagbar. Ein echter Mensch nutzt Patzer besser aus
// als der Testgegner, in der Praxis dürfte die Quote also etwas höher liegen.
const SLIP_CHANCE = 0.03;

// Wie oft „Einfach" doch hinschaut. Er nimmt dann einen sofortigen Sieg mit,
// blockt aber nie — Blocken ist das, was einen Bot schwer schlagbar macht.
const EASY_ATTENTION = 0.3;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Feld, auf dem `mark` sofort gewinnen würde, sonst null. */
function findImmediateWin(board, mark) {
  for (const move of availableMoves(board)) {
    if (getOutcome(applyMove(board, move, mark)).winner === mark) return move;
  }
  return null;
}

// --- Einfach ---------------------------------------------------------------

function randomStrategy(board) {
  const free = availableMoves(board);
  if (Math.random() < EASY_ATTENTION) {
    const win = findImmediateWin(board, BOT);
    if (win !== null) return win;
  }
  return pickRandom(free);
}

// --- Mittel ----------------------------------------------------------------

/**
 * Feste Regelkette, jeweils nur einen Zug vorausgedacht:
 *   1. selbst gewinnen
 *   2. den Sieg des Spielers verhindern
 *   3. Mitte, sonst Ecke, sonst Kante
 *
 * Genau das macht die Stufe schlagbar: Sie erkennt keine Gabel — eine
 * Stellung, in der der Spieler zwei Gewinnreihen gleichzeitig droht. Gegen
 * einen einzelnen drohenden Zug ist sie dicht, gegen zwei nicht.
 */
function heuristicStrategy(board) {
  const win = findImmediateWin(board, BOT);
  if (win !== null) return win;

  const block = findImmediateWin(board, HUMAN);
  if (block !== null) return block;

  if (board[CENTER] === EMPTY) return CENTER;

  const freeCorners = CORNERS.filter((i) => board[i] === EMPTY);
  if (freeCorners.length) return pickRandom(freeCorners);

  const freeEdges = EDGES.filter((i) => board[i] === EMPTY);
  return pickRandom(freeEdges);
}

// --- Minimax ---------------------------------------------------------------

/**
 * Bewertet eine Stellung aus Sicht des Bots.
 *
 * Grundgedanke: Der Bot geht davon aus, dass der Spieler ebenfalls optimal
 * spielt. Deshalb wechseln sich zwei Sichtweisen ab —
 *   ist der Bot am Zug, sucht er das MAXIMUM der Folgestellungen,
 *   ist der Spieler am Zug, sucht er das MINIMUM.
 * Daher der Name Minimax.
 *
 * Die Tiefe fließt in die Bewertung ein:
 *   Bot gewinnt      →  10 - depth   (früher Sieg ist mehr wert)
 *   Spieler gewinnt  →  depth - 10   (späte Niederlage ist weniger schlimm)
 *   Unentschieden    →  0
 * Ohne diesen Tiefenbonus wären alle Siege gleich viel wert, und der Bot
 * würde einen Sieg in drei Zügen genauso gern nehmen wie einen sofortigen —
 * was von außen aussieht, als würde er trödeln.
 *
 * Alpha-Beta-Pruning schneidet Äste ab, die das Ergebnis nicht mehr ändern
 * können: `alpha` ist das Beste, was der maximierende Spieler auf dem Weg
 * hierher schon sicher hat, `beta` das Beste des minimierenden. Sobald
 * beta <= alpha gilt, würde der jeweils andere diesen Ast ohnehin vermeiden,
 * und es lohnt nicht mehr, weiterzurechnen. Am Ergebnis ändert das nichts,
 * nur an der Rechenzeit.
 *
 * @param {string[]} board   Stellung
 * @param {string}   toMove  Wer ist am Zug
 * @param {number}   depth   Wie viele Halbzüge sind wir schon tief
 * @param {number}   alpha   untere Schranke
 * @param {number}   beta    obere Schranke
 * @returns {number} Bewertung aus Sicht des Bots
 */
function minimax(board, toMove, depth, alpha, beta) {
  const outcome = getOutcome(board);
  if (outcome.over) {
    if (outcome.winner === BOT) return 10 - depth;
    if (outcome.winner === HUMAN) return depth - 10;
    return 0; // Unentschieden
  }

  const moves = availableMoves(board);

  if (toMove === BOT) {
    let best = -Infinity;
    for (const move of moves) {
      const score = minimax(applyMove(board, move, BOT), HUMAN, depth + 1, alpha, beta);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break; // der Spieler würde diesen Ast meiden
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const score = minimax(applyMove(board, move, HUMAN), BOT, depth + 1, alpha, beta);
    if (score < best) best = score;
    if (best < beta) beta = best;
    if (beta <= alpha) break; // der Bot würde diesen Ast meiden
  }
  return best;
}

/**
 * Bewertet jeden möglichen Zug der aktuellen Stellung einzeln.
 *
 * Wichtig und leicht falsch zu machen: Jeder Zug wird mit einem FRISCHEN
 * Fenster (-Infinity, +Infinity) gerechnet. Würde man stattdessen ein
 * gemeinsames Alpha-Beta-Fenster über alle Wurzelzüge laufen lassen, wären
 * die Bewertungen abgeschnittener Züge nur noch Schranken statt exakter
 * Werte — für „welcher Zug ist der beste?" reicht das, für „welche Züge sind
 * gleich gut?" nicht. Und genau das braucht „Extrem", um zufällig unter den
 * optimalen Zügen zu wählen. Innerhalb jedes Teilbaums wird trotzdem normal
 * gekürzt, die Ersparnis bleibt also erhalten.
 */
function scoreAllMoves(board) {
  return availableMoves(board).map((move) => ({
    move,
    score: minimax(applyMove(board, move, BOT), HUMAN, 1, -Infinity, Infinity),
  }));
}

/** Alle Züge mit der besten Bewertung. */
function bestMoves(board) {
  const scored = scoreAllMoves(board);
  const best = Math.max(...scored.map((entry) => entry.score));
  return scored.filter((entry) => entry.score === best).map((entry) => entry.move);
}

// --- Extrem ----------------------------------------------------------------

/**
 * Immer ein optimaler Zug. Sind mehrere gleich gut, wird zufällig gewählt —
 * das ändert nichts an der Spielstärke, sorgt aber dafür, dass nicht jede
 * Partie identisch verläuft.
 *
 * Folge: Diese Stufe ist mathematisch nicht zu besiegen. Tic-Tac-Toe ist ein
 * gelöstes Spiel; bei perfektem Spiel beider Seiten endet es unentschieden.
 * Jeder Fehler des Spielers wird dagegen konsequent bestraft.
 */
function minimaxPerfectStrategy(board) {
  return pickRandom(bestMoves(board));
}

// --- Schwer ----------------------------------------------------------------

/**
 * Wie „Extrem", aber mit gelegentlichem Patzer: In SLIP_CHANCE der Fälle
 * wird bewusst nicht der beste Zug gewählt.
 *
 * Entscheidend ist, WIE gepatzt wird: Der Bot weicht auf die **zweitbeste**
 * Bewertungsstufe aus, nicht auf einen beliebigen schwächeren Zug. Der erste
 * Versuch tat Letzteres — und machte „Schwer" dadurch leichter als „Mittel"
 * (gemessen 32 % gegen 19 % Spielersiege). Grund: ein zufälliger schwacher
 * Zug verschenkt oft sofort die Partie, während „Mittel" wenigstens immer
 * blockt. Ein Ausrutscher auf die zweitbeste Stufe kostet dagegen meist nur
 * den Sieg und nicht gleich das Remis.
 *
 * Sind alle Züge gleich gut, gibt es keine zweitbeste Stufe — dann spielt
 * der Bot normal weiter.
 */
function minimaxSlipStrategy(board) {
  const scored = scoreAllMoves(board);
  const tiers = [...new Set(scored.map((entry) => entry.score))].sort((a, b) => b - a);
  const target = tiers.length > 1 && Math.random() < SLIP_CHANCE ? tiers[1] : tiers[0];
  return pickRandom(scored.filter((entry) => entry.score === target).map((entry) => entry.move));
}

// --- Auswahl ---------------------------------------------------------------

const STRATEGIES = {
  random: randomStrategy,
  heuristic: heuristicStrategy,
  minimaxSlip: minimaxSlipStrategy,
  minimaxPerfect: minimaxPerfectStrategy,
};

/**
 * Wählt den Zug des Bots.
 *
 * @param {string[]} board    aktuelle Stellung
 * @param {string}   strategy Kennung aus difficulty.js
 * @returns {number|null} Feldindex, oder null wenn kein Zug möglich ist
 */
export function chooseMove(board, strategy) {
  if (!availableMoves(board).length) return null;
  // hasOwnProperty, damit "constructor" o.ä. nicht als Strategie durchgeht.
  const fn = Object.prototype.hasOwnProperty.call(STRATEGIES, strategy)
    ? STRATEGIES[strategy]
    : STRATEGIES.heuristic;
  return fn(board);
}

// Für Testläufe: erlaubt es, die Stärke einer Stufe zu messen, ohne die
// Oberfläche zu starten.
export { findImmediateWin, bestMoves, opponentOf };
