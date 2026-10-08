// Rubbellose: Gewinnpläne, Losbilder, Kauf, Aufdecken, Einfordern, Spielstand.
import test from "node:test";
import assert from "node:assert/strict";

import * as S from "../js/games/scratch/tickets.js";
import { createEconomy } from "../js/core/economy.js";
import { defaultState, sanitizeState } from "../js/core/state.js";
import { seeded } from "../js/core/rng.js";
import { MAX_SINGLE_WIN } from "../js/core/limits.js";

function setup({ balance = 10000, guard = () => null, rnd = seeded(1) } = {}) {
  const s = defaultState();
  s.balance = balance;
  s.games.scratch = S.defaultData();
  const economy = createEconomy({ getState: () => s, guard });
  let writes = 0;
  const sc = S.createScratch({ getData: () => s.games.scratch, economy, saveNow: () => writes++, rnd, look: seeded(2) });
  return { s, economy, sc, writes: () => writes };
}

test("Gewinnpläne: 7 Lossorten, Coin-Sink mit 65–72 % RTP, Gewinne steigen mit der Seltenheit, Deckel eingehalten", () => {
  assert.equal(S.TYPE_IDS.length, 7);
  for (const id of S.TYPE_IDS) {
    const t = S.TYPES[id];
    const r = S.rtpOf(id);
    assert.ok(r > 0.65 && r < 0.72, `${id}: RTP ${r}`);
    const pw = S.pAnyWin(id);
    assert.ok(pw > 0.2 && pw < 0.35, `${id}: Gewinnchance ${pw}`);
    const base = S.baseDist(id);
    for (let i = 1; i < base.length; i++) {
      assert.ok(base[i - 1][0] > base[i][0], `${id}: Beträge absteigend`);
      assert.ok(base[i - 1][1] < base[i][1], `${id}: höherer Gewinn ist seltener`);
    }
    assert.equal(base[base.length - 1][0], t.price, `${id}: kleinster Gewinn = Einsatz zurück`);
    assert.ok(S.topPrize(id) <= MAX_SINGLE_WIN, `${id}: Höchstgewinn ${S.topPrize(id)} über MAX_SINGLE_WIN`);
    // Gesamtverteilung = Grund × Bonus, Wahrscheinlichkeiten summieren sich zur Gewinnchance
    const total = S.prizeDist(id).reduce((s2, [, p]) => s2 + p, 0);
    assert.ok(Math.abs(total - pw) < 1e-12, `${id}: Summe ${total} ≠ ${pw}`);
  }
  // Prüfwerte von Hand
  assert.ok(Math.abs(S.rtpOf("neon7") - 0.68) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("lucky") - 0.69) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("vault") - 0.69) < 1e-12);
  const em = S.MULTI.reduce((s2, [m, p]) => s2 + m * p, 0);
  assert.ok(Math.abs(em - 1.53) < 1e-12, "Erwartungswert MULTI");
  assert.ok(Math.abs(S.MULTI.reduce((s2, [, p]) => s2 + p, 0) - 1) < 1e-12);
  const baseEv = (id) => S.TYPES[id].prizes.reduce((s2, [a, p]) => s2 + a * p, 0);
  assert.ok(Math.abs(S.rtpOf("turbo") - (baseEv("turbo") * em) / 50) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("crown") - (baseEv("crown") * em) / 500) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("luckyx") - (baseEv("luckyx") * 1.4) / 100) < 1e-12, "Extrazahl: E = 0,9 · 1 + 0,1 · 5 = 1,4");
  // Goldgräber: Binomialverteilung 12 Felder, p = 0,15
  const b = (k) => {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (12 - k + i)) / i;
    return c * 0.15 ** k * 0.85 ** (12 - k);
  };
  const p3plus = 1 - [0, 1, 2].reduce((s2, k) => s2 + b(k), 0);
  assert.ok(Math.abs(S.pAnyWin("digger") - p3plus) < 1e-12);
  assert.ok(Math.abs(S.baseDist("digger").find(([a]) => a === 75)[1] - b(4)) < 1e-15);
});

test("Monte-Carlo: echte Lose (Kaufweg) entsprechen der exakten Gewinnverteilung", () => {
  const rnd = seeded(7);
  const n = 200000;
  for (const id of S.TYPE_IDS) {
    const hist = new Map();
    for (let i = 0; i < n; i++) {
      const t = S.createTicket(id, { id: "x", rnd, look: () => 0.5 });
      hist.set(t.prize, (hist.get(t.prize) || 0) + 1);
    }
    const dist = S.prizeDist(id);
    for (const [amount, p] of dist) {
      const exp = p * n;
      if (exp < 100) continue;
      assert.ok(Math.abs((hist.get(amount) || 0) - exp) < 5 * Math.sqrt(exp), `${id} ${amount}: ${hist.get(amount)} vs ${exp.toFixed(0)}`);
    }
    for (const amount of hist.keys()) assert.ok(amount === 0 || dist.some(([a]) => a === amount), `${id}: unbekannter Betrag ${amount}`);
    const capped = dist.filter(([, p]) => p * n >= 100);
    const expCapped = capped.reduce((s2, [a, p]) => s2 + a * p, 0) / S.TYPES[id].price;
    const gotCapped = capped.reduce((s2, [a]) => s2 + a * (hist.get(a) || 0), 0) / n / S.TYPES[id].price;
    assert.ok(Math.abs(gotCapped - expCapped) < 0.03, `${id}: ${gotCapped} vs ${expCapped}`);
  }
});

test("Losbilder: zeigen genau den gezogenen Grundgewinn, Bonus multipliziert sichtbar", () => {
  const rnd = seeded(11);
  for (const id of S.TYPE_IDS) {
    const t = S.TYPES[id];
    if (t.mechanic !== "coins") {
      for (const prize of [0, ...t.prizes.map(([a]) => a)]) {
        for (let k = 0; k < 200; k++) assert.equal(S.evaluateBase(id, S.makeLayout(id, prize, rnd)), prize, `${id}: Bild zeigt nicht ${prize}`);
      }
    }
    for (let k = 0; k < 500; k++) {
      const tk = S.createTicket(id, { id: "x", rnd });
      assert.ok(S.validLayout(id, tk.layout), `${id}: ungültiges Bild`);
      assert.equal(tk.prize, S.evaluateBase(id, tk.layout) * S.bonusFactor(id, tk.layout));
      assert.equal(tk.revealed.length, S.fieldCount(id));
    }
  }
  assert.equal(S.evaluateLayout("turbo", { cells: [100, 50, 100, 250, 100, 500], multi: 5 }), 500);
  assert.equal(S.evaluateLayout("turbo", { cells: [100, 50, 100, 250, 50, 500], multi: 10 }), 0, "Multi ohne Gewinn bringt nichts");
  assert.equal(S.evaluateLayout("luckyx", { win: [3, 9], own: [{ n: 3, amount: 200 }, { n: 1, amount: 100 }, { n: 2, amount: 100 }, { n: 4, amount: 100 }, { n: 5, amount: 100 }, { n: 6, amount: 100 }], extra: { draw: 7, mine: 7 } }), 1000);
  assert.equal(S.evaluateLayout("digger", { cells: [true, true, true, true, false, false, false, false, false, false, false, false] }), 75);
});

test("Bonus ist unabhängig: Multiplikator und Extrazahl auf Nieten so häufig wie auf Gewinnen", () => {
  const rnd = seeded(21);
  const n = 120000;
  const tally = { win: { n: 0, big: 0 }, lose: { n: 0, big: 0 } };
  const extra = { win: { n: 0, hit: 0 }, lose: { n: 0, hit: 0 } };
  for (let i = 0; i < n; i++) {
    const t = S.createTicket("turbo", { id: "x", rnd });
    const k = S.evaluateBase("turbo", t.layout) > 0 ? "win" : "lose";
    tally[k].n++;
    if (t.layout.multi >= 5) tally[k].big++;
    const e = S.createTicket("luckyx", { id: "y", rnd });
    const k2 = S.evaluateBase("luckyx", e.layout) > 0 ? "win" : "lose";
    extra[k2].n++;
    if (e.layout.extra.draw === e.layout.extra.mine) extra[k2].hit++;
  }
  const pBig = 0.04;
  for (const k of ["win", "lose"]) {
    const sd = Math.sqrt((pBig * (1 - pBig)) / tally[k].n);
    assert.ok(Math.abs(tally[k].big / tally[k].n - pBig) < 5 * sd, `MULTI ≥ ×5 bei ${k}: ${tally[k].big / tally[k].n}`);
    const sd2 = Math.sqrt((0.1 * 0.9) / extra[k].n);
    assert.ok(Math.abs(extra[k].hit / extra[k].n - 0.1) < 5 * sd2, `Extrazahl bei ${k}: ${extra[k].hit / extra[k].n}`);
  }
});

test("Nieten: keine eingebauten Beinahe-Gewinne (Paare so häufig wie bei reinem Zufall)", () => {
  // Neon Sieben: gleichverteilte Nieten-Bilder ⇒ Anteil mit mindestens einem Paar = Zufallserwartung
  const rnd = seeded(5);
  const amounts = S.TYPES.neon7.prizes.map(([a]) => a);
  let pairsGen = 0;
  let pairsRef = 0;
  let refN = 0;
  const n = 30000;
  const hasPair = (cells) => [...cells.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map()).values()].some((c) => c === 2);
  for (let i = 0; i < n; i++) if (hasPair(S.makeLayout("neon7", 0, rnd).cells)) pairsGen++;
  const ref = seeded(6);
  while (refN < n) {
    const cells = Array.from({ length: 6 }, () => amounts[Math.floor(ref() * amounts.length)]);
    if (S.evaluateLayout("neon7", { cells }) !== 0) continue; // nur Nieten
    refN++;
    if (hasPair(cells)) pairsRef++;
  }
  assert.ok(Math.abs(pairsGen / n - pairsRef / n) < 0.02, `${pairsGen / n} vs ${pairsRef / n}`);
  // Glückszahlen/Tresor: Nieten enthalten nie eine Gewinnzahl bzw. einen Diamanten
  for (let i = 0; i < 2000; i++) {
    const L = S.makeLayout("lucky", 0, rnd);
    assert.ok(!L.own.some((o) => L.win.includes(o.n)));
    assert.ok(!S.makeLayout("vault", 0, rnd).cells.some((c) => c.s === S.DIAMOND));
  }
});

test("Kauf: genau einmal abgebucht, Ergebnis sofort gespeichert, höchstens 12 Lose auf dem Tisch", () => {
  const t = setup();
  const r = t.sc.buy("neon7");
  assert.equal(r.ok, true);
  assert.equal(t.s.balance, 10000 - 20);
  assert.equal(t.s.stats.wagered, 20);
  assert.ok(t.writes() >= 1, "sofort gespeichert");
  assert.equal(S.evaluateLayout("neon7", r.ticket.layout), r.ticket.prize);
  assert.equal(t.sc.buy("nope").ok, false);
  for (let i = 0; i < 20; i++) t.sc.buy("lucky");
  assert.equal(t.sc.tickets().length, S.MAX_ON_TABLE);
  assert.equal(t.s.balance, 10000 - 20 - 11 * 50);
  const poor = setup({ balance: 199 });
  assert.equal(poor.sc.buy("vault").ok, false);
  assert.equal(poor.s.balance, 199);
  const paused = setup({ guard: () => "Spielpause" });
  assert.equal(paused.sc.buy("neon7").ok, false);
  assert.equal(paused.s.balance, 10000);
});

test("Einfordern: erst nach dem Aufdecken, genau einmal, Bilanz stimmt", () => {
  // Zufallsquelle: erster Wert 0,02 ⇒ Gewinnklasse 100 (kumuliert 0,0116 … 0,0366), danach normal
  const base = seeded(3);
  let first = true;
  const t = setup({ rnd: () => (first ? ((first = false), 0.02) : base()) });
  const win = t.sc.buy("neon7").ticket;
  assert.equal(win.prize, 100);
  assert.equal(t.sc.resolve(win.id), null, "vor dem Aufdecken nicht einforderbar");
  for (let i = 0; i < win.revealed.length - 1; i++) assert.equal(t.sc.reveal(win.id, i), false);
  assert.equal(t.sc.reveal(win.id, win.revealed.length - 1), true, "komplett offen");
  const before = t.s.balance;
  assert.equal(t.sc.resolve(win.id), win.prize);
  assert.equal(t.sc.resolve(win.id), null, "Doppelklick");
  assert.equal(t.s.balance, before + win.prize);
  assert.equal(t.sc.history()[0].prize, win.prize);
  const st = t.s.stats;
  assert.equal(t.s.balance, 10000 - st.wagered + st.won + (st.bonus || 0), "Bilanz");
  assert.equal(st.perGame.scratch.rounds, 1);
});

test("Niete: ablegen zahlt nichts, zählt als Runde", () => {
  const base = seeded(9);
  let first = true;
  const t = setup({ rnd: () => (first ? ((first = false), 0.99) : base()) });
  const lose = t.sc.buy("vault").ticket;
  assert.equal(lose.prize, 0);
  t.sc.revealAll(lose.id);
  const before = t.s.balance;
  assert.equal(t.sc.resolve(lose.id), 0);
  assert.equal(t.s.balance, before);
  assert.equal(t.s.stats.perGame.scratch.rounds, 1);
});

test("Neuladen: gleiches Los, gleiches Bild, gleicher Fortschritt – nichts wird neu gewürfelt", () => {
  const t = setup();
  const r = t.sc.buy("lucky");
  t.sc.reveal(r.ticket.id, 0);
  t.sc.reveal(r.ticket.id, 3);
  for (let i = 0; i < 3; i++) {
    const reloaded = sanitizeState(JSON.parse(JSON.stringify(t.s)));
    const d = S.sanitizeData(reloaded.games.scratch);
    assert.deepEqual(d.tickets[0].layout, r.ticket.layout);
    assert.equal(d.tickets[0].prize, r.ticket.prize);
    assert.deepEqual(d.tickets[0].revealed, r.ticket.revealed);
  }
});

test("Bereinigung: Gewinn kommt aus dem Bild, manipulierte/kaputte Lose fliegen raus", () => {
  const good = S.createTicket("neon7", { id: "a", rnd: seeded(4) });
  const fakePrize = { ...good, prize: 10000 };
  const broken = { ...S.createTicket("vault", { id: "b", rnd: seeded(4) }), layout: { cells: [{ s: S.DIAMOND, amount: 50000 }, { s: S.DIAMOND, amount: 50000 }] } };
  const twoTriples = { id: "c", type: "neon7", layout: { cells: [20, 20, 20, 40, 40, 40] } };
  const badMulti = { id: "d", type: "turbo", layout: { cells: [100, 50, 100, 250, 100, 500], multi: 7 } };
  const goodMulti = { id: "e", type: "turbo", prize: 1, layout: { cells: [100, 50, 100, 250, 100, 500], multi: 3 } };
  const badExtra = { id: "f", type: "luckyx", layout: { win: [1, 2], own: [3, 4, 5, 6, 7, 8].map((n) => ({ n, amount: 100 })), extra: { draw: 11, mine: 1 } } };
  const d = S.sanitizeData({ tickets: [fakePrize, broken, twoTriples, badMulti, goodMulti, badExtra, { type: "x" }, null], history: [{ type: "lucky", prize: 100, at: 1 }, { type: "?" }], seq: 5 });
  assert.equal(d.tickets.length, 2);
  assert.equal(d.tickets[1].prize, 300, "Multi-Gewinn aus dem Bild berechnet");
  assert.equal(d.tickets[1].revealed.length, 7, "Multi-Feld zählt als Rubbelfeld");
  assert.equal(d.tickets[0].prize, S.evaluateLayout("neon7", good.layout), "gespeicherter Betrag zählt nicht");
  assert.equal(d.history.length, 1);
  assert.equal(d.seq, 5);
  const many = S.sanitizeData({ tickets: Array.from({ length: 30 }, (_, i) => S.createTicket("neon7", { id: `t${i}`, rnd: seeded(i + 1) })) });
  assert.equal(many.tickets.length, S.MAX_ON_TABLE);
});
