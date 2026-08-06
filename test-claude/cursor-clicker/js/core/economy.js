// Klick- und Coin-Ökonomie: Basiswert je Klick, multipliziert vom ausgerüsteten Cursor.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursor } from "../data/cursors.js";

const BASE_COINS_PER_CLICK = 1;

export function getEquippedCursor() {
  return state.equippedCursorId ? getCursor(state.equippedCursorId) : null;
}

export function getCoinsPerClick() {
  const equipped = getEquippedCursor();
  const multiplier = equipped ? equipped.multiplier : 1;
  return Math.max(1, Math.round(BASE_COINS_PER_CLICK * multiplier));
}

export function registerClick() {
  const gained = getCoinsPerClick();
  state.coins += gained;
  state.totalCoinsEarned += gained;
  state.totalClicks += 1;
  events.emit("click", { gained, totalClicks: state.totalClicks });
  events.emit("state:changed", state);
  return gained;
}

export function canAfford(amount) {
  return state.coins >= amount;
}

export function spendCoins(amount) {
  if (!canAfford(amount)) return false;
  state.coins -= amount;
  events.emit("state:changed", state);
  return true;
}

export function equipCursor(cursorId) {
  if (!state.ownedCursors[cursorId]) return false;
  state.equippedCursorId = cursorId;
  events.emit("cursor:equipped", { cursorId });
  events.emit("state:changed", state);
  return true;
}

export function toggleFavorite(cursorId) {
  const entry = state.ownedCursors[cursorId];
  if (!entry) return false;
  entry.favorite = !entry.favorite;
  events.emit("state:changed", state);
  return entry.favorite;
}
