import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../js/core/rng.js";
import * as P from "../js/games/plinko/physics.js";
import { RISKS, MEASURED_P, rtpOf, payoutFor } from "../js/games/plinko/tables.js";
import { LIMITS } from "../js/core/limits.js";

test("Plinko-Physik: gleicher Einwurf ⇒ identischer Weg und gleiches Fach", () => {
  for (const [u1, u2] of [[0.1, 0.9], [0.5, 0.5], [0.77, 0.03]]) {
    const a = P.simulateDrop(u1, u2, { path: true });
    const b = P.simulateDrop(u1, u2, { path: true });
    assert.equal(a.slot, b.slot);
    assert.deepEqual(a.path, b.path);
  }
});

test("Plinko-Physik: Kugeln prallen sichtbar an Pins ab und kommen unten an", () => {
  const rnd = seeded(4);
  for (let i = 0; i < 400; i++) {
    const r = P.simulateDrop(rnd(), rnd(), { path: true });
    assert.ok(r.slot >= 0 && r.slot < P.SLOTS);
    assert.ok(r.time < 12, `Fallzeit ${r.time}`);
    assert.ok(r.hits >= 6, `nur ${r.hits} Pin-Kontakte`);
    // Der Pfad bleibt innerhalb des Bretts und endet über dem Fach
    for (const [x, y] of r.path) assert.ok(Math.abs(x) < P.SLOTS / 2 + 0.5 && y < P.FLOOR_Y + 0.5);
    assert.equal(P.slotOf(r.path[r.path.length - 1][0]), r.slot);
  }
});

test("Plinko-Physik: Fach ergibt sich aus der Bewegung (kleine Startänderung ⇒ anderer Weg möglich)", () => {
  const slots = new Set();
  for (let k = 0; k < 60; k++) slots.add(P.simulateDrop(k / 60, 0.5).slot);
  assert.ok(slots.size >= 5, "Startposition beeinflusst das Fach");
});

test("Plinko-Verteilung: frische Simulation passt zu den hinterlegten Wahrscheinlichkeiten", () => {
  const n = 20000;
  const dist = P.slotDistribution(n, seeded(99));
  for (let i = 0; i < P.SLOTS; i++) {
    const se = Math.sqrt((MEASURED_P[i] * (1 - MEASURED_P[i])) / n);
    assert.ok(Math.abs(dist[i] - MEASURED_P[i]) < 5 * se + 0.002, `Fach ${i}: ${dist[i]} vs ${MEASURED_P[i]}`);
  }
  const sum = MEASURED_P.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-4);
});

test("Plinko-RTP je Risikostufe im Zielbereich", () => {
  const low = rtpOf(RISKS.low.mult);
  const mid = rtpOf(RISKS.mid.mult);
  const high = rtpOf(RISKS.high.mult);
  for (const [name, r] of [["Niedrig", low], ["Mittel", mid], ["Hoch", high]]) assert.ok(r > 0.94 && r < 0.96, `${name} ${r}`);
  // V1.2: Risiko = Varianz, nicht schlechtere Quote – Spanne höchstens 1 Prozentpunkt
  assert.ok(Math.max(low, mid, high) - Math.min(low, mid, high) < 0.01);
  // Hoch hat die größten, seltensten Multiplikatoren
  assert.ok(Math.max(...RISKS.high.mult) > Math.max(...RISKS.mid.mult));
  assert.ok(Math.max(...RISKS.mid.mult) > Math.max(...RISKS.low.mult));
  for (const r of Object.values(RISKS)) {
    assert.equal(r.mult.length, P.SLOTS);
    assert.deepEqual(r.mult, r.mult.slice().reverse(), "symmetrisch");
  }
});

test("Plinko-Auszahlungen sind ganzzahlig für alle Einsatzstufen", () => {
  for (const bet of LIMITS.plinko.steps) {
    for (const r of Object.values(RISKS)) {
      for (const m of r.mult) {
        const exact = bet * m;
        assert.ok(Math.abs(exact - Math.round(exact)) < 1e-9, `${bet}×${m}`);
        assert.equal(payoutFor(bet, m), Math.round(exact));
      }
    }
  }
  assert.ok(LIMITS.plinko.max * Math.max(...RISKS.high.mult) <= 60000, "Max-Gewinn begrenzt");
});

test("Plinko-RTP per Monte-Carlo mit Auszahlungen (Niedrig, ohne Jackpot-Rauschen)", () => {
  const rnd = seeded(7);
  let paid = 0;
  const n = 15000;
  for (let i = 0; i < n; i++) paid += payoutFor(10, RISKS.low.mult[P.simulateDrop(rnd(), rnd()).slot]);
  const rtp = paid / (n * 10);
  assert.ok(rtp > 0.92 && rtp < 1.0, `RTP ${rtp}`);
});
