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
// V1.2: V1.1 war zu streng (blaue Zone ±2 Lampen bei 7–17 ms pro Lampe ≈ Zufall
// für Menschen). Jetzt: breitere Zonen, etwas ruhigere Umläufe. Simulation je
// Timing-Genauigkeit in sim/cyclone.mjs und docs/ECONOMY.md.
export const BASE_LAPS = [0.95, 0.85, 0.76, 0.68, 0.6]; // Sekunden pro Umlauf
export const STREAK_SPEEDUP = 0.92; // je Jackpot-Treffer in Folge
export const MIN_LAP = 0.5;
/** Zonen nach Abstand zur Jackpot-Lampe: [größter Abstand, Punkte, Name]. */
export const ZONES = [
  [0, 5, "jackpot"],
  [2, 3, "pink"],
  [6, 1, "blau"],
];
export const POINTS = ZONES.map((z) => z[1]); // [5, 3, 1]
export const MAX_POINTS = STAGES * POINTS[0];

/** Preistabelle: [Mindestpunkte, Vielfaches der Startgebühr]. Höchster Treffer zuerst. */
export const PRIZES = [
  [25, 8],
  [23, 2],
  [21, 1.35],
  [19, 1.1],
  [17, 0.9],
  [15, 0.8],
  [13, 0.65],
  [11, 0.5],
  [9, 0.3],
  [7, 0.2],
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

export function zoneOf(bulb) {
  const d = distance(bulb);
  for (const z of ZONES) if (d <= z[0]) return z;
  return null;
}

export function pointsFor(bulb) {
  return zoneOf(bulb)?.[1] ?? 0;
}

export function prizeMultiple(points) {
  for (const [min, mult] of PRIZES) if (points >= min) return mult;
  return 0;
}

export function prizeFor(points, entry) {
  return Math.round(prizeMultiple(points) * entry);
}
