// Turmbau V1.1: erwartete Rückzahlung je Timing-Genauigkeit.
// Modell: Der Spieler drückt, wenn die Reihe über dem Turm stehen sollte; sein
// zeitlicher Fehler ist normalverteilt (σ in ms) plus Bildraster-Quantisierung
// (60 Hz → σ ≈ 4,8 ms). Ein Fehler von k Schrittzeiten verschiebt die Reihe um
// k Zellen, überstehende Zellen fallen ab.
// Strategien: „take“ nimmt den Zwischenpreis immer mit, „go“ baut immer weiter.
import * as S from "../js/games/stacker/logic.js";
import { seeded } from "../js/core/rng.js";

const FRAME_SIGMA = 4.8;

export function simulate({ sigma, strategy = "take", rounds = 100000, seed = 1 }) {
  const rnd = seeded(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const s = Math.sqrt(sigma * sigma + FRAME_SIGMA * FRAME_SIGMA);
  let ret = 0; let minor = 0; let major = 0; let rows = 0;
  for (let i = 0; i < rounds; i++) {
    let w = 3; let row = 0; let prize = 0;
    while (true) {
      const off = row === 0 ? 0 : Math.abs(Math.round((gauss() * s) / S.stepMs(row)));
      const kept = Math.max(0, w - off);
      if (!kept) break;
      row++;
      if (row >= S.ROWS) { prize = S.MAJOR; major++; break; }
      if (row === S.MINOR_ROW && strategy === "take") { prize = S.MINOR; minor++; break; }
      w = Math.min(kept, S.MAX_WIDTH[row]);
    }
    rows += row;
    ret += prize;
  }
  return { rtp: ret / rounds / S.ENTRY, minorRate: minor / rounds, majorRate: major / rounds, avgRow: rows / rounds };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Schrittzeiten (ms):", Array.from({ length: S.ROWS }, (_, r) => S.stepMs(r)).join(", "));
  console.log("σ(ms)   RTP (mitnehmen)  RTP (weiterbauen)  Jackpot-Quote");
  for (const sigma of [70, 45, 30, 20, 15, 10, 6, 0]) {
    const a = simulate({ sigma, strategy: "take" });
    const b = simulate({ sigma, strategy: "go" });
    console.log(String(sigma).padStart(5), a.rtp.toFixed(2).padStart(12), b.rtp.toFixed(2).padStart(17), (b.majorRate * 100).toFixed(1).padStart(12) + " %");
  }
}
