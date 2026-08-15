// Bekannte Fähigkeiten und Hinweise eines Spiels ("features" in config.json).
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
// ZWEI SORTEN VON CHIPS
//
//   Fähigkeit (Vorgabe)  "was das Spiel kann"        — z.B. „Multiplayer"
//   Hinweis (caveat)     "wofür es eher nicht ist"   — z.B. „Nicht fürs Handy"
//
// Hinweise sind keine Fehler und kein Mangel: sie ersparen dem Besucher die
// Enttäuschung, ein Spiel auf einem Gerät zu öffnen, für das es nie gedacht
// war. Sie stehen immer HINTER den Fähigkeiten und tragen als einzige einen
// roten Ton.
//
// FARBE
//
// Rot ist ausschließlich für Hinweise reserviert und lässt sich für eine
// Fähigkeit gar nicht erst auswählen — der Ton eines Hinweises kommt aus
// CAVEAT_TINT, nicht aus dem Eintrag. Dadurch bleibt die Bedeutung von Rot auf
// der ganzen Seite eindeutig: rot heißt „aufpassen", nie bloß „bunt".
//
// Die Farbe steht deshalb nie allein: der Text eines Hinweises ist immer schon
// für sich verneinend formuliert („Nicht fürs Handy"), damit die Aussage auch
// ohne Farbwahrnehmung ankommt.
//
// NEUEN EINTRAG ERGÄNZEN
//   Fähigkeit: Zeile hinzufügen, einen vorhandenen Farbton wählen — fertig.
//   Hinweis:   Zeile hinzufügen mit kind: "caveat", KEIN tint. Der Text muss
//              die Einschränkung selbst benennen, nicht nur das Gerät.
// Eigenes CSS ist in beiden Fällen nicht nötig.
//
// Die Chips sind bewusst nur eingefärbt (heller Grund, kräftige Schrift),
// während Status-Badges eine Vollfläche bekommen: ein Status ist eine Meldung
// und darf auffallen, eine Fähigkeit ist eine Sacheigenschaft und soll die
// Karte nicht dominieren.

// Farbtöne, die eine FÄHIGKEIT wählen darf. Rot fehlt hier absichtlich.
export const FEATURE_TINTS = ["purple", "amber", "teal", "neutral"];
export const DEFAULT_FEATURE_TINT = "neutral";

// Fester Ton aller Hinweise — nicht wählbar, damit Rot seine Bedeutung behält.
export const CAVEAT_TINT = "rose";

// Reihenfolge in dieser Datei = Reihenfolge auf der Karte (Fähigkeiten zuerst,
// Hinweise danach — das erzwingt orderGameFeatureIds unabhängig davon, wo ein
// Eintrag hier steht).
export const GAME_FEATURES = {
  // --- Wie man spielt ---
  // "multiplayer" heißt online, "local-multiplayer" zu zweit am selben Gerät.
  // Der Unterschied ist für den Besucher der entscheidende: das eine braucht
  // einen zweiten Menschen mit eigenem Gerät, das andere nur jemanden neben dir.
  // Reihenfolge = aufsteigend nach Zahl der Menschen: allein gegen den
  // Computer, zu zweit nebeneinander, online gegen Fremde. So wie die Spiele
  // ihre Modi auch im eigenen Menü anbieten.
  bot: { label: "Gegen Bot", tint: "purple" },
  "local-multiplayer": { label: "Zu zweit", tint: "purple" },
  multiplayer: { label: "Multiplayer", tint: "purple" },

  // --- Was drin steckt ---
  // "leaderboard" ist die ECHTE Online-Rangliste (Werte anderer Spieler über
  // einen Server). "highscore" ist die Bestenliste des eigenen Geräts. Der
  // Unterschied ist keine Wortklauberei: Snake speichert seine fünf besten
  // Runden ausschließlich lokal — dort „Online-Rangliste" zu behaupten, wäre
  // schlicht falsch.
  leaderboard: { label: "Online-Rangliste", tint: "amber" },
  highscore: { label: "Bestenliste", tint: "amber" },
  skins: { label: "Skins", tint: "amber" },

  // Geräte absteigend nach Bildschirmgröße, damit sie auf der Karte immer in
  // derselben Reihe stehen.
  pc: { label: "PC", tint: "teal" },
  tablet: { label: "Tablet", tint: "teal" },
  mobile: { label: "Mobil", tint: "teal" },
  offline: { label: "Offline", tint: "neutral" },

  // --- Hinweise ---
  // "unfertig", nicht "nicht dafür gedacht": Neon Bot Arena ist ausdrücklich
  // auch fürs Handy gebaut (es hat Touch-Steuerung samt Geräteauswahl), das
  // Layout ist dort nur noch nicht gut. Siehe ROADMAP.md.
  "mobile-wip": { label: "Am Handy unfertig", kind: "caveat" },
};

// Höchstzahl der Chips je Karte, getrennt gezählt. Getrennt, weil sonst ein
// Spiel mit vielen Fähigkeiten seinen Hinweis verlieren könnte — und der ist
// die wichtigere der beiden Angaben.
export const MAX_FEATURES_PER_GAME = 4;
export const MAX_CAVEATS_PER_GAME = 2;

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

export function isCaveatFeature(id) {
  return getGameFeature(id)?.kind === "caveat";
}

export function listGameFeatureIds() {
  return Object.keys(GAME_FEATURES);
}

// Farbton eines Eintrags, abgesichert gegen Tippfehler in dieser Datei.
// Der Rückgabewert landet als CSS-Klasse im DOM — deshalb wird er gegen die
// bekannten Werte geprüft und nicht einfach durchgereicht.
export function getFeatureTint(id) {
  if (isCaveatFeature(id)) return CAVEAT_TINT;
  const feature = getGameFeature(id);
  const tint = feature && typeof feature.tint === "string" ? feature.tint : "";
  return FEATURE_TINTS.includes(tint) ? tint : DEFAULT_FEATURE_TINT;
}

/**
 * Bringt die Angaben eines Spiels in die zentrale Reihenfolge und wirft dabei
 * Unbekanntes und Doppeltes weg.
 *
 * Erst alle Fähigkeiten, dann alle Hinweise — jeweils in der Reihenfolge
 * dieser Datei. Bewusst nicht in der Reihenfolge der config.json: so ist das
 * Ergebnis unabhängig davon, wie ein Spiel seine Liste sortiert, und ein
 * Hinweis rutscht nie zwischen die Fähigkeiten.
 *
 * @param {unknown} ids Rohe Liste aus einer config.json.
 * @returns {string[]}  Bekannte ids, ohne Duplikate, in Anzeige-Reihenfolge.
 */
export function orderGameFeatureIds(ids) {
  if (!Array.isArray(ids)) return [];
  const wanted = new Set(ids.filter((id) => typeof id === "string").map((id) => id.trim()));
  const known = listGameFeatureIds().filter((id) => wanted.has(id));
  return [...known.filter((id) => !isCaveatFeature(id)), ...known.filter(isCaveatFeature)];
}
