// Zentraler Spielzustand als einfaches, mutierbares Objekt. Änderungen werden
// per events.emit("state:changed") gemeldet, UI-Module rendern daraufhin neu.
import { events } from "./events.js";

export const SAVE_VERSION = 1;

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    coins: 0,
    totalCoinsEarned: 0,
    totalClicks: 0,
    boxesOpened: 0,
    equippedCursorId: null,
    // cursorId -> { count, favorite, firstObtainedAt }
    ownedCursors: {},
    // achievementId -> Zeitstempel der Freischaltung
    unlockedAchievements: {},
    dailyReward: { lastClaimedDate: null, streak: 0 },
    settings: { music: false, sfx: true, animations: true },
    playtimeSeconds: 0,
    createdAt: Date.now(),
    lastSavedAt: null,
  };
}

export const state = createDefaultState();

export function replaceState(nextState) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, nextState);
  events.emit("state:changed", state);
}

export function resetState() {
  replaceState(createDefaultState());
}
