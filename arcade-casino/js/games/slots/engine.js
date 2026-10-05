// Slot-Engine (rein, ohne DOM – testbar in Node).
//
// WAHRSCHEINLICHKEITEN: Jede Walze hat einen festen Walzenstreifen (`strips`).
// Beim Dreh wird für jede Walze unabhängig und gleichverteilt eine Stoppposition
// gewählt. Die Wahrscheinlichkeit für ein Symbol in einer Zeile ist damit genau
// (Anzahl auf dem Streifen) / (Streifenlänge). Es gibt keine versteckte
// Gewinnsteuerung; die Ergebnisse hängen nur vom Zufall und den Streifen ab.
// Die Auszahlungsquote (RTP) jeder Maschine wird in tests/slots.test.mjs
// berechnet (exakt für 3 Walzen, per Simulation für Kosmo 5).

import { random, randInt } from "../../core/rng.js";

/** Gleichverteilte Stopps → sichtbares Raster grid[reel][row]. */
export function spinStops(machine, rnd = random) {
  return machine.strips.map((strip) => randInt(strip.length, rnd));
}

export function gridFromStops(machine, stops) {
  return machine.strips.map((strip, r) => {
    const col = [];
    for (let row = 0; row < machine.rows; row++) col.push(strip[(stops[r] + row) % strip.length]);
    return col;
  });
}

/**
 * Wertet ein Raster aus.
 * @returns {{ total: number, lines: {line:number, cells:[number,number][], symbol:string, count:number, win:number}[], scatter: {count:number, cells:[number,number][], win:number, freeSpins:number}|null }}
 * Gewinne sind Vielfache des Linieneinsatzes `lineBet` (bzw. Gesamteinsatz bei Scatter).
 */
export function evaluate(machine, grid, lineBet, multiplier = 1) {
  if (machine.mode === "classic") return evaluateClassic(machine, grid, lineBet, multiplier);
  const lines = [];
  let total = 0;
  machine.lines.forEach((rows, li) => {
    const syms = rows.map((row, r) => grid[r][row]);
    let base = null;
    let count = 0;
    for (const s of syms) {
      if (s === machine.scatter?.symbol) break;
      if (s === machine.wild) {
        count++;
        continue;
      }
      if (base === null) {
        base = s;
        count++;
      } else if (s === base) count++;
      else break;
    }
    // Reine Wild-Linie zahlt als Wild-Symbol
    if (base === null) base = machine.wild;
    // Prüfen, ob nur Wilds vorne besser zahlen als die Ersetzung
    let best = { symbol: base, count, mult: machine.pays[base]?.[count] || 0 };
    if (machine.wild && base !== machine.wild) {
      let wc = 0;
      for (const s of syms) {
        if (s === machine.wild) wc++;
        else break;
      }
      const wm = machine.pays[machine.wild]?.[wc] || 0;
      if (wm > best.mult) best = { symbol: machine.wild, count: wc, mult: wm };
    }
    if (best.mult > 0) {
      const win = best.mult * lineBet * multiplier;
      total += win;
      lines.push({ line: li, cells: rows.slice(0, best.count).map((row, r) => [r, row]), symbol: best.symbol, count: best.count, win });
    }
  });

  let scatter = null;
  if (machine.scatter) {
    const cells = [];
    grid.forEach((col, r) => col.forEach((s, row) => s === machine.scatter.symbol && cells.push([r, row])));
    const n = cells.length;
    const sm = machine.scatter.pays[Math.min(n, 5)] || 0;
    const fs = machine.scatter.freeSpins[Math.min(n, 5)] || 0;
    if (sm || fs) {
      const win = sm * lineBet * machine.lines.length * multiplier;
      total += win;
      scatter = { count: n, cells, win, freeSpins: fs };
    }
  }
  return { total, lines, scatter };
}

/** Klassische 3-Walzen-Regeln mit Mischgewinnen und Kirschen (nur Mittellinie). */
function evaluateClassic(machine, grid, lineBet, multiplier) {
  const row = machine.payRow;
  const syms = grid.map((col) => col[row]);
  const cells = syms.map((_, r) => [r, row]);
  let mult = 0;
  let symbol = syms[0];
  let count = 3;
  if (syms.every((s) => s === syms[0]) && machine.pays[syms[0]]?.[3]) {
    mult = machine.pays[syms[0]][3];
  } else if (syms.every((s) => machine.mixed.symbols.includes(s))) {
    mult = machine.mixed.pay;
    symbol = "mixed";
  } else {
    const cherries = syms.filter((s) => s === machine.cherry.symbol).length;
    if (cherries) {
      mult = machine.cherry.pays[cherries];
      symbol = machine.cherry.symbol;
      count = cherries;
    }
  }
  if (!mult) return { total: 0, lines: [], scatter: null };
  const win = mult * lineBet * multiplier;
  const winCells = symbol === machine.cherry.symbol && count < 3 ? cells.filter(([r]) => syms[r] === symbol) : cells;
  return { total: win, lines: [{ line: 0, cells: winCells, symbol, count, win }], scatter: null };
}

/** Ein kompletter Dreh. */
export function spin(machine, lineBet, { rnd = random, multiplier = 1 } = {}) {
  const stops = spinStops(machine, rnd);
  const grid = gridFromStops(machine, stops);
  const result = evaluate(machine, grid, lineBet, multiplier);
  return { stops, grid, ...result };
}

/** Exakte Auszahlungsquote für 3-Walzen-Maschinen (Vollaufzählung aller Stopps). */
export function exactRtp(machine) {
  const [a, b, c] = machine.strips;
  let paid = 0;
  let wins = 0;
  const n = a.length * b.length * c.length;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      for (let k = 0; k < c.length; k++) {
        const grid = gridFromStops(machine, [i, j, k]);
        const r = evaluate(machine, grid, 1);
        paid += r.total;
        if (r.total > 0) wins++;
      }
  return { rtp: paid / (n * machine.lines.length), hitRate: wins / n };
}

/** Monte-Carlo-Schätzung inkl. Freispielen. */
export function simulateRtp(machine, spins, rnd = random) {
  let paid = 0;
  let wins = 0;
  let free = 0;
  for (let i = 0; i < spins; i++) {
    const r = spin(machine, 1, { rnd });
    paid += r.total;
    if (r.total > 0) wins++;
    let fs = r.scatter?.freeSpins || 0;
    let guard = 0;
    while (fs > 0 && guard++ < 1000) {
      fs--;
      free++;
      const f = spin(machine, 1, { rnd, multiplier: machine.freeSpinMultiplier || 1 });
      paid += f.total;
      fs += f.scatter?.freeSpins || 0;
    }
  }
  return { rtp: paid / (spins * machine.lines.length), hitRate: wins / spins, freeSpinsPerSpin: free / spins };
}
