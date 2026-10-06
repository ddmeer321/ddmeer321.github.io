// Münzgreifer: ausgelieferte Werte (Grundeinheiten) je Griff für verschiedene Spielweisen.
import * as G from "../js/games/grabber/physics.js";
import { seeded } from "../js/core/rng.js";

const STRATS = {
  // wahllos irgendwohin
  random: (w, rnd) => G.CLAW_MIN_X + rnd() * (G.CLAW_MAX_X - G.CLAW_MIN_X),
  // zielt auf die wertvollste Münze der oberen Lage, mit Zielfehler ~0,5 Münzradien
  human: (w, rnd, gauss, memo) => {
    const top = w.coins.filter((c) => c.y + c.r >= G.contactY(w, c.x) - 0.6 && !(memo.failX !== undefined && Math.abs(c.x - memo.failX) < 1.2));
    top.sort((a, b) => G.COIN_TYPES[b.type].value - G.COIN_TYPES[a.type].value || rnd() - 0.5);
    const target = top[0] || w.coins[Math.floor(rnd() * w.coins.length)];
    return target.x + gauss() * 0.5;
  },
  // perfekter Rechner: probiert alle Positionen (obere Schranke, für Menschen unerreichbar)
  optimal: (w) => {
    let best = G.CLAW_MIN_X;
    let bestV = -1;
    for (let x = G.CLAW_MIN_X; x <= G.CLAW_MAX_X; x += 0.2) {
      const v = G.deliveredValue(G.planGrab(w, x));
      if (v > bestV) {
        bestV = v;
        best = x;
      }
    }
    return best;
  },
};

export function simulate(strategy, grabs = 1500, seed = 1) {
  const rnd = seeded(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const w = G.createWorld(rnd);
  let total = 0;
  let coins = 0;
  const hist = {};
  const memo = {};
  for (let i = 0; i < grabs; i++) {
    const x = STRATS[strategy](w, rnd, gauss, memo);
    const r = G.resolveGrab(w, x);
    memo.failX = r.delivered === 0 ? x : undefined;
    total += r.value;
    coins += r.delivered;
    hist[r.delivered] = (hist[r.delivered] || 0) + 1;
  }
  return { units: total / grabs, coins: coins / grabs, hist };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const s of ["random", "human", "optimal"]) {
    const t0 = Date.now();
    const r = simulate(s, +process.argv[2] || 800);
    console.log(s.padEnd(8), "Einheiten/Griff", r.units.toFixed(2), "Münzen/Griff", r.coins.toFixed(2), JSON.stringify(r.hist), `${Date.now() - t0} ms`);
  }
}
