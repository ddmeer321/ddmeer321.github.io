import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "../js/games/horses/logic.js";
import { analyse } from "../sim/horses.mjs";

test("Pferderennen: gleicher Seed ⇒ identisches Rennen; Rennen dauert 10–20 s", () => {
  const card = H.makeCard(42);
  const a = H.runRace(card, 7, { track: true });
  const b = H.runRace(card, 7, { track: true });
  assert.deepEqual(a.order, b.order);
  assert.deepEqual(a.frames[a.frames.length - 1], b.frames[b.frames.length - 1]);
  assert.ok(a.duration > 10 && a.duration < 20, `Dauer ${a.duration}`);
  assert.equal(new Set(a.order).size, 6);
});

test("Pferderennen: Animation und Ergebnis stimmen überein (wer vorne liegt, ist im Ziel vorn)", () => {
  const card = H.makeCard(9);
  for (let s = 1; s < 40; s++) {
    const r = H.runRace(card, s, { track: true });
    // Im Frame, in dem der Sieger die Linie überquert, hat er die größte Position
    const k = Math.ceil(r.duration / H.DT);
    const f = r.frames[Math.min(k, r.frames.length - 1)];
    assert.ok(f[r.order[0]] >= H.DISTANCE - 1e-9);
    assert.ok(r.finish[r.order[0]] <= r.finish[r.order[1]]);
  }
});

test("Pferderennen: Wahrscheinlichkeiten summieren sich, Quoten passen zu Wahrscheinlichkeiten", () => {
  const card = H.makeCard(123);
  const m = H.buildMarket(card, 3000);
  const sw = m.pWin.reduce((a, b) => a + b, 0);
  const sp = m.pPlace.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sw - 1) < 1e-9);
  assert.ok(Math.abs(sp - 2) < 1e-9);
  m.win.forEach((o, i) => {
    assert.ok(o * m.pWin[i] <= 1 - H.MARGIN + 1e-9 || o === H.MIN_ODDS, `Quote ${o} bei p ${m.pWin[i]}`);
  });
  // stärkeres Pferd ⇒ niedrigere Quote
  const iMax = m.pWin.indexOf(Math.max(...m.pWin));
  assert.equal(Math.min(...m.win), m.win[iMax]);
});

test("Pferderennen: unabhängige Rennen bestätigen die Quoten (Rückzahlung ≈ 92 %, kein Gewinn auf Dauer)", () => {
  const r = analyse(8, 300, 5);
  assert.ok(r.rtpWin > 0.82 && r.rtpWin < 1.0, `Sieg-RTP ${r.rtpWin}`);
  assert.ok(r.rtpPlace > 0.82 && r.rtpPlace < 1.0, `Platz-RTP ${r.rtpPlace}`);
  assert.ok(Math.abs(r.favWinRate - r.avgFavP) < 0.06, "Favoritenquote passt zur Vorhersage");
  assert.ok(r.leadChangesPerRace >= 1, "Führungswechsel finden statt");
  assert.ok(r.upsetRate > 0.05, "Außenseiter gewinnen manchmal");
});

test("Pferderennen: Auszahlung Sieg/Platz", () => {
  const order = [3, 1, 0, 2, 4, 5];
  assert.equal(H.payout("win", 3, 20, 4.5, order), 90);
  assert.equal(H.payout("win", 1, 20, 4.5, order), 0);
  assert.equal(H.payout("place", 1, 20, 1.8, order), 36);
  assert.equal(H.payout("place", 0, 20, 1.8, order), 0);
});
