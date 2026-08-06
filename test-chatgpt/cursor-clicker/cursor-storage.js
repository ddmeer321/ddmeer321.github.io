const STORAGE_KEY = "cursor-clicker-save-v1";

export function createDefaultState() {
  return {
    version: 1,
    coins: 0,
    equipped: "wooden",
    inventory: { wooden: { count: 1, favorite: false, firstDrawnAt: null } },
    achievements: {},
    daily: { lastClaim: null, streak: 0 },
    stats: {
      totalClicks: 0,
      totalCoinsEarned: 0,
      boxesOpened: 0,
      totalDraws: 0,
      highestRarity: 0,
      startedAt: Date.now(),
      playSeconds: 0,
    },
    settings: { music: false, sounds: true, animations: true },
    lastSavedAt: Date.now(),
  };
}

export function loadState() {
  const fallback = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      ...fallback,
      ...saved,
      inventory: { ...fallback.inventory, ...(saved.inventory || {}) },
      achievements: saved.achievements || {},
      daily: { ...fallback.daily, ...(saved.daily || {}) },
      stats: { ...fallback.stats, ...(saved.stats || {}) },
      settings: { ...fallback.settings, ...(saved.settings || {}) },
    };
  } catch (error) {
    console.warn("Cursor-Clicker-Spielstand konnte nicht geladen werden.", error);
    return fallback;
  }
}

export function saveState(state) {
  state.lastSavedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Cursor-Clicker-Spielstand konnte nicht gespeichert werden.", error);
    return false;
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return createDefaultState();
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}
