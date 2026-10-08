// Cloud-Spielstand für angemeldete Spieler.
//
// Neonpalast speichert immer zuerst lokal (localStorage). Wer auf der
// Spielebibliothek angemeldet ist und die Cloud-Speicherung im Profil nicht
// ausgeschaltet hat, bekommt zusätzlich eine Kopie in Supabase (Tabelle
// game_saves, über die gemeinsame Schicht window.CloudSave aus
// assets/js/cloud-save.js – dieselbe wie bei Snake und Cursor Clicker).
//
// Grundsätze
// * Ohne gespeicherte Anmeldung lädt Neonpalast NICHTS aus dem Netz – auch
//   nicht das Supabase-SDK. Nicht angemeldete Spieler bleiben komplett lokal.
// * Der Abgleich passiert einmal beim Start (höchstens CONNECT_TIMEOUT_MS).
//   Kommt die Antwort zu spät, wird sie verworfen: Ein verspäteter Cloud-Stand
//   darf nie Spielzüge überschreiben, die danach lokal gemacht wurden.
// * Der Stand ist an ein Konto gebunden (cloud.owner). Der Fortschritt eines
//   Kontos wird nie in ein anderes Konto kopiert.
// * Spielkontrolle (Pause/Auszeit) wird nie durch einen Abgleich verkürzt:
//   Es gilt immer die strengere Sperre aus lokalem und Cloud-Stand.
// * Der Testbereich speichert unter einer eigenen game_id und kann so nie
//   einen echten Spielstand überschreiben; auf localhost gibt es keine Cloud.
//
// Grenze (bewusst akzeptiert): Wie lokal gilt der Cloud-Stand dem Client – wer
// seine eigene Zeile in game_saves mit Entwicklerwerkzeugen ändert, ändert
// sein eigenes Spielgeld. Es ist virtuelles Spielgeld ohne jeden Wert.

import { sanitizeControl } from "./control.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
export const IS_TEST_AREA = typeof location !== "undefined" && location.pathname.includes("/test-claude/");
export const CLOUD_GAME_ID = IS_TEST_AREA ? "arcade-casino-test" : "arcade-casino";
export const CONNECT_TIMEOUT_MS = 4000;
/** Hochladen gebündelt: frühestens so lange nach der letzten Änderung … */
export const UPLOAD_DEBOUNCE_MS = 3000;
/** … aber spätestens nach dieser Zeit, auch wenn ständig gespielt wird. */
export const UPLOAD_MAX_WAIT_MS = 15000;

const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
const SITE_SCRIPTS = ["/assets/js/supabase-client.js", "/assets/js/cloud-save.js?v=1"];

/** Liegt eine Supabase-Sitzung der Spielebibliothek im Browser? (rein lokal, kein Netz) */
export function hasStoredSession(storage) {
  try {
    const st = storage || window.localStorage;
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (k && /^sb-[a-z0-9]+-auth-token$/.test(k)) return true;
    }
  } catch {
    /* gesperrter Speicher = keine Sitzung */
  }
  return false;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false; // Reihenfolge: SDK → Client → CloudSave
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Skript nicht geladen: ${src}`));
    document.head.append(el);
  });
}

async function ensureCloudSave() {
  if (window.CloudSave) return window.CloudSave; // z. B. von Tests bereitgestellt
  if (LOCAL_HOSTS.includes(location.hostname)) return null;
  if (!hasStoredSession()) return null;
  if (!window.supabase) await loadScript(SDK_URL);
  if (!window.supabaseClient) await loadScript(SITE_SCRIPTS[0]);
  if (!window.CloudSave) await loadScript(SITE_SCRIPTS[1]);
  return window.CloudSave || null;
}

/**
 * Verbindet beim Start. Rückgabe:
 *   { status: "off" }                       – kein Konto/keine Cloud (lokal spielen)
 *   { status: "timeout" | "error" }          – Cloud gerade nicht erreichbar (lokal spielen)
 *   { status: "ready", api, owner, data }    – angemeldet; data = Cloud-Stand oder null
 */
export async function connectCloud({ timeout = CONNECT_TIMEOUT_MS } = {}) {
  let timer;
  const work = (async () => {
    const api = await ensureCloudSave();
    if (!api) return { status: "off" };
    const owner = await api.ready();
    if (!owner) return { status: "off", signedIn: hasStoredSession() };
    const data = await api.load(CLOUD_GAME_ID);
    return { status: "ready", api, owner: String(owner).toLowerCase(), data: data && typeof data === "object" ? data : null };
  })().catch((err) => {
    console.warn("[cloud] Verbindung fehlgeschlagen", err);
    return { status: "error" };
  });
  const late = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ status: "timeout" }), timeout);
  });
  const result = await Promise.race([work, late]);
  clearTimeout(timer);
  return result;
}

// ---------- Entscheidung beim Start (rein, testbar) ----------

/** Hat dieser Stand schon echten Fortschritt (mehr als ein frischer Start)? */
export function hasProgress(s) {
  if (!s) return false;
  const st = s.stats || {};
  return (st.rounds || 0) > 0 || (st.wagered || 0) > 0 || (st.spent || 0) > 0 || (s.xp || 0) > 0 || Object.keys(s.lotto?.draws || {}).length > 0 || Object.keys(s.lotto?.tickets || {}).length > 0;
}

/** Die strengere Spielkontrolle aus zwei Ständen: Sperren werden nie verkürzt. */
export function mergeControl(a, b) {
  const x = sanitizeControl(a);
  const y = sanitizeControl(b);
  return {
    pauseUntil: Math.max(x.pauseUntil, y.pauseUntil),
    excludeUntil: Math.max(x.excludeUntil, y.excludeUntil),
    remindMin: x.remindMin, // Erinnerung ist eine Komfort-Einstellung dieses Geräts
    lastBlockStart: Math.max(x.lastBlockStart, y.lastBlockStart),
  };
}

/**
 * Entscheidet, mit welchem Stand gespielt wird.
 * @param {object} local  bereinigter lokaler Stand (mit local.cloud = {owner, savedAt})
 * @param {object|null} cloud  bereinigter Cloud-Stand oder null
 * @param {string} owner  angemeldetes Konto
 * @returns {{use: "local"|"cloud"|"fresh"|"ask", reason: string}}
 *   local  – lokalen Stand behalten und hochladen
 *   cloud  – Cloud-Stand übernehmen
 *   fresh  – neu anfangen (lokaler Stand gehört einem anderen Konto, Cloud leer)
 *   ask    – beide Stände haben Fortschritt und keiner ist eindeutig: Spieler fragen
 */
export function decideBoot(local, cloud, owner) {
  const localOwner = local?.cloud?.owner || null;
  if (!cloud) {
    if (localOwner && localOwner !== owner) return { use: "fresh", reason: "lokaler Stand gehört einem anderen Konto" };
    return { use: "local", reason: "noch kein Cloud-Stand" };
  }
  if (localOwner === owner) {
    return (cloud.cloud?.savedAt || 0) > (local.cloud?.savedAt || 0) ? { use: "cloud", reason: "Cloud-Stand ist neuer" } : { use: "local", reason: "lokaler Stand ist neuer" };
  }
  if (localOwner && localOwner !== owner) return { use: "cloud", reason: "lokaler Stand gehört einem anderen Konto" };
  // lokaler Stand ohne Konto (vor dem Anmelden gespielt)
  if (!hasProgress(local)) return { use: "cloud", reason: "lokal noch kein Fortschritt" };
  if (!hasProgress(cloud)) return { use: "local", reason: "Cloud-Stand ohne Fortschritt" };
  return { use: "ask", reason: "beide Stände haben Fortschritt" };
}

/** Kurzbeschreibung eines Stands für den Auswahldialog. */
export function summarize(s) {
  const st = s?.stats || {};
  return { balance: s?.balance ?? 0, xp: s?.xp ?? 0, rounds: st.rounds || 0, savedAt: s?.cloud?.savedAt || 0 };
}

// ---------- Hochladen ----------

/**
 * Lädt Änderungen gebündelt hoch (höchstens eine Anfrage gleichzeitig, immer
 * der neueste Stand). Lokal ist vorher schon gespeichert – scheitert die Cloud,
 * geht nichts verloren; der nächste Start lädt den neueren lokalen Stand hoch.
 */
export function createUploader({ api, getState, canWrite = () => true, onStatus = () => {}, debounce = UPLOAD_DEBOUNCE_MS, maxWait = UPLOAD_MAX_WAIT_MS, now = () => Date.now() }) {
  let timer = 0;
  let firstPending = 0;
  let inFlight = null;
  let again = false;
  let lastOk = 0;

  async function send() {
    timer = 0;
    firstPending = 0;
    if (!canWrite()) return false;
    if (inFlight) {
      again = true;
      return inFlight;
    }
    const snapshot = JSON.parse(JSON.stringify(getState()));
    onStatus({ state: "saving" });
    inFlight = Promise.resolve()
      .then(() => api.save(CLOUD_GAME_ID, snapshot))
      .catch(() => false)
      .then((ok) => {
        inFlight = null;
        if (ok) lastOk = now();
        onStatus({ state: ok ? "saved" : "error", at: lastOk });
        if (again) {
          again = false;
          schedule();
        }
        return ok;
      });
    return inFlight;
  }

  function schedule() {
    const t = now();
    if (!firstPending) firstPending = t;
    clearTimeout(timer);
    const wait = Math.max(0, Math.min(debounce, firstPending + maxWait - t));
    timer = setTimeout(send, wait);
  }

  return {
    schedule,
    /** Sofort hochladen (Tab wird verlassen). */
    flush() {
      if (!timer && !again) return inFlight || Promise.resolve(true);
      clearTimeout(timer);
      return send();
    },
    pending: () => Boolean(timer || inFlight),
    lastSavedAt: () => lastOk,
  };
}

// ---------- Sicherung des ersetzten Stands ----------
//
// Wird beim Abgleich ein Stand mit Fortschritt ersetzt (Auswahldialog oder
// Stand eines anderen Kontos), bleibt er als Sicherung im Browser liegen.
// Gesichert wird nur bei solchen Konflikten – nicht beim normalen Wechsel
// zwischen Geräten, sonst stünde dort ständig ein veralteter Stand.

export const BACKUP_VERSION = 1;

/** Sicherungs-Datensatz für einen ersetzten Stand (oder null ohne Fortschritt). */
export function makeBackup(state, reason, now = Date.now()) {
  if (!state || !hasProgress(state)) return null;
  return { bv: BACKUP_VERSION, at: now, reason: String(reason || "").slice(0, 80), owner: state.cloud?.owner || null, state: JSON.parse(JSON.stringify(state)) };
}

/** Prüft einen gespeicherten Datensatz (Schutz vor kaputten/fremden Daten). */
export function validBackup(raw) {
  if (!raw || typeof raw !== "object" || raw.bv !== BACKUP_VERSION) return null;
  if (!raw.state || typeof raw.state !== "object" || !Number.isFinite(raw.at)) return null;
  const owner = typeof raw.owner === "string" && /^[0-9a-f-]{36}$/i.test(raw.owner) ? raw.owner.toLowerCase() : null;
  return { ...raw, owner };
}

/**
 * Darf diese Sicherung jetzt wiederhergestellt werden? Nie über Kontogrenzen:
 * nur Sicherungen ohne Konto oder vom gerade angemeldeten Konto.
 */
export function canRestore(backup, currentOwner) {
  const b = validBackup(backup);
  if (!b) return false;
  return !b.owner || b.owner === (currentOwner || null);
}
