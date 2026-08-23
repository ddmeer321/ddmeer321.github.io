// Klick-Ökonomie. Der effektive Coins-pro-Klick-Wert (Level + Mutation
// eingerechnet) kommt aus loadout.js — Coins selbst verwaltet wallet.js.
import { state } from "./state.js";
import { events } from "./events.js";
import { getEquippedLoadout } from "./loadout.js";
import { addCoins } from "./wallet.js";

export { canAfford, spendCoins } from "./wallet.js";

export function getCoinsPerClick() {
  return getEquippedLoadout().coinsPerClick;
}

export function registerClick() {
  const gained = getCoinsPerClick();
  addCoins(gained);
  state.totalClicks += 1;
  events.emit("click", { gained, totalClicks: state.totalClicks });
  events.emit("state:changed", state);
  return gained;
}

export function toggleFavorite(cursorId) {
  const entry = state.ownedCursors[cursorId];
  if (!entry) return false;
  entry.favorite = !entry.favorite;
  events.emit("state:changed", state);
  return entry.favorite;
}
