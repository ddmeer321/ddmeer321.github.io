// Neon Hoops V1.1: Punkte und Rückzahlung je Trefferquote (Modell: konstanter
// Wurfrhythmus, Trefferquote sinkt um 25 %, sobald der Korb pendelt).
import * as S from "../js/games/hoops/scoring.js";
import { seeded } from "../js/core/rng.js";

export function simulate(p, swishShare = 0.4, rounds = 20000, seed = 1, swipe = 0.32) {
  const rnd = seeded(seed);
  let ret = 0, avg = 0, best = 0;
  for (let r = 0; r < rounds; r++) {
    let score = 0, streak = 0;
    for (let t = 0; t < S.ROUND_TIME; t += S.READY_TIME + swipe) {
      const pp = score >= S.MOVING_FROM ? p * 0.75 : p;
      if (rnd() < pp) {
        streak++;
        score += S.pointsFor({ swish: rnd() < swishShare, streak, spurt: t >= S.ROUND_TIME - S.FINAL_SPURT });
      } else streak = 0;
    }
    avg += score; best = Math.max(best, score);
    ret += S.prizeFor(score);
  }
  return { avgScore: avg / rounds, rtp: ret / rounds / S.ENTRY, best };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [p, s] of [[0.2, 0.3], [0.35, 0.35], [0.5, 0.4], [0.65, 0.5], [0.8, 0.6], [0.92, 0.7]]) {
    const r = simulate(p, s);
    console.log(`Trefferquote ${p} Swish ${s}: Ø ${r.avgScore.toFixed(0)} Punkte, max ${r.best}, RTP ${r.rtp.toFixed(2)}`);
  }
}
