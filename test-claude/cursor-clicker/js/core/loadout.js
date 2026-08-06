// Einzige Stelle, die den effektiven Klick-Ertrag berechnet: Basis-Cursor +
// Level (upgrades.js) + Mutation (fusion.js) + Aura (auras.js) + Cosmetic-
// Overlay (cosmetics.js, rein visuell — fließt NIE in die Zahl ein).
// UI-Module und economy.js lesen ausschließlich von hier.
//
// Zentrale Formel (in dieser Reihenfolge, siehe getEquippedLoadout):
//   1. Basis-Multiplikator des Cursors
//   2. + Level-Bonus:            (Level - 1) × 0,1        [additiv]
//   3. × Mutationsbonus:         × (1 + Mutation% / 100)   [multiplikativ]
//   4. × Aura-Faktor:            × (1 + Aura-Bonus)        [multiplikativ]
//   5. = Klick-Ertrag (am Ende gerundet, mindestens 1)
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursor } from "../data/cursors.js";
import { getMutation } from "../data/mutations.js";
import { getCosmetic } from "../data/cosmetics.js";
import { getCursorLevel, getLevelBonusMultiplier, isMaxLevel } from "./upgrades.js";
import { getEquippedAura } from "./auras.js";
import { getAuraFactor } from "../data/auras.js";

const BASE_COINS_PER_CLICK = 1;

function findMutatedInstance(cursorId, instanceId) {
  if (!instanceId) return null;
  const list = state.mutatedCursors[cursorId] || [];
  return list.find((entry) => entry.instanceId === instanceId) || null;
}

function emptyLoadout() {
  return {
    cursor: null,
    level: 1,
    maxLevel: true,
    instance: null,
    mutationMajor: null,
    mutationMinor: null,
    aura: null,
    breakdown: { base: 0, levelBonus: 0, afterLevel: 0, mutationBonusPercent: 0, afterMutation: 0, auraFactor: 1, afterAura: 0 },
    effectiveMultiplier: 1,
    coinsPerClick: BASE_COINS_PER_CLICK,
    visualClasses: [],
    particle: null,
  };
}

// Vollständige, DOM-freie Beschreibung des aktiven Loadouts inkl. einer
// nachvollziehbaren Schritt-für-Schritt-Aufschlüsselung (breakdown) für die UI.
export function getEquippedLoadout() {
  const { cursorId, instanceId } = state.equipped;
  const cursor = cursorId ? getCursor(cursorId) : null;
  if (!cursor) return emptyLoadout();

  const instance = findMutatedInstance(cursorId, instanceId);
  const level = getCursorLevel(cursorId);
  const levelBonus = getLevelBonusMultiplier(cursorId);

  const majorMutation = instance ? getMutation(instance.major) : null;
  const minorMutation = instance ? getMutation(instance.minor) : null;
  const mutationBonusPercent =
    (majorMutation?.effects.multiplierBonusPercent || 0) +
    (majorMutation?.effects.coinBonusPercent || 0) +
    (minorMutation?.effects.multiplierBonusPercent || 0) +
    (minorMutation?.effects.coinBonusPercent || 0);

  const aura = getEquippedAura();
  const auraFactor = getAuraFactor(aura);

  const base = cursor.multiplier;
  const afterLevel = base + levelBonus;
  const afterMutation = afterLevel * (1 + mutationBonusPercent / 100);
  const afterAura = afterMutation * auraFactor;
  const coinsPerClick = Math.max(1, Math.round(BASE_COINS_PER_CLICK * afterAura));

  const cosmetic = getCosmetic(state.equippedCosmeticId);
  const visualClasses = [majorMutation?.visualClass, minorMutation?.visualClass, cosmetic?.cssClass].filter(Boolean);
  const particle = majorMutation?.particle || minorMutation?.particle || null;

  const breakdown = { base, levelBonus, afterLevel, mutationBonusPercent, afterMutation, auraFactor, afterAura };

  return {
    cursor,
    level,
    maxLevel: isMaxLevel(cursorId),
    instance,
    mutationMajor: majorMutation,
    mutationMinor: minorMutation,
    aura,
    breakdown,
    effectiveMultiplier: afterAura,
    coinsPerClick,
    visualClasses,
    particle,
  };
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
  const entry = state.ownedCursors[cursorId];
  if (!entry) return false;
  // Die unmutierte Basisvariante ist nur ausrüstbar, solange mindestens ein
  // Basis-Exemplar übrig ist (Fusion kann sie auf 0 verbrauchen).
  if (instanceId === null && entry.count <= 0) return false;
  if (instanceId && !findMutatedInstance(cursorId, instanceId)) return false;

  state.equipped = { cursorId, instanceId };
  events.emit("cursor:equipped", { cursorId, instanceId });
  events.emit("state:changed", state);
  return true;
}

export function isEquipped(cursorId, instanceId = null) {
  return state.equipped.cursorId === cursorId && state.equipped.instanceId === instanceId;
}
