// Wertet die deklarativen Bedingungen aus data/achievements.js gegen den
// aktuellen State aus. Wird nach relevanten Events erneut aufgerufen (siehe main.js).
import { state } from "./state.js";
import { events } from "./events.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { CURSORS } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";

function rarestOwnedOrder() {
  let best = -1;
  for (const id of Object.keys(state.ownedCursors)) {
    const cursor = CURSORS.find((c) => c.id === id);
    if (!cursor) continue;
    const order = getRarity(cursor.rarity).order;
    if (order > best) best = order;
  }
  return best;
}

function isUnlocked(achievement) {
  switch (achievement.type) {
    case "clicks":
      return state.totalClicks >= achievement.value;
    case "boxesOpened":
      return state.boxesOpened >= achievement.value;
    case "coinsEarned":
      return state.totalCoinsEarned >= achievement.value;
    case "uniqueCursors": {
      const owned = Object.keys(state.ownedCursors).length;
      return achievement.value === "all" ? owned >= CURSORS.length : owned >= achievement.value;
    }
    case "rarityObtained":
      return rarestOwnedOrder() >= getRarity(achievement.value).order;
    case "dailyStreak":
      return state.dailyReward.streak >= achievement.value;
    default:
      return false;
  }
}

export function checkAchievements() {
  const unlockedNow = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.unlockedAchievements[achievement.id]) continue;
    if (isUnlocked(achievement)) {
      state.unlockedAchievements[achievement.id] = Date.now();
      unlockedNow.push(achievement);
    }
  }
  if (unlockedNow.length) {
    events.emit("achievements:unlocked", unlockedNow);
    events.emit("state:changed", state);
  }
  return unlockedNow;
}
