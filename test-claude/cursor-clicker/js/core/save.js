// Persistenz-Schicht. Kapselt localStorage vollständig, damit ein späterer
// Wechsel auf Cloud-Speicherung (z.B. Supabase) nur diese Datei betrifft.
import { state, replaceState, createDefaultState, SAVE_VERSION } from "./state.js";
import { getDefaultUnlockedCosmeticIds } from "../data/cosmetics.js";
import { MAX_LEVEL } from "./upgrades.js";

const STORAGE_KEY = "cursorClicker.save.v1";

function defaultUnlockedCosmetics() {
  const unlocked = {};
  getDefaultUnlockedCosmeticIds().forEach((id) => { unlocked[id] = true; });
  return unlocked;
}

// Migrationspfad für künftige Save-Versionen. Jede Version bringt ihre eigene
// kleine Transform-Funktion mit, damit neue Schema-Änderungen nicht die
// vorherigen Migrationsschritte anfassen müssen.
const MIGRATIONS = {
  // v1 -> v2: equippedCursorId (string) wird zu equipped { cursorId, instanceId }.
  // Neue Systeme (Upgrades, Fusion, Cosmetics) starten für Bestandsspieler leer,
  // bis auf den kostenlosen Standard-Cosmetic, den auch neue Spielstände bekommen.
  1: (saved) => {
    const { equippedCursorId, ...rest } = saved;
    return {
      ...rest,
      equipped: { cursorId: equippedCursorId ?? null, instanceId: null },
      cursorLevels: saved.cursorLevels || {},
      mutatedCursors: saved.mutatedCursors || {},
      unlockedCosmetics: saved.unlockedCosmetics || defaultUnlockedCosmetics(),
      equippedCosmeticId: saved.equippedCosmeticId ?? null,
    };
  },
  // v2 -> v3: sichtbares Level startet jetzt bei 1 statt 0 (alter interner
  // Wert 0 = "kein Upgrade" wird zu neuem Level 1 = "kein Bonus"). Jeder alte
  // gespeicherte Levelwert wird daher um 1 verschoben und auf MAX_LEVEL gedeckelt.
  // Auren sind ein komplett neues System und starten für Bestandsspieler leer.
  2: (saved) => {
    const shiftedLevels = {};
    for (const [cursorId, oldLevel] of Object.entries(saved.cursorLevels || {})) {
      shiftedLevels[cursorId] = Math.min(MAX_LEVEL, (Number(oldLevel) || 0) + 1);
    }
    return {
      ...saved,
      cursorLevels: shiftedLevels,
      ownedAuras: saved.ownedAuras || {},
      equippedAuraId: saved.equippedAuraId ?? null,
      auraBoxesOpened: saved.auraBoxesOpened || 0,
    };
  },
};

function migrate(saved) {
  if (!saved || typeof saved !== "object") return createDefaultState();

  let working = saved;
  let fromVersion = Number(working.version) || 1;
  while (MIGRATIONS[fromVersion]) {
    working = MIGRATIONS[fromVersion](working);
    fromVersion += 1;
  }

  const merged = Object.assign(createDefaultState(), working);
  merged.version = SAVE_VERSION;
  return merged;
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    replaceState(migrate(saved));
    return true;
  } catch (err) {
    console.warn("Cursor Clicker: Speicherstand konnte nicht geladen werden.", err);
    return false;
  }
}

export function saveGame() {
  try {
    state.lastSavedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Cursor Clicker: Speicherstand konnte nicht gespeichert werden.", err);
  }
}

export function hardReset() {
  localStorage.removeItem(STORAGE_KEY);
  replaceState(createDefaultState());
}
