// Freischalt-/Equip-Logik für Cosmetics. Rein visuell, siehe data/cosmetics.js
// und loadout.js (dort liefert equippedCosmeticId das separate cosmeticClass-
// Feld — bewusst getrennt von visualClasses/Mutation, siehe dortiger Kommentar).
import { state } from "./state.js";
import { events } from "./events.js";
import { COSMETICS, getCosmetic } from "../data/cosmetics.js";

export function isCosmeticUnlocked(id) {
  return Boolean(state.unlockedCosmetics[id]);
}

export function unlockCosmetic(id) {
  if (!getCosmetic(id) || isCosmeticUnlocked(id)) return false;
  state.unlockedCosmetics[id] = true;
  events.emit("cosmetic:unlocked", { cosmeticId: id });
  events.emit("state:changed", state);
  return true;
}

export function equipCosmetic(id) {
  if (id !== null && !isCosmeticUnlocked(id)) return false;
  state.equippedCosmeticId = id;
  events.emit("cosmetic:equipped", { cosmeticId: id });
  events.emit("state:changed", state);
  return true;
}

export function getUnlockedCosmetics() {
  return COSMETICS.filter((cosmetic) => isCosmeticUnlocked(cosmetic.id));
}
