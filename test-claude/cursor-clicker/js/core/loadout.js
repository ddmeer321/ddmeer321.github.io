// Löst den aktuell ausgerüsteten Cursor zu effektiven Werten auf: Basis-Cursor
// + Level-Bonus (upgrades.js) + Mutations-Bonus (fusion.js) + Cosmetic-Overlay
// (cosmetics.js). Einzige Stelle, die diese vier Systeme kombiniert — UI-Module
// und economy.js lesen ausschließlich von hier, statt eigene Berechnungen zu
// duplizieren.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursor } from "../data/cursors.js";
import { getMutation } from "../data/mutations.js";
import { getCosmetic } from "../data/cosmetics.js";
import { getCursorLevel, getLevelBonusPercent } from "./upgrades.js";

const BASE_COINS_PER_CLICK = 1;

function findMutatedInstance(cursorId, instanceId) {
  if (!instanceId) return null;
  const list = state.mutatedCursors[cursorId] || [];
  return list.find((entry) => entry.instanceId === instanceId) || null;
}

function emptyLoadout() {
  return {
    cursor: null,
    level: 0,
    instance: null,
    mutationMajor: null,
    mutationMinor: null,
    bonusPercent: 0,
    effectiveMultiplier: 1,
    coinsPerClick: BASE_COINS_PER_CLICK,
    visualClasses: [],
    particle: null,
  };
}

// Vollständige, DOM-freie Beschreibung des aktiven Loadouts.
export function getEquippedLoadout() {
  const { cursorId, instanceId } = state.equipped;
  const cursor = cursorId ? getCursor(cursorId) : null;
  if (!cursor) return emptyLoadout();

  const instance = findMutatedInstance(cursorId, instanceId);
  const level = getCursorLevel(cursorId);
  const majorMutation = instance ? getMutation(instance.major) : null;
  const minorMutation = instance ? getMutation(instance.minor) : null;

  const mutationBonusPercent =
    (majorMutation?.effects.multiplierBonusPercent || 0) +
    (majorMutation?.effects.coinBonusPercent || 0) +
    (minorMutation?.effects.multiplierBonusPercent || 0) +
    (minorMutation?.effects.coinBonusPercent || 0);

  const bonusPercent = getLevelBonusPercent(cursorId) + mutationBonusPercent;
  const effectiveMultiplier = cursor.multiplier * (1 + bonusPercent / 100);
  const coinsPerClick = Math.max(1, Math.round(BASE_COINS_PER_CLICK * effectiveMultiplier));

  const cosmetic = getCosmetic(state.equippedCosmeticId);
  const visualClasses = [majorMutation?.visualClass, minorMutation?.visualClass, cosmetic?.cssClass].filter(Boolean);
  const particle = majorMutation?.particle || minorMutation?.particle || null;

  return { cursor, level, instance, mutationMajor: majorMutation, mutationMinor: minorMutation, bonusPercent, effectiveMultiplier, coinsPerClick, visualClasses, particle };
}

// Erweitert die Fusions-Erfolgschance eines Cursors um dessen Lucky-artige
// Mutations-Boni (falls die aktuell ausgerüstete Instanz das gezielte Duplikat ist).
// Bewusst simpel gehalten: Dropchance-Boni wirken nur über die gerade ausgerüstete Mutation.
export function getFusionDropChanceBonus(cursorId) {
  const loadout = getEquippedLoadout();
  if (!loadout.cursor || loadout.cursor.id !== cursorId) return 0;
  return (loadout.mutationMajor?.effects.dropChanceBonusPercent || 0) + (loadout.mutationMinor?.effects.dropChanceBonusPercent || 0);
}

export function equipCursor(cursorId, instanceId = null) {
  if (!state.ownedCursors[cursorId]) return false;
  if (instanceId && !findMutatedInstance(cursorId, instanceId)) return false;

  state.equipped = { cursorId, instanceId };
  events.emit("cursor:equipped", { cursorId, instanceId });
  events.emit("state:changed", state);
  return true;
}

export function isEquipped(cursorId, instanceId = null) {
  return state.equipped.cursorId === cursorId && state.equipped.instanceId === instanceId;
}
