// Tagesbonus und Gratis-Nachschub. Beides ist reines Spielgeld; der Nachschub
// sorgt dafür, dass niemand „pleite“ festsitzt.

export const REFILL_THRESHOLD = 10;
export const REFILL_AMOUNT = 300;
// V1.1: Wartezeit verhindert endloses „Freeroll“ (alles auf eine Zahl, bei
// Verlust sofort neu auffüllen). Siehe docs/ECONOMY.md.
export const REFILL_COOLDOWN_MS = 20 * 60 * 1000;

export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dailyAmount(level) {
  return Math.min(1000, 250 + 25 * (Math.max(1, level) - 1));
}

export function dailyAvailable(state, now = Date.now()) {
  return !state.lastDaily || dayKey(state.lastDaily) !== dayKey(now);
}

export function refillNeeded(state) {
  return state.balance < REFILL_THRESHOLD;
}

/** Restwartezeit in ms (0 = sofort möglich). */
export function refillWait(state, now = Date.now()) {
  if (!state.lastRefill) return 0;
  return Math.max(0, state.lastRefill + REFILL_COOLDOWN_MS - now);
}

export function refillAvailable(state, now = Date.now()) {
  return refillNeeded(state) && refillWait(state, now) === 0;
}
