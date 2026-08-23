// Besitz-/Equip-Logik für Auren. Maximal eine Aura gleichzeitig ausgerüstet.
// grantAura() wird von der Aura-Box-Öffnungslogik genutzt (siehe auraGacha.js);
// hier zentral gehalten, damit alle Aura-Bestandsänderungen an einer Stelle
// passieren, genau wie ownedCursors nur über gacha.js/fusion.js verändert wird.
import { state } from "./state.js";
import { events } from "./events.js";
import { AURAS, getAura } from "../data/auras.js";

export function isAuraOwned(id) {
  return Boolean(state.ownedAuras[id]);
}

export function getAuraCount(id) {
  return state.ownedAuras[id]?.count || 0;
}

export function getOwnedAuras() {
  return AURAS.filter((aura) => isAuraOwned(aura.id));
}

export function getEquippedAura() {
  return getAura(state.equippedAuraId);
}

export function isAuraEquipped(id) {
  return state.equippedAuraId === id;
}

export function equipAura(id) {
  if (id !== null && !isAuraOwned(id)) return false;
  state.equippedAuraId = id;
  events.emit("aura:equipped", { auraId: id });
  events.emit("state:changed", state);
  return true;
}

export function grantAura(id) {
  const aura = getAura(id);
  if (!aura) return null;

  const isNew = !state.ownedAuras[id];
  const entry = state.ownedAuras[id] || { count: 0, firstObtainedAt: Date.now() };
  entry.count += 1;
  state.ownedAuras[id] = entry;

  const result = { aura, isNew };
  events.emit("aura:obtained", result);
  events.emit("state:changed", state);
  return result;
}
