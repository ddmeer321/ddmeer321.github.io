// Wertet die deklarativen Bedingungen aus data/achievements.js gegen den
// aktuellen State aus. Wird nach relevanten Events erneut aufgerufen (siehe main.js).
// Freischalten zahlt automatisch reward-Coins aus und schaltet ein optionales
// rewardCosmeticId frei (Platzhalter-Erwerbsweg bis es Cosmetic-Boxen gibt).
import { state } from "./state.js";
import { events } from "./events.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { CURSORS } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";
import { addCoins } from "./wallet.js";
import { unlockCosmetic } from "./cosmetics.js";

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

function hasAnyMutationOfTier(tier) {
  return Object.values(state.mutatedCursors).some((instances) => instances.some((instance) => Boolean(instance[tier])));
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
    case "cursorLevel":
      return Object.values(state.cursorLevels).some((level) => level >= achievement.value);
    case "fusionsPerformed":
      return state.fusionsPerformed >= achievement.value;
    case "mutationTierObtained":
      return hasAnyMutationOfTier(achievement.value);
    default:
      return false;
  }
}

function grantReward(achievement) {
  if (achievement.reward) addCoins(achievement.reward);
  if (achievement.rewardCosmeticId) unlockCosmetic(achievement.rewardCosmeticId);
}

export function checkAchievements() {
  const unlockedNow = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.unlockedAchievements[achievement.id]) continue;
    if (isUnlocked(achievement)) {
      state.unlockedAchievements[achievement.id] = Date.now();
      grantReward(achievement);
      unlockedNow.push(achievement);
    }
  }
  if (unlockedNow.length) {
    events.emit("achievements:unlocked", unlockedNow);
    events.emit("state:changed", state);
  }
  return unlockedNow;
}
