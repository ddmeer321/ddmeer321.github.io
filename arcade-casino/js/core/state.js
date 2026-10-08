// Spielstand: Aufbau, Validierung beim Laden und Speichern.
//
// Der Stand liegt im Browser (localStorage); angemeldete Spieler bekommen
// zusätzlich eine Kopie in der Cloud (core/cloud.js). Er wird beim Laden
// streng bereinigt (keine NaN-/negativen Werte, keine fremden Typen), ist aber
// NICHT gegen absichtliche Manipulation durch den Benutzer geschützt – wer die
// Entwicklerwerkzeuge öffnet, kann sein Spielgeld ändern. Da es sich nur um
// virtuelles Spielgeld ohne jeden realen Wert handelt, ist das bewusst akzeptiert.

import { readJSON, writeJSON } from "./storage.js";
import { defaultControl, sanitizeControl } from "./control.js";
import { sanitizeChallenges } from "./challenges.js";
import { defaultJukebox, sanitizeJukebox } from "./jukebox.js";
import { defaultLotto, sanitizeLotto } from "./lotto.js";
import { defaultInbox, sanitizeInbox } from "./inbox.js";

// Der Schlüssel behält bewusst seinen alten Namen, damit V1.0-Spielstände
// gefunden und migriert werden. Die Schema-Version steht im Feld `v`.
// Der Testbereich (test-claude/) liegt auf derselben Domain und damit im selben
// localStorage – er bekommt einen eigenen Schlüssel, damit Test-Fortschritt nie
// im echten Spielstand (und über die Cloud in einem echten Konto) landet.
const IN_TEST_AREA = typeof location !== "undefined" && location.pathname.includes("/test-claude/");
export const SAVE_KEY = IN_TEST_AREA ? "neonpalast.save.test" : "neonpalast.save.v1";
export const SAVE_VERSION = 3;
export const START_BALANCE = 1000;
export const MAX_BALANCE = 999_999_999;

export function defaultSettings() {
  return {
    master: 0.8,
    sfx: 0.9,
    ambience: 0.35,
    music: 0.6,
    vibration: true,
    audioHaptics: true,
    motion: "auto", // auto | reduced | full
    theme: "neon",
  };
}

export function defaultState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    createdAt: now,
    balance: START_BALANCE,
    xp: 0,
    lastDaily: 0,
    lastRefill: 0,
    refills: 0,
    settings: defaultSettings(),
    stats: {
      rounds: 0,
      wagered: 0,
      won: 0,
      biggestWin: 0,
      bonus: 0,
      spent: 0,
      perGame: {},
    },
    bests: {},
    achievements: {},
    counters: {},
    games: {},
    control: defaultControl(),
    challenges: { day: "", items: [], bonus: false },
    // Cloud-Abgleich: zu welchem Konto gehört dieser Stand, wann zuletzt gespeichert
    cloud: { owner: null, savedAt: 0 },
    jukebox: defaultJukebox(),
    lotto: defaultLotto(),
    inbox: defaultInbox(),
  };
}

/**
 * Hebt ältere Spielstände schrittweise auf die aktuelle Version.
 * v1 → v2: neue Bereiche (Spielkontrolle, Challenges); Lichtwirbel-Daten der
 * alten Einzelstopp-Version werden verworfen (Spiel ist neu aufgebaut).
 */
export function migrateState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const out = { ...raw };
  const v = Number.isInteger(out.v) ? out.v : 1;
  if (v < 2) {
    const games = out.games && typeof out.games === "object" ? { ...out.games } : {};
    delete games.cyclone;
    out.games = games;
    out.control = defaultControl();
    out.challenges = { day: "", items: [], bonus: false };
    out.migratedFrom = 1;
  }
  if (v < 3) {
    // v2 → v3 (V1.2): Jukebox, Lotto und Posteingang kommen leer dazu.
    // „Gesunde Pause“ war ein Erfolg fürs Pausieren – Pausen sollen nicht
    // gamifiziert werden, der Erfolg entfällt (bereits erhaltene XP bleiben).
    const ach = out.achievements && typeof out.achievements === "object" ? { ...out.achievements } : {};
    delete ach["break-taken"];
    out.achievements = ach;
    out.jukebox = defaultJukebox();
    out.lotto = defaultLotto();
    out.inbox = defaultInbox();
    out.migratedFrom = out.migratedFrom || 2;
  }
  out.v = SAVE_VERSION;
  return out;
}

// ---------- Bereinigung ----------

function int(v, def, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof v !== "number" || !Number.isFinite(v)) return def;
  const n = Math.trunc(v);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function num(v, def, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}

function bool(v, def) {
  return typeof v === "boolean" ? v : def;
}

function oneOf(v, list, def) {
  return list.includes(v) ? v : def;
}

function plainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function intMap(obj, max = Number.MAX_SAFE_INTEGER) {
  const out = {};
  for (const [k, val] of Object.entries(plainObject(obj))) {
    if (typeof k !== "string" || k.length > 64) continue;
    const n = int(val, null, 0, max);
    if (n !== null) out[k] = n;
  }
  return out;
}

export const THEMES = ["neon", "sunset", "ocean", "jungle", "royal"];

/** Macht aus beliebigen (evtl. kaputten/manipulierten) Daten einen gültigen Stand. */
export function sanitizeState(raw, now = Date.now()) {
  const def = defaultState(now);
  const src = plainObject(migrateState(raw));
  if (!Object.keys(src).length) return def;

  const s = plainObject(src.settings);
  const st = plainObject(src.stats);
  const perGame = {};
  for (const [id, g] of Object.entries(plainObject(st.perGame))) {
    if (!/^[a-z0-9-]{1,32}$/.test(id)) continue;
    const pg = plainObject(g);
    perGame[id] = {
      rounds: int(pg.rounds, 0),
      wagered: int(pg.wagered, 0),
      won: int(pg.won, 0),
      biggestWin: int(pg.biggestWin, 0),
    };
  }

  return {
    v: SAVE_VERSION,
    createdAt: int(src.createdAt, def.createdAt, 0),
    balance: int(src.balance, START_BALANCE, 0, MAX_BALANCE),
    xp: int(src.xp, 0, 0, 1e12),
    lastDaily: int(src.lastDaily, 0, 0),
    lastRefill: int(src.lastRefill, 0, 0),
    refills: int(src.refills, 0, 0),
    settings: {
      master: num(s.master, def.settings.master, 0, 1),
      sfx: num(s.sfx, def.settings.sfx, 0, 1),
      ambience: num(s.ambience, def.settings.ambience, 0, 1),
      music: num(s.music, def.settings.music, 0, 1),
      vibration: bool(s.vibration, def.settings.vibration),
      audioHaptics: bool(s.audioHaptics, def.settings.audioHaptics),
      motion: oneOf(s.motion, ["auto", "reduced", "full"], "auto"),
      theme: oneOf(s.theme, THEMES, "neon"),
    },
    stats: {
      rounds: int(st.rounds, 0),
      wagered: int(st.wagered, 0),
      won: int(st.won, 0),
      biggestWin: int(st.biggestWin, 0),
      bonus: int(st.bonus, 0),
      spent: int(st.spent, 0),
      perGame,
    },
    bests: intMap(src.bests),
    achievements: intMap(src.achievements),
    counters: intMap(src.counters),
    // Spielspezifische Daten werden von den Spielen selbst geprüft.
    games: plainObject(src.games),
    control: sanitizeControl(src.control),
    challenges: sanitizeChallenges(src.challenges),
    jukebox: sanitizeJukebox(src.jukebox),
    lotto: sanitizeLotto(src.lotto),
    inbox: sanitizeInbox(src.inbox),
    cloud: sanitizeCloudMeta(src.cloud),
  };
}

/** Konto-Bindung des Stands (Supabase-User-ID) und Zeitpunkt der letzten Speicherung. */
export function sanitizeCloudMeta(raw) {
  const c = plainObject(raw);
  const owner = typeof c.owner === "string" && /^[0-9a-f-]{36}$/i.test(c.owner) ? c.owner.toLowerCase() : null;
  return { owner, savedAt: int(c.savedAt, 0, 0) };
}

// ---------- Laufzeit-Instanz ----------

let state = null;
let saveTimer = 0;
let canWrite = () => true;
let afterSave = () => {};

export function setWriteGuard(fn) {
  canWrite = fn;
}

/** Wird nach jedem erfolgreichen lokalen Speichern aufgerufen (Cloud-Abgleich). */
export function setAfterSave(fn) {
  afterSave = typeof fn === "function" ? fn : () => {};
}

export function loadState() {
  state = sanitizeState(readJSON(SAVE_KEY));
  return state;
}

export function getState() {
  if (!state) loadState();
  return state;
}

/** Ersetzt den Stand (z. B. nach Übernahme aus einem anderen Tab). */
export function replaceState(next) {
  state = sanitizeState(next);
  return state;
}

export function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!state || !canWrite()) return false;
  state.cloud.savedAt = Math.max(Date.now(), state.cloud.savedAt + 1);
  const ok = writeJSON(SAVE_KEY, state);
  if (ok) afterSave(state);
  return ok;
}

/** Speichert gebündelt (mehrere Änderungen kurz hintereinander = ein Schreibvorgang). */
export function saveSoon(delay = 250) {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, delay);
}

export function resetState() {
  const keepSettings = state?.settings;
  // Spielkontrolle (Pause/Auszeit) überlebt einen Reset bewusst.
  const keepControl = state?.control;
  const keepOwner = state?.cloud?.owner || null;
  state = defaultState();
  if (keepSettings) state.settings = keepSettings;
  if (keepControl) state.control = keepControl;
  // Der Stand gehört weiter demselben Konto – der Reset wird auch in der Cloud wirksam.
  state.cloud.owner = keepOwner;
  saveNow();
  return state;
}

/** Spielspezifischer Speicherbereich. */
export function gameData(id) {
  const s = getState();
  if (!s.games[id] || typeof s.games[id] !== "object") s.games[id] = {};
  return s.games[id];
}
