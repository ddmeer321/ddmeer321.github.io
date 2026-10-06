import { test } from "node:test";
import assert from "node:assert/strict";
import { createEconomy, isValidAmount } from "../js/core/economy.js";
import { sanitizeState, defaultState, START_BALANCE, MAX_BALANCE } from "../js/core/state.js";
import { levelInfo, xpForLevel, createProgression } from "../js/core/progression.js";
import { dailyAvailable, refillAvailable } from "../js/core/bonus.js";

function setup(balance = 1000) {
  const s = defaultState();
  s.balance = balance;
  const events = [];
  const eco = createEconomy({ getState: () => s, emit: (t, p) => events.push([t, p]) });
  return { s, eco, events };
}

test("ungültige Beträge werden abgelehnt", () => {
  const { eco, s } = setup();
  for (const bad of [NaN, -10, 0, 1.5, Infinity, "10", null, undefined, 1e300]) {
    assert.equal(eco.placeBet("x", bad), null, `Betrag ${bad}`);
  }
  assert.equal(s.balance, 1000);
  assert.equal(isValidAmount(10), true);
});

test("Einsatz über Guthaben bzw. Limits wird abgelehnt", () => {
  const { eco, s } = setup(50);
  assert.equal(eco.placeBet("x", 60), null);
  assert.equal(eco.placeBet("x", 20, { min: 30 }), null);
  assert.equal(eco.placeBet("x", 40, { max: 30 }), null);
  assert.equal(s.balance, 50);
});

test("settle zahlt pro Ticket genau einmal aus", () => {
  const { eco, s } = setup();
  const t = eco.placeBet("x", 100);
  assert.equal(s.balance, 900);
  eco.settle(t, 250);
  eco.settle(t, 250);
  assert.equal(s.balance, 1150);
  assert.equal(s.stats.rounds, 1);
  assert.equal(s.stats.wagered, 100);
  assert.equal(s.stats.won, 250);
});

test("settle mit NaN/negativ zahlt nichts", () => {
  const { eco, s } = setup();
  const t = eco.placeBet("x", 100);
  eco.settle(t, NaN);
  assert.equal(s.balance, 900);
  const t2 = eco.placeBet("x", 100);
  eco.settle(t2, -500);
  assert.equal(s.balance, 800);
});

test("addStake (Double/Split) nur mit Guthaben und offenem Ticket", () => {
  const { eco, s } = setup(150);
  const t = eco.placeBet("bj", 100);
  assert.equal(eco.addStake(t, 100), false);
  assert.equal(eco.addStake(t, 50), true);
  assert.equal(t.stake, 150);
  assert.equal(s.balance, 0);
  eco.settle(t, 300);
  assert.equal(eco.addStake(t, 1), false);
});

test("debit/credit für Automaten ohne Runden", () => {
  const { eco, s } = setup(15);
  assert.equal(eco.debit("cp", 10), true);
  assert.equal(eco.debit("cp", 10), false);
  assert.equal(eco.credit("cp", 50), true);
  assert.equal(eco.credit("cp", -5), false);
  assert.equal(s.balance, 55);
});

test("forfeitOpen schließt offene Runden ohne Auszahlung", () => {
  const { eco, s } = setup();
  eco.placeBet("a", 100);
  eco.placeBet("b", 100);
  eco.forfeitOpen("a");
  assert.equal(eco.openTickets().length, 1);
  assert.equal(s.balance, 800);
});

test("Spielstand-Bereinigung macht kaputte Daten gültig", () => {
  assert.equal(sanitizeState(null).balance, START_BALANCE);
  assert.equal(sanitizeState("quatsch").balance, START_BALANCE);
  assert.equal(sanitizeState({ balance: NaN }).balance, START_BALANCE);
  assert.equal(sanitizeState({ balance: -50 }).balance, 0);
  assert.equal(sanitizeState({ balance: 12.7 }).balance, 12);
  assert.equal(sanitizeState({ balance: 1e20 }).balance, MAX_BALANCE);
  const s = sanitizeState({ balance: 10, settings: { master: 7, theme: "hack" }, stats: { perGame: { "../x": {}, ok: { rounds: -3 } } }, bests: { hoops: "9" } });
  assert.equal(s.settings.master, 1);
  assert.equal(s.settings.theme, "neon");
  assert.deepEqual(Object.keys(s.stats.perGame), ["ok"]);
  assert.equal(s.stats.perGame.ok.rounds, 0);
  assert.equal(s.bests.hoops, undefined);
});

test("Level-Kurve ist monoton und konsistent", () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(xpForLevel(1)).level, 2);
  assert.equal(levelInfo(xpForLevel(1) - 1).level, 1);
  let prev = 0;
  for (let l = 1; l < 30; l++) {
    assert.ok(xpForLevel(l) > prev);
    prev = xpForLevel(l);
  }
});

test("Progression: Achievements nur einmal, Bestwerte nur nach oben", () => {
  const s = defaultState();
  const ev = [];
  const p = createProgression({ getState: () => s, save() {}, emit: (t, x) => ev.push(t) });
  assert.equal(p.award("first-win"), true);
  assert.equal(p.award("first-win"), false);
  assert.equal(p.award("gibt-es-nicht"), false);
  assert.equal(p.setBest("hoops", 10), true);
  assert.equal(p.setBest("hoops", 5), false);
  assert.equal(p.best("hoops"), 10);
  p.addXp(10000);
  assert.ok(ev.includes("levelup"));
});

test("Tagesbonus und Nachschub", () => {
  const s = defaultState();
  assert.equal(dailyAvailable(s), true);
  s.lastDaily = Date.now();
  assert.equal(dailyAvailable(s), false);
  s.balance = 5;
  assert.equal(refillAvailable(s), true);
});

test("V1.2.1 Loader: Netzwerk-/Modul-Ladefehler werden von echten Spielfehlern unterschieden", async () => {
  const { isModuleLoadError } = await import("../js/core/loaderror.js");
  const te = (m) => Object.assign(new TypeError(m));
  // Ladefehler der großen Browser
  assert.equal(isModuleLoadError(te("Failed to fetch dynamically imported module: https://x/js/games/slots/slots.js"), true), true);
  assert.equal(isModuleLoadError(te("error loading dynamically imported module: https://x/a.js"), true), true);
  assert.equal(isModuleLoadError(te("Importing a module script failed."), true), true);
  // offline: immer Ladefehler
  assert.equal(isModuleLoadError(new Error("irgendwas"), false), true);
  // echte Defekte bleiben „außer Betrieb“
  assert.equal(isModuleLoadError(new SyntaxError("Unexpected token"), true), false);
  assert.equal(isModuleLoadError(new ReferenceError("foo is not defined"), true), false);
  assert.equal(isModuleLoadError(te("Cannot read properties of undefined (reading 'mount')"), true), false);
  assert.equal(isModuleLoadError(null, true), false);
});
