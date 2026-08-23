// Zentraler Spielzustand als einfaches, mutierbares Objekt. Änderungen werden
// per events.emit("state:changed") gemeldet, UI-Module rendern daraufhin neu.
import { events } from "./events.js";
import { getDefaultUnlockedCosmeticIds } from "../data/cosmetics.js";

export const SAVE_VERSION = 3;

function defaultUnlockedCosmetics() {
  const unlocked = {};
  getDefaultUnlockedCosmeticIds().forEach((id) => { unlocked[id] = true; });
  return unlocked;
}

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    coins: 0,
    totalCoinsEarned: 0,
    totalClicks: 0,
    boxesOpened: 0,
    fusionsPerformed: 0,
    // Welcher Cursor aktiv ist: instanceId=null -> unmutierte Basisform,
    // sonst Verweis auf einen Eintrag in mutatedCursors[cursorId].
    equipped: { cursorId: null, instanceId: null },
    // cursorId -> { count, favorite, firstObtainedAt } — Basis-Duplikate (Fusion-Rohstoff)
    ownedCursors: {},
    // cursorId -> Level (0 = nicht aufgewertet)
    cursorLevels: {},
    // cursorId -> [{ instanceId, major, minor, createdAt }] — Fusionsergebnisse
    mutatedCursors: {},
    // achievementId -> Zeitstempel der Freischaltung
    unlockedAchievements: {},
    dailyReward: { lastClaimedDate: null, streak: 0 },
    // cosmeticId -> true
    unlockedCosmetics: defaultUnlockedCosmetics(),
    equippedCosmeticId: null,
    // auraId -> { count, firstObtainedAt } — aus Aura-Boxen gezogen, max. 1 gleichzeitig ausgerüstet
    ownedAuras: {},
    equippedAuraId: null,
    auraBoxesOpened: 0,
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
