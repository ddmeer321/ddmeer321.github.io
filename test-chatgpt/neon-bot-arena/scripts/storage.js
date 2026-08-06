import { coinKey, defaultCosmetic, highScoreKey, leaderboardKey, progressionKey, starterHeroes, testSiteBuild } from "./config.js?v=musicvolume1";
import { cleanName } from "./utils.js";

const GAME_MODES = new Set(["normal", "chaos", "hardcore"]);
const DIFFICULTIES = new Set(["easy", "normal", "hard"]);
const LEADERBOARD_LIMIT_PER_MODE = 10;

export function loadHighScore() {
  if (testSiteBuild) return 0;
  return Number(localStorage.getItem(highScoreKey)) || 0;
}

export function loadCoins() {
  return Number(localStorage.getItem(coinKey)) || 0;
}

export function saveCoins(coins) {
  localStorage.setItem(coinKey, String(coins));
}

export function loadProgression() {
  try {
    const parsed = JSON.parse(localStorage.getItem(progressionKey) || "{}");
    const unlocked = Array.isArray(parsed.unlockedHeroes) ? parsed.unlockedHeroes : starterHeroes;
    const upgrades = parsed.upgrades && typeof parsed.upgrades === "object" ? parsed.upgrades : {};
    const ownedCosmetics = Array.isArray(parsed.ownedCosmetics) ? parsed.ownedCosmetics : [defaultCosmetic];
    const equippedCosmetic = typeof parsed.equippedCosmetic === "string" ? parsed.equippedCosmetic : defaultCosmetic;
    return {
      unlockedHeroes: [...new Set([...starterHeroes, ...unlocked])],
      upgrades,
      ownedCosmetics: [...new Set([defaultCosmetic, ...ownedCosmetics])],
      equippedCosmetic
    };
  } catch {
    return { unlockedHeroes: [...starterHeroes], upgrades: {}, ownedCosmetics: [defaultCosmetic], equippedCosmetic: defaultCosmetic };
  }
}

export function saveProgression(state) {
  localStorage.setItem(
    progressionKey,
    JSON.stringify({
      unlockedHeroes: state.unlockedHeroes,
      upgrades: state.upgrades,
      ownedCosmetics: state.ownedCosmetics,
      equippedCosmetic: state.equippedCosmetic
    })
  );
}

export function saveHighScore(state, dom) {
  if (!isScorePersistenceAllowed(state)) return false;
  if (state.score <= state.highScore) return false;
  state.highScore = state.score;
  localStorage.setItem(highScoreKey, String(state.highScore));
  if (dom.menuHighScoreText) dom.menuHighScoreText.textContent = state.highScore;
  if (dom.highScoreText) dom.highScoreText.textContent = state.highScore;
  return true;
}

export function loadLeaderboard() {
  if (testSiteBuild) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(leaderboardKey) || "[]");
    return Array.isArray(parsed) ? limitLeaderboardByMode(normalizeLeaderboard(parsed)) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboardEntry(state) {
  if (!isScorePersistenceAllowed(state)) return false;
  const mode = GAME_MODES.has(state.gameMode) ? state.gameMode : "normal";
  const existing = state.leaderboard.find((entry) => entry.mode === mode && entry.name.toLowerCase() === state.playerName.toLowerCase());
  if (!existing) {
    state.leaderboard.push({
      name: state.playerName,
      score: state.score,
      wave: state.wave,
      mode,
      difficulty: state.difficulty,
      playerCount: Math.max(1, Math.min(3, Math.round(Number(state.multiplayer?.playerCount) || 1))),
      date: new Date().toISOString()
    });
  } else if (state.score > existing.score || (state.score === existing.score && state.wave > existing.wave)) {
    existing.name = state.playerName;
    existing.score = state.score;
    existing.wave = state.wave;
    existing.difficulty = state.difficulty;
    existing.playerCount = Math.max(1, Math.min(3, Math.round(Number(state.multiplayer?.playerCount) || 1)));
    existing.date = new Date().toISOString();
  }
  state.leaderboard = limitLeaderboardByMode(normalizeLeaderboard(state.leaderboard));
  localStorage.setItem(leaderboardKey, JSON.stringify(state.leaderboard));
  return true;
}

export function isScorePersistenceAllowed(state) {
  return testSiteBuild !== true && state?.testMode !== true;
}

export function normalizeLeaderboard(entries) {
  const bestByName = new Map();
  for (const entry of entries) {
    if (!entry || !entry.name) continue;
    const score = Number(entry.score);
    const wave = Number(entry.wave);
    if (!Number.isFinite(score)) continue;

    const name = cleanName(entry.name);
    const legacyMode = entry.mode === "one-heart" ? "hardcore" : entry.mode;
    const mode = GAME_MODES.has(legacyMode) ? legacyMode : "normal";
    const normalized = {
      name,
      score,
      wave: Number.isFinite(wave) ? wave : 1,
      mode,
      difficulty: DIFFICULTIES.has(entry.difficulty) ? entry.difficulty : "normal",
      playerCount: Math.max(1, Math.min(3, Math.round(Number(entry.playerCount) || 1))),
      date: entry.date || new Date().toISOString()
    };
    const key = `${mode}:${name.toLowerCase()}`;
    const current = bestByName.get(key);
    if (!current || normalized.score > current.score || (normalized.score === current.score && normalized.wave > current.wave)) {
      bestByName.set(key, normalized);
    }
  }
  return [...bestByName.values()].sort((a, b) => b.score - a.score || b.wave - a.wave);
}

export function limitLeaderboardByMode(entries, limit = LEADERBOARD_LIMIT_PER_MODE) {
  const safeLimit = Math.max(1, Math.round(Number(limit) || LEADERBOARD_LIMIT_PER_MODE));
  return ["normal", "chaos", "hardcore"].flatMap((mode) => entries.filter((entry) => entry.mode === mode).slice(0, safeLimit));
}

export function filterLeaderboard(entries, mode, filter = "all") {
  return entries
    .filter((entry) => entry.mode === mode)
    .filter((entry) => {
      if (filter === "players-2") return entry.playerCount === 2;
      if (filter === "all") return entry.playerCount === 1;
      return entry.playerCount === 1 && entry.difficulty === filter;
    })
    .slice(0, LEADERBOARD_LIMIT_PER_MODE);
}
