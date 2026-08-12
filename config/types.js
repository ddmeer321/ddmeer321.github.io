// Bekannte Spieltypen ("type" in config.json).
//
// "type" beschreibt, WAS für ein Spiel es ist — nicht seinen Zustand
// (das macht "status", siehe statuses.js).
//
// Diese Datei ist die EINZIGE Stelle, an der Typen definiert werden. Die
// config.json eines Spiels enthält nur die id (z.B. "action"), niemals den
// angezeigten Text und keine CSS-Klassen.
//
// NEUEN TYP ERGÄNZEN: einen Eintrag hinzufügen, fertig. Die id ist der Wert,
// der in config.json unter "type" stehen darf, label ist der angezeigte Text.

export const GAME_TYPES = {
  minigame: { label: "Minigame" },
  clicker: { label: "Clicker" },
  action: { label: "Kampfspiel" },
  puzzle: { label: "Puzzle" },
};

// hasOwnProperty statt GAME_TYPES[id], damit geerbte Object-Eigenschaften
// ("constructor", "toString", ...) aus einer fremden config.json nicht
// versehentlich als gültiger Typ durchgehen.
export function getGameType(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(GAME_TYPES, id) ? GAME_TYPES[id] : null;
}

export function isKnownGameType(id) {
  return getGameType(id) !== null;
}

export function listGameTypeIds() {
  return Object.keys(GAME_TYPES);
}
