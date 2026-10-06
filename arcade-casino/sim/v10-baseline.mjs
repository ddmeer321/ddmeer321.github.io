// Baseline-Analyse V1.0: erwartete Rückzahlung der Skillgames bei verschiedenen
// Timing-Genauigkeiten (Normalverteilter Fehler, σ in ms). Nur Analyse.
import { seeded } from "../js/core/rng.js";
const rnd = seeded(1);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// --- Lichtwirbel V1.0: 36 Felder, Runde 2,2 s, Start immer gegenüber → reines Intervall-Timing
function cycloneV10(sigma, n = 200000) {
  const cell = 2200 / 36; let ret = 0;
  for (let i = 0; i < n; i++) {
    const e = gauss() * sigma; // Ziel: Mitte des Jackpot-Feldes
    const d = Math.abs(Math.round(e / cell));
    ret += d === 0 ? 25 : d === 1 ? 4 : d === 2 ? 1 : 0;
  }
  return ret / n;
}
// --- Turmbau V1.0: Schrittzeit max(55, 190-12r), Breiten 3,3,3,3,2,2,2,2,2,1,1,1; Major 300 (15×), Minor 50 (2,5×) bei Einsatz 20
function stackerV10(sigma, n = 50000) {
  const MAXW = [3,3,3,3,2,2,2,2,2,1,1,1]; let ret = 0;
  for (let i = 0; i < n; i++) {
    let w = 3, row = 0, lost = false;
    while (row < 12) {
      const step = Math.max(55, 190 - row * 12);
      const off = Math.abs(Math.round(gauss() * sigma / step));
      const kept = row === 0 ? w : Math.max(0, w - off);
      if (!kept) { lost = true; break; }
      row++; if (row < 12) w = Math.min(kept, MAXW[row]);
    }
    ret += lost ? 0 : 300;
  }
  return ret / n / 20;
}
console.log("σ(ms)  Lichtwirbel-RTP  Turmbau-RTP(nur Major, ohne Minor-Mitnahme)");
for (const s of [8, 12, 20, 30, 45, 70]) console.log(String(s).padStart(5), cycloneV10(s).toFixed(2).padStart(14), stackerV10(s).toFixed(2).padStart(12));
console.log("Zufall (gleichverteilt) Lichtwirbel:", ((25 + 2 * 4 + 2 * 1) / 36).toFixed(3));

// --- Gratis-Nachschub V1.0: 500 Credits ohne Wartezeit, wenn < 10 → „Freeroll“:
// alles auf eine Roulette-Zahl (Tischlimit 2000 → hier 500) – Erwartete Nachschübe bis 18.000 Gewinn = 37
console.log("Freeroll V1.0: erwartete Nachschübe für +17.500 (Zahl 35:1):", 37);

// --- Neon Hoops V1.0: 45 s, Ball bereit nach 0,38 s + ~0,35 s Wischen ≈ 60 Würfe,
// Korb 2 / Swish 3, Serie ≥3 ×2, ≥6 ×3, letzte 10 s ×2. Preise bis 400 (8× Einsatz 50).
function hoopsV10(p, swish, n = 20000) {
  const PR = [[140,400],[110,250],[85,150],[65,100],[45,60],[30,30]];
  let ret = 0, avg = 0;
  for (let i = 0; i < n; i++) {
    let score = 0, streak = 0;
    for (let k = 0; k < 60; k++) {
      const t = k * 0.75;
      if (rnd() < p) { streak++; const base = rnd() < swish ? 3 : 2; score += base * (streak >= 6 ? 3 : streak >= 3 ? 2 : 1) * (t >= 35 ? 2 : 1); }
      else streak = 0;
    }
    avg += score; ret += (PR.find(([m]) => score >= m) || [0, 0])[1];
  }
  return { score: avg / n, rtp: ret / n / 50 };
}
console.log("\nHoops V1.0 (Trefferquote, Swish-Anteil) → Ø Punkte, RTP");
for (const [p, s] of [[0.3, 0.3], [0.5, 0.4], [0.7, 0.5], [0.85, 0.6]]) { const r = hoopsV10(p, s); console.log(p, s, r.score.toFixed(0), r.rtp.toFixed(2)); }
