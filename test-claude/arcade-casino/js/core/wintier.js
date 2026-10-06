// Gemeinsame Gewinnstufen für den ganzen Neonpalast.
//
// Die Stufe richtet sich nach dem Verhältnis Auszahlung : Einsatz – +100 bei
// Einsatz 10 ist wichtiger als +100 bei Einsatz 10.000. Teil-Rückzahlungen
// (z. B. Plinko ×0,2) sind ehrlich ein VERLUST und werden nie als Gewinn
// inszeniert.

export const TIERS = ["loss", "push", "small", "good", "big", "mega", "jackpot"];

export const TIER_LABEL = {
  loss: "Verlust",
  push: "Einsatz zurück",
  small: "Gewinn",
  good: "Guter Gewinn",
  big: "Großer Gewinn",
  mega: "Mega-Gewinn",
  jackpot: "Jackpot",
};

/** Schwellen als Vielfaches des Einsatzes (Rückzahlung inkl. Einsatz). */
export const THRESHOLDS = { good: 2, big: 5, mega: 20, jackpot: 100 };

/**
 * @param {{stake:number, payout:number, jackpot?:boolean}} o
 * @returns {"loss"|"push"|"small"|"good"|"big"|"mega"|"jackpot"}
 */
export function classifyWin({ stake, payout, jackpot = false }) {
  const s = Number(stake) > 0 ? Number(stake) : 0;
  const p = Number.isFinite(Number(payout)) ? Math.max(0, Number(payout)) : 0;
  if (jackpot && p > s) return "jackpot";
  if (s === 0) return p > 0 ? "small" : "loss";
  if (p < s) return "loss";
  if (p === s) return "push";
  const r = p / s;
  if (r >= THRESHOLDS.jackpot) return "jackpot";
  if (r >= THRESHOLDS.mega) return "mega";
  if (r >= THRESHOLDS.big) return "big";
  if (r >= THRESHOLDS.good) return "good";
  return "small";
}

export function tierRank(tier) {
  return Math.max(0, TIERS.indexOf(tier));
}
