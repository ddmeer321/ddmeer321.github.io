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

test("Gewinnpläne: Coin-Sink mit 65–72 % RTP, Gewinne steigen mit der Seltenheit, Deckel eingehalten", () => {
  for (const id of S.TYPE_IDS) {
    const t = S.TYPES[id];
    const r = S.rtpOf(id);
    assert.ok(r > 0.65 && r < 0.72, `${id}: RTP ${r}`);
    const pw = S.pAnyWin(id);
    assert.ok(pw > 0.2 && pw < 0.35, `${id}: Gewinnchance ${pw}`);
    for (let i = 1; i < t.prizes.length; i++) {
      assert.ok(t.prizes[i - 1][0] > t.prizes[i][0], `${id}: Beträge absteigend`);
      assert.ok(t.prizes[i - 1][1] < t.prizes[i][1], `${id}: höherer Gewinn ist seltener`);
    }
    assert.ok(t.prizes.every(([a]) => a >= t.price), `${id}: kleinster Gewinn = Einsatz zurück`);
    assert.ok(S.topPrize(id) <= MAX_SINGLE_WIN, `${id}: Höchstgewinn über MAX_SINGLE_WIN`);
  }
  assert.ok(Math.abs(S.rtpOf("neon7") - 0.68) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("lucky") - 0.69) < 1e-12);
  assert.ok(Math.abs(S.rtpOf("vault") - 0.69) < 1e-12);
});

test("Monte-Carlo: gezogene Gewinne entsprechen dem Gewinnplan", () => {
  const rnd = seeded(7);
  const n = 400000;
  for (const id of S.TYPE_IDS) {
    const hist = new Map();
    let paid = 0;
    for (let i = 0; i < n; i++) {
      const p = S.drawPrize(id, rnd);
      paid += p;
      hist.set(p, (hist.get(p) || 0) + 1);
    }
    for (const [amount, p] of S.TYPES[id].prizes) {
      const exp = p * n;
      if (exp < 100) continue;
      assert.ok(Math.abs((hist.get(amount) || 0) - exp) < 5 * Math.sqrt(exp), `${id} ${amount}: ${hist.get(amount)} vs ${exp}`);
    }
    // ohne die seltensten Klassen (Varianz) muss die Rückzahlung passen
    const capped = S.TYPES[id].prizes.filter(([, p]) => p * n >= 100);
    const expCapped = capped.reduce((s, [a, p]) => s + a * p, 0) / S.TYPES[id].price;
    const gotCapped = capped.reduce((s, [a]) => s + a * (hist.get(a) || 0), 0) / n / S.TYPES[id].price;
    assert.ok(Math.abs(gotCapped - expCapped) < 0.02, `${id}: ${gotCapped} vs ${expCapped}`);
  }
});

test("Losbilder: zeigen genau den gezogenen Gewinn, Nieten zeigen nie einen Gewinn", () => {
  const rnd = seeded(11);
  for (const id of S.TYPE_IDS) {
    for (const prize of [0, ...S.TYPES[id].prizes.map(([a]) => a)]) {
      for (let k = 0; k < 300; k++) {
        const layout = S.makeLayout(id, prize, rnd);
        assert.ok(S.validLayout(id, layout), `${id}: ungültiges Bild`);
        assert.equal(S.evaluateLayout(id, layout), prize, `${id}: Bild zeigt nicht ${prize}`);
      }
    }
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
  const d = S.sanitizeData({ tickets: [fakePrize, broken, twoTriples, { type: "x" }, null], history: [{ type: "lucky", prize: 100, at: 1 }, { type: "?" }], seq: 5 });
  assert.equal(d.tickets.length, 1);
  assert.equal(d.tickets[0].prize, S.evaluateLayout("neon7", good.layout), "gespeicherter Betrag zählt nicht");
  assert.equal(d.history.length, 1);
  assert.equal(d.seq, 5);
  const many = S.sanitizeData({ tickets: Array.from({ length: 30 }, (_, i) => S.createTicket("neon7", { id: `t${i}`, rnd: seeded(i + 1) })) });
  assert.equal(many.tickets.length, S.MAX_ON_TABLE);
});
