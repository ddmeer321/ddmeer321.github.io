// Tagesbonus und Gratis-Nachschub. Beides ist reines Spielgeld; der Nachschub
// sorgt dafür, dass niemand „pleite“ festsitzt.

export const REFILL_THRESHOLD = 10;
export const REFILL_AMOUNT = 500;

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

export function refillAvailable(state) {
  return state.balance < REFILL_THRESHOLD;
}
