import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, migrateState, SAVE_VERSION, defaultState } from "../js/core/state.js";
import { createEconomy } from "../js/core/economy.js";
import { classifyWin, TIERS } from "../js/core/wintier.js";
import { playStatus, startPause, startExclusion, defaultControl, sanitizeControl, createSessionTracker, IDLE_RESET_MS } from "../js/core/control.js";
import { challengesForDay, createChallenges, CHALLENGE_POOL, CHALLENGE_REWARD } from "../js/core/challenges.js";
import { refillAvailable, refillWait, REFILL_COOLDOWN_MS } from "../js/core/bonus.js";
import { xpForRound, levelReward } from "../js/core/progression.js";
import { LIMITS } from "../js/core/limits.js";

// Ein echter V1.0-Spielstand (verkürzt, Felder wie in V1.0 gespeichert)
const V10_SAVE = {
  v: 1,
  createdAt: 1790000000000,
  balance: 104523,
  xp: 5321,
  lastDaily: 1790000000000,
  lastRefill: 0,
  refills: 2,
  settings: { master: 0.5, sfx: 0.7, ambience: 0.2, vibration: false, audioHaptics: true, motion: "reduced", theme: "sunset" },
  stats: { rounds: 812, wagered: 50210, won: 153733, biggestWin: 2480, perGame: { cyclone: { rounds: 500, wagered: 10000, won: 120000, biggestWin: 2500 }, "slots-fruit": { rounds: 20, wagered: 500, won: 430, biggestWin: 120 } } },
  bests: { hoops: 212, stacker: 12, "cyclone-streak": 9 },
  achievements: { "first-win": 1790000000100, "cyclone-jackpot": 1790000000200 },
  counters: { "played-cyclone": 3, "pusher-coins": 77 },
  games: { cyclone: { bet: 100 }, coinpusher: { world: { t: 1.2, c: [[1.5, 60.2, 1, 0], [-10, 70, 1, 1]] }, dropX: 4 }, "slots-cosmo": { bet: 20, free: { n: 2, bet: 20, total: 40 } } },
};

test("Migration V1.0 → V1.1 erhält Guthaben, XP, Erfolge, Einstellungen, Statistik, Bestwerte, Coin-Pusher-Feld", () => {
  const s = sanitizeState(JSON.parse(JSON.stringify(V10_SAVE)));
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.balance, 104523);
  assert.equal(s.xp, 5321);
  assert.deepEqual(Object.keys(s.achievements).sort(), ["cyclone-jackpot", "first-win"]);
  assert.equal(s.settings.theme, "sunset");
  assert.equal(s.settings.motion, "reduced");
  assert.equal(s.settings.vibration, false);
  assert.equal(s.stats.rounds, 812);
  assert.equal(s.stats.perGame.cyclone.won, 120000);
  assert.equal(s.bests.hoops, 212);
  assert.equal(s.counters["pusher-coins"], 77);
  assert.equal(s.games.coinpusher.world.c.length, 2);
  assert.equal(s.games["slots-cosmo"].free.n, 2);
  // Alte Lichtwirbel-Einstellungen (Einzelstopp) werden verworfen
  assert.equal(s.games.cyclone, undefined);
  // Neue Bereiche existieren
  assert.deepEqual(s.control, defaultControl());
  assert.equal(s.challenges.items.length, 0);
});

test("Migration ist idempotent und verträgt kaputte Werte", () => {
  const once = sanitizeState(V10_SAVE);
  const twice = sanitizeState(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
  const broken = sanitizeState({ v: 2, balance: "viel", xp: -5, control: { pauseUntil: "morgen", excludeUntil: NaN, remindMin: 13 }, challenges: { items: [{ id: "gibts-nicht" }, { id: "hoops-5", progress: -2 }] } });
  assert.equal(broken.balance, 1000);
  assert.equal(broken.xp, 0);
  assert.equal(broken.control.pauseUntil, 0);
  assert.equal(broken.control.remindMin, 60);
  assert.equal(broken.challenges.items.length, 1);
  assert.equal(broken.challenges.items[0].progress, 0);
  assert.equal(migrateState(null), null);
});

test("Gewinnstufen: ehrlich relativ zum Einsatz, Teil-Rückzahlung ist Verlust", () => {
  assert.equal(classifyWin({ stake: 10, payout: 0 }), "loss");
  assert.equal(classifyWin({ stake: 10, payout: 2 }), "loss"); // Plinko ×0,2
  assert.equal(classifyWin({ stake: 10, payout: 10 }), "push");
  assert.equal(classifyWin({ stake: 10, payout: 15 }), "small");
  assert.equal(classifyWin({ stake: 10, payout: 20 }), "good");
  assert.equal(classifyWin({ stake: 10, payout: 50 }), "big");
  assert.equal(classifyWin({ stake: 10, payout: 200 }), "mega");
  assert.equal(classifyWin({ stake: 10, payout: 1000 }), "jackpot");
  // +100 bei Einsatz 10 ist mehr wert als +100 bei Einsatz 10.000
  assert.ok(TIERS.indexOf(classifyWin({ stake: 10, payout: 110 })) > TIERS.indexOf(classifyWin({ stake: 10000, payout: 10100 })));
  // Jackpot-Flag nur, wenn es wirklich ein Gewinn ist
  assert.equal(classifyWin({ stake: 20, payout: 0, jackpot: true }), "loss");
  assert.equal(classifyWin({ stake: 20, payout: 500, jackpot: true }), "jackpot");
  assert.equal(classifyWin({ stake: 10, payout: NaN }), "loss");
});

test("Pause und Auszeit blockieren und lassen sich nicht verkürzen", () => {
  const c = defaultControl();
  const now = 1_800_000_000_000;
  assert.equal(playStatus(c, now).ok, true);
  assert.equal(startPause(c, 15, now), true);
  assert.equal(playStatus(c, now + 60000).ok, false);
  assert.equal(playStatus(c, now + 15 * 60000 + 1).ok, true);
  assert.equal(startPause(c, 7, now), false, "nur feste Optionen");
  startExclusion(c, 7, now);
  const until = c.excludeUntil;
  startPause(c, 15, now); // kürzere Pause darf die Auszeit nicht verkürzen
  startExclusion(c, 1, now);
  assert.equal(c.excludeUntil, until);
  assert.equal(playStatus(c, now + 6 * 86400000).kind, "exclusion");
  assert.equal(playStatus(c, now + 7 * 86400000 + 1).ok, true);
  assert.deepEqual(sanitizeControl(c), c);
});

test("Gesperrte Spielkontrolle verhindert Einsätze auch in der Wirtschaft", () => {
  const s = defaultState();
  let blocked = "Spielpause";
  const eco = createEconomy({ getState: () => s, guard: () => blocked });
  assert.equal(eco.placeBet("x", 10), null);
  assert.equal(eco.debit("x", 10), false);
  assert.equal(eco.validateBet(10).reason, "Spielpause");
  blocked = null;
  const t = eco.placeBet("x", 10);
  assert.ok(t);
  blocked = "Pause";
  assert.equal(eco.addStake(t, 10), false);
  // laufende Runde darf trotzdem abgerechnet werden
  assert.ok(eco.settle(t, 20));
  assert.equal(s.balance, 1010);
});

test("Session-Erinnerung: fällig nach eingestellter Zeit, Inaktivität setzt zurück", () => {
  const tr = createSessionTracker();
  const t0 = 1_800_000_000_000;
  for (let m = 0; m <= 61; m++) tr.activity(t0 + m * 60000);
  assert.equal(tr.due(60, t0 + 61 * 60000), true);
  assert.equal(tr.due(60, t0 + 61 * 60000), false, "nicht doppelt");
  assert.equal(tr.due(0, t0 + 61 * 60000), false, "aus");
  tr.activity(t0 + 61 * 60000 + IDLE_RESET_MS + 1);
  assert.ok(tr.minutes(t0 + 61 * 60000 + IDLE_RESET_MS + 2) < 1);
});

test("Tages-Challenges: deterministisch, verschiedene Automaten, Belohnung einmalig", () => {
  const a = challengesForDay("2026-10-6");
  assert.deepEqual(a, challengesForDay("2026-10-6"));
  assert.equal(a.length, 3);
  const games = a.map((id) => CHALLENGE_POOL.find((c) => c.id === id).game);
  assert.equal(new Set(games).size, 3);

  const s = defaultState();
  const events = [];
  const ch = createChallenges({ getState: () => s, save() {}, emit: (t, p) => events.push(t), now: () => new Date(2026, 9, 6).getTime() });
  const list = ch.list();
  for (const item of list) {
    const def = item.def;
    const goal = def.count || 1;
    for (let i = 0; i < goal + 2; i++) ch.report(def.event, sample(def.id, i));
  }
  assert.equal(events.filter((e) => e === "done").length, 3);
  assert.equal(events.filter((e) => e === "all").length, 1);
  assert.ok(CHALLENGE_REWARD.credits * 3 + 75 <= 400, "Challenges fluten die Wirtschaft nicht");
});

function sample(id, i) {
  return {
    "hoops-5": { baskets: 6 }, "hoops-swish": { swishes: 3 }, "bj-20": { result: "win", total: 20 }, "bj-double": { result: "win", doubled: true },
    "pusher-chain": { coins: 3 }, "plinko-5x": { mult: 9 }, "plinko-25": {}, "stacker-6": { row: 7 }, "cyclone-2": { jackpots: 2 },
    "roulette-dozen": { types: ["dozen"] }, "slots-10": {}, "horses-underdog": { won: true, odds: 6 }, "horses-3": {}, "grabber-3": { coins: 3 }, "variety-4": { key: "g" + i },
  }[id];
}

test("Gratis-Nachschub hat eine Wartezeit (kein endloser Freeroll)", () => {
  const s = defaultState();
  s.balance = 3;
  const now = 1_800_000_000_000;
  assert.equal(refillAvailable(s, now), true);
  s.lastRefill = now;
  assert.equal(refillAvailable(s, now + 1000), false);
  assert.ok(refillWait(s, now + 1000) > 0);
  assert.equal(refillAvailable(s, now + REFILL_COOLDOWN_MS), true);
});

test("XP und Level-Bonus sind von der Einsatzhöhe entkoppelt und gedeckelt", () => {
  assert.equal(xpForRound(10), 2);
  assert.equal(xpForRound(1000), 10);
  assert.equal(xpForRound(1e9), 10);
  assert.equal(levelReward(3), 150);
  assert.equal(levelReward(99), 1000);
});

test("Einsatzlimits: jedes Spiel hat Limits, min ≤ max, Stufen innerhalb der Limits", () => {
  for (const [id, l] of Object.entries(LIMITS)) {
    if (l.steps) {
      assert.equal(l.steps[0], l.min, id);
      assert.equal(l.steps[l.steps.length - 1], l.max, id);
      for (let i = 1; i < l.steps.length; i++) assert.ok(l.steps[i] > l.steps[i - 1], id);
    }
    if (l.min !== undefined) assert.ok(l.min <= l.max, id);
  }
});
