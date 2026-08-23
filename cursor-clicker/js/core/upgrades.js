// Pro-Cursor-Upgrades. Level gilt für den Cursor-TYP (nicht pro Mutation/
// Instanz) — Mutationen (fusion.js) und Auren (auras.js) legen ihren Bonus
// unabhängig obendrauf, siehe loadout.js für die zentrale Kombination.
//
// Sichtbares Level startet bei 1 (Grundzustand, kein Bonus) und geht bis
// Level 10. Jedes Level über 1 gibt +0,1× auf den Cursor-Basiswert:
//   Bonus = (Level - 1) × 0,1
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
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const LEVEL_BONUS_PER_LEVEL = 0.1;

export function getCursorLevel(cursorId) {
  return state.cursorLevels[cursorId] || MIN_LEVEL;
}

// Additiver Bonus in "×"-Einheiten, nicht Prozent — siehe loadout.js für die
// zentrale Formel, die diesen Wert direkt auf den Basismultiplikator addiert.
export function getLevelBonusMultiplier(cursorId) {
  return (getCursorLevel(cursorId) - MIN_LEVEL) * LEVEL_BONUS_PER_LEVEL;
}

export function isMaxLevel(cursorId) {
  return getCursorLevel(cursorId) >= MAX_LEVEL;
}

// null = kein weiteres Upgrade möglich (MAX erreicht).
export function getUpgradeCost(cursorId) {
  if (isMaxLevel(cursorId)) return null;
  const cursor = getCursor(cursorId);
  if (!cursor) return null;
  const baseCost = BASE_COST_BY_RARITY[cursor.rarity] ?? BASE_COST_BY_RARITY.common;
  const stepsAboveMin = getCursorLevel(cursorId) - MIN_LEVEL;
  return Math.round(baseCost * Math.pow(COST_GROWTH_RATE, stepsAboveMin));
}

export function isOwned(cursorId) {
  return Boolean(state.ownedCursors[cursorId]);
}

export function canUpgrade(cursorId) {
  if (!isOwned(cursorId) || isMaxLevel(cursorId)) return false;
  const cost = getUpgradeCost(cursorId);
  return cost !== null && canAfford(cost);
}

export function upgradeCursor(cursorId) {
  if (!canUpgrade(cursorId)) return false;
  const cost = getUpgradeCost(cursorId);
  if (cost === null || !spendCoins(cost)) return false;

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
