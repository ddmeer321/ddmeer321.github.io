// Lichtwirbel V1.1: erwartete Rückzahlung für verschiedene Spielerfähigkeiten.
// Modell: Der Spieler zielt auf die Mitte der Jackpot-Lampe; sein zeitlicher
// Fehler ist normalverteilt (σ in ms, optional mit systematischem Versatz).
import * as C from "../js/games/cyclone/logic.js";
import { seeded } from "../js/core/rng.js";

export function simulate({ sigma, bias = 0, random = false, rounds = 100000, seed = 1 }) {
  const rnd = seeded(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let ret = 0; let perfect = 0; let jackHits = 0; let pinkPlus = 0; let bluePlus = 0;
  for (let r = 0; r < rounds; r++) {
    let pts = 0; let streak = 0;
    for (let s = 0; s < C.STAGES; s++) {
      const lap = C.lapFor(s, streak);
      const bulbMs = (lap * 1000) / C.BULBS;
      const pos = random ? rnd() * C.BULBS : 0.5 + (gauss() * sigma + bias) / bulbMs;
      const p = C.pointsFor(Math.floor(pos));
      pts += p;
      if (p === C.POINTS[0]) { streak++; jackHits++; } else streak = 0;
      if (p >= C.POINTS[1]) pinkPlus++;
      if (p >= C.POINTS[2]) bluePlus++;
    }
    if (pts === C.MAX_POINTS) perfect++;
    ret += C.prizeMultiple(pts);
  }
  const stops = rounds * C.STAGES;
  return { rtp: ret / rounds, perfectRate: perfect / rounds, jackpotHitRate: jackHits / stops, pinkOrBetterRate: pinkPlus / stops, blueOrBetterRate: bluePlus / stops };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Spieler                      RTP    Jackpot  Pink+   Blau+   perfekte Runde");
  const rows = [["Zufall (ohne Timing)", { random: true }], ["σ 80 ms (Anfänger)", { sigma: 80 }], ["σ 60 ms (Gelegenheit)", { sigma: 60 }], ["σ 50 ms (normal)", { sigma: 50 }], ["σ 40 ms (geübt)", { sigma: 40 }], ["σ 25 ms (gut)", { sigma: 25 }], ["σ 15 ms (sehr gut)", { sigma: 15 }], ["σ 10 ms (Elite)", { sigma: 10 }], ["σ 6 ms (Maschine)", { sigma: 6 }], ["σ 15 ms + 10 ms Versatz", { sigma: 15, bias: 10 }]];
  for (const [name, o] of rows) {
    const r = simulate(o);
    console.log(name.padEnd(28), r.rtp.toFixed(3), [r.jackpotHitRate, r.pinkOrBetterRate, r.blueOrBetterRate].map((x) => (x * 100).toFixed(0).padStart(5) + " %").join(" "), (r.perfectRate * 100).toFixed(3).padStart(10) + " %");
  }
}
