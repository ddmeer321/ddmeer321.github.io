// Rubbellose – reine Spiellogik (deterministisch testbar, ohne DOM).
//
// EHRLICHKEIT: Das Ergebnis eines Loses wird beim KAUF genau einmal mit
// crypto-Zufall aus dem festen Gewinnplan gezogen und sofort mit dem fertigen
// Losbild gespeichert. Rubbeln deckt nur auf – Neuladen, Weglegen, „Alles
// aufdecken“ oder erneutes Öffnen ändern nichts. Gewinnpläne hängen nie von
// Guthaben, Verlauf, Level oder Spielzeit ab.
//
// Nieten: Das Losbild einer Niete wird gleichverteilt aus ALLEN möglichen
// Nieten-Bildern gewählt (Ziehen mit Zurückweisung). Es werden keine
// zusätzlichen „Beinahe-Gewinne“ eingebaut.
//
// Mathematik und Simulation: docs/ECONOMY.md (Abschnitt Rubbellose) und
// tests/scratch.test.mjs.

import { random } from "../../core/rng.js";

/** Höchstens so viele ungeöffnete/offene Lose liegen gleichzeitig auf dem Tisch. */
export const MAX_ON_TABLE = 12;
export const HISTORY = 20;

const NUMBERS = 40; // Glückszahlen: 1–40
const SYMBOLS = ["⭐", "🍀", "🔔", "🍒", "🎲", "👑", "🌙", "🎈"]; // Diamant-Tresor: alles außer 💎 ist Niete
export const DIAMOND = "💎";

/**
 * Lossorten. `prizes`: [Betrag, Wahrscheinlichkeit je Los], seltenster zuerst.
 * Ein Betrag gleich dem Lospreis ist „Einsatz zurück“ (kein Gewinn).
 */
export const TYPES = {
  neon7: {
    id: "neon7",
    name: "Neon Sieben",
    price: 20,
    mechanic: "match3",
    rule: "3 gleiche Beträge = Gewinn",
    fields: 6,
    prizes: [
      [10000, 0.0001],
      [1000, 0.0015],
      [200, 0.01],
      [100, 0.025],
      [40, 0.08],
      [20, 0.17],
    ],
  },
  lucky: {
    id: "lucky",
    name: "Glückszahlen",
    price: 50,
    mechanic: "numbers",
    rule: "Eigene Zahl = Gewinnzahl → Betrag darunter",
    fields: 8, // 2 Gewinnzahlen + 6 eigene Zahlen
    prizes: [
      [50000, 0.00002],
      [2500, 0.0016],
      [500, 0.012],
      [250, 0.03],
      [100, 0.08],
      [50, 0.16],
    ],
  },
  vault: {
    id: "vault",
    name: "Diamant-Tresor",
    price: 200,
    mechanic: "diamond",
    rule: "Finde den 💎 → Betrag darunter",
    fields: 9,
    prizes: [
      [50000, 0.0001],
      [10000, 0.0015],
      [2000, 0.0125],
      [1000, 0.035],
      [400, 0.07],
      [200, 0.15],
    ],
  },
};
export const TYPE_IDS = Object.keys(TYPES);

// ---------- Mathematik ----------

export function pAnyWin(type) {
  return TYPES[type].prizes.reduce((s, [, p]) => s + p, 0);
}
/** Erwartete Rückzahlung je eingesetztem Credit. */
export function rtpOf(type) {
  const t = TYPES[type];
  return t.prizes.reduce((s, [amount, p]) => s + amount * p, 0) / t.price;
}
export function topPrize(type) {
  return Math.max(...TYPES[type].prizes.map(([a]) => a));
}

/** Zieht den Gewinn eines Loses aus dem Gewinnplan (0 = Niete). */
export function drawPrize(type, rnd = random) {
  const r = rnd();
  let acc = 0;
  for (const [amount, p] of TYPES[type].prizes) {
    acc += p;
    if (r < acc) return amount;
  }
  return 0;
}

// ---------- Losbilder ----------

const pickInt = (n, rnd) => Math.floor(rnd() * n);
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = pickInt(i + 1, rnd);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const counts = (list) => list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());

/** Baut das Losbild zu einem bereits gezogenen Gewinn. */
export function makeLayout(type, prize, rnd = random) {
  const t = TYPES[type];
  if (t.mechanic === "match3") {
    const amounts = t.prizes.map(([a]) => a);
    for (;;) {
      let cells;
      if (prize > 0) {
        const others = amounts.filter((a) => a !== prize);
        cells = [prize, prize, prize, ...Array.from({ length: t.fields - 3 }, () => others[pickInt(others.length, rnd)])];
        shuffle(cells, rnd);
      } else cells = Array.from({ length: t.fields }, () => amounts[pickInt(amounts.length, rnd)]);
      if (evaluateLayout(type, { cells }) === prize) return { cells };
    }
  }
  if (t.mechanic === "numbers") {
    const amounts = t.prizes.map(([a]) => a);
    const all = shuffle(Array.from({ length: NUMBERS }, (_, i) => i + 1), rnd);
    const win = all.slice(0, 2);
    const rest = all.slice(2);
    const own = rest.slice(0, 6).map((n) => ({ n, amount: amounts[pickInt(amounts.length, rnd)] }));
    if (prize > 0) {
      const i = pickInt(own.length, rnd);
      own[i] = { n: win[pickInt(2, rnd)], amount: prize };
    }
    return { win, own };
  }
  // diamond
  const cells = Array.from({ length: t.fields }, () => ({ s: SYMBOLS[pickInt(SYMBOLS.length, rnd)], amount: 0 }));
  if (prize > 0) cells[pickInt(cells.length, rnd)] = { s: DIAMOND, amount: prize };
  return { cells };
}

/** Wertet ein Losbild aus – das Bild ist die Wahrheit (auch nach dem Neuladen). */
export function evaluateLayout(type, layout) {
  const t = TYPES[type];
  if (!t || !layout) return 0;
  if (t.mechanic === "match3") {
    let prize = 0;
    let triples = 0;
    for (const [a, c] of counts(layout.cells)) if (c >= 3) {
      triples++;
      prize = c === 3 ? a : -1;
    }
    return triples === 1 && prize > 0 ? prize : triples ? -1 : 0; // −1 = ungültiges Bild
  }
  if (t.mechanic === "numbers") {
    const win = new Set(layout.win);
    const hits = layout.own.filter((o) => win.has(o.n));
    if (hits.length > 1) return -1;
    return hits.length ? hits[0].amount : 0;
  }
  const d = layout.cells.filter((c) => c.s === DIAMOND);
  if (d.length > 1) return -1;
  return d.length ? d[0].amount : 0;
}

/** Anzahl aufrubbelbarer Felder (für den Fortschritt). */
export function fieldCount(type) {
  return TYPES[type].fields;
}

export function validLayout(type, layout) {
  const t = TYPES[type];
  if (!t || !layout || typeof layout !== "object") return false;
  const amounts = new Set(t.prizes.map(([a]) => a));
  if (t.mechanic === "match3") return Array.isArray(layout.cells) && layout.cells.length === t.fields && layout.cells.every((a) => amounts.has(a));
  if (t.mechanic === "numbers") {
    const okNum = (n) => Number.isInteger(n) && n >= 1 && n <= NUMBERS;
    if (!Array.isArray(layout.win) || layout.win.length !== 2 || !layout.win.every(okNum) || layout.win[0] === layout.win[1]) return false;
    if (!Array.isArray(layout.own) || layout.own.length !== 6) return false;
    const nums = layout.own.map((o) => o?.n);
    return nums.every(okNum) && new Set(nums).size === 6 && layout.own.every((o) => amounts.has(o.amount));
  }
  return (
    Array.isArray(layout.cells) &&
    layout.cells.length === t.fields &&
    layout.cells.every((c) => c && (c.s === DIAMOND ? amounts.has(c.amount) : SYMBOLS.includes(c.s) && c.amount === 0))
  );
}

/** Ein neues Los: Gewinn ziehen, Bild bauen. Tischlage ist reine Optik. */
export function createTicket(type, { id, now = Date.now(), rnd = random, look = Math.random } = {}) {
  const prize = drawPrize(type, rnd);
  return {
    id,
    type,
    price: TYPES[type].price,
    prize,
    layout: makeLayout(type, prize, rnd),
    revealed: Array(fieldCount(type)).fill(false),
    boughtAt: now,
    rot: Math.round((look() - 0.5) * 14 * 10) / 10,
    dx: Math.round((look() - 0.5) * 10),
    dy: Math.round((look() - 0.5) * 10),
  };
}

// ---------- Spielstand ----------

export function defaultData() {
  return { tickets: [], history: [], seq: 0 };
}

/**
 * Bereinigt gespeicherte Daten. Der Gewinn wird IMMER aus dem Losbild neu
 * berechnet; kaputte Bilder fliegen raus statt neu gewürfelt zu werden.
 */
export function sanitizeData(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = defaultData();
  out.seq = Number.isSafeInteger(src.seq) && src.seq >= 0 ? src.seq : 0;
  for (const t of Array.isArray(src.tickets) ? src.tickets : []) {
    if (!t || !TYPES[t.type] || !validLayout(t.type, t.layout)) continue;
    const prize = evaluateLayout(t.type, t.layout);
    if (prize < 0) continue;
    const n = fieldCount(t.type);
    const revealed = Array.from({ length: n }, (_, i) => Array.isArray(t.revealed) && t.revealed[i] === true);
    const num = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
    out.tickets.push({
      id: String(t.id || `s${out.tickets.length}`).slice(0, 24),
      type: t.type,
      price: TYPES[t.type].price,
      prize,
      layout: JSON.parse(JSON.stringify(t.layout)),
      revealed,
      boughtAt: Number.isFinite(t.boughtAt) ? t.boughtAt : 0,
      rot: num(t.rot, -10, 10),
      dx: num(t.dx, -8, 8),
      dy: num(t.dy, -8, 8),
    });
    if (out.tickets.length >= MAX_ON_TABLE) break;
  }
  for (const x of Array.isArray(src.history) ? src.history.slice(0, HISTORY) : []) {
    if (!x || !TYPES[x.type]) continue;
    out.history.push({ type: x.type, price: TYPES[x.type].price, prize: Number.isSafeInteger(x.prize) && x.prize >= 0 ? x.prize : 0, at: Number.isFinite(x.at) ? x.at : 0 });
  }
  return out;
}

// ---------- Verwaltung ----------

/**
 * @param {object} o
 * @param {() => object} o.getData   Spieldaten (state.games.scratch)
 * @param {object} o.economy         debit/credit/countRound aus core/economy.js
 * @param {() => void} o.saveNow     sofort speichern (Kauf und Einfordern dürfen nicht verloren gehen)
 * @param {() => void} [o.save]      gebündelt speichern (Rubbel-Fortschritt)
 */
export function createScratch({ getData, economy, saveNow, save = saveNow, now = () => Date.now(), rnd = random, look = Math.random }) {
  const D = () => getData();
  const find = (id) => D().tickets.find((t) => t.id === id) || null;
  const api = {
    tickets: () => D().tickets,
    history: () => D().history,
    get: find,
    /** Kauft ein Los. Atomar: prüfen → genau einmal abbuchen → auslosen → sofort speichern. */
    buy(type) {
      const t = TYPES[type];
      if (!t) return { ok: false, reason: "Unbekanntes Los" };
      if (D().tickets.length >= MAX_ON_TABLE) return { ok: false, reason: `Höchstens ${MAX_ON_TABLE} Lose auf dem Tisch – erst aufrubbeln` };
      if (!economy.debit("scratch", t.price, "scratch")) return { ok: false, reason: economy.balance < t.price ? "Nicht genug Credits" : "Gerade nicht möglich" };
      const d = D();
      d.seq++;
      const ticket = createTicket(type, { id: `s${d.seq}`, now: now(), rnd, look });
      d.tickets.push(ticket);
      saveNow();
      return { ok: true, ticket };
    },
    /** Feld i ist freigerubbelt. Rückgabe: true, wenn das Los jetzt komplett offen ist. */
    reveal(id, i) {
      const t = find(id);
      if (!t || i < 0 || i >= t.revealed.length) return false;
      if (!t.revealed[i]) {
        t.revealed[i] = true;
        save();
      }
      return api.isOpen(id);
    },
    revealAll(id) {
      const t = find(id);
      if (!t) return false;
      t.revealed.fill(true);
      saveNow();
      return true;
    },
    isOpen(id) {
      const t = find(id);
      return Boolean(t) && t.revealed.every(Boolean);
    },
    /**
     * Gewinn einfordern bzw. Niete ablegen – genau einmal. Erst wenn das Los
     * vollständig aufgedeckt ist. Rückgabe: ausgezahlter Betrag (0 bei Niete) oder null.
     */
    resolve(id) {
      const d = D();
      const idx = d.tickets.findIndex((t) => t.id === id);
      if (idx < 0) return null;
      const t = d.tickets[idx];
      if (!t.revealed.every(Boolean)) return null;
      d.tickets.splice(idx, 1); // zuerst entfernen: ein zweiter Aufruf findet nichts mehr
      if (t.prize > 0) economy.credit("scratch", t.prize, "scratch");
      economy.countRound?.("scratch");
      d.history.unshift({ type: t.type, price: t.price, prize: t.prize, at: now() });
      if (d.history.length > HISTORY) d.history.length = HISTORY;
      saveNow();
      return t.prize;
    },
  };
  return api;
}
