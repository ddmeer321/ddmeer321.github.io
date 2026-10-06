import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../js/core/rng.js";
import * as P from "../js/games/coinpusher/physics.js";
import { simulate } from "../sim/coinpusher.mjs";

test("Münzkaskade 2.0: Kettenreaktionen – ein Schub wirft regelmäßig mehrere Münzen", () => {
  const r = simulate({ strat: "center", drops: 500, seed: 4 });
  const multi = Object.entries(r.chains).filter(([k]) => Number(k) >= 3).reduce((s, [, v]) => s + v, 0);
  assert.ok(multi > 20, `Zyklen mit ≥3 Münzen: ${multi}`);
});

test("Münzkaskade 2.0: geschobene Münzen gleiten nach (Trägheit) und kommen zur Ruhe", () => {
  const w = P.createWorld(seeded(1));
  const c = P.makeCoin(0, 60, 1);
  c.vy = 40;
  w.coins.push(c);
  w.py = 10;
  const y0 = c.y;
  for (let i = 0; i < 12; i++) P.step(w, 1 / 120);
  assert.ok(c.y > y0 + 1, "gleitet");
  for (let i = 0; i < 400; i++) P.step(w, 1 / 120);
  assert.ok(Math.abs(c.vy) < 0.5, "Reibung bremst");
});

test("Münzkaskade 2.0: Stapel bilden sich im Gedränge und fallen mit ihrer Unterlage", () => {
  const r = simulate({ strat: "center", drops: 400, seed: 6 });
  assert.ok(r.climbs > 0 && r.maxStack > 0, "es entstehen Stapel");
  // Stapelmünze ohne Unterlage fällt herunter
  const w = P.createWorld(seeded(2));
  const top = P.makeCoin(0, 70, 2);
  w.coins.push(top);
  const ev = P.step(w, 1 / 120);
  assert.equal(top.layer, 1);
  assert.ok(ev.some((e) => e.kind === "topple"));
});

test("Münzkaskade 2.0: Kipp-Zustand an der Kante, Fallen erst ab Mittelpunkt", () => {
  const c = P.makeCoin(0, P.LEN - 1, 1);
  assert.ok(P.teeter(c) > 0.5);
  assert.equal(P.teeter(P.makeCoin(0, 60, 1)), 0);
  const w = P.createWorld(seeded(3));
  w.coins.push(c);
  const ev = P.step(w, 1 / 120);
  assert.ok(!ev.some((e) => e.kind === "win"), "steht über, fällt aber noch nicht");
  c.y = P.LEN + 0.01;
  assert.ok(P.step(w, 1 / 120).some((e) => e.kind === "win"));
});

test("Münzkaskade 2.0: Rückgabe je Einwurfstrategie unter 100 %", () => {
  const center = simulate({ strat: "center", drops: 1500, seed: 11 }).ratio;
  const side = simulate({ strat: "side", drops: 1500, seed: 11 }).ratio;
  assert.ok(center < 1.02, `mittig ${center}`);
  assert.ok(side < center, "Rand ist schlechter (Rinnen)");
});

test("Münzkaskade 2.0: V1.0-Spielstände laden weiter (Format [x, y, Ebene, Typ])", () => {
  const old = { t: 1.2, c: [[1.5, 60.2, 1, 0], [-10, 70, 1, 1], [5, 10, 0, 2]] };
  const w = P.deserialize(old, seeded(1));
  assert.equal(w.coins.length, 3);
  assert.deepEqual(w.coins.map((c) => c.type), ["normal", "gold", "star"]);
  const round = P.deserialize(JSON.parse(JSON.stringify(P.serialize(w))), seeded(1));
  assert.equal(round.coins.length, 3);
});
