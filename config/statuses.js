// Bekannte Veröffentlichungs-/Update-Status ("status" in config.json).
//
// "status" beschreibt den aktuellen Zustand eines Spiels — unabhängig davon,
// WAS für ein Spiel es ist (das macht "type", siehe types.js).
//
// Diese Datei ist die EINZIGE Stelle, an der Status definiert werden. Die
// config.json eines Spiels enthält nur die id (z.B. "beta"), niemals den
// angezeigten Text und niemals die CSS-Klasse.
//
// NEUEN STATUS ERGÄNZEN:
//   1. hier einen Eintrag mit label + badgeClass hinzufügen
//   2. in library.css eine passende .status-<name>-Regel ergänzen
//
// badge: false bedeutet bewusst "kein Badge anzeigen" — nicht "unbekannt".

export const GAME_STATUSES = {
  stable: { badge: false },
  new: { badge: true, label: "Neu", badgeClass: "status-new" },
  beta: { badge: true, label: "Beta", badgeClass: "status-beta" },
  updated: { badge: true, label: "Update", badgeClass: "status-update" },
};

// Wird verwendet, wenn ein Spiel gar keinen Status angibt. "stable" zeigt
// bewusst kein Badge — der Normalfall eines fertig veröffentlichten Spiels.
export const DEFAULT_STATUS = "stable";

// hasOwnProperty: siehe Kommentar in types.js.
export function getGameStatus(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(GAME_STATUSES, id) ? GAME_STATUSES[id] : null;
}

export function isKnownGameStatus(id) {
  return getGameStatus(id) !== null;
}

// Liefert { label, badgeClass } wenn ein Badge angezeigt werden soll, sonst
// null. Ein unbekannter Status liefert ebenfalls null (kein Badge) statt eines
// Fehlers — eine fehlerhafte Angabe soll die Karte nicht unbrauchbar machen.
export function getStatusBadge(id) {
  const status = getGameStatus(id);
  if (!status || !status.badge) return null;
  return { label: status.label, badgeClass: status.badgeClass };
}

export function listGameStatusIds() {
  return Object.keys(GAME_STATUSES);
}
