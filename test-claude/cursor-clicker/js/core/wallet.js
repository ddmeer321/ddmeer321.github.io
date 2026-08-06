// Coins-Grundmechanik ohne jede Abhängigkeit auf andere Systeme (bewusst so
// gehalten, damit economy.js/upgrades.js/achievements.js/dailyReward.js sie
// alle nutzen können, ohne Zirkelbezüge untereinander aufzubauen).
import { state } from "./state.js";
import { events } from "./events.js";

export function addCoins(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.coins += amount;
  state.totalCoinsEarned += amount;
  events.emit("state:changed", state);
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
