// Box-Öffnungslogik: Seltenheit gewichtet auswürfeln, dann einen Cursor dieser
// Seltenheit ziehen. Reine Berechnung, keine DOM-Zugriffe.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursorsByRarity } from "../data/cursors.js";
import { getBox } from "../data/boxes.js";
import { spendCoins } from "./economy.js";
import { weightedPick } from "./random.js";

function rollRarity(odds) {
  const rarityIds = Object.keys(odds);
  return weightedPick(rarityIds, (rarityId) => odds[rarityId]);
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
  if (!state.equipped.cursorId) {
    state.equipped = { cursorId: cursor.id, instanceId: null };
  }

  const result = { box, cursor, isNew };
  events.emit("box:opened", result);
  events.emit("state:changed", state);
  return result;
}
