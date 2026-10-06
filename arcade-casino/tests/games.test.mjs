import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../js/core/rng.js";
import { handValue, isBlackjack, createRound, createShoe } from "../js/games/blackjack/logic.js";
import { payoutFor, betWins, isValidKey } from "../js/games/roulette/logic.js";
import { WHEEL_ORDER, RED } from "../js/games/roulette/wheel.js";
import { MACHINES } from "../js/games/slots/machines.js";
import { evaluate, exactRtp, simulateRtp, spin } from "../js/games/slots/engine.js";
import * as CP from "../js/games/coinpusher/physics.js";
import * as HP from "../js/games/hoops/physics.js";
import * as ST from "../js/games/stacker/logic.js";
import * as CY from "../js/games/cyclone/logic.js";
import { simulate as simulateCyclone } from "../sim/cyclone.mjs";
import { prizeFor } from "../js/games/hoops/hoops.js";

const C = (r, s = "♠") => ({ r, s });

function roundWith(bet, cards) {
  const queue = cards.map((x) => (typeof x === "string" ? C(x) : x));
  return createRound(bet, () => queue.shift());
}

// ---------- Blackjack ----------
test("Blackjack: Handwerte inkl. weicher Asse", () => {
  assert.deepEqual(handValue([C("A"), C("6")]), { total: 17, soft: true });
  assert.deepEqual(handValue([C("A"), C("6"), C("K")]), { total: 17, soft: false });
  assert.equal(handValue([C("A"), C("A"), C("9")]).total, 21);
  assert.equal(isBlackjack([C("A"), C("Q")]), true);
  assert.equal(isBlackjack([C("A"), C("Q")], true), false);
});

test("Blackjack zahlt 3:2", () => {
  // Spieler A,K – Dealer 9,7
  const g = roundWith(100, ["A", "9", "K", "7"]);
  assert.equal(g.round.phase, "done");
  const r = g.settle();
  assert.equal(r.hands[0].result, "blackjack");
  assert.equal(r.total, 250);
});

test("Dealer zieht bis 17 und steht auf weicher 17", () => {
  // Spieler 10,8 ; Dealer 6,A (weiche 17) → steht
  const g = roundWith(50, ["10", "6", "8", "A"]);
  g.stand();
  g.dealerPlay();
  assert.equal(handValue(g.round.dealer).total, 17);
  assert.equal(g.round.dealer.length, 2);
  assert.equal(g.settle().hands[0].result, "win");
});

test("Dealer-Peek: Dealer-Blackjack beendet die Runde sofort", () => {
  const g = roundWith(50, ["10", "A", "9", "K"]);
  assert.equal(g.round.phase, "done");
  assert.equal(g.settle().total, 0);
});

test("Push bei Gleichstand, Bust verliert", () => {
  const g = roundWith(40, ["10", "10", "8", "8"]);
  g.stand();
  g.dealerPlay();
  assert.equal(g.settle().total, 40);
  const g2 = roundWith(40, ["10", "10", "6", "7", "K"]);
  g2.hit();
  assert.equal(g2.round.phase, "dealer");
  g2.dealerPlay();
  assert.equal(g2.settle().hands[0].result, "bust");
});

test("Double Down: eine Karte, doppelter Einsatz", () => {
  const g = roundWith(50, ["6", "10", "5", "7", "K", "Q"]);
  assert.equal(g.canDouble(), true);
  g.double();
  assert.equal(g.round.hands[0].bet, 100);
  assert.equal(g.round.hands[0].cards.length, 3);
  g.dealerPlay();
  const r = g.settle();
  assert.equal(r.hands[0].result, "win"); // 21 gegen 17+10=27 (Bust)
  assert.equal(r.total, 200);
});

test("Split: zwei Hände, 21 nach Split ist kein Blackjack", () => {
  const g = roundWith(20, ["8", "10", "8", "9", "3", "A"]);
  assert.equal(g.canSplit(), true);
  g.split();
  assert.equal(g.round.hands.length, 2);
  assert.equal(g.round.hands[0].cards.length, 2);
  g.stand();
  g.stand();
  g.dealerPlay();
  const r = g.settle();
  assert.equal(r.hands.length, 2);
  // Hand 2: 8+A = 19 gegen 19 → Push; Hand 1: 8+3 = 11 → verliert
  assert.equal(r.hands[1].result, "push");
  assert.equal(r.hands[0].result, "lose");
});

test("Split-Asse bekommen nur eine Karte", () => {
  const g = roundWith(20, ["A", "9", "A", "7", "K", "K", "2"]);
  g.split();
  assert.equal(g.round.phase, "dealer");
  g.dealerPlay();
  const r = g.settle();
  assert.equal(r.hands[0].result, "win");
  assert.equal(r.hands[0].payout, 40); // 1:1, nicht 3:2
});

test("Verlassen mitten in der Runde: autoFinish rechnet ab", () => {
  const g = roundWith(20, ["10", "9", "9", "8"]);
  const r = g.autoFinish();
  assert.equal(r.hands[0].result, "win");
});

test("Schlitten: 6 Decks, 312 Karten, korrekte Verteilung", () => {
  const shoe = createShoe(6, seeded(1));
  assert.equal(shoe.remaining, 312);
  const counts = {};
  for (let i = 0; i < 312; i++) {
    const c = shoe.draw();
    counts[c.r] = (counts[c.r] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, 13);
  for (const n of Object.values(counts)) assert.equal(n, 24);
});

// ---------- Roulette ----------
test("Roulette: Rad hat 37 eindeutige Felder, 18 rote", () => {
  assert.equal(new Set(WHEEL_ORDER).size, 37);
  assert.equal(RED.size, 18);
});

test("Roulette: Auszahlungen je Wettart", () => {
  const bets = { "n:17": 10, red: 10, black: 10, odd: 10, even: 10, low: 10, high: 10, "dozen:2": 10, "col:2": 10 };
  // 17: schwarz, ungerade, 1–18, 2. Dutzend, 2. Kolonne
  const r = payoutFor(bets, 17);
  assert.equal(r.total, 360 + 20 + 20 + 20 + 30 + 30);
  // Null: nur Zahl 0 gewinnt
  assert.equal(payoutFor(bets, 0).total, 0);
  assert.equal(payoutFor({ "n:0": 5, red: 100 }, 0).total, 180);
});

test("Roulette: ungültige Wett-Schlüssel werden ignoriert", () => {
  assert.equal(isValidKey("n:37"), false);
  assert.equal(isValidKey("dozen:4"), false);
  assert.equal(payoutFor({ "n:99": 10, red: -5, black: 1.5 }, 2).total, 0);
  assert.equal(betWins("col:3", 36), true);
  assert.equal(betWins("col:1", 34), true);
});

test("Roulette: Erwartungswert jeder Außenwette ist 36/37", () => {
  for (const key of ["red", "black", "odd", "even", "low", "high", "dozen:1", "col:3", "n:5"]) {
    let total = 0;
    for (let n = 0; n <= 36; n++) total += payoutFor({ [key]: 1 }, n).total;
    assert.equal(total, 36, key);
  }
});

// ---------- Slots ----------
test("Slots: Auszahlungsquoten liegen zwischen 90 % und 98 %", () => {
  const fruit = exactRtp(MACHINES.fruit).rtp;
  const seven = exactRtp(MACHINES.seven).rtp;
  const cosmo = simulateRtp(MACHINES.cosmo, 300000, seeded(42)).rtp;
  for (const [name, rtp] of [["fruit", fruit], ["seven", seven], ["cosmo", cosmo]]) {
    assert.ok(rtp > 0.9 && rtp < 0.98, `${name}: ${rtp}`);
  }
});

test("Slots: Linienauswertung, Wild, Scatter, Kirschen", () => {
  const F = MACHINES.fruit;
  const grid = [
    ["lemon", "seven", "bell"],
    ["lemon", "seven", "cherry"],
    ["grapes", "seven", "cherry"],
  ];
  const r = evaluate(F, grid, 2);
  assert.equal(r.total, 150 * 2);
  assert.equal(r.lines[0].line, 0);

  const K = MACHINES.cosmo;
  const g2 = [
    ["rocket", "orb", "moon"],
    ["nova", "orb", "comet"],
    ["rocket", "star", "comet"],
    ["gem", "moon", "comet"],
    ["orb", "gem", "star"],
  ];
  const r2 = evaluate(K, g2, 1);
  assert.ok(r2.lines.some((l) => l.symbol === "rocket" && l.count === 3));
  assert.equal(r2.scatter.count, 3);
  assert.equal(r2.scatter.freeSpins, 8);

  const S = MACHINES.seven;
  const g3 = [
    ["blank", "cherry", "blank"],
    ["blank", "bar", "blank"],
    ["blank", "blank", "blank"],
  ];
  assert.equal(evaluate(S, g3, 10).total, 10);
  const g4 = [
    ["blank", "seven", "blank"],
    ["blank", "bar", "blank"],
    ["blank", "star", "blank"],
  ];
  assert.equal(evaluate(S, g4, 10).total, 50);
});

test("Slots: Gewinne und Verluste kommen beide vor", () => {
  const rnd = seeded(9);
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < 500; i++) {
    const r = spin(MACHINES.fruit, 1, { rnd });
    if (r.total > 0) wins++;
    else losses++;
  }
  assert.ok(wins > 50 && losses > 50);
});

// ---------- Coin Pusher ----------
test("Coin Pusher: Münzen fallen tatsächlich über die Vorderkante", () => {
  const rnd = seeded(5);
  const w = CP.createWorld(rnd);
  CP.seedField(w);
  let wins = 0;
  for (let i = 0; i < 120 * 20; i++) {
    if (i % 50 === 0) CP.dropCoin(w, (rnd() * 2 - 1) * 30);
    for (const e of CP.step(w, 1 / 120)) if (e.kind === "win") wins++;
  }
  assert.ok(wins > 5, `Gewinne: ${wins}`);
  assert.ok(w.coins.length <= CP.MAX_COINS);
});

test("Coin Pusher: gleicher Seed ⇒ gleiches Ergebnis; Speichern/Laden", () => {
  const run = () => {
    const rnd = seeded(77);
    const w = CP.createWorld(rnd);
    CP.seedField(w);
    let wins = 0;
    for (let i = 0; i < 2400; i++) {
      if (i % 60 === 0) CP.dropCoin(w, 10);
      for (const e of CP.step(w, 1 / 120)) if (e.kind === "win") wins++;
    }
    return { wins, n: w.coins.length, w };
  };
  const a = run();
  const b = run();
  assert.equal(a.wins, b.wins);
  assert.equal(a.n, b.n);
  const data = JSON.parse(JSON.stringify(CP.serialize(a.w)));
  const back = CP.deserialize(data);
  assert.ok(Math.abs(back.coins.length - a.w.coins.filter((c) => c.z <= 0 || c.layer === 0).length) === 0);
  assert.equal(CP.deserialize({ c: "x" }), null);
});

// ---------- Basketball ----------
test("Basketball: optimaler Wurf trifft, zu schwach/zu stark/schief verfehlt", () => {
  const up = HP.idealUpSpeed();
  assert.equal(HP.simulate(HP.swipeToVelocity(up, 0)).scored, true);
  assert.equal(HP.simulate(HP.swipeToVelocity(up * 0.7, 0)).scored, false);
  assert.equal(HP.simulate(HP.swipeToVelocity(up * 1.8, 0)).scored, false);
  assert.equal(HP.simulate(HP.swipeToVelocity(up, 0.6)).scored, false);
  assert.equal(HP.swipeToVelocity(0.2, 0), null);
});

test("Basketball: gleicher Swipe ⇒ identische Flugbahn (kein Zufall)", () => {
  const v = HP.swipeToVelocity(2.4, 0.05);
  const a = HP.simulate(v);
  const b = HP.simulate(v);
  assert.deepEqual([a.ball.x, a.ball.y, a.ball.z, a.scored, a.rimHits], [b.ball.x, b.ball.y, b.ball.z, b.scored, b.rimHits]);
});

test("Basketball: Ring- und Brettkontakte werden erkannt", () => {
  const up = HP.idealUpSpeed();
  let rim = false;
  let board = false;
  for (let k = 0.85; k < 1.4; k += 0.01) {
    const r = HP.simulate(HP.swipeToVelocity(up * k, 0));
    if (r.rimHits) rim = true;
    if (r.boardHits) board = true;
  }
  assert.ok(rim && board);
});

test("Basketball: Preise steigen mit der Punktzahl", () => {
  assert.equal(prizeFor(0), 0);
  assert.ok(prizeFor(50) > prizeFor(30));
  assert.ok(prizeFor(200) >= prizeFor(140));
});

// ---------- Turmbau / Lichtwirbel ----------
test("Turmbau: perfektes Stapeln erreicht den Jackpot, Versatz verkleinert", () => {
  const g = ST.createGame();
  while (!g.over) {
    // Zielposition = über der Reihe darunter
    const target = g.row === 0 ? 2 : g.stack[g.row - 1][0];
    let guard = 0;
    while (g.pos !== target && guard++ < 50) ST.advance(g);
    ST.place(g);
  }
  assert.equal(g.won, true);

  const g2 = ST.createGame();
  ST.place(g2); // Reihe 0 bei pos 0: 0,1,2
  ST.advance(g2); // nächste Reihe startet rechts und läuft nach links
  while (g2.pos !== 1) ST.advance(g2);
  const res = ST.place(g2);
  assert.equal(res.kept.length, 2);
  assert.equal(res.lost.length, 1);
});

test("Lichtwirbel: gewertet wird exakt die Lampe zum Zeitpunkt des Tippens", () => {
  const lap = CY.lapFor(0);
  const bulbMs = (lap * 1000) / CY.BULBS;
  for (let start = 0; start < CY.BULBS; start += 7) {
    // perfekter Tipp: Mitte der Jackpot-Lampe nach einer vollen Runde
    const t = (CY.BULBS + 0.5 - start) * bulbMs;
    assert.equal(CY.bulbAt(start, lap, t), 0);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t)), CY.POINTS[0]);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t + bulbMs)), CY.POINTS[1]);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t - 2 * bulbMs)), CY.POINTS[1]);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t + 3 * bulbMs)), CY.POINTS[2]);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t - 6 * bulbMs)), CY.POINTS[2]);
    assert.equal(CY.pointsFor(CY.bulbAt(start, lap, t + 7 * bulbMs)), 0);
  }
});

test("Lichtwirbel: Stufen werden schneller, Serien beschleunigen zusätzlich", () => {
  for (let i = 1; i < CY.STAGES; i++) assert.ok(CY.lapFor(i) < CY.lapFor(i - 1));
  assert.ok(CY.lapFor(2, 2) < CY.lapFor(2, 0));
  assert.ok(CY.lapFor(4, 99) >= CY.MIN_LAP);
});

test("Lichtwirbel: Preistabelle monoton, perfekte Runde ist der Jackpot", () => {
  let prev = Infinity;
  for (const [, m] of CY.PRIZES) {
    assert.ok(m < prev);
    prev = m;
  }
  assert.equal(CY.prizeFor(CY.MAX_POINTS, 20), 160);
  // ganzzahlige Preise bei der Startgebühr
  for (const [, m] of CY.PRIZES) assert.equal(Number.isInteger(m * 20), true);
  assert.equal(CY.prizeFor(0, 20), 0);
});

test("Lichtwirbel-Balance: kein Spieler mit realistischer Präzision druckt Credits", () => {
  const r = (o) => simulateCyclone({ ...o, rounds: 20000, seed: 3 }).rtp;
  assert.ok(r({ random: true }) < 0.1, "Zufall");
  assert.ok(r({ sigma: 40 }) < 0.75, "Durchschnitt");
  assert.ok(r({ sigma: 25 }) < 1.0, "gut");
  assert.ok(r({ sigma: 15 }) < 1.25, "sehr gut");
  assert.ok(r({ sigma: 10 }) < 1.65, "Elite");
});

test("Lichtwirbel V1.2: blaue Zone für normale Spieler erreichbar, pink spürbar schwerer, Jackpot selten", () => {
  const z = (sigma) => simulateCyclone({ sigma, rounds: 20000, seed: 4 });
  const normal = z(50);
  assert.ok(normal.blueOrBetterRate > 0.9, `blau+ bei σ50: ${normal.blueOrBetterRate}`);
  assert.ok(normal.pinkOrBetterRate > 0.4 && normal.pinkOrBetterRate < 0.75, `pink+ bei σ50: ${normal.pinkOrBetterRate}`);
  assert.ok(normal.jackpotHitRate < 0.2, `Jackpot bei σ50: ${normal.jackpotHitRate}`);
  assert.ok(normal.rtp > 0.4, "normal spielbar, nicht frustrierend");
});
