// Turmbau (Stacker) – reine Spiellogik, deterministisch.
// Eine Reihe Blöcke pendelt Zelle für Zelle hin und her. Beim Stoppen fallen
// alle Blöcke weg, die nicht auf der Reihe darunter stehen.

export const COLS = 7;
export const ROWS = 12;
export const MINOR_ROW = 8; // nach dieser Reihe: Zwischenpreis oder weiterspielen
export const MAX_WIDTH = [3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1];

/** Millisekunden pro Zellschritt in Reihe r (0 = unten). */
export function stepMs(r) {
  return Math.max(55, 190 - r * 12);
}

export function createGame() {
  return { row: 0, stack: [], width: 3, pos: 0, dir: 1, over: false, won: false };
}

/** Schiebt die laufende Reihe um eine Zelle weiter (prallt an den Rändern ab). */
export function advance(gm) {
  let next = gm.pos + gm.dir;
  if (next < 0 || next + gm.width > COLS) {
    gm.dir = -gm.dir;
    next = gm.pos + gm.dir;
  }
  gm.pos = next;
}

/** Stoppt die laufende Reihe. Rückgabe: { kept, lost, perfect } */
export function place(gm) {
  const cells = [];
  for (let i = 0; i < gm.width; i++) cells.push(gm.pos + i);
  let kept = cells;
  if (gm.row > 0) {
    const below = new Set(gm.stack[gm.row - 1]);
    kept = cells.filter((c) => below.has(c));
  }
  const lost = cells.filter((c) => !kept.includes(c));
  gm.stack.push(kept);
  if (!kept.length) {
    gm.over = true;
    return { kept, lost, perfect: false };
  }
  gm.row++;
  if (gm.row >= ROWS) {
    gm.over = true;
    gm.won = true;
    return { kept, lost, perfect: !lost.length };
  }
  gm.width = Math.min(kept.length, MAX_WIDTH[gm.row]);
  // neue Reihe startet am Rand, abwechselnd links/rechts
  gm.dir = gm.row % 2 ? -1 : 1;
  gm.pos = gm.dir === 1 ? 0 : COLS - gm.width;
  return { kept, lost, perfect: !lost.length };
}
