// Bekannte Fähigkeiten eines Spiels ("features" in config.json).
//
// "features" beschreibt, WAS ein Spiel unterstützt — nicht was für ein Spiel
// es ist (das macht "type", siehe types.js) und nicht seinen Zustand (das
// macht "status", siehe statuses.js). Die drei sind bewusst getrennt:
//
//   type     = welche Art Spiel es ist        (genau eine, dauerhaft)
//   status   = Release-/Update-Zustand        (genau einer, oft befristet)
//   features = was das Spiel kann             (mehrere, dauerhaft)
//
// Diese Datei ist die EINZIGE Stelle, an der Fähigkeiten definiert werden. Die
// config.json eines Spiels enthält nur die ids (z.B. ["multiplayer","mobile"]),
// niemals den angezeigten Text und keine CSS-Klassen.
//
// Die Reihenfolge der Einträge hier ist gleichzeitig die ANZEIGE-Reihenfolge
// auf der Karte. Sie stammt bewusst NICHT aus der config.json: dadurch stehen
// gleiche Chips auf allen Karten an derselben Stelle, egal in welcher
// Reihenfolge ein Spiel sie einträgt.
//
// NEUE FÄHIGKEIT ERGÄNZEN: einen Eintrag hinzufügen, fertig. Anders als bei
// den Status braucht es dafür KEIN eigenes CSS — alle Chips sehen gleich aus.
// Ein Status ist eine Meldung und darf auffallen; eine Fähigkeit ist eine
// Sacheigenschaft und soll die Karte nicht dominieren.

export const GAME_FEATURES = {
  multiplayer: { label: "Multiplayer" },
  leaderboard: { label: "Online-Rangliste" },
  mobile: { label: "Mobil" },
  offline: { label: "Offline" },
};

// Höchstzahl der Chips je Karte. Begrenzt, weil eine Karte mit acht Chips
// nichts mehr aussagt — die Chips sollen die Kurzbeschreibung ergänzen oder
// ersetzen, nicht zu einer zweiten Merkmalsliste werden.
export const MAX_FEATURES_PER_GAME = 4;

// hasOwnProperty statt GAME_FEATURES[id], damit geerbte Object-Eigenschaften
// ("constructor", "toString", ...) aus einer fremden config.json nicht
// versehentlich als gültige Fähigkeit durchgehen.
export function getGameFeature(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(GAME_FEATURES, id) ? GAME_FEATURES[id] : null;
}

export function isKnownGameFeature(id) {
  return getGameFeature(id) !== null;
}

export function listGameFeatureIds() {
  return Object.keys(GAME_FEATURES);
}

/**
 * Bringt die Fähigkeiten eines Spiels in die zentrale Reihenfolge und wirft
 * dabei Unbekanntes und Doppeltes weg.
 *
 * Bewusst über die Reihenfolge von GAME_FEATURES statt über die Eingabe: so
 * ist das Ergebnis unabhängig davon, wie die config.json sortiert ist.
 *
 * @param {unknown} ids Rohe Liste aus einer config.json.
 * @returns {string[]}  Bekannte ids, ohne Duplikate, in Anzeige-Reihenfolge.
 */
export function orderGameFeatureIds(ids) {
  if (!Array.isArray(ids)) return [];
  const wanted = new Set(ids.filter((id) => typeof id === "string").map((id) => id.trim()));
  return listGameFeatureIds().filter((id) => wanted.has(id));
}
