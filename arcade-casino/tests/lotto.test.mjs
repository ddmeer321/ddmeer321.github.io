// V1.2: Neon Lotto (Regeln, Mathematik, Termine, Kauf, Ziehung, Einfordern) und Posteingang.
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

test("Lotto-Mathematik: Wahrscheinlichkeiten summieren sich zu 1, Werte wie berechnet", () => {
  for (const id of L.DRAW_TYPES) {
    const pool = L.DRAWS[id].pool;
    let sum = 0;
    for (let k = 0; k <= 4; k++) sum += L.pMatches(pool, k);
    assert.ok(Math.abs(sum - 1) < 1e-12, id);
  }
  assert.equal(L.choose(20, 4), 4845);
  assert.equal(L.choose(24, 4), 10626);
  assert.ok(Math.abs(L.pMatches(20, 4) - 1 / 4845) < 1e-15);
  assert.ok(Math.abs(L.pMatches(20, 3) - 64 / 4845) < 1e-15);
  assert.ok(Math.abs(L.pMatches(20, 2) - 720 / 4845) < 1e-15);
  assert.ok(Math.abs(L.pMatches(24, 3) - 80 / 10626) < 1e-15);
});

test("Lotto-RTP: beide Ziehungen sind ein Coin-Sink (50–65 %), Gewinnklassen steigen", () => {
  for (const id of L.DRAW_TYPES) {
    const r = L.rtpOf(id);
    assert.ok(r > 0.5 && r < 0.65, `${id}: ${r}`);
    const p = L.DRAWS[id].prizes;
    assert.ok(p[4] > p[3] && p[3] > p[2] && p[2] > L.DRAWS[id].price, id);
  }
  assert.ok(L.DRAWS.grand.prizes[4] > L.DRAWS.daily.prizes[4] * 5, "großes Lotto hat einen deutlich größeren Höchstgewinn");
  assert.ok(L.DRAWS.grand.price > L.DRAWS.daily.price);
});

test("Lotto-Monte-Carlo bestätigt die exakte Rechnung", () => {
  const rnd = seeded(42);
  for (const id of L.DRAW_TYPES) {
    let paid = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const drawn = L.drawNumbers(L.DRAWS[id].pool, rnd);
      paid += L.evaluate(id, drawn, [{ id: "t", nums: [1, 2, 3, 4] }]).payout;
    }
    const rtp = paid / n / L.DRAWS[id].price;
    assert.ok(Math.abs(rtp - L.rtpOf(id)) < 0.05, `${id}: MC ${rtp} vs. ${L.rtpOf(id)}`);
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

test("Schein: genau 4 verschiedene gültige Zahlen, Preis genau einmal abgebucht", () => {
  const { s, lotto } = setup();
  for (const bad of [[1, 2, 3], [1, 2, 3, 3], [0, 1, 2, 3], [1, 2, 3, 21], [1.5, 2, 3, 4], ["1", 2, 3, 4], null]) {
    assert.equal(lotto.buy("daily", bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(s.balance, 10000, "nichts abgebucht");
  const r = lotto.buy("daily", [19, 4, 12, 7]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ticket.nums, [4, 7, 12, 19]);
  assert.equal(s.balance, 10000 - 50);
  assert.equal(s.stats.wagered, 50);
  assert.equal(lotto.buy("daily", [4, 7, 12, 19]).ok, false, "identischer Schein abgelehnt");
  assert.equal(s.balance, 10000 - 50);
  assert.equal(lotto.buy("grand", [21, 22, 23, 24]).ok, true, "4 aus 24 im großen Lotto");
});

test("Schein: höchstens 20 pro Ziehung, nicht während Pause/Auszeit, nicht ohne Guthaben", () => {
  const { s, lotto } = setup();
  let n = 0;
  for (let a = 1; a <= 20 && n < 25; a++) for (let b = a + 1; b <= 20 && n < 25; b++) {
    lotto.buy("daily", [a, b, 19, 20].filter((x, i, arr) => arr.indexOf(x) === i).length === 4 ? [a, b, 19, 20] : [a, b, 17, 18]);
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
  t.lotto.buy("grand", [1, 2, 3, 4]);
  const g = L.nextDraw("grand", t.clock.now);
  t.clock.now = g.at + 60_000;
  const fresh = t.lotto.realizeDue();
  assert.ok(fresh.length >= 2);
  assert.ok(fresh.some((d) => d.type === "grand") && fresh.some((d) => d.type === "daily"));
  for (const d of fresh) assert.ok(d.nums.every((n) => n >= 1 && n <= L.DRAWS[d.type].pool));
});

function forcedDraw(nums, ticketNums) {
  // Ziehung mit bekanntem Ergebnis über einen (bereinigten) Spielstand – wie nach dem Neuladen
  const s = defaultState();
  s.balance = 1000;
  s.lotto = { tickets: {}, draws: { "daily-2026-10-05": { nums, tickets: ticketNums.map((n, i) => ({ id: `t${i}`, nums: n })), payout: 999999 } } };
  const clean = sanitizeState(JSON.parse(JSON.stringify(s)));
  const economy = createEconomy({ getState: () => clean });
  const inbox = createInbox({ getState: () => clean, save: () => {} });
  inbox.add({ id: "lotto:daily-2026-10-05", type: "lotto", title: "Neon Lotto – Ziehung vom 05.10.", action: { label: "Ziehung ansehen", kind: "lotto:show" }, payload: { drawId: "daily-2026-10-05" } });
  let writes = 0;
  const lotto = L.createLotto({ getState: () => clean, economy, saveNow: () => writes++, inbox });
  return { s: clean, lotto, inbox, writes: () => writes };
}

test("Auswertung: Gewinnklassen je Schein, manipulierte Auszahlung zählt nicht", () => {
  const t = forcedDraw([4, 12, 17, 19], [[4, 12, 17, 19], [4, 12, 17, 2], [4, 12, 1, 2], [4, 1, 2, 3], [1, 2, 3, 5]]);
  const d = t.lotto.draw("daily-2026-10-05");
  assert.deepEqual(d.results.map((r) => r.k), [4, 3, 2, 1, 0]);
  assert.deepEqual(d.results.map((r) => r.prize), [10000, 1000, 100, 0, 0]);
  assert.equal(d.payout, 11100, "neu berechnet statt gespeichertem Wert");
  assert.equal(d.stake, 250);
});

test("Einfordern: genau einmal – Doppelklick, zweites Öffnen, Neuladen vor/nach dem Einfordern", () => {
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
      "daily-2026-10-06": Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, nums: [1, 2, 3, 4 + (i % 16)] })),
      "bogus": [{ nums: [1, 2, 3, 4] }],
      "grand-2026-10-07": [{ nums: [1, 1, 2, 3] }],
    },
    draws: { "daily-2026-10-01": { nums: [1, 2, 3, 99], tickets: [] }, "daily-2026-10-02": { nums: [1, 2, 3, 4], tickets: [{ nums: [1, 2, 3, 4] }], claimed: true } },
  };
  const clean = L.sanitizeLotto(raw);
  assert.equal(clean.tickets["daily-2026-10-06"].length, 20);
  assert.equal(clean.tickets.bogus, undefined);
  assert.equal(clean.tickets["grand-2026-10-07"], undefined);
  assert.equal(clean.draws["daily-2026-10-01"], undefined, "ungültiges Ergebnis verworfen");
  assert.equal(clean.draws["daily-2026-10-02"].payout, 10000);
  assert.equal(clean.draws["daily-2026-10-02"].claimed, true);
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

test("Effekt von 1–20 Scheinen: Chance auf mindestens 3 Richtige wächst, Erwartungswert bleibt negativ", () => {
  for (const id of L.DRAW_TYPES) {
    const p3plus = L.pMatches(L.DRAWS[id].pool, 3) + L.pMatches(L.DRAWS[id].pool, 4);
    const one = p3plus;
    const twenty = 1 - Math.pow(1 - p3plus, 20); // verschiedene Scheine sind nicht unabhängig – gute Näherung
    assert.ok(twenty > one * 10);
    assert.ok(L.rtpOf(id) < 1);
  }
});
