// V1.2/V1.2.1: Neon Lotto (Regeln, Mathematik, Termine, Kauf, Ziehung, Einfordern) und Posteingang.
import test from "node:test";
import assert from "node:assert/strict";

import * as L from "../js/core/lotto.js";
import { createInbox, sanitizeInbox } from "../js/core/inbox.js";
import { createEconomy } from "../js/core/economy.js";
import { defaultState, sanitizeState } from "../js/core/state.js";
import { seeded } from "../js/core/rng.js";

function setup({ balance = 10000, now = new Date(2026, 9, 6, 12, 0).getTime(), guard = () => null, rnd = seeded(1) } = {}) {
  const s = defaultState();
  s.balance = balance;
  const clock = { now };
  const economy = createEconomy({ getState: () => s, guard });
  const inbox = createInbox({ getState: () => s, save: () => {} });
  let writes = 0;
  const lotto = L.createLotto({ getState: () => s, economy, saveNow: () => writes++, inbox, now: () => clock.now, rnd });
  return { s, economy, inbox, lotto, clock, writes: () => writes };
}

const G = () => L.rulesFor("grand");
const D = () => L.rulesFor("daily");

test("Neue Regeln V1.2.1: täglich 4 aus 40, groß 6 aus 49 + Neonzahl 0–9", () => {
  assert.equal(L.RULES_VERSION, 2);
  assert.deepEqual([D().pick, D().pool, D().neon], [4, 40, 0]);
  assert.deepEqual([G().pick, G().pool, G().neon], [6, 49, 10]);
  assert.equal(L.rulesLabel(D()), "4 aus 40");
  assert.equal(L.rulesLabel(G()), "6 aus 49 + Neonzahl");
  // Regelwerk 1 (V1.2) bleibt für alte Daten erhalten
  assert.deepEqual([L.rulesFor("daily", 1).pool, L.rulesFor("grand", 1).pool, L.rulesFor("grand", 1).pick], [20, 24, 4]);
});

test("Lotto-Mathematik täglich: exakte Kombinatorik 4 aus 40", () => {
  assert.equal(L.choose(40, 4), 91390);
  assert.equal(L.combinations(D()), 91390);
  let sum = 0;
  for (let k = 0; k <= 4; k++) sum += L.pMatches(40, k, 4);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  const p = Object.fromEntries(D().classes.map((c) => [c.id, L.pClass(D(), c)]));
  assert.ok(Math.abs(p["4"] - 1 / 91390) < 1e-18, "Hauptgewinn 1 : 91.390 (V1.2: 1 : 4.845)");
  assert.ok(Math.abs(p["3"] - 144 / 91390) < 1e-15);
  assert.ok(Math.abs(p["2"] - 3780 / 91390) < 1e-15);
  assert.ok(1 / p["4"] > 4845 * 15, "Hauptgewinn deutlich seltener als in V1.2");
  assert.ok(1 / L.pAnyWin(D()) < 30, "kleine Treffer bleiben erreichbar (etwa jeder 23. Schein)");
});

test("Lotto-Mathematik groß: 6 aus 49 + Neonzahl, Hauptgewinn 1 : 139.838.160", () => {
  assert.equal(L.choose(49, 6), 13983816);
  assert.equal(L.combinations(G()), 139838160);
  let sum = 0;
  for (let k = 0; k <= 6; k++) sum += L.pMatches(49, k, 6);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  // exakte Anzahl günstiger Fälle je Klasse (von 139.838.160)
  const counts = { "6+N": 1, 6: 9, "5+N": 258, 5: 2322, "4+N": 13545, 4: 121905, "3+N": 246820, 3: 2221380, "2+N": 1851150 };
  assert.deepEqual(G().classes.map((c) => c.id).sort(), Object.keys(counts).sort());
  for (const c of G().classes) {
    const exact = counts[c.id] / 139838160;
    assert.ok(Math.abs(L.pClass(G(), c) - exact) / exact < 1e-12, `${c.id}: ${L.pClass(G(), c)} vs ${exact}`);
  }
  assert.equal(Math.round(1 / L.pClass(G(), G().classes[0])), 139838160);
  assert.equal(L.classFor(G(), 6, true).id, "6+N");
  assert.equal(L.classFor(G(), 6, false).id, "6");
  assert.equal(L.classFor(G(), 2, false), null, "2 Richtige ohne Neonzahl gewinnen nicht");
  assert.equal(L.classFor(G(), 1, true), null);
  const anyWin = Object.values(counts).reduce((a, b) => a + b, 0) / 139838160;
  assert.ok(Math.abs(L.pAnyWin(G()) - anyWin) < 1e-15);
});

test("Lotto-RTP: exakt aus dem Gewinnplan, beide Ziehungen bleiben ein Coin-Sink", () => {
  const daily = (1 * 150000 + 144 * 7500 + 3780 * 350) / 91390 / 50;
  assert.ok(Math.abs(L.rtpOf("daily") - daily) < 1e-12);
  const grandSum = G().classes.reduce((s, c) => s + Math.round(L.pClass(G(), c) * 139838160) * c.prize, 0);
  assert.ok(Math.abs(L.rtpOf("grand") - grandSum / 139838160 / 100) < 1e-12);
  for (const id of L.DRAW_TYPES) {
    const r = L.rtpOf(id);
    assert.ok(r > 0.45 && r < 0.6, `${id}: ${r}`);
    const def = L.DRAWS[id];
    // seltenere Klasse ⇒ höherer Gewinn; jede Klasse zahlt mehr als den Schein
    const byRarity = def.classes.slice().sort((a, b) => L.pClass(def, a) - L.pClass(def, b));
    for (let i = 1; i < byRarity.length; i++) assert.ok(byRarity[i - 1].prize >= byRarity[i].prize, `${id}: ${byRarity[i - 1].id}`);
    // Anzeige-Reihenfolge (nach Richtigen) zahlt ebenfalls nie aufsteigend
    for (let i = 1; i < def.classes.length; i++) assert.ok(def.classes[i - 1].prize >= def.classes[i].prize);
    for (const c of def.classes) assert.ok(c.prize > def.price, `${id} ${c.id}`);
  }
  assert.ok(L.topPrize(G()) >= L.topPrize(D()) * 50, "großes Lotto: spektakulärer Höchstgewinn");
  // V1.2-Regelwerke rechnen weiter wie damals
  assert.ok(Math.abs(L.rtpOf(L.rulesFor("daily", 1)) - 0.6027) < 0.001);
  assert.ok(Math.abs(L.rtpOf(L.rulesFor("grand", 1)) - 0.575) < 0.001);
});

test("Lotto-Monte-Carlo bestätigt die exakte Rechnung (Klassenhäufigkeiten)", () => {
  const rnd = seeded(42);
  const n = 300000;
  for (const id of L.DRAW_TYPES) {
    const rules = L.rulesFor(id);
    const ticket = rules.neon ? { id: "t", nums: [1, 2, 3, 4, 5, 6], neon: 0 } : { id: "t", nums: [1, 2, 3, 4] };
    const hits = {};
    const neonSeen = new Array(10).fill(0);
    for (let i = 0; i < n; i++) {
      const dr = L.drawFor(rules, rnd);
      assert.equal(new Set(dr.nums).size, rules.pick);
      if (rules.neon) neonSeen[dr.neon]++;
      const r = L.evaluate(rules, dr.nums, [ticket], dr.neon).results[0];
      if (r.cls) hits[r.cls] = (hits[r.cls] || 0) + 1;
    }
    for (const c of rules.classes) {
      const exp = L.pClass(rules, c) * n;
      if (exp < 100) continue; // zu selten für eine Stichprobe dieser Größe
      const sd = Math.sqrt(exp);
      assert.ok(Math.abs((hits[c.id] || 0) - exp) < 5 * sd, `${id} ${c.id}: ${hits[c.id]} vs ${exp.toFixed(0)}`);
    }
    if (rules.neon) for (const x of neonSeen) assert.ok(Math.abs(x - n / 10) < 5 * Math.sqrt(n / 10), "Neonzahl gleichverteilt");
  }
});

test("Ziehungstermine: stabile ids, täglich 20 Uhr, groß alle 3 Tage 21 Uhr, Annahmeschluss", () => {
  const noon = new Date(2026, 9, 6, 12, 0).getTime();
  const d = L.nextDraw("daily", noon);
  assert.equal(d.id, "daily-2026-10-06");
  assert.equal(new Date(d.at).getHours(), 20);
  const late = new Date(2026, 9, 6, 19, 59, 30).getTime();
  assert.equal(L.nextDraw("daily", late).id, "daily-2026-10-07", "nach Annahmeschluss: nächster Tag");
  const g = L.nextDraw("grand", noon);
  assert.ok(L.isDrawDay("grand", g.y, g.m, g.d));
  assert.equal(new Date(g.at).getHours(), 21);
  // Großes Lotto genau alle 3 Tage
  const g2 = L.nextDraw("grand", g.at + 1000);
  assert.equal(Math.round((Date.UTC(g2.y, g2.m, g2.d) - Date.UTC(g.y, g.m, g.d)) / 86400000), 3);
  assert.deepEqual(L.parseDrawId("daily-2026-10-06"), { id: "daily-2026-10-06", type: "daily", y: 2026, m: 9, d: 6, at: new Date(2026, 9, 6, 20, 0).getTime() });
  assert.equal(L.parseDrawId("daily-2026-13-01"), null, "ungültiges Datum");
  assert.equal(L.parseDrawId("grand-2026-02-30"), null);
  assert.equal(L.parseDrawId("evil-2026-10-06"), null);
});

test("Schein täglich: genau 4 verschiedene Zahlen 1–40, Preis genau einmal abgebucht", () => {
  const { s, lotto } = setup();
  for (const bad of [[1, 2, 3], [1, 2, 3, 3], [0, 1, 2, 3], [1, 2, 3, 41], [1.5, 2, 3, 4], ["1", 2, 3, 4], [1, 2, 3, 4, 5], null]) {
    assert.equal(lotto.buy("daily", bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(s.balance, 10000, "nichts abgebucht");
  const r = lotto.buy("daily", [39, 4, 12, 7]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ticket.nums, [4, 7, 12, 39]);
  assert.equal(r.ticket.r, 2);
  assert.equal(r.ticket.neon, undefined);
  assert.equal(s.balance, 10000 - 50);
  assert.equal(s.stats.wagered, 50);
  assert.equal(lotto.buy("daily", [4, 7, 12, 39]).ok, false, "identischer Schein abgelehnt");
  assert.equal(s.balance, 10000 - 50);
});

test("Schein groß: genau 6 verschiedene Zahlen 1–49 plus Neonzahl 0–9", () => {
  const { s, lotto } = setup();
  const six = [49, 1, 7, 23, 31, 12];
  for (const [nums, neon] of [
    [[1, 2, 3, 4, 5], 3],
    [[1, 2, 3, 4, 5, 6, 7], 3],
    [[1, 2, 3, 4, 5, 5], 3],
    [[0, 2, 3, 4, 5, 6], 3],
    [[1, 2, 3, 4, 5, 50], 3],
    [six, undefined],
    [six, 10],
    [six, -1],
    [six, 1.5],
    [six, "3"],
    [[1, 2, 3, 4], 3],
  ]) {
    assert.equal(lotto.buy("grand", nums, neon).ok, false, JSON.stringify([nums, neon]));
  }
  assert.equal(s.balance, 10000);
  const r = lotto.buy("grand", six, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ticket.nums, [1, 7, 12, 23, 31, 49]);
  assert.equal(r.ticket.neon, 0);
  assert.equal(s.balance, 10000 - 100);
  assert.equal(lotto.buy("grand", six, 0).ok, false, "identischer Schein abgelehnt");
  assert.equal(lotto.buy("grand", six, 9).ok, true, "gleiche Zahlen, andere Neonzahl = anderer Schein");
  assert.equal(s.balance, 10000 - 200);
  const q = L.quickPick("grand", seeded(3));
  assert.ok(L.validTicket(G(), q.nums, q.neon), "Zufallszahlen sind gültig");
  assert.equal(L.quickPick("daily", seeded(3)).neon, null);
});

test("Schein: höchstens 20 pro Ziehung, nicht während Pause/Auszeit, nicht ohne Guthaben", () => {
  const { s, lotto } = setup();
  let n = 0;
  for (let a = 1; a <= 30 && n < 25; a++) {
    lotto.buy("daily", [a, 38, 39, 40]);
    n++;
  }
  const id = L.nextDraw("daily", new Date(2026, 9, 6, 12).getTime()).id;
  assert.equal(lotto.ticketsFor(id).length, 20);
  assert.equal(s.balance, 10000 - 20 * 50);
  const blocked = setup({ guard: () => "Spielpause" });
  assert.equal(blocked.lotto.buy("daily", [1, 2, 3, 4]).ok, false);
  assert.equal(blocked.s.balance, 10000);
  const poor = setup({ balance: 49 });
  assert.equal(poor.lotto.buy("daily", [1, 2, 3, 4]).ok, false);
  assert.equal(poor.s.balance, 49);
});

test("Ziehung: erst zum Termin, genau ein Ergebnis pro id – Neuladen würfelt nicht neu", () => {
  const t = setup();
  t.lotto.buy("daily", [1, 2, 3, 4]);
  t.lotto.buy("daily", [5, 6, 7, 8]);
  assert.deepEqual(t.lotto.realizeDue(), [], "vor dem Termin passiert nichts");
  t.clock.now = new Date(2026, 9, 6, 20, 0, 1).getTime();
  const [d] = t.lotto.realizeDue();
  assert.equal(d.id, "daily-2026-10-06");
  assert.equal(d.nums.length, 4);
  assert.equal(new Set(d.nums).size, 4);
  assert.ok(d.nums.every((x) => x >= 1 && x <= 40));
  assert.equal(d.r, 2);
  assert.equal(d.neon, null);
  assert.equal(d.tickets.length, 2);
  assert.equal(d.stake, 100);
  assert.equal(d.live, true);
  assert.deepEqual(t.lotto.realizeDue(), [], "kein zweites Auslosen");
  // „Neuladen“: bereinigter Stand, neuer Manager mit anderem Zufall
  const reloaded = sanitizeState(JSON.parse(JSON.stringify(t.s)));
  assert.deepEqual(reloaded.lotto.draws[d.id].nums, d.nums);
  const economy = createEconomy({ getState: () => reloaded });
  const l2 = L.createLotto({ getState: () => reloaded, economy, saveNow: () => {}, now: () => t.clock.now + 5000, rnd: seeded(999) });
  assert.deepEqual(l2.realizeDue(), []);
  assert.deepEqual(l2.draw(d.id).nums, d.nums);
});

test("Verpasste Ziehung: später geöffnet → ausgewertet, Posteingang ohne Spoiler, keine Duplikate", () => {
  const t = setup();
  t.lotto.buy("daily", [1, 2, 3, 4]);
  t.clock.now = new Date(2026, 9, 8, 9, 0).getTime(); // zwei Tage später
  const fresh = t.lotto.realizeDue();
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].live, false);
  const msgs = t.inbox.list();
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].title, /Ziehung vom 06\.10\./);
  assert.doesNotMatch(msgs[0].title + msgs[0].body, /gewonnen|verloren|kein Gewinn|Credits/i, "kein Spoiler");
  assert.equal(msgs[0].action.kind, "lotto:show");
  assert.equal(t.inbox.add({ id: msgs[0].id, title: "x" }), false, "gleiche id wird nicht doppelt angelegt");
  assert.equal(t.inbox.unreadCount(), 1);
});

test("Mehrere Ziehungen und Scheine: täglich + groß getrennt ausgewertet", () => {
  const t = setup();
  t.lotto.buy("daily", [1, 2, 3, 4]);
  t.lotto.buy("grand", [1, 2, 3, 4, 5, 6], 7);
  const g = L.nextDraw("grand", t.clock.now);
  t.clock.now = g.at + 60_000;
  const fresh = t.lotto.realizeDue();
  assert.ok(fresh.length >= 2);
  assert.ok(fresh.some((d) => d.type === "grand") && fresh.some((d) => d.type === "daily"));
  for (const d of fresh) assert.ok(d.nums.every((n) => n >= 1 && n <= L.DRAWS[d.type].pool));
  const gd = fresh.find((d) => d.type === "grand");
  assert.equal(gd.nums.length, 6);
  assert.equal(new Set(gd.nums).size, 6);
  assert.ok(Number.isInteger(gd.neon) && gd.neon >= 0 && gd.neon <= 9, "Neonzahl separat gezogen");
  assert.equal(gd.tickets[0].neon, 7);
});

test("Großes Lotto: Ergebnis inkl. Neonzahl einmal erzeugt, Neuladen würfelt nicht neu", () => {
  const t = setup({ rnd: seeded(77) });
  t.lotto.buy("grand", [5, 10, 15, 20, 25, 30], 4);
  const g = L.nextDraw("grand", t.clock.now);
  t.clock.now = g.at + 1000;
  const [d] = t.lotto.realizeDue();
  const snap = JSON.stringify({ nums: d.nums, neon: d.neon, payout: d.payout });
  for (let i = 0; i < 3; i++) {
    const reloaded = sanitizeState(JSON.parse(JSON.stringify(t.s)));
    const l2 = L.createLotto({ getState: () => reloaded, economy: createEconomy({ getState: () => reloaded }), saveNow: () => {}, now: () => t.clock.now + i * 60_000, rnd: seeded(1000 + i) });
    assert.deepEqual(l2.realizeDue(), []);
    const again = l2.draw(d.id);
    assert.equal(JSON.stringify({ nums: again.nums, neon: again.neon, payout: again.payout }), snap);
  }
});

/**
 * Ziehung mit bekanntem Ergebnis über einen (bereinigten) Spielstand – wie nach dem Neuladen.
 * Ohne `r` sind das exakt die Daten eines V1.2-Spielstands (Regelwerk 1: 4 aus 20).
 */
function forcedDraw(nums, ticketNums, { id = "daily-2026-10-05", r, neon, ticketNeon = [] } = {}) {
  const s = defaultState();
  s.balance = 1000;
  const dr = { nums, tickets: ticketNums.map((n, i) => ({ id: `t${i}`, nums: n, ...(ticketNeon[i] !== undefined ? { neon: ticketNeon[i] } : {}) })), payout: 999999 };
  if (r !== undefined) dr.r = r;
  if (neon !== undefined) dr.neon = neon;
  s.lotto = { tickets: {}, draws: { [id]: dr } };
  const clean = sanitizeState(JSON.parse(JSON.stringify(s)));
  const economy = createEconomy({ getState: () => clean });
  const inbox = createInbox({ getState: () => clean, save: () => {} });
  inbox.add({ id: `lotto:${id}`, type: "lotto", title: "Neon Lotto – Ziehung vom 05.10.", action: { label: "Ziehung ansehen", kind: "lotto:show" }, payload: { drawId: id } });
  let writes = 0;
  const lotto = L.createLotto({ getState: () => clean, economy, saveNow: () => writes++, inbox });
  return { s: clean, lotto, inbox, writes: () => writes };
}

test("Auswertung täglich (neue Regeln): Gewinnklassen je Schein, manipulierte Auszahlung zählt nicht", () => {
  const t = forcedDraw([4, 12, 37, 19], [[4, 12, 37, 19], [4, 12, 37, 2], [4, 12, 1, 2], [4, 1, 2, 3], [1, 2, 3, 5]], { r: 2 });
  const d = t.lotto.draw("daily-2026-10-05");
  assert.equal(d.r, 2);
  assert.deepEqual(d.results.map((r) => r.k), [4, 3, 2, 1, 0]);
  assert.deepEqual(d.results.map((r) => r.prize), [150000, 7500, 350, 0, 0]);
  assert.equal(d.payout, 157850, "neu berechnet statt gespeichertem Wert");
  assert.equal(d.stake, 250);
});

test("Auswertung groß: jede Gewinnklasse mit/ohne Neonzahl exakt", () => {
  const nums = [3, 11, 19, 27, 35, 43];
  const tickets = [
    [[3, 11, 19, 27, 35, 43], 7, "6+N", 10_000_000],
    [[3, 11, 19, 27, 35, 43], 8, "6", 1_000_000],
    [[3, 11, 19, 27, 35, 1], 7, "5+N", 300_000],
    [[3, 11, 19, 27, 35, 1], 0, "5", 75_000],
    [[3, 11, 19, 27, 1, 2], 7, "4+N", 20_000],
    [[3, 11, 19, 27, 1, 2], 1, "4", 5_000],
    [[3, 11, 19, 1, 2, 4], 7, "3+N", 4_000],
    [[3, 11, 19, 1, 2, 4], 2, "3", 1_250],
    [[3, 11, 1, 2, 4, 5], 7, "2+N", 1_250],
    [[3, 11, 1, 2, 4, 5], 9, null, 0],
    [[3, 1, 2, 4, 5, 6], 7, null, 0],
    [[1, 2, 4, 5, 6, 8], 7, null, 0],
  ];
  const t = forcedDraw(nums, tickets.map((x) => x[0]), { id: "grand-2026-10-04", r: 2, neon: 7, ticketNeon: tickets.map((x) => x[1]) });
  const d = t.lotto.draw("grand-2026-10-04");
  assert.equal(d.neon, 7);
  assert.deepEqual(d.results.map((r) => r.cls), tickets.map((x) => x[2]));
  assert.deepEqual(d.results.map((r) => r.prize), tickets.map((x) => x[3]));
  assert.deepEqual(d.results.map((r) => r.neonHit), tickets.map((x) => x[1] === 7));
  assert.equal(d.payout, tickets.reduce((s, x) => s + x[3], 0));
  assert.equal(d.stake, 1200);
});

test("V1.2-Ziehung (ohne Regelwerk-Kennung) wird nach ihren alten Regeln ausgewertet – nichts wird neu gewürfelt", () => {
  const t = forcedDraw([4, 12, 17, 19], [[4, 12, 17, 19], [4, 12, 17, 2], [4, 12, 1, 2], [4, 1, 2, 3], [1, 2, 3, 5]]);
  const d = t.lotto.draw("daily-2026-10-05");
  assert.equal(d.r, 1);
  assert.deepEqual(d.nums, [4, 12, 17, 19], "gespeicherte Zahlen unverändert");
  assert.deepEqual(d.results.map((r) => r.k), [4, 3, 2, 1, 0]);
  assert.deepEqual(d.results.map((r) => r.prize), [10000, 1000, 100, 0, 0], "alter Gewinnplan");
  assert.equal(d.payout, 11100);
  assert.equal(d.stake, 250);
  const g = forcedDraw([1, 2, 3, 4], [[1, 2, 3, 24], [10, 11, 12, 13]], { id: "grand-2026-10-04" });
  assert.equal(g.lotto.draw("grand-2026-10-04").payout, 4000, "altes großes Lotto 4 aus 24");
  assert.equal(g.lotto.draw("grand-2026-10-04").neon, null);
});

test("Einfordern (V1.2-Gewinn nach dem Update): genau einmal – Doppelklick, zweites Öffnen, Neuladen vor/nach dem Einfordern", () => {
  const t = forcedDraw([4, 12, 17, 19], [[4, 12, 17, 2]]);
  const id = "daily-2026-10-05";
  // Neuladen VOR dem Einfordern: Gewinn wartet weiter
  const before = sanitizeState(JSON.parse(JSON.stringify(t.s)));
  assert.equal(before.lotto.draws[id].claimed, false);
  assert.equal(t.lotto.unclaimed().length, 1);
  assert.equal(t.lotto.claim(id), 1000);
  assert.equal(t.lotto.claim(id), 0, "Doppelklick");
  assert.equal(t.s.balance, 2000);
  assert.equal(t.s.stats.won, 1000);
  assert.ok(t.writes() >= 1, "sofort gespeichert");
  // Neuladen NACH dem Einfordern
  const after = sanitizeState(JSON.parse(JSON.stringify(t.s)));
  assert.equal(after.lotto.draws[id].claimed, true);
  const economy = createEconomy({ getState: () => after });
  const l2 = L.createLotto({ getState: () => after, economy, saveNow: () => {} });
  assert.equal(l2.claim(id), 0);
  assert.equal(after.balance, 2000);
  assert.equal(t.inbox.get(`lotto:${id}`).read, true);
});

test("Verlust: nichts einzufordern, gilt nach dem Ansehen als erledigt", () => {
  const t = forcedDraw([4, 12, 17, 19], [[1, 2, 3, 5]]);
  const id = "daily-2026-10-05";
  assert.equal(t.lotto.claim(id), 0);
  assert.equal(t.s.balance, 1000);
  t.lotto.markSeen(id);
  const d = t.lotto.draw(id);
  assert.equal(d.seen, true);
  assert.equal(t.lotto.unclaimed().length, 0);
  assert.equal(t.inbox.get(`lotto:${id}`).read, true);
});

test("Live gesehen und behandelt → keine überflüssige Posteingang-Nachricht", () => {
  const t = forcedDraw([4, 12, 17, 19], [[1, 2, 3, 5]]);
  t.lotto.markSeen("daily-2026-10-05", { live: true });
  assert.equal(t.inbox.has("lotto:daily-2026-10-05"), false);
});

test("Lotto-Bereinigung: kaputte Tickets/Ziehungen fliegen raus, höchstens 20 Scheine", () => {
  const raw = {
    tickets: {
      "daily-2026-10-06": Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, nums: [1, 2, 3, 4 + (i % 30)], r: 2 })),
      "bogus": [{ nums: [1, 2, 3, 4] }],
      "grand-2026-10-07": [{ nums: [1, 1, 2, 3] }],
      "grand-2026-10-10": [{ nums: [1, 2, 3, 4, 5, 6], neon: 3, r: 2 }, { nums: [1, 2, 3, 4, 5, 6], neon: 12, r: 2 }, { nums: [1, 2, 3, 4, 5, 6], r: 2 }],
    },
    draws: {
      "daily-2026-10-01": { nums: [1, 2, 3, 99], tickets: [] },
      "daily-2026-10-02": { nums: [1, 2, 3, 4], tickets: [{ nums: [1, 2, 3, 4] }], claimed: true },
      "grand-2026-10-04": { r: 2, nums: [1, 2, 3, 4, 5, 6], tickets: [] }, // Neonzahl fehlt
      "grand-2026-09-28": { r: 2, nums: [1, 2, 3, 4, 5, 6], neon: 5, tickets: [{ nums: [1, 2, 3, 4, 5, 6], neon: 5 }] },
    },
  };
  const clean = L.sanitizeLotto(raw);
  assert.equal(clean.tickets["daily-2026-10-06"].length, 20);
  assert.ok(clean.tickets["daily-2026-10-06"].every((t) => t.r === 2 && t.price === 50));
  assert.equal(clean.tickets.bogus, undefined);
  assert.equal(clean.tickets["grand-2026-10-07"], undefined);
  assert.equal(clean.tickets["grand-2026-10-10"].length, 1, "ungültige Neonzahl / fehlende Neonzahl verworfen");
  assert.equal(clean.tickets["grand-2026-10-10"][0].neon, 3);
  assert.equal(clean.draws["daily-2026-10-01"], undefined, "ungültiges Ergebnis verworfen");
  assert.equal(clean.draws["daily-2026-10-02"].payout, 10000, "V1.2-Ziehung: alter Gewinnplan");
  assert.equal(clean.draws["daily-2026-10-02"].claimed, true);
  assert.equal(clean.draws["grand-2026-10-04"], undefined, "neue Ziehung ohne Neonzahl verworfen");
  assert.equal(clean.draws["grand-2026-09-28"].payout, 10_000_000);
});

test("Migration V1.2 → V1.2.1: offene alte Scheine werden genau einmal vollständig erstattet", () => {
  const s = defaultState();
  s.balance = 500;
  s.stats.wagered = 400;
  s.stats.perGame = { lotto: { rounds: 0, wagered: 400, won: 0, biggestWin: 0 } };
  // V1.2: ein offener Tagesschein (4 aus 20), zwei große Scheine (4 aus 24), einer davon für einen vergangenen Termin
  s.lotto = {
    seq: 3,
    tickets: {
      "daily-2026-10-06": [{ id: "t1", nums: [1, 2, 3, 4], at: 1, price: 50 }],
      "grand-2026-10-07": [{ id: "t2", nums: [21, 22, 23, 24], at: 2, price: 100 }],
      "grand-2026-10-04": [{ id: "t3", nums: [1, 2, 3, 4], at: 3, price: 100 }],
    },
    draws: { "daily-2026-10-05": { nums: [4, 12, 17, 19], tickets: [{ id: "t0", nums: [4, 12, 17, 2] }], claimed: false, seen: false } },
  };
  s.inbox = { items: [{ id: "lotto:daily-2026-10-05", type: "lotto", ts: 1, title: "Neon Lotto – Ziehung vom 05.10.", read: false, payload: { drawId: "daily-2026-10-05" }, action: { label: "Ziehung ansehen", kind: "lotto:show" } }] };
  const clean = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(clean.lotto.tickets["daily-2026-10-06"][0].r, 1, "alte Scheine bleiben bis zur Erstattung erhalten");
  const economy = createEconomy({ getState: () => clean });
  const inbox = createInbox({ getState: () => clean, save: () => {} });
  const lotto = L.createLotto({ getState: () => clean, economy, saveNow: () => {}, inbox, now: () => new Date(2026, 9, 6, 12).getTime(), rnd: seeded(5) });
  const fresh = lotto.realizeDue();
  assert.deepEqual(fresh, [], "alte Scheine werden nicht nach neuen Quoten gezogen");
  assert.equal(clean.balance, 750, "50 + 100 + 100 erstattet");
  assert.equal(clean.stats.wagered, 150, "Erstattung ist kein Gewinn, sondern ein zurückgenommener Einsatz");
  assert.equal(clean.stats.perGame.lotto.won, 0);
  assert.deepEqual(clean.lotto.tickets, {});
  assert.ok(inbox.has("lotto:refund-v2"));
  assert.match(inbox.get("lotto:refund-v2").body, /250 Credits/);
  // bereits ausgeloste V1.2-Ziehung bleibt unverändert und einforderbar
  const d = lotto.draw("daily-2026-10-05");
  assert.deepEqual(d.nums, [4, 12, 17, 19]);
  assert.equal(d.payout, 1000);
  assert.ok(inbox.has("lotto:daily-2026-10-05"));
  // kein zweites Erstatten (auch nicht nach Neuladen)
  assert.equal(lotto.refundLegacy(), 0);
  const again = sanitizeState(JSON.parse(JSON.stringify(clean)));
  const l2 = L.createLotto({ getState: () => again, economy: createEconomy({ getState: () => again }), saveNow: () => {}, now: () => new Date(2026, 9, 6, 13).getTime() });
  assert.equal(l2.refundLegacy(), 0);
  assert.equal(again.balance, 750);
  assert.equal(l2.claim("daily-2026-10-05"), 1000);
  assert.equal(l2.claim("daily-2026-10-05"), 0);
  assert.equal(again.balance, 1750);
  // Bilanz: Start − Einsätze + Auszahlungen + Boni − Ausgaben bleibt stimmig
  const st = again.stats;
  assert.equal(1000 - st.wagered + st.won + (st.bonus || 0) - (st.spent || 0) + (500 - 1000 + 400), again.balance);
});

test("Posteingang: ungelesen/gelesen, Nutzdaten, Aktion, Persistenz, Bereinigung", () => {
  const s = defaultState();
  const box = createInbox({ getState: () => s, save: () => {} });
  assert.equal(box.add({ id: "a", type: "info", title: "Hallo", payload: { x: 1 } }), true);
  assert.equal(box.add({ id: "b", type: "lotto", title: "Ziehung", action: { label: "Ansehen", kind: "lotto:show" }, payload: { drawId: "d" } }), true);
  assert.equal(box.unreadCount(), 2);
  box.markRead("a");
  assert.equal(box.unreadCount(), 1);
  const again = sanitizeState(JSON.parse(JSON.stringify(s)));
  const b = again.inbox.items.find((m) => m.id === "b");
  assert.equal(b.payload.drawId, "d");
  assert.equal(b.action.kind, "lotto:show");
  assert.equal(again.inbox.items.find((m) => m.id === "a").read, true);
  const dirty = sanitizeInbox({ items: [{ id: "x" }, { id: "x" }, { title: "ohne id" }, null, { id: "y", payload: [1, 2], read: "ja" }] });
  assert.deepEqual(dirty.items.map((m) => m.id).sort(), ["x", "y"]);
  assert.deepEqual(dirty.items.find((m) => m.id === "y").payload, {});
  assert.equal(dirty.items.find((m) => m.id === "y").read, false);
  assert.equal(box.remove("a"), true);
  assert.equal(box.has("a"), false);
});

test("Effekt von 1–20 Scheinen: Gewinnchance wächst, Erwartungswert bleibt negativ", () => {
  for (const id of L.DRAW_TYPES) {
    const one = L.pAnyWin(L.DRAWS[id]);
    const twenty = 1 - Math.pow(1 - one, 20); // verschiedene Scheine sind nicht unabhängig – gute Näherung
    assert.ok(twenty > one * 10);
    assert.ok(L.rtpOf(id) < 1);
  }
});
