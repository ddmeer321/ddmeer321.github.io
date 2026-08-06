// Persistenz-Schicht. Kapselt localStorage vollständig, damit ein späterer
// Wechsel auf Cloud-Speicherung (z.B. Supabase) nur diese Datei betrifft.
import { state, replaceState, createDefaultState, SAVE_VERSION } from "./state.js";

const STORAGE_KEY = "cursorClicker.save.v1";

// Migrationspfad für künftige Save-Versionen. Aktuell nur Version 1 vorhanden.
function migrate(saved) {
  if (!saved || typeof saved !== "object") return createDefaultState();
  const merged = Object.assign(createDefaultState(), saved);
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
