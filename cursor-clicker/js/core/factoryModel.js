// Pure factory calculations: one shared save, no separate wallet or demo import.
import { employees, potions } from "../data/factory.js";
export const FACTORY_UNLOCK_COINS = 100000;
export const OFFLINE_CAP_MS = 8 * 3600000;
export function createFactoryState() {
  return { unlocked: false, pending: 0, collected: 0, owned: {}, slots: [null, null, null],
    potions: { quick: 0, rush: 0, steady: 0 }, boosts: [null, null, null], lastSeen: null };
}
const finite = v => typeof v === "number" && Number.isFinite(v) && v >= 0;
export function normalizeFactory(raw, now = Date.now()) {
  const f = createFactoryState();
  if (!raw || typeof raw !== "object") return f;
  f.unlocked = raw.unlocked === true;
  for (const key of ["pending", "collected"]) if (finite(raw[key])) f[key] = raw[key];
  for (const e of employees) f.owned[e.id] = Number.isSafeInteger(raw.owned?.[e.id]) && raw.owned[e.id] > 0 ? raw.owned[e.id] : 0;
  const used = {};
  f.slots = [0, 1, 2].map(i => {
    const id = raw.slots?.[i];
    if (employees.some(e => e.id === id) && (used[id] || 0) < f.owned[id]) {
      used[id] = (used[id] || 0) + 1; return id;
    }
    return null;
  });
  for (const p of potions) f.potions[p.id] = Number.isSafeInteger(raw.potions?.[p.id]) && raw.potions[p.id] > 0 ? raw.potions[p.id] : 0;
  f.boosts = f.slots.map((id, i) => {
    const b = raw.boosts?.[i];
    return id && potions.some(p => p.id === b?.id) && finite(b.ends) ? { id: b.id, ends: b.ends } : null;
  });
  if (finite(raw.lastSeen)) f.lastSeen = Math.min(now, raw.lastSeen);
  return f;
}
export function unlockFactory(game, now = Date.now()) {
  game.factory ||= createFactoryState();
  if (game.factory.unlocked || game.coins < FACTORY_UNLOCK_COINS) return false;
  game.factory.unlocked = true;
  game.factory.lastSeen = now;
  return true;
}
export function settleFactory(f, now = Date.now()) {
  if (!f?.unlocked) return 0;
  if (f.lastSeen === null) { f.lastSeen = now; return 0; }
  const start = f.lastSeen, end = Math.min(now, start + OFFLINE_CAP_MS);
  if (end <= start) return 0;
  let gain = 0;
  f.slots.forEach((id, i) => {
    const base = employees.find(e => e.id === id)?.clicks || 0;
    const b = f.boosts[i], p = potions.find(p => p.id === b?.id);
    gain += base * (end - start) / 1000;
    if (p) gain += base * (p.mult - 1) * Math.max(0, Math.min(end, b.ends) - start) / 1000;
  });
  f.pending += gain;
  f.lastSeen = now;
  return gain;
}
export function collectFactoryCoins(game, now = Date.now()) {
  settleFactory(game.factory, now);
  const amount = Math.floor(game.factory.pending);
  if (amount < 1) return 0;
  game.factory.pending -= amount;
  game.factory.collected += amount;
  game.coins += amount;
  game.totalCoinsEarned += amount;
  return amount;
}
