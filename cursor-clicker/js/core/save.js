// Persistenz-Schicht. Kapselt localStorage vollständig, damit ein späterer
// Wechsel auf Cloud-Speicherung (z.B. Supabase) nur diese Datei betrifft.
import { state, replaceState, createDefaultState, SAVE_VERSION } from "./state.js";
import { getDefaultUnlockedCosmeticIds } from "../data/cosmetics.js";
import { MAX_LEVEL } from "./upgrades.js";
import { normalizeFactory, unlockFactory, settleFactory } from "./factoryModel.js";
import { canWriteGame } from "./session.js";

// test-claude/ läuft absichtlich unter einem eigenen Storage-Key. localStorage
// ist pro Origin (nicht pro Pfad) gültig — ohne diese Trennung würde ein
// künftiger echter Release (außerhalb von test-claude/, gleiche Origin
// ddmeer321.github.io) automatisch den hier gespielten Testspielstand laden.
// Alles außerhalb von test-claude/ startet dadurch garantiert bei null.
const IS_TEST_ENV = location.pathname.includes("/test-claude/");
const STORAGE_KEY = IS_TEST_ENV ? "cursorClicker.save.v1" : "cursorClicker.save.v1.live";

// Cloud-Sync nur fuer den echten Live-Spielstand - gleiches Prinzip wie beim
// Storage-Key oben: die test-claude-Sandbox darf einen echten Cloud-Spielstand
// nie ueberschreiben. Falls diese Datei je wieder 1:1 nach test-claude/
// kopiert wird (siehe WORKFLOW.md), bleibt der Schutz automatisch bestehen.
const CLOUD_GAME_ID = "cursor-clicker";
// Local preview must never upload demo/test progress to a real account.
const CLOUD_SYNC_ENABLED = !IS_TEST_ENV && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
let cloudReady = false;
let cloudQueue = Promise.resolve();
const nextTimestamp = () => Math.max(Date.now(), (Number(state.lastSavedAt) || 0) + 1);

// Leichtgewichtiger Zwischenstand für den häufigen Autosave-Takt: nur die
// Felder, die sich bei praktisch jedem Klick ändern. Vermeidet, den kompletten
// (mit wachsendem Inventar immer größeren) State alle paar Sekunden neu zu
// serialisieren — das übernimmt weiterhin saveGame() in größeren Abständen.
const QUICK_KEY = STORAGE_KEY + ".quick";
const QUICK_FIELDS = ["coins", "totalCoinsEarned", "totalClicks", "playtimeSeconds", "lastSavedAt", "factory"];

function defaultUnlockedCosmetics() {
  const unlocked = {};
  getDefaultUnlockedCosmeticIds().forEach((id) => { unlocked[id] = true; });
  return unlocked;
}

// Migrationspfad für künftige Save-Versionen. Jede Version bringt ihre eigene
// kleine Transform-Funktion mit, damit neue Schema-Änderungen nicht die
// vorherigen Migrationsschritte anfassen müssen.
const MIGRATIONS = {
  // v1 -> v2: equippedCursorId (string) wird zu equipped { cursorId, instanceId }.
  // Neue Systeme (Upgrades, Fusion, Cosmetics) starten für Bestandsspieler leer,
  // bis auf den kostenlosen Standard-Cosmetic, den auch neue Spielstände bekommen.
  1: (saved) => {
    const { equippedCursorId, ...rest } = saved;
    return {
      ...rest,
      equipped: { cursorId: equippedCursorId ?? null, instanceId: null },
      cursorLevels: saved.cursorLevels || {},
      mutatedCursors: saved.mutatedCursors || {},
      unlockedCosmetics: saved.unlockedCosmetics || defaultUnlockedCosmetics(),
      equippedCosmeticId: saved.equippedCosmeticId ?? null,
    };
  },
  // v2 -> v3: sichtbares Level startet jetzt bei 1 statt 0 (alter interner
  // Wert 0 = "kein Upgrade" wird zu neuem Level 1 = "kein Bonus"). Jeder alte
  // gespeicherte Levelwert wird daher um 1 verschoben und auf MAX_LEVEL gedeckelt.
  // Auren sind ein komplett neues System und starten für Bestandsspieler leer.
  2: (saved) => {
    const shiftedLevels = {};
    for (const [cursorId, oldLevel] of Object.entries(saved.cursorLevels || {})) {
      shiftedLevels[cursorId] = Math.min(MAX_LEVEL, (Number(oldLevel) || 0) + 1);
    }
    return {
      ...saved,
      cursorLevels: shiftedLevels,
      ownedAuras: saved.ownedAuras || {},
      equippedAuraId: saved.equippedAuraId ?? null,
      auraBoxesOpened: saved.auraBoxesOpened || 0,
    };
  },
};

function migrate(saved) {
  if (!saved || typeof saved !== "object") return createDefaultState();

  let working = saved;
  let fromVersion = Number(working.version) || 1;
  while (MIGRATIONS[fromVersion]) {
    working = MIGRATIONS[fromVersion](working);
    fromVersion += 1;
  }

  const merged = Object.assign(createDefaultState(), working);
  merged.version = SAVE_VERSION;
  merged.factory = normalizeFactory(working.factory);
  return merged;
}

// Übernimmt einen frischeren Schnellspeicherstand (falls vorhanden) in den
// gerade geladenen Vollspeicherstand — deckt den Fall ab, dass die letzte
// Sitzung zwischen zwei Vollspeicherungen (alle 3 Min.) abgestürzt ist und nur
// noch der 8s-Schnellspeicherstand die neueren Werte hat.
// Gibt zurück, ob ein frischerer Schnellspeicherstand übernommen wurde —
// loadGame() braucht das, um auch dann korrekt zu laden, wenn NOCH KEIN
// Vollspeicherstand existiert (siehe dortiger Kommentar).
function applyNewerQuickSave(target) {
  try {
    const raw = localStorage.getItem(QUICK_KEY);
    if (!raw) return false;
    const quick = JSON.parse(raw);
    if (!quick || typeof quick !== "object") return false;
    if (Number(quick.lastSavedAt) > (Number(target.lastSavedAt) || 0)) {
      QUICK_FIELDS.forEach((key) => {
        if (key in quick) target[key] = quick[key];
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Cursor Clicker: Schnellspeicherstand konnte nicht gelesen werden.", err);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // saved bleibt null, wenn noch kein Vollspeicherstand existiert — migrate(null)
    // liefert dafür bereits createDefaultState(). Wichtig: trotzdem weiter unten
    // auf einen Schnellspeicherstand prüfen (nicht hier schon abbrechen), sonst
    // ginge der Fortschritt eines ganz neuen Spielers verloren, der zwar schon
    // einen 8s-Schnellspeicherstand hat, aber noch vor der ersten Vollspeicherung
    // (3min-Takt/wertvolles Event/beforeunload) abstürzt.
    const saved = raw ? JSON.parse(raw) : null;
    const merged = migrate(saved);
    const appliedQuickSave = applyNewerQuickSave(merged);
    if (!raw && !appliedQuickSave) return false;
    merged.factory = normalizeFactory(merged.factory);
    unlockFactory(merged);
    replaceState(merged);
    return true;
  } catch (err) {
    console.warn("Cursor Clicker: Speicherstand konnte nicht geladen werden.", err);
    return false;
  }
}

// Vollständige Speicherung — läuft alle 3 Minuten (main.js), direkt nach
// wertvollen/seltenen Fortschritts-Events (Box, Fusion, Level, Achievement)
// sowie bei beforeunload/Tab-Wechsel.
export function saveGame({ cloud = true } = {}) {
  if (!canWriteGame()) return Promise.resolve(false);
  unlockFactory(state);
  settleFactory(state.factory);
  try {
    state.lastSavedAt = nextTimestamp();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.removeItem(QUICK_KEY);
  } catch (err) {
    console.warn("Cursor Clicker: Speicherstand konnte nicht gespeichert werden.", err);
    window.dispatchEvent(new Event("cursor-save-error"));
    return Promise.resolve(false);
  }
  // Serialize snapshots so an older HTTP request cannot finish after a newer one.
  if (cloud && cloudReady && CLOUD_SYNC_ENABLED && window.CloudSave) {
    const snapshot = structuredClone(state);
    cloudQueue = cloudQueue.catch(() => false).then(() => window.CloudSave.save(CLOUD_GAME_ID, snapshot)).catch(() => false);
    return cloudQueue;
  }
  return Promise.resolve(true);
}

// Finish the initial load BEFORE enabling gameplay. A timed-out cloud request
// never applies later, and cannot erase actions performed after the timeout.
export async function syncFromCloud() {
  if (!CLOUD_SYNC_ENABLED || !window.CloudSave) return;
  let timer;
  try {
    const result = await Promise.race([
      (async () => {
        const owner = await window.CloudSave.ready();
        if (!owner) return { owner: null, data: null };
        return { owner, data: await window.CloudSave.load(CLOUD_GAME_ID) };
      })(),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 4000); }),
    ]);
    if (!result || !canWriteGame()) return;
    if (!result.owner) return;
    const localBelongsToOwner = state.cloudOwnerId === result.owner;
    if (result.data && (!localBelongsToOwner ||
        Number(result.data.lastSavedAt || 0) > Number(state.lastSavedAt || 0))) {
      replaceState(migrate(result.data));
    } else if (!localBelongsToOwner && state.cloudOwnerId) {
      // Never copy the previous account's inventory into a different account.
      replaceState(createDefaultState());
    }
    state.cloudOwnerId = result.owner;
    cloudReady = true;
    saveGame();
  } catch (err) {
    console.warn("Cursor Clicker: Cloud-Abgleich fehlgeschlagen.", err);
  } finally {
    clearTimeout(timer);
  }
}

// Local storage is already durable before navigation; wait briefly for cloud
// delivery. If unavailable, the newer local timestamp is kept on the next load.
export async function navigateWithSave(url) {
  await Promise.race([saveGame(), new Promise(resolve => setTimeout(resolve, 1500))]);
  location.assign(url);
}

// Günstige Teilspeicherung für den 8s-Takt: nur die Felder, die sich bei
// praktisch jedem Klick ändern, keine Vollserialisierung des Gesamtzustands.
export function quickSaveGame() {
  if (!canWriteGame()) return;
  unlockFactory(state);
  settleFactory(state.factory);
  try {
    state.lastSavedAt = nextTimestamp();
    const partial = {};
    QUICK_FIELDS.forEach((key) => { partial[key] = state[key]; });
    localStorage.setItem(QUICK_KEY, JSON.stringify(partial));
  } catch (err) {
    console.warn("Cursor Clicker: Schnellspeicherung fehlgeschlagen.", err);
  }
}

export function hardReset() {
  if (!canWriteGame()) return;
  const owner = state.cloudOwnerId;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(QUICK_KEY);
  replaceState({ ...createDefaultState(), ...(owner ? { cloudOwnerId: owner } : {}) });
  saveGame();
}
