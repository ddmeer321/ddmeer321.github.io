// Münzkaskade 2.0: Rückgabequote und Kettenreaktionen (Monte-Carlo, fester Seed).
import * as P from "../js/games/coinpusher/physics.js";
import { seeded } from "../js/core/rng.js";

export function simulate({ strat = "random", drops = 1500, seed = 3, gap = 0.45 } = {}) {
  const rnd = seeded(seed);
  const w = P.createWorld(rnd);
  P.seedField(w);
  let paid = 0, won = 0, lost = 0, free = 0, wins = 0, climbs = 0, maxStack = 0;
  const dt = 1 / 120;
  let t = 0, next = 0, done = 0;
  let cycleWins = 0, lastPy = w.py, rising = false;
  const chains = {};
  while (done < drops) {
    t += dt;
    if (t >= next) {
      const x = strat === "center" ? (rnd() - 0.5) * 10 : strat === "side" ? (rnd() < 0.5 ? -44 : 44) : (rnd() * 2 - 1) * 45;
      if (free > 0) { free--; P.dropCoin(w, (rnd() * 2 - 1) * 45, "normal"); }
      else { paid++; done++; P.dropCoin(w, x, P.rollType(rnd)); }
      next = t + gap;
    }
    for (const e of P.step(w, dt)) {
      if (e.kind === "win") { const ct = P.COIN_TYPES[e.coin.type]; won += ct.value; wins++; cycleWins++; if (ct.bonus) free += ct.bonus; }
      if (e.kind === "lost") lost++;
      if (e.kind === "climb") climbs++;
    }
    maxStack = Math.max(maxStack, w.coins.filter((c) => c.layer === 2).length);
    const nowRising = w.py > lastPy;
    if (nowRising && !rising) { chains[cycleWins] = (chains[cycleWins] || 0) + 1; cycleWins = 0; }
    rising = nowRising; lastPy = w.py;
  }
  return { paid, won, ratio: won / paid, lost, wins, climbs, maxStack, coins: w.coins.length, chains };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const strat of ["random", "center", "side"]) {
    const t0 = Date.now();
    const r = simulate({ strat, drops: +process.argv[2] || 1500 });
    console.log(strat.padEnd(7), "Quote", r.ratio.toFixed(3), "verloren", r.lost, "Stapel max", r.maxStack, "Kletterer", r.climbs, "Münzen", r.coins, "Ketten", JSON.stringify(r.chains), `${Date.now() - t0} ms`);
  }
}
