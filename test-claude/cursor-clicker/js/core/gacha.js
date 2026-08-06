// Box-Öffnungslogik: Seltenheit gewichtet auswürfeln, dann einen Cursor dieser
// Seltenheit ziehen. Reine Berechnung, keine DOM-Zugriffe.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursorsByRarity } from "../data/cursors.js";
import { getBox } from "../data/boxes.js";
import { spendCoins } from "./economy.js";

function rollRarity(odds) {
  const roll = Math.random() * 100;
  let cumulative = 0;
  let lastPositive = null;
  for (const [rarityId, chance] of Object.entries(odds)) {
    if (chance > 0) lastPositive = rarityId;
    cumulative += chance;
    if (roll < cumulative) return rarityId;
  }
  // Rundungs-Fallback, falls die Summe knapp unter 100 liegt.
  return lastPositive;
}

function rollCursor(rarityId) {
  const pool = getCursorsByRarity(rarityId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function openBox(boxId) {
  const box = getBox(boxId);
  if (!box) return null;
  if (!spendCoins(box.price)) return null;

  const rarityId = rollRarity(box.odds);
  const cursor = rollCursor(rarityId);
  const isNew = !state.ownedCursors[cursor.id];

  const entry = state.ownedCursors[cursor.id] || { count: 0, favorite: false, firstObtainedAt: Date.now() };
  entry.count += 1;
  state.ownedCursors[cursor.id] = entry;
  state.boxesOpened += 1;

  // Erster jemals gezogener Cursor wird automatisch ausgerüstet, damit Coins/Klick
  // nie ungenutzt bei x1 hängen bleibt. Danach entscheidet ausschließlich der Spieler.
  if (!state.equippedCursorId) {
    state.equippedCursorId = cursor.id;
  }

  const result = { box, cursor, isNew };
  events.emit("box:opened", result);
  events.emit("state:changed", state);
  return result;
}
