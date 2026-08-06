import { ACHIEVEMENTS, BOXES, CURSORS, RARITIES, boxById, cursorById } from "./cursor-data.js";
import { configureAudio, playSound } from "./cursor-audio.js";
import { createDefaultState, loadState, resetState, saveState } from "./cursor-storage.js";
import { createUI } from "./cursor-ui.js";

let state = loadState();
let combo = 0;
let comboTimer;
let saveTimer;

const ui = createUI({
  clickCursor,
  openBox,
  equipCursor,
  toggleFavorite,
  claimDaily,
  updateSetting,
  resetGame,
  requestRender: render,
});

function getDerived() {
  const equipped = cursorById(state.equipped) || CURSORS[0];
  return {
    coinsPerClick: equipped.multiplier,
    daily: getDailyStatus(),
  };
}

function addCoins(amount) {
  state.coins += amount;
  state.stats.totalCoinsEarned += amount;
}

function clickCursor(event) {
  const cursor = cursorById(state.equipped);
  let amount = cursor.multiplier;
  let special = false;
  let specialText = "";

  state.stats.totalClicks += 1;
  combo += 1;
  window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => { combo = 0; ui.setCombo(0); }, 1600);

  if (cursor.effect?.type === "critical" && Math.random() < cursor.effect.chance) {
    amount *= cursor.effect.bonus;
    special = true;
    specialText = `Kritischer Klick ×${cursor.effect.bonus}!`;
  }
  if (cursor.effect?.type === "every" && state.stats.totalClicks % cursor.effect.every === 0) {
    amount *= cursor.effect.bonus;
    special = true;
    specialText = `${cursor.effect.every}. Klick: ×${cursor.effect.bonus} Bonus!`;
  }

  addCoins(amount);
  ui.animateClick();
  ui.floatCoins(event.clientX || innerWidth / 2, event.clientY || innerHeight / 2, amount, special);
  ui.setCombo(combo);
  if (specialText) ui.showSpecial(specialText);
  playSound("click");
  checkAchievements();
  render();
  scheduleSave();
}

function rollRarity(chances) {
  let roll = Math.random() * 100;
  for (const [rarity, chance] of Object.entries(chances)) {
    if (roll < chance) return rarity;
    roll -= chance;
  }
  return "common";
}

function openBox(boxId) {
  const box = boxById(boxId);
  if (!box || state.coins < box.price) {
    ui.toast("Nicht genug Coins", "Klicke weiter oder öffne eine günstigere Box.", "#fb7185");
    return;
  }

  state.coins -= box.price;
  const rarity = rollRarity(box.chances);
  const pool = CURSORS.filter(cursor => cursor.rarity === rarity);
  const cursor = pool[Math.floor(Math.random() * pool.length)];
  const duplicate = Boolean(state.inventory[cursor.id]);

  if (duplicate) state.inventory[cursor.id].count += 1;
  else state.inventory[cursor.id] = { count: 1, favorite: false, firstDrawnAt: Date.now() };

  state.stats.boxesOpened += 1;
  state.stats.totalDraws += 1;
  state.stats.highestRarity = Math.max(state.stats.highestRarity, RARITIES[rarity].rank);
  playSound("buy");
  window.setTimeout(() => playSound("reveal", RARITIES[rarity].rank), state.settings.animations ? 250 : 0);
  checkAchievements();
  render();
  saveState(state);

  window.setTimeout(() => ui.showReward(cursor, duplicate), state.settings.animations ? 220 : 0);
}

function equipCursor(cursorId) {
  if (!state.inventory[cursorId] || !cursorById(cursorId)) return;
  state.equipped = cursorId;
  playSound("equip");
  ui.toast("Cursor ausgerüstet", cursorById(cursorId).name, RARITIES[cursorById(cursorId).rarity].color);
  render();
  saveState(state);
}

function toggleFavorite(cursorId) {
  if (!state.inventory[cursorId]) return;
  state.inventory[cursorId].favorite = !state.inventory[cursorId].favorite;
  render();
  scheduleSave();
}

function checkAchievements() {
  const newlyUnlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!state.achievements[achievement.id] && achievement.test(state)) {
      state.achievements[achievement.id] = { unlockedAt: Date.now() };
      addCoins(achievement.reward);
      newlyUnlocked.push(achievement);
    }
  }
  newlyUnlocked.forEach((achievement, index) => {
    window.setTimeout(() => {
      playSound("reward");
      ui.toast(`Achievement: ${achievement.title}`, `+${achievement.reward.toLocaleString("de-DE")} Coins`, "#4ade80", 4700);
    }, index * 250);
  });
}

function dayStart(time = Date.now()) {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getDailyStatus() {
  const today = dayStart();
  const last = state.daily.lastClaim ? dayStart(state.daily.lastClaim) : null;
  const daysSince = last === null ? null : Math.round((today - last) / 86_400_000);
  const available = last === null || daysSince >= 1;
  const nextStreak = last === null || daysSince > 1 ? 1 : Math.min(state.daily.streak + 1, 7);
  const reward = nextStreak * 150;
  const nextDay = today + 86_400_000;
  const remainingMs = Math.max(0, nextDay - Date.now());
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  return { available, nextStreak, reward, remaining: `${hours} Std. ${minutes} Min.` };
}

function claimDaily() {
  const daily = getDailyStatus();
  if (!daily.available) {
    ui.toast("Schon abgeholt", `Die nächste Belohnung kommt in ${daily.remaining}.`, "#fbbf24");
    return;
  }
  state.daily.streak = daily.nextStreak;
  state.daily.lastClaim = Date.now();
  addCoins(daily.reward);
  playSound("reward");
  ui.toast(`Daily Reward · Tag ${daily.nextStreak}`, `+${daily.reward.toLocaleString("de-DE")} Coins`, "#fbbf24", 5000);
  checkAchievements();
  render();
  saveState(state);
}

function updateSetting(key, value) {
  if (!(key in state.settings)) return;
  state.settings[key] = value;
  configureAudio(state.settings);
  render();
  saveState(state);
}

function resetGame() {
  state = resetState();
  combo = 0;
  configureAudio(state.settings);
  ui.closeConfirm();
  ui.closeReward();
  ui.showTab("play");
  ui.toast("Neuer Spielstand", "Dein Fortschritt wurde vollständig zurückgesetzt.", "#fb7185");
  render();
  saveState(state);
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveState(state), 500);
}

function render() {
  ui.render(state, getDerived());
}

configureAudio(state.settings);
checkAchievements();
render();

window.setInterval(() => {
  if (!document.hidden) state.stats.playSeconds += 1;
  if (state.stats.playSeconds % 5 === 0) {
    render();
    saveState(state);
  }
}, 1000);

document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(state); });
window.addEventListener("beforeunload", () => saveState(state));

// Kleine, bewusst stabile Schnittstelle für spätere Systeme wie Cloud-Saves oder Quests.
window.CursorClicker = {
  getSnapshot: () => structuredClone(state),
  addCoins: amount => { if (Number.isFinite(amount) && amount > 0) { addCoins(amount); render(); scheduleSave(); } },
  version: 1,
};
