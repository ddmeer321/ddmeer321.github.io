import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded } from "../js/core/rng.js";
import * as G from "../js/games/grabber/physics.js";
import { simulate } from "../sim/grabber.mjs";

test("Münzgreifer: Haufen liegt ruhig im Kasten, keine Münze außerhalb", () => {
  const w = G.createWorld(seeded(2));
  assert.equal(w.coins.length, G.PILE_TARGET);
  for (const c of w.coins) {
    assert.ok(c.x >= G.WALL_X + c.r - 1e-6 && c.x <= G.BOX_W - c.r + 1e-6);
    assert.ok(c.y >= c.r - 1e-6 && c.y < G.BOX_H);
  }
  // kaum Überlappung nach dem Setzen
  let worst = 0;
  for (let i = 0; i < w.coins.length; i++)
    for (let j = i + 1; j < w.coins.length; j++) {
      const a = w.coins[i];
      const b = w.coins[j];
      worst = Math.max(worst, a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y));
    }
  assert.ok(worst < 0.15, `Überlappung ${worst}`);
});

test("Münzgreifer: gleicher Haufen + gleiche Position ⇒ gleicher Griff (keine Zufallsgreifkraft)", () => {
  const a = G.createWorld(seeded(5));
  const b = G.createWorld(seeded(5));
  for (const x of [7, 10.3, 15.5, 21]) {
    const pa = G.planGrab(a, x);
    const pb = G.planGrab(b, x);
    assert.deepEqual(pa.items.map((i) => [i.coin.type, i.fate, i.hold]), pb.items.map((i) => [i.coin.type, i.fate, i.hold]));
  }
});

test("Münzgreifer: zentrale Münzen halten, Randmünzen fallen, Kapazität begrenzt", () => {
  const w = { coins: [], rnd: seeded(1) };
  // eine Münze genau unter der Kralle, eine am Rand des Greifbereichs
  w.coins.push(G.makeCoin("gold", 12, 1), G.makeCoin("bronze", 12 + G.GRIP_HALF * 0.92, 1));
  const p = G.planGrab(w, 12);
  const gold = p.items.find((i) => i.coin.type === "gold");
  const edge = p.items.find((i) => i.coin.type === "bronze");
  assert.equal(gold.fate, "deliver");
  assert.notEqual(edge.fate, "deliver");
  assert.ok(gold.hold > edge.hold);

  const crowd = { coins: [], rnd: seeded(1) };
  for (let i = 0; i < 9; i++) crowd.coins.push(G.makeCoin("bronze", 12 + (i % 3 - 1) * 0.6, 1 + Math.floor(i / 3) * 0.6));
  const pc = G.planGrab(crowd, 12);
  assert.ok(pc.items.filter((i) => i.fate === "deliver").length <= G.CAPACITY);
});

test("Münzgreifer: Kralle setzt auf dem Haufen auf, nicht darin", () => {
  const w = G.createWorld(seeded(8));
  for (let x = G.CLAW_MIN_X; x <= G.CLAW_MAX_X; x += 1) {
    const y = G.contactY(w, x);
    const below = w.coins.filter((c) => Math.abs(c.x - x) < G.GRIP_HALF * 0.5);
    for (const c of below) assert.ok(y >= c.y, "Kralle nie unterhalb einer Münze direkt darunter");
  }
});

test("Münzgreifer: Nachfüllen ersetzt nur Entnommenes, Speichern/Laden", () => {
  const w = G.createWorld(seeded(3));
  const r = G.resolveGrab(w, 12);
  assert.equal(w.coins.length, G.PILE_TARGET);
  assert.ok(r.delivered >= 0);
  const back = G.deserialize(JSON.parse(JSON.stringify(G.serialize(w))), seeded(1));
  assert.equal(back.coins.length, w.coins.length);
  assert.equal(G.deserialize([[1, 2]], seeded(1)), null);
});

test("Münzgreifer-Economy: selbst perfektes Zielen bleibt unter 100 % (1 Einheit = Einsatz/5)", () => {
  const rtp = (s) => simulate(s, 250, 4).units / 5;
  const random = rtp("random");
  const optimal = rtp("optimal");
  assert.ok(random < 0.65, `wahllos ${random}`);
  assert.ok(optimal < 1.0, `optimal ${optimal}`);
  assert.ok(optimal > random, "Zielen lohnt sich");
});
