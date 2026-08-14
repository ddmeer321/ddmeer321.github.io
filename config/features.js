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
// NEUE FÄHIGKEIT ERGÄNZEN: einen Eintrag hinzufügen und einen der unten
// definierten Farbtöne wählen — fertig. Anders als bei den Status braucht es
// dafür KEIN eigenes CSS: die Farbtöne sind ein fester, kleiner Vorrat, keine
// Farbe je Fähigkeit. Dadurch bleiben die Karten ruhig, auch wenn irgendwann
// zehn Fähigkeiten existieren.
//
// Die Chips sind bewusst nur eingefärbt (heller Grund, kräftige Schrift),
// während Status-Badges eine Vollfläche bekommen: ein Status ist eine Meldung
// und darf auffallen, eine Fähigkeit ist eine Sacheigenschaft und soll die
// Karte nicht dominieren.

// Erlaubte Farbtöne. Jeder hat in assets/css/library.css eine
// .tint-<name>-Regel; ein unbekannter Wert fällt auf "neutral" zurück.
export const FEATURE_TINTS = ["purple", "pink", "amber", "teal", "neutral"];
export const DEFAULT_FEATURE_TINT = "neutral";

export const GAME_FEATURES = {
  multiplayer: { label: "Multiplayer", tint: "pink" },
  leaderboard: { label: "Online-Rangliste", tint: "amber" },
  mobile: { label: "Mobil", tint: "teal" },
  offline: { label: "Offline", tint: "neutral" },
};

// Farbton einer Fähigkeit, abgesichert gegen Tippfehler in dieser Datei.
// Der Rückgabewert landet als CSS-Klasse im DOM — deshalb wird er gegen die
// bekannte Liste geprüft und nicht einfach durchgereicht.
export function getFeatureTint(id) {
  const feature = getGameFeature(id);
  const tint = feature && typeof feature.tint === "string" ? feature.tint : "";
  return FEATURE_TINTS.includes(tint) ? tint : DEFAULT_FEATURE_TINT;
}

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
