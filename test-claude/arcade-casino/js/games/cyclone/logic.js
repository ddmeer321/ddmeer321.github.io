// Lichtwirbel V1.1 – reine Spiellogik (deterministisch, testbar).
//
// Eine Runde besteht aus 5 Stopps („Stufen“). Pro Stufe läuft ein Licht mit
// konstanter, sichtbarer Geschwindigkeit über 48 Lampen; es startet an einer
// zufälligen Lampe (sichtbar). Gewertet wird genau die Lampe, die beim Tippen
// leuchtet – es gibt kein nachträgliches Verschieben. Jede Stufe ist schneller,
// jeder Jackpot-Treffer beschleunigt zusätzlich die nächste Stufe.
//
// Warum Runden statt Einzelstopp? In V1.0 brachte ein gut getimter Einzelstopp
// das 25-Fache – mit Rhythmus praktisch risikolos (RTP 10–25×). Jetzt gibt es
// eine feste Startgebühr und eine gedeckelte Preistabelle; siehe docs/ECONOMY.md.

export const BULBS = 48;
export const STAGES = 5;
export const BASE_LAPS = [0.8, 0.66, 0.55, 0.46, 0.38]; // Sekunden pro Umlauf
export const STREAK_SPEEDUP = 0.85; // je Jackpot-Treffer in Folge
export const MIN_LAP = 0.34;
export const POINTS = [5, 2, 1]; // nach Abstand zum Jackpot-Feld (0, 1, 2 Lampen)
export const MAX_POINTS = STAGES * POINTS[0];

/** Preistabelle: [Mindestpunkte, Vielfaches der Startgebühr]. Höchster Treffer zuerst. */
export const PRIZES = [
  [25, 25],
  [21, 3],
  [17, 1.8],
  [13, 1.2],
  [9, 0.8],
  [6, 0.5],
];

export function lapFor(stage, streak = 0) {
  const base = BASE_LAPS[Math.min(stage, BASE_LAPS.length - 1)];
  return Math.max(MIN_LAP, base * Math.pow(STREAK_SPEEDUP, Math.max(0, streak)));
}

/** Lichtposition (in Lampen, kontinuierlich) nach tMs Millisekunden. */
export function lightPos(start, lapSec, tMs) {
  const p = start + (tMs / 1000 / lapSec) * BULBS;
  return ((p % BULBS) + BULBS) % BULBS;
}

export function bulbAt(start, lapSec, tMs) {
  return Math.floor(lightPos(start, lapSec, tMs)) % BULBS;
}

export function distance(bulb) {
  const b = ((bulb % BULBS) + BULBS) % BULBS;
  return Math.min(b, BULBS - b);
}

export function pointsFor(bulb) {
  const d = distance(bulb);
  return d < POINTS.length ? POINTS[d] : 0;
}

export function prizeMultiple(points) {
  for (const [min, mult] of PRIZES) if (points >= min) return mult;
  return 0;
}

export function prizeFor(points, entry) {
  return Math.round(prizeMultiple(points) * entry);
}
