// Roulette-Auswertung (rein, testbar). Europäisches Rad, eine Null.
// Bei Null verlieren alle Außenwetten (kein „La Partage“).

import { RED } from "./wheel.js";
import { randInt, random } from "../../core/rng.js";

export const ODDS = { n: 35, dozen: 2, col: 2, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1 };

export const LABELS = {
  red: "Rot",
  black: "Schwarz",
  odd: "Ungerade",
  even: "Gerade",
  low: "1–18",
  high: "19–36",
};

export function betType(key) {
  return key.split(":")[0];
}

export function isValidKey(key) {
  const [t, v] = key.split(":");
  if (!(t in ODDS)) return false;
  if (t === "n") return /^\d{1,2}$/.test(v) && Number(v) <= 36;
  if (t === "dozen" || t === "col") return ["1", "2", "3"].includes(v);
  return v === undefined;
}

export function betWins(key, n) {
  const [t, v] = key.split(":");
  const k = Number(v);
  switch (t) {
    case "n":
      return n === k;
    case "red":
      return n !== 0 && RED.has(n);
    case "black":
      return n !== 0 && !RED.has(n);
    case "odd":
      return n !== 0 && n % 2 === 1;
    case "even":
      return n !== 0 && n % 2 === 0;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen":
      return n !== 0 && Math.ceil(n / 12) === k;
    case "col":
      return n !== 0 && ((n - 1) % 3) + 1 === k;
    default:
      return false;
  }
}

/** Gesamtrückzahlung (inkl. Einsätze der gewinnenden Wetten). */
export function payoutFor(bets, n) {
  let total = 0;
  const winners = [];
  for (const [key, amount] of Object.entries(bets)) {
    if (!isValidKey(key) || !Number.isSafeInteger(amount) || amount <= 0) continue;
    if (betWins(key, n)) {
      const pay = amount * (ODDS[betType(key)] + 1);
      total += pay;
      winners.push({ key, amount, pay });
    }
  }
  return { total, winners };
}

export function totalBet(bets) {
  return Object.values(bets).reduce((s, v) => s + v, 0);
}

export function spinNumber(rnd = random) {
  return randInt(37, rnd);
}
