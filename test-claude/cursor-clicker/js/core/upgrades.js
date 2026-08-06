// Pro-Cursor-Upgrades: jeder Cursor hat ein eigenes Level mit exponentiell
// steigenden Kosten und einem eigenen Multiplikator-Bonus. Level gilt für den
// Cursor-TYP (nicht pro Mutation/Instanz) — Mutationen (siehe fusion.js) legen
// ihren Bonus unabhängig obendrauf, siehe loadout.js für die Kombination.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursor } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";
import { spendCoins, canAfford } from "./wallet.js";

const BASE_COST_BY_RARITY = {
  common: 20,
  uncommon: 45,
  rare: 100,
  epic: 220,
  legendary: 480,
  mythic: 1000,
  secret: 2200,
};

const COST_GROWTH_RATE = 1.6;
const LEVEL_BONUS_PERCENT_PER_LEVEL = 6;

export function getCursorLevel(cursorId) {
  return state.cursorLevels[cursorId] || 0;
}

export function getLevelBonusPercent(cursorId) {
  return getCursorLevel(cursorId) * LEVEL_BONUS_PERCENT_PER_LEVEL;
}

export function getUpgradeCost(cursorId) {
  const cursor = getCursor(cursorId);
  if (!cursor) return Infinity;
  const baseCost = BASE_COST_BY_RARITY[cursor.rarity] ?? BASE_COST_BY_RARITY.common;
  return Math.round(baseCost * Math.pow(COST_GROWTH_RATE, getCursorLevel(cursorId)));
}

export function isOwned(cursorId) {
  return Boolean(state.ownedCursors[cursorId]);
}

export function canUpgrade(cursorId) {
  return isOwned(cursorId) && canAfford(getUpgradeCost(cursorId));
}

export function upgradeCursor(cursorId) {
  if (!isOwned(cursorId)) return false;
  const cost = getUpgradeCost(cursorId);
  if (!spendCoins(cost)) return false;

  state.cursorLevels[cursorId] = getCursorLevel(cursorId) + 1;
  const result = { cursorId, level: state.cursorLevels[cursorId], cost };
  events.emit("cursor:leveledUp", result);
  events.emit("state:changed", state);
  return result;
}

// Reine Anzeige-Hilfe für rarity-abhängige Basiskosten, z.B. für zukünftige
// Balance-Tools oder Tooltips.
export function getBaseUpgradeCost(rarityId) {
  return BASE_COST_BY_RARITY[getRarity(rarityId).id] ?? BASE_COST_BY_RARITY.common;
}
