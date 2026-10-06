// Neon Hoops – Wertung und Preise (rein, testbar). V1.1 neu balanciert:
// In V1.0 stapelten sich Serien-Multiplikatoren (×3) und Endspurt (×2) bei ~60
// Würfen; schon 30 % Trefferquote brachten mehr zurück als die Startgebühr.
// Jetzt: Ball braucht länger, Serie gibt höchstens ×2, Preise gedeckelt.

export const ENTRY = 40;
export const ROUND_TIME = 45;
export const FINAL_SPURT = 10; // letzte Sekunden: doppelte Punkte
export const MOVING_FROM = 30; // ab dieser Punktzahl pendelt der Korb
export const READY_TIME = 0.6; // s bis der nächste Ball bereitliegt
export const STREAK_FOR_X2 = 4;

/** Preistabelle [Mindestpunkte, Credits] – höchster zuerst. */
export const PRIZES = [
  [240, 120],
  [190, 80],
  [150, 55],
  [115, 40],
  [85, 28],
  [55, 16],
  [35, 8],
];

export function multiplier(streak) {
  return streak >= STREAK_FOR_X2 ? 2 : 1;
}

export function pointsFor({ swish, streak, spurt }) {
  return (swish ? 3 : 2) * multiplier(streak) * (spurt ? 2 : 1);
}

export function prizeFor(score) {
  for (const [min, prize] of PRIZES) if (score >= min) return prize;
  return 0;
}
