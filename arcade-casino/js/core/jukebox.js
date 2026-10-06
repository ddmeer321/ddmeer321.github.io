// Jukebox (V1.2) – Besitz, Bibliothek und Einstellungen. Reine Logik, testbar.
//
// Die Jukebox ist ein dauerhafter Kauf. Dazu gehören zwei Starter-Stücke.
// Weitere Stücke kosten ALLE denselben Preis (Musikgeschmack ist subjektiv –
// „teurer“ darf nicht „besser“ bedeuten). Besondere Stücke sind nicht käuflich,
// sondern werden über Meilensteine frei (Level, alle Automaten gespielt).
// Preise: Begründung und Simulation in docs/ECONOMY.md (Abschnitt Jukebox).

import { TRACKS, TRACK_IDS, trackById } from "../audio/tracks.js";

export const JUKEBOX_PRICE = 6000;
export const SONG_PRICE = 1500;
export const MUSIC_IN_GAMES = ["duck", "full", "off"];

export function defaultJukebox() {
  return { owned: false, ownedAt: 0, songs: [], current: null, shuffle: false, wasPlaying: false, inGames: "duck" };
}

export function sanitizeJukebox(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const owned = src.owned === true;
  const songs = [...new Set(Array.isArray(src.songs) ? src.songs.filter((id) => TRACK_IDS.includes(id)) : [])];
  if (owned) for (const t of TRACKS) if (t.kind === "starter" && !songs.includes(t.id)) songs.push(t.id);
  return {
    owned,
    ownedAt: owned && Number.isFinite(src.ownedAt) ? Math.max(0, Math.trunc(src.ownedAt)) : 0,
    songs: owned ? songs : [],
    current: owned && songs.includes(src.current) ? src.current : owned ? songs[0] || null : null,
    shuffle: src.shuffle === true,
    wasPlaying: owned && src.wasPlaying === true,
    inGames: MUSIC_IN_GAMES.includes(src.inGames) ? src.inGames : "duck",
  };
}

/** Preis eines Stücks: null = nicht käuflich (Starter oder besonders). */
export function priceOf(id) {
  return trackById(id)?.kind === "shop" ? SONG_PRICE : null;
}

/** Ist die Freischaltbedingung eines besonderen Stücks erfüllt? */
export function specialUnlocked(track, { level = 1, gamesPlayed = 0 } = {}) {
  const u = track.unlock;
  if (!u) return false;
  if (u.type === "level") return level >= u.value;
  if (u.type === "variety") return gamesPlayed >= u.value;
  return false;
}

/**
 * @param {object} o
 * @param {() => object} o.getState
 * @param {object} o.economy   spend() aus core/economy.js
 * @param {() => void} o.saveNow
 * @param {() => {level:number, gamesPlayed:number}} o.progress
 * @param {(ev:string, d?:any) => void} [o.emit]
 */
export function createJukebox({ getState, economy, saveNow, progress, emit = () => {}, now = () => Date.now() }) {
  const J = () => {
    const s = getState();
    if (!s.jukebox || typeof s.jukebox !== "object") s.jukebox = defaultJukebox();
    return s.jukebox;
  };
  const api = {
    get owned() {
      return J().owned;
    },
    state: J,
    has(id) {
      return J().songs.includes(id);
    },
    /** Kauft die Jukebox – genau einmal. */
    buy() {
      const j = J();
      if (j.owned) return { ok: false, reason: "Die Jukebox gehört dir schon" };
      if (!economy.spend(JUKEBOX_PRICE, "jukebox")) return { ok: false, reason: "Nicht genug Credits" };
      j.owned = true;
      j.ownedAt = now();
      j.songs = TRACKS.filter((t) => t.kind === "starter").map((t) => t.id);
      j.current = j.songs[0];
      api.checkSpecials(false);
      saveNow();
      emit("jukebox:bought");
      return { ok: true };
    },
    /** Kauft ein reguläres Stück – jedes genau einmal, alle zum selben Preis. */
    buySong(id) {
      const j = J();
      const t = trackById(id);
      if (!j.owned) return { ok: false, reason: "Erst die Jukebox kaufen" };
      if (!t) return { ok: false, reason: "Unbekanntes Stück" };
      if (j.songs.includes(id)) return { ok: false, reason: "Schon in deiner Bibliothek" };
      if (t.kind !== "shop") return { ok: false, reason: "Dieses Stück ist nicht käuflich" };
      if (!economy.spend(SONG_PRICE, "song")) return { ok: false, reason: "Nicht genug Credits" };
      j.songs.push(id);
      saveNow();
      emit("jukebox:song", { id });
      return { ok: true };
    },
    /** Schaltet erreichte besondere Stücke frei. Rückgabe: neu freigeschaltete ids. */
    checkSpecials(save = true) {
      const j = J();
      if (!j.owned) return [];
      const p = progress();
      const fresh = [];
      for (const t of TRACKS) {
        if (t.kind === "special" && !j.songs.includes(t.id) && specialUnlocked(t, p)) {
          j.songs.push(t.id);
          fresh.push(t.id);
        }
      }
      if (fresh.length && save) {
        saveNow();
        emit("jukebox:special", fresh);
      }
      return fresh;
    },
    library() {
      const j = J();
      return TRACKS.filter((t) => j.songs.includes(t.id));
    },
    select(id) {
      const j = J();
      if (!j.songs.includes(id)) return false;
      j.current = id;
      saveNow();
      return true;
    },
    /** Nächstes/vorheriges Stück der eigenen Bibliothek (bei Zufall: ein anderes zufälliges). */
    neighbour(dir = 1, rnd = Math.random) {
      const lib = api.library().map((t) => t.id);
      const j = J();
      if (!lib.length) return null;
      if (j.shuffle && lib.length > 1) {
        const others = lib.filter((id) => id !== j.current);
        return others[Math.floor(rnd() * others.length)];
      }
      const i = Math.max(0, lib.indexOf(j.current));
      return lib[(i + dir + lib.length) % lib.length];
    },
    setShuffle(v) {
      J().shuffle = Boolean(v);
      saveNow();
    },
    setInGames(mode) {
      if (!MUSIC_IN_GAMES.includes(mode)) return;
      J().inGames = mode;
      saveNow();
    },
    setWasPlaying(v) {
      const j = J();
      if (j.wasPlaying === Boolean(v)) return;
      j.wasPlaying = Boolean(v);
      saveNow();
    },
  };
  return api;
}
