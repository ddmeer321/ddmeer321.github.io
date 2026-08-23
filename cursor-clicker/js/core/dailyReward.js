// Täglicher Bonus mit steigender Belohnung bei aufeinanderfolgenden Kalendertagen.
// Ein ausgelassener Tag setzt die Serie zurück auf 1.
import { state } from "./state.js";
import { events } from "./events.js";
import { addCoins } from "./wallet.js";

const BASE_REWARD = 100;
const MAX_STREAK_DAYS = 7;

function dateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function todayKey() {
  return dateKey(new Date());
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export function canClaimDailyReward() {
  return state.dailyReward.lastClaimedDate !== todayKey();
}

// Die Serienlänge, die beim Abholen JETZT herauskäme — auch nutzbar, um den
// Bonus im Modal anzuzeigen, bevor tatsächlich abgeholt wurde.
export function getPreviewStreak() {
  const continuesStreak = state.dailyReward.lastClaimedDate === yesterdayKey();
  return continuesStreak ? Math.min(state.dailyReward.streak + 1, MAX_STREAK_DAYS) : 1;
}

export function getNextRewardAmount() {
  return BASE_REWARD * getPreviewStreak();
}

export function claimDailyReward() {
  if (!canClaimDailyReward()) return null;
  state.dailyReward.streak = getPreviewStreak();
  const amount = BASE_REWARD * state.dailyReward.streak;

  state.dailyReward.lastClaimedDate = todayKey();
  addCoins(amount);

  const result = { amount, streak: state.dailyReward.streak };
  events.emit("dailyReward:claimed", result);
  events.emit("state:changed", state);
  return result;
}
