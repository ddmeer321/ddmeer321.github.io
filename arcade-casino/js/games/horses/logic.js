// Pferderennen – Rennmodell, Quoten, Auswertung (rein, deterministisch je Seed).
//
// EHRLICHKEIT: Es gibt genau EIN Rennmodell. Die Quoten werden vor dem Rennen
// berechnet, indem dasselbe Modell viele Male (Monte-Carlo) gelaufen wird; aus
// den Sieg-/Platzhäufigkeiten ergeben sich die Wahrscheinlichkeiten und daraus –
// abzüglich einer festen Marge – die Quoten. Das angezeigte Rennen ist ein
// weiterer, unabhängiger Lauf desselben Modells; die Animation zeigt exakt dessen
// Positionen, und der Sieger ist, wer in dieser Simulation zuerst ins Ziel kommt.

import { seeded } from "../../core/rng.js";

export const DISTANCE = 100; // Bahn-Einheiten
export const DT = 0.05; // s
export const SEGMENTS = 7; // Tempo-Abschnitte (Führungswechsel)
export const MARGIN = 0.07; // Marge → Ziel-RTP ≈ 93 % (Quoten werden zusätzlich abgerundet)
export const MC_RUNS = 4000;
export const MIN_ODDS = 1.2;
export const MAX_ODDS = 40;

export const NAMES = [
  "Neonblitz", "Mitternacht", "Glücksfee", "Sternschnuppe", "Donnerhuf", "Silberpfeil", "Kometenschweif", "Pixelprinz",
  "Laserlady", "Turbo-Toni", "Nebelreiter", "Goldjunge", "Rosenrausch", "Funkenflug", "Mondscheinbaron", "Disco-Diva",
  "Windspiel", "Nachtfalter", "Blaue Stunde", "Zuckerwatte",
];
export const SILKS = ["#ff3d9a", "#2de2e6", "#ffc53d", "#8cff5a", "#9b5cff", "#ff8a3d"];
export const STYLES = {
  early: { label: "Frühstarter", curve: (p) => 1.06 - 0.12 * p },
  closer: { label: "Endspurtler", curve: (p) => 0.95 + 0.11 * p * p },
  steady: { label: "Konstant", curve: () => 1.0 },
};
const STYLE_KEYS = Object.keys(STYLES);

/** Startfeld aus einem Seed: 6 Pferde mit Grundtempo und Rennstil. */
export function makeCard(seed) {
  const rnd = seeded(seed);
  const names = NAMES.slice();
  const horses = [];
  for (let i = 0; i < 6; i++) {
    const k = Math.floor(rnd() * names.length);
    const name = names.splice(k, 1)[0];
    horses.push({
      no: i + 1,
      name,
      silk: SILKS[i],
      // Grundtempo: kleine Unterschiede, damit Favoriten und Außenseiter entstehen
      speed: 7 + (rnd() - 0.5) * 0.28,
      style: STYLE_KEYS[Math.floor(rnd() * STYLE_KEYS.length)],
    });
  }
  return { seed, horses };
}

function gauss(rnd) {
  let u = 0;
  let v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Ein Rennen. Rückgabe: Ziel-Reihenfolge, Zielzeiten und (optional) die
 * Positionen pro Zeitschritt für die Animation.
 */
export function runRace(card, raceSeed, { track = false } = {}) {
  const rnd = seeded(raceSeed);
  const n = card.horses.length;
  // Tagesform und Abschnitts-Tempo (geglättet) je Pferd
  const form = card.horses.map(() => gauss(rnd) * 0.035);
  const seg = card.horses.map(() => Array.from({ length: SEGMENTS + 1 }, () => gauss(rnd) * 0.05));
  const pos = new Array(n).fill(0);
  const finish = new Array(n).fill(Infinity);
  const frames = track ? [] : null;
  let t = 0;
  let finished = 0;
  while (finished < n && t < 60) {
    if (frames) frames.push(pos.slice());
    for (let i = 0; i < n; i++) {
      if (finish[i] < Infinity) {
        pos[i] += card.horses[i].speed * DT * 0.6; // ausgaloppieren
        continue;
      }
      const h = card.horses[i];
      const p = Math.min(1, pos[i] / DISTANCE);
      const sIdx = p * SEGMENTS;
      const k = Math.floor(sIdx);
      const f = sIdx - k;
      const sm = f * f * (3 - 2 * f);
      const segF = seg[i][k] * (1 - sm) + seg[i][Math.min(SEGMENTS, k + 1)] * sm;
      const start = Math.min(1, t / 1.2); // Antritt aus der Startbox
      const v = h.speed * STYLES[h.style].curve(p) * (1 + form[i] + segF) * (0.35 + 0.65 * start);
      const before = pos[i];
      pos[i] += v * DT;
      if (pos[i] >= DISTANCE) {
        // exakte Zielzeit (lineare Interpolation im Zeitschritt)
        finish[i] = t + ((DISTANCE - before) / (pos[i] - before)) * DT;
        finished++;
      }
    }
    t += DT;
  }
  if (frames) frames.push(pos.slice());
  const order = finish.map((ft, i) => [ft, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i);
  return { order, finish, frames, duration: finish[order[0]] };
}

/** Sieg- und Platzwahrscheinlichkeiten per Monte-Carlo. */
export function probabilities(card, runs = MC_RUNS) {
  const n = card.horses.length;
  const win = new Array(n).fill(0);
  const place = new Array(n).fill(0);
  for (let r = 0; r < runs; r++) {
    const res = runRace(card, (card.seed * 7919 + r * 104729 + 17) >>> 0);
    win[res.order[0]]++;
    place[res.order[0]]++;
    place[res.order[1]]++;
  }
  return { win: win.map((x) => x / runs), place: place.map((x) => x / runs) };
}

/** Dezimalquote aus Wahrscheinlichkeit: (1 − Marge) / p, auf 0,1 abgerundet. */
export function oddsFor(p) {
  if (!(p > 0)) return MAX_ODDS;
  const raw = (1 - MARGIN) / p;
  return Math.max(MIN_ODDS, Math.min(MAX_ODDS, Math.floor(raw * 10) / 10));
}

export function buildMarket(card, runs = MC_RUNS) {
  const pr = probabilities(card, runs);
  return {
    win: pr.win.map(oddsFor),
    place: pr.place.map(oddsFor),
    pWin: pr.win,
    pPlace: pr.place,
  };
}

/** Auszahlung (Rückzahlung inkl. Einsatz). type: "win" | "place". */
export function payout(type, horse, stake, odds, order) {
  const hit = type === "win" ? order[0] === horse : order[0] === horse || order[1] === horse;
  // Runden, NICHT abrunden. Quoten haben eine Nachkommastelle und Einsaetze
  // sind Vielfache von 10, Quote x Einsatz ist also immer ganzzahlig -- aber
  // in Gleitkomma knapp daneben: 2.3 * 50 ergibt 114.99999999999999, und
  // Math.floor machte daraus 114 statt 115. Das traf 103 der 2334 moeglichen
  // Quote-Einsatz-Kombinationen. Math.floor zahlte also zu wenig; runden kann
  // hier nie zu viel zahlen, weil das exakte Ergebnis ganzzahlig ist.
  return hit ? Math.round(stake * odds) : 0;
}
