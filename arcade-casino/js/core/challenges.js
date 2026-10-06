// Tägliche Arcade-Challenges. Drei Aufgaben pro Tag, deterministisch aus dem
// Datum gewählt, jeweils für unterschiedliche Automaten – sie sollen zum
// Ausprobieren anregen, nicht die Wirtschaft fluten (max. ~300 Credits/Tag).

import { seeded, shuffle } from "./rng.js";
import { dayKey } from "./bonus.js";

export const CHALLENGE_REWARD = { credits: 75, xp: 30 };
export const ALL_DONE_BONUS = 75;

export const CHALLENGE_POOL = [
  { id: "hoops-5", game: "hoops", icon: "🏀", title: "Triff 5 Körbe in einer Runde Neon Hoops", event: "hoops:round", test: (d) => d.baskets >= 5 },
  { id: "hoops-swish", game: "hoops", icon: "💫", title: "Wirf 2 Swishes in einer Runde Neon Hoops", event: "hoops:round", test: (d) => d.swishes >= 2 },
  { id: "bj-20", game: "blackjack", icon: "🂠", title: "Gewinne eine Blackjack-Hand mit genau 20", event: "blackjack:hand", test: (d) => d.result === "win" && d.total === 20 },
  { id: "bj-double", game: "blackjack", icon: "⏫", title: "Gewinne eine Hand nach Double Down", event: "blackjack:hand", test: (d) => d.result === "win" && d.doubled },
  { id: "pusher-chain", game: "coinpusher", icon: "🪙", title: "Münzkaskade: 3 Münzen mit einem Schub über die Kante", event: "coinpusher:push", test: (d) => d.coins >= 3 },
  { id: "plinko-5x", game: "plinko", icon: "🔻", title: "Plinko: Triff ein Fach mit mindestens ×5", event: "plinko:ball", test: (d) => d.mult >= 5 },
  { id: "plinko-25", game: "plinko", icon: "⚪", title: "Plinko: Lass 25 Kugeln fallen", event: "plinko:ball", count: 25 },
  { id: "stacker-6", game: "stacker", icon: "🧱", title: "Turmbau: Erreiche Reihe 6", event: "stacker:round", test: (d) => d.row >= 6 },
  { id: "cyclone-2", game: "cyclone", icon: "🌀", title: "Lichtwirbel: 2 Jackpot-Treffer in einer Runde", event: "cyclone:round", test: (d) => d.jackpots >= 2 },
  { id: "roulette-dozen", game: "roulette", icon: "🎯", title: "Roulette: Gewinne mit einer Dutzend-Wette", event: "roulette:win", test: (d) => d.types.includes("dozen") },
  { id: "slots-10", game: "slots", icon: "🎰", title: "Spiele 10 Drehungen an den Slots", event: "slots:spin", count: 10 },
  { id: "horses-underdog", game: "horses", icon: "🐎", title: "Pferderennen: Gewinne mit Quote 5,0 oder höher", event: "horses:race", test: (d) => d.won && d.odds >= 5 },
  { id: "horses-3", game: "horses", icon: "🏁", title: "Pferderennen: Schau dir 3 Rennen mit Einsatz an", event: "horses:race", count: 3 },
  { id: "grabber-3", game: "grabber", icon: "🦾", title: "Münzgreifer: Hole mit einem Griff 3 Münzen heraus", event: "grabber:grab", test: (d) => d.coins >= 3 },
  { id: "variety-4", game: "any", icon: "🗺️", title: "Spiele heute 4 verschiedene Automaten", event: "game:open", distinct: true, count: 4 },
];

const byId = new Map(CHALLENGE_POOL.map((c) => [c.id, c]));

/** Die drei Challenges eines Tages (rein, deterministisch). */
export function challengesForDay(key) {
  let seed = 0;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = shuffle(CHALLENGE_POOL.slice(), seeded(seed || 1));
  const out = [];
  const games = new Set();
  for (const c of pool) {
    if (games.has(c.game)) continue;
    games.add(c.game);
    out.push(c.id);
    if (out.length === 3) break;
  }
  return out;
}

export function sanitizeChallenges(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(c.items)
    ? c.items
        .filter((it) => it && byId.has(it.id))
        .slice(0, 3)
        .map((it) => ({
          id: it.id,
          progress: Number.isSafeInteger(it.progress) && it.progress >= 0 ? Math.min(it.progress, 1000) : 0,
          done: it.done === true,
          seen: Array.isArray(it.seen) ? it.seen.filter((s) => typeof s === "string" && s.length < 40).slice(0, 20) : [],
        }))
    : [];
  return { day: typeof c.day === "string" ? c.day.slice(0, 12) : "", items, bonus: c.bonus === true };
}

export function createChallenges({ getState, save, emit, now = () => Date.now() }) {
  function ensureToday() {
    const s = getState();
    const key = dayKey(now());
    if (s.challenges.day !== key || s.challenges.items.length !== 3) {
      s.challenges = { day: key, items: challengesForDay(key).map((id) => ({ id, progress: 0, done: false, seen: [] })), bonus: false };
      save();
    }
    return s.challenges;
  }

  return {
    list() {
      const c = ensureToday();
      return c.items.map((it) => ({ ...it, def: byId.get(it.id), goal: byId.get(it.id).count || 1 }));
    },
    /** Spiele melden Ereignisse; passende Challenges zählen hoch. */
    report(event, data = {}) {
      const c = ensureToday();
      let changed = false;
      for (const it of c.items) {
        if (it.done) continue;
        const def = byId.get(it.id);
        if (def.event !== event) continue;
        if (def.test && !def.test(data)) continue;
        if (def.distinct) {
          const key = String(data.key ?? "");
          if (!key || it.seen.includes(key)) continue;
          it.seen.push(key);
        }
        it.progress++;
        changed = true;
        if (it.progress >= (def.count || 1)) {
          it.done = true;
          emit("done", { def, reward: CHALLENGE_REWARD });
        }
      }
      if (changed && !c.bonus && c.items.every((it) => it.done)) {
        c.bonus = true;
        emit("all", { bonus: ALL_DONE_BONUS });
      }
      if (changed) save();
    },
  };
}
