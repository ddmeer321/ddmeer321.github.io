// Plinko-Multiplikatoren je Risikostufe (13 Fächer, symmetrisch).
//
// Die Fachwahrscheinlichkeiten stammen aus der Physik selbst (sim/plinko-dist.mjs,
// 400.000 Würfe, symmetrisiert) – NICHT aus einer vorgegebenen Verteilung.
// Aus ihnen ergibt sich die Auszahlungsquote; tests/plinko.test.mjs prüft, dass
// eine frische Simulation zu diesen Werten passt.
//
// Alle Multiplikatoren sind Vielfache von 0,2 und alle Einsätze Vielfache von 5
// → jede Auszahlung ist eine ganze Zahl, ohne Rundungsverluste.

export const MEASURED_P = [0.000775, 0.004471, 0.013448, 0.040091, 0.105689, 0.207292, 0.256468, 0.207292, 0.105689, 0.040091, 0.013448, 0.004471, 0.000775];

const mirror = (half) => [...half, ...half.slice(0, -1).reverse()];

export const RISKS = {
  // V1.2: Risiko soll vor allem Varianz bedeuten – die RTPs liegen jetzt eng
  // beieinander (95,1 / 94,8 / 95,3 %) statt 96,0 / 94,8 / 93,7 % in V1.1.
  low: { name: "Niedrig", mult: mirror([12, 3, 2, 1.4, 1.2, 0.8, 0.6]) },
  mid: { name: "Mittel", mult: mirror([50, 12, 4, 1.8, 1, 0.6, 0.2]) },
  high: { name: "Hoch", mult: mirror([200, 18, 5, 1.6, 0.4, 0.2, 0.2]) },
};

export function rtpOf(mult, p = MEASURED_P) {
  return mult.reduce((s, m, i) => s + m * p[i], 0);
}

/** Auszahlung in Credits (ganzzahlig, da Einsatz Vielfaches von 5). */
export function payoutFor(bet, mult) {
  return Math.round(bet * mult);
}

export function fmtMult(m) {
  return "×" + (Number.isInteger(m) ? String(m) : m.toFixed(1).replace(".", ","));
}
