// Spielzeit-Tracking und abgeleitete Statistiken.
import { state } from "./state.js";
import { events } from "./events.js";
import { CURSORS } from "../data/cursors.js";
import { getRarity } from "../data/rarities.js";

let tickHandle = null;

export function startPlaytimeTracking() {
  if (tickHandle) return;
  tickHandle = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    state.playtimeSeconds += 1;
    events.emit("playtime:tick", state.playtimeSeconds);
  }, 1000);
}

export function formatPlaytime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function getRarestOwnedCursor() {
  let rarest = null;
  let bestOrder = -1;
  for (const id of Object.keys(state.ownedCursors)) {
    const cursor = CURSORS.find((c) => c.id === id);
    if (!cursor) continue;
    const order = getRarity(cursor.rarity).order;
    if (order > bestOrder) {
      bestOrder = order;
      rarest = cursor;
    }
  }
  return rarest;
}

// "Gezogene Cursor" = verschiedene Cursor-Typen, die der Spieler schon besitzt
// (nicht die Anzahl der Boxen-Öffnungen — die steht separat in state.boxesOpened).
export function getUniqueCursorsDrawn() {
  return Object.keys(state.ownedCursors).length;
}

export function getTotalCursorCatalogSize() {
  return CURSORS.length;
}
