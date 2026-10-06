// Misst die Fachverteilung der Plinko-Physik (Monte-Carlo, fester Seed).
import * as P from "../js/games/plinko/physics.js";
import { seeded } from "../js/core/rng.js";
const n = +process.argv[2] || 400000;
const rnd = seeded(20261006);
const c = new Array(P.SLOTS).fill(0);
for (let i = 0; i < n; i++) c[P.simulateDrop(rnd(), rnd()).slot]++;
const p = c.map((x) => x / n);
const sym = p.map((x, i) => (x + p[P.SLOTS - 1 - i]) / 2);
console.log(JSON.stringify(sym.map((x) => +x.toFixed(6))));
