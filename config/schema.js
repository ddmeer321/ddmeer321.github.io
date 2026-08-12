// Validierung einer config.json.
//
// Wichtig: Config-Daten sind NIE vertrauenswürdig. Sie können später auch von
// fremden Entwicklern eingereicht werden. Diese Datei prüft deshalb jedes Feld
// einzeln, bevor irgendetwas davon in die Seite gelangt.
//
// Grundregeln:
//   - Pfade (entry, thumbnail) sind IMMER relativ zum Seiten-Root
//     ("snake.html", "games/foo/bild.png") — keine absoluten URLs, kein "..",
//     kein "javascript:"/"data:".
//   - Fehler (errors) = Spiel wird übersprungen, der Rest der Seite lädt normal.
//   - Warnungen (warnings) = Spiel wird angezeigt, ein Detail wird ignoriert.
//
// Diese Datei enthält bewusst KEIN DOM und KEINE Anzeige-Logik, damit sie
// später auch in einem Prüfskript (z.B. für Uploads) genutzt werden kann.

import { isKnownGameType, listGameTypeIds } from "./types.js";
import { isKnownGameStatus, DEFAULT_STATUS } from "./statuses.js";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Erlaubt nur harmlose Pfadzeichen. Doppelpunkt ist damit ausgeschlossen, also
// auch "javascript:", "data:" und "https://".
const SAFE_PATH_RE = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const ENTRY_EXT_RE = /\.html?$/i;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|gif|avif|svg)$/i;
// Emoji/Symbol als Platzhalter, wenn ein Spiel kein Bild hat. Bewusst kurz
// begrenzt, damit hier kein ganzer Text landen kann.
const MAX_ICON_LENGTH = 8;

const MAX_LENGTHS = {
  name: 80,
  description: 400,
  author: 60,
  thumbnailAlt: 200,
  path: 200,
};

const ALLOWED_FIELDS = [
  "id",
  "name",
  "type",
  "status",
  "statusUntil",
  "version",
  "author",
  "description",
  "thumbnail",
  "thumbnailAlt",
  "icon",
  "entry",
];

function isPlainString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Echtes Kalenderdatum im Format YYYY-MM-DD. Der Rückweg über toISOString()
// fängt Angaben wie "2026-02-30" oder "2026-13-01" ab, die das Format zwar
// erfüllen, aber keinen existierenden Tag bezeichnen.
function isRealISODate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Prüft einen Pfad relativ zum Seiten-Root auf Ausbruchsversuche und Schemata.
export function isSafeRelativePath(value) {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (!path || path.length > MAX_LENGTHS.path) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false; // absolute Pfade
  if (path.includes("\\")) return false; // Windows-Trenner
  if (path.includes(":")) return false; // javascript:, data:, https://
  if (path.includes("..")) return false; // Ausbruch aus dem Repo
  return SAFE_PATH_RE.test(path);
}

/**
 * Prüft eine eingelesene config.json.
 *
 * @param {unknown} raw    Der geparste Inhalt der config.json.
 * @param {string}  source Herkunft (nur für verständliche Fehlermeldungen).
 * @returns {{ ok: boolean, game: object|null, errors: string[], warnings: string[] }}
 *          Bei ok === true ist `game` ein bereinigtes, sicher verwendbares Objekt.
 */
export function validateGameConfig(raw, source = "config.json") {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, game: null, errors: [`${source}: kein gültiges JSON-Objekt.`], warnings };
  }

  // Unbekannte Felder sind kein Fehler (Configs dürfen künftig mehr enthalten,
  // z.B. releasedAt/changelog), werden hier aber gemeldet und nicht übernommen.
  Object.keys(raw).forEach((key) => {
    if (!ALLOWED_FIELDS.includes(key)) {
      warnings.push(`${source}: unbekanntes Feld "${key}" wird ignoriert.`);
    }
  });

  // --- Pflichtfelder ---------------------------------------------------

  const id = isPlainString(raw.id) ? raw.id.trim() : "";
  if (!id) {
    errors.push(`${source}: "id" fehlt.`);
  } else if (!ID_RE.test(id)) {
    errors.push(`${source}: "id" ist ungültig ("${id}") — erlaubt sind a-z, 0-9 und Bindestrich.`);
  }

  const name = isPlainString(raw.name) ? raw.name.trim() : "";
  if (!name) {
    errors.push(`${source}: "name" fehlt.`);
  } else if (name.length > MAX_LENGTHS.name) {
    errors.push(`${source}: "name" ist zu lang (max. ${MAX_LENGTHS.name} Zeichen).`);
  }

  const type = isPlainString(raw.type) ? raw.type.trim() : "";
  if (!type) {
    errors.push(`${source}: "type" fehlt.`);
  } else if (!isKnownGameType(type)) {
    errors.push(`${source}: unbekannter "type" ("${type}") — bekannt sind: ${listGameTypeIds().join(", ")}.`);
  }

  const entry = isPlainString(raw.entry) ? raw.entry.trim() : "";
  if (!entry) {
    errors.push(`${source}: "entry" fehlt.`);
  } else if (!isSafeRelativePath(entry)) {
    errors.push(`${source}: "entry" ist kein erlaubter relativer Pfad ("${entry}").`);
  } else if (!ENTRY_EXT_RE.test(entry)) {
    errors.push(`${source}: "entry" muss auf .html enden ("${entry}").`);
  }

  // --- Optionale Felder ------------------------------------------------

  // Unbekannter Status ist bewusst nur eine Warnung: das Spiel bleibt sichtbar,
  // es wird lediglich kein Badge angezeigt.
  let status = DEFAULT_STATUS;
  if (raw.status !== undefined && raw.status !== null && raw.status !== "") {
    if (!isPlainString(raw.status)) {
      warnings.push(`${source}: "status" ist kein Text und wird ignoriert.`);
    } else if (!isKnownGameStatus(raw.status.trim())) {
      warnings.push(`${source}: unbekannter "status" ("${raw.status}") — es wird kein Badge angezeigt.`);
      status = raw.status.trim(); // getStatusBadge() liefert dafür null
    } else {
      status = raw.status.trim();
    }
  }

  // Ablaufdatum des Badges. Fehlt es, bleibt der Status dauerhaft sichtbar.
  // Ein ungültiges Datum wird ignoriert (Badge bleibt), statt das Spiel zu
  // verwerfen — ein Tippfehler im Datum soll kein Spiel unsichtbar machen.
  let statusUntil = null;
  if (raw.statusUntil !== undefined && raw.statusUntil !== null && raw.statusUntil !== "") {
    if (isRealISODate(typeof raw.statusUntil === "string" ? raw.statusUntil.trim() : raw.statusUntil)) {
      statusUntil = raw.statusUntil.trim();
    } else {
      warnings.push(`${source}: "statusUntil" ist kein gültiges Datum im Format JJJJ-MM-TT und wird ignoriert.`);
    }
  }

  let version = null;
  if (raw.version !== undefined && raw.version !== null && raw.version !== "") {
    if (isPlainString(raw.version) && VERSION_RE.test(raw.version.trim())) {
      version = raw.version.trim();
    } else {
      warnings.push(`${source}: "version" ist keine gültige Versionsnummer (z.B. "1.0.0") und wird ignoriert.`);
    }
  }

  let author = null;
  if (raw.author !== undefined && raw.author !== null && raw.author !== "") {
    if (isPlainString(raw.author) && raw.author.trim().length <= MAX_LENGTHS.author) {
      author = raw.author.trim();
    } else {
      warnings.push(`${source}: "author" ist ungültig oder zu lang und wird ignoriert.`);
    }
  }

  let description = "";
  if (raw.description !== undefined && raw.description !== null && raw.description !== "") {
    if (isPlainString(raw.description) && raw.description.trim().length <= MAX_LENGTHS.description) {
      description = raw.description.trim();
    } else {
      warnings.push(`${source}: "description" ist ungültig oder zu lang und wird ignoriert.`);
    }
  }

  let thumbnail = null;
  if (raw.thumbnail !== undefined && raw.thumbnail !== null && raw.thumbnail !== "") {
    if (!isSafeRelativePath(raw.thumbnail)) {
      warnings.push(`${source}: "thumbnail" ist kein erlaubter relativer Pfad und wird ignoriert.`);
    } else if (!IMAGE_EXT_RE.test(raw.thumbnail.trim())) {
      warnings.push(`${source}: "thumbnail" ist keine Bilddatei und wird ignoriert.`);
    } else {
      thumbnail = raw.thumbnail.trim();
    }
  }

  let thumbnailAlt = "";
  if (raw.thumbnailAlt !== undefined && raw.thumbnailAlt !== null && raw.thumbnailAlt !== "") {
    if (isPlainString(raw.thumbnailAlt) && raw.thumbnailAlt.trim().length <= MAX_LENGTHS.thumbnailAlt) {
      thumbnailAlt = raw.thumbnailAlt.trim();
    } else {
      warnings.push(`${source}: "thumbnailAlt" ist ungültig oder zu lang und wird ignoriert.`);
    }
  }

  let icon = null;
  if (raw.icon !== undefined && raw.icon !== null && raw.icon !== "") {
    if (isPlainString(raw.icon) && [...raw.icon.trim()].length <= MAX_ICON_LENGTH) {
      icon = raw.icon.trim();
    } else {
      warnings.push(`${source}: "icon" ist ungültig oder zu lang und wird ignoriert.`);
    }
  }

  if (errors.length) {
    return { ok: false, game: null, errors, warnings };
  }

  // Bewusst ein NEUES Objekt: nur geprüfte Felder gelangen weiter, alles
  // andere aus der Original-Config bleibt draußen.
  return {
    ok: true,
    errors,
    warnings,
    game: {
      id,
      name,
      type,
      status,
      statusUntil,
      version,
      author,
      description,
      thumbnail,
      thumbnailAlt,
      icon,
      entry,
    },
  };
}
