// Konfiguration der drei Slotmaschinen.
//
// Die Walzenstreifen werden aus den Symbol-ANZAHLEN unten deterministisch
// (fester Seed) gemischt. Die Anzahl eines Symbols geteilt durch die
// Streifenlänge ist seine Wahrscheinlichkeit pro sichtbarer Position.
// Auszahlungen sind Vielfache des Linieneinsatzes.

import { seeded, shuffle } from "../../core/rng.js";

function buildStrip(counts, seed) {
  const list = [];
  for (const [sym, n] of Object.entries(counts)) for (let i = 0; i < n; i++) list.push(sym);
  shuffle(list, seeded(seed));
  return list;
}

/** Klassischer Streifen: Symbol, Leerfeld, Symbol, Leerfeld … */
function buildClassicStrip(counts, seed) {
  const syms = buildStrip(counts, seed);
  const out = [];
  for (const s of syms) out.push(s, "blank");
  return out;
}

// Gewinnlinien: Zeilenindex je Walze (0 = oben)
const LINES_3x3 = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];

const LINES_5x3 = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [1, 0, 1, 2, 1],
];

const FRUIT_COUNTS = { cherry: 7, lemon: 6, grapes: 5, bell: 4, seven: 2 };

export const FRUIT = {
  id: "fruit",
  name: "Fruchtfiesta",
  reels: 3,
  rows: 3,
  lines: LINES_3x3,
  strips: [buildStrip(FRUIT_COUNTS, 11), buildStrip(FRUIT_COUNTS, 12), buildStrip(FRUIT_COUNTS, 13)],
  pays: {
    cherry: { 2: 1, 3: 9 },
    lemon: { 3: 12 },
    grapes: { 3: 22 },
    bell: { 3: 40 },
    seven: { 3: 150 },
  },
  wild: null,
  scatter: null,
  betSteps: [5, 10, 25, 50, 100, 250],
  defaultBet: 25,
  theme: { frame: "#ff3d9a", frame2: "#ffde59", bg: ["#3a0d27", "#16050f"], line: "#ffde59", accent: "#5be36a" },
  tagline: "5 Gewinnlinien · Kirschen ab 2",
};

export const SEVEN = {
  id: "seven",
  name: "Goldene Sieben",
  mode: "classic",
  reels: 3,
  rows: 3,
  payRow: 1,
  lines: [[1, 1, 1]],
  strips: [
    buildClassicStrip({ seven: 1, star: 2, bar: 5, cherry: 3, bell: 3 }, 21),
    buildClassicStrip({ seven: 1, star: 2, bar: 5, cherry: 3, bell: 3 }, 22),
    buildClassicStrip({ seven: 1, star: 2, bar: 5, cherry: 3, bell: 3 }, 23),
  ],
  pays: {
    seven: { 3: 1000 },
    star: { 3: 150 },
    bar: { 3: 40 },
    bell: { 3: 80 },
  },
  mixed: { symbols: ["seven", "star", "bar"], pay: 5 },
  cherry: { symbol: "cherry", pays: { 1: 1, 2: 5, 3: 20 } },
  wild: null,
  scatter: null,
  betSteps: [5, 10, 20, 50, 100, 200],
  defaultBet: 10,
  theme: { frame: "#ffc53d", frame2: "#c4162a", bg: ["#2b0508", "#120204"], line: "#ff2d55", accent: "#ffc53d" },
  tagline: "1 Linie · klassische Mischgewinne",
};

export const COSMO = {
  id: "cosmo",
  name: "Kosmo 5",
  reels: 5,
  rows: 3,
  lines: LINES_5x3,
  strips: [
    buildStrip({ rocket: 2, planet: 3, gem: 4, star: 5, moon: 6, orb: 7, comet: 1, nova: 0 }, 31),
    buildStrip({ rocket: 2, planet: 3, gem: 4, star: 5, moon: 6, orb: 6, comet: 1, nova: 1 }, 32),
    buildStrip({ rocket: 2, planet: 3, gem: 4, star: 5, moon: 6, orb: 6, comet: 1, nova: 1 }, 33),
    buildStrip({ rocket: 2, planet: 3, gem: 4, star: 5, moon: 6, orb: 6, comet: 1, nova: 1 }, 34),
    buildStrip({ rocket: 2, planet: 3, gem: 4, star: 5, moon: 6, orb: 7, comet: 1, nova: 0 }, 35),
  ],
  pays: {
    nova: { 3: 100, 4: 400, 5: 2000 },
    rocket: { 3: 50, 4: 200, 5: 750 },
    planet: { 3: 30, 4: 100, 5: 400 },
    gem: { 3: 20, 4: 60, 5: 200 },
    star: { 3: 12, 4: 40, 5: 120 },
    moon: { 3: 6, 4: 20, 5: 75 },
    orb: { 3: 4, 4: 12, 5: 40 },
  },
  wild: "nova",
  scatter: { symbol: "comet", pays: { 3: 2, 4: 10, 5: 50 }, freeSpins: { 3: 8, 4: 12, 5: 20 } },
  freeSpinMultiplier: 2,
  betSteps: [10, 20, 50, 100, 200, 500],
  defaultBet: 20,
  theme: { frame: "#2de2e6", frame2: "#9b5cff", bg: ["#140a3a", "#05030f"], line: "#2de2e6", accent: "#ff3d9a" },
  tagline: "10 Linien · Nova ersetzt · 3 Kometen = Freispiele ×2",
};

export const MACHINES = { fruit: FRUIT, seven: SEVEN, cosmo: COSMO };
