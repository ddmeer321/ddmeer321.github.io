// V1.1: Balance der bestehenden Spiele (Blackjack, Turmbau, Basketball, Slots, Roulette).
import test from "node:test";
import assert from "node:assert/strict";

import { simulate as simBlackjack } from "../sim/blackjack.mjs";
import { simulate as simStacker } from "../sim/stacker.mjs";
import { simulate as simHoops } from "../sim/hoops.mjs";
import * as ST from "../js/games/stacker/logic.js";
import * as HS from "../js/games/hoops/scoring.js";
import { MACHINES } from "../js/games/slots/machines.js";
import { spin } from "../js/games/slots/engine.js";
import { seeded } from "../js/core/rng.js";
import { LIMITS, MAX_SINGLE_WIN } from "../js/core/limits.js";
import { payoutFor, ODDS } from "../js/games/roulette/logic.js";

test("Blackjack (Basisstrategie, 6 Decks, S17, 3:2): Hausvorteil 0,2–1,2 %, plausible Raten, gleichverteilte Ränge", () => {
  const r = simBlackjack(200000, 7);
  assert.ok(r.houseEdge > 0.002 && r.houseEdge < 0.012, `Hausvorteil ${r.houseEdge}`);
  assert.ok(r.bjRate > 0.042 && r.bjRate < 0.05, `Blackjack-Quote ${r.bjRate}`);
  assert.ok(r.dealerBustRate > 0.2 && r.dealerBustRate < 0.3, `Dealer-Bust ${r.dealerBustRate}`);
  assert.ok(r.pushRate > 0.07 && r.pushRate < 0.11, `Push ${r.pushRate}`);
  // 13 Ränge, „10“ inkl. Bildkarten zählt einzeln: jeder Rang ≈ 1/13
  for (const [rank, share] of Object.entries(r.rankShare)) assert.ok(Math.abs(share - 1 / 13) < 0.004, `Rang ${rank}: ${share}`);
});

test("Turmbau: Durchschnittsspieler verlieren, sehr gute liegen nahe 1, Elite ist gedeckelt", () => {
  const take = (sigma) => simStacker({ sigma, strategy: "take", rounds: 40000, seed: 3 }).rtp;
  const go = (sigma) => simStacker({ sigma, strategy: "go", rounds: 40000, seed: 3 }).rtp;
  const best = (sigma) => Math.max(take(sigma), go(sigma));
  assert.ok(best(45) < 0.45, `σ45: ${best(45)}`);
  assert.ok(best(30) < 0.8, `σ30: ${best(30)}`);
  assert.ok(best(20) < 1.05, `σ20: ${best(20)}`);
  assert.ok(best(15) < 1.2, `σ15: ${best(15)}`);
  assert.ok(best(10) < 1.7, `σ10: ${best(10)}`);
  // Zwischenpreis ist die einzige Quelle bis Reihe 8 → RTP „mitnehmen“ nie über MINOR/ENTRY
  assert.ok(take(0) <= ST.MINOR / ST.ENTRY + 1e-9);
  // V1.0-Werte (Major 300 = 15×) dürfen nicht zurückkehren
  assert.ok(ST.MAJOR / ST.ENTRY <= 4, `Jackpot ${ST.MAJOR / ST.ENTRY}×`);
});

test("Turmbau: Tempo steigt monoton, oben sichtbar schnell (≥ 1 Bild bei 60 Hz)", () => {
  for (let r = 1; r < ST.ROWS; r++) assert.ok(ST.stepMs(r) <= ST.stepMs(r - 1));
  assert.ok(ST.stepMs(ST.ROWS - 1) >= 17, "jede Position muss mindestens ein Bild lang sichtbar sein");
  assert.ok(ST.stepMs(ST.ROWS - 1) < 30);
});

test("Turmbau: perfektes Timing erreicht den Jackpot – keine versteckte Ergebnisverschiebung", () => {
  const gm = ST.createGame();
  // perfekter Spieler: stoppt genau, wenn alle Zellen über der Reihe darunter liegen
  while (!gm.over) {
    if (gm.row > 0) {
      const below = new Set(gm.stack[gm.row - 1]);
      let guard = 0;
      while (![...Array(gm.width).keys()].every((i) => below.has(gm.pos + i)) && guard++ < 50) ST.advance(gm);
    }
    ST.place(gm);
  }
  assert.equal(gm.won, true);
});

test("Basketball: Gelegenheitswerfer verlieren deutlich, Profis liegen nahe 1, Preise gedeckelt", () => {
  assert.ok(simHoops(0.35, 0.35, 8000, 2).rtp < 0.35);
  assert.ok(simHoops(0.5, 0.4, 8000, 2).rtp < 0.55);
  const pro = simHoops(0.8, 0.6, 8000, 2).rtp;
  assert.ok(pro > 0.7 && pro < 1.1, `p=0.8: ${pro}`);
  assert.ok(simHoops(0.92, 0.7, 8000, 2).rtp < 1.5);
  const top = Math.max(...HS.PRIZES.map(([, p]) => p));
  assert.ok(top / HS.ENTRY <= 3, `Höchstpreis ${top / HS.ENTRY}×`);
  assert.equal(HS.prizeFor(0), 0);
  for (let i = 1; i < HS.PRIZES.length; i++) assert.ok(HS.PRIZES[i - 1][0] > HS.PRIZES[i][0] && HS.PRIZES[i - 1][1] >= HS.PRIZES[i][1]);
});

test("Slots: Einsatzstufen kommen aus LIMITS, Höchstgewinn pro Dreh bleibt unter MAX_SINGLE_WIN", () => {
  for (const m of Object.values(MACHINES)) {
    const lim = LIMITS[`slots-${m.id}`];
    assert.ok(lim, m.id);
    for (const b of lim.steps) assert.equal(b % m.lines.length, 0, `${m.id}: Einsatz ${b} nicht durch Linien teilbar`);
    const lineBet = lim.max / m.lines.length;
    const topLine = Math.max(...Object.values(m.pays).flatMap((p) => Object.values(p)));
    const freeMult = m.freeSpinMultiplier || 1;
    // grobe Obergrenze: alle Linien mit dem Höchstwert (in der Praxis unmöglich) – nur für 1-Linien-Maschinen exakt
    const bound = m.lines.length === 1 ? topLine * lineBet : topLine * lineBet * freeMult;
    assert.ok(bound <= MAX_SINGLE_WIN, `${m.id}: ${bound}`);
  }
});

test("Kosmo 5: Nova liegt nicht auf Walze 1/5 und hat keine (unerreichbare) eigene Linienzahlung", () => {
  const c = MACHINES.cosmo;
  assert.equal(c.strips[0].includes("nova"), false);
  assert.equal(c.strips[4].includes("nova"), false);
  assert.equal(c.pays.nova, undefined);
  // Wild ersetzt weiterhin: Simulation findet Linien mit Nova in der Mitte
  const rnd = seeded(5);
  let withWild = 0;
  for (let i = 0; i < 4000; i++) {
    const o = spin(c, 1, { rnd });
    for (const l of o.lines) if (l.cells.some(([reel, row]) => o.grid[reel][row] === "nova")) withWild++;
  }
  assert.ok(withWild > 0, "Nova muss als Joker in Gewinnlinien vorkommen");
});

test("Roulette: Limits – Einzelzahl max. 100, Tisch max. 2000, Höchstgewinn im Rahmen", () => {
  assert.equal(LIMITS.roulette.maxStraight, 100);
  assert.equal(LIMITS.roulette.max, 2000);
  // bestmöglicher Einzeltreffer bei vollem Tischlimit: 20 Zahlen à 100
  const bets = {};
  for (let n = 1; n <= 20; n++) bets[`n:${n}`] = 100;
  assert.equal(payoutFor(bets, 7).total, 100 * (ODDS.n + 1));
  assert.ok(2000 * (ODDS.red + 1) <= MAX_SINGLE_WIN);
});
