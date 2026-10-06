// V1.2: Jukebox (Besitz, Einheitspreis, Bibliothek, Migration) und Musik-Engine.
import test from "node:test";
import assert from "node:assert/strict";

import { createJukebox, sanitizeJukebox, defaultJukebox, JUKEBOX_PRICE, SONG_PRICE, priceOf, specialUnlocked } from "../js/core/jukebox.js";
import { TRACKS, TRACK_IDS } from "../js/audio/tracks.js";
import { initSynth, makeBus, stepDur } from "../js/audio/synth.js";
import { createEconomy } from "../js/core/economy.js";
import { defaultState, sanitizeState, migrateState } from "../js/core/state.js";

function setup(balance = 50000, progress = { level: 1, gamesPlayed: 0 }) {
  const s = defaultState();
  s.balance = balance;
  let saves = 0;
  const economy = createEconomy({ getState: () => s });
  const p = { ...progress };
  const jb = createJukebox({ getState: () => s, economy, saveNow: () => saves++, progress: () => p });
  return { s, jb, economy, p, saves: () => saves };
}

test("Jukebox: Kauf bucht genau einmal ab, gehört danach dauerhaft dem Spieler", () => {
  const { s, jb } = setup(10000);
  assert.equal(jb.owned, false);
  const r = jb.buy();
  assert.equal(r.ok, true);
  assert.equal(s.balance, 10000 - JUKEBOX_PRICE);
  assert.equal(s.stats.spent, JUKEBOX_PRICE);
  assert.equal(s.stats.wagered, 0, "ein Kauf ist kein Einsatz");
  assert.equal(jb.buy().ok, false, "zweiter Kauf abgelehnt");
  assert.equal(s.balance, 10000 - JUKEBOX_PRICE, "kein zweites Abbuchen");
  // Persistenz über Bereinigung
  const again = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(again.jukebox.owned, true);
  assert.deepEqual(again.jukebox.songs.sort(), TRACKS.filter((t) => t.kind === "starter").map((t) => t.id).sort());
});

test("Jukebox: ohne genug Credits kein Kauf, kein negatives Guthaben", () => {
  const { s, jb } = setup(JUKEBOX_PRICE - 1);
  assert.equal(jb.buy().ok, false);
  assert.equal(s.balance, JUKEBOX_PRICE - 1);
  assert.equal(jb.owned, false);
});

test("Songs: alle regulär kaufbaren Stücke kosten exakt gleich viel", () => {
  const shop = TRACKS.filter((t) => t.kind === "shop");
  assert.ok(shop.length >= 5);
  const prices = new Set(shop.map((t) => priceOf(t.id)));
  assert.deepEqual([...prices], [SONG_PRICE]);
  for (const t of TRACKS.filter((x) => x.kind !== "shop")) assert.equal(priceOf(t.id), null, `${t.id} ist nicht käuflich`);
});

test("Songs: Kauf genau einmal, Bibliothek bleibt erhalten, Starter/Besondere nicht käuflich", () => {
  const { s, jb } = setup(20000);
  assert.equal(jb.buySong("pixel").ok, false, "erst die Jukebox");
  jb.buy();
  const bal = s.balance;
  assert.equal(jb.buySong("pixel").ok, true);
  assert.equal(s.balance, bal - SONG_PRICE);
  assert.equal(jb.buySong("pixel").ok, false);
  assert.equal(s.balance, bal - SONG_PRICE, "nicht doppelt berechnet");
  assert.equal(jb.buySong("drive").ok, false, "Starter ist schon da");
  assert.equal(jb.buySong("hymn").ok, false, "Besonderes Stück nicht käuflich");
  assert.equal(jb.buySong("gibtsnicht").ok, false);
  const again = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.ok(again.jukebox.songs.includes("pixel"));
});

test("Besondere Stücke: Meilensteine statt Preis", () => {
  const { jb, p } = setup(20000, { level: 9, gamesPlayed: 11 });
  jb.buy();
  assert.equal(jb.has("sunset"), false);
  assert.equal(jb.has("hymn"), false);
  p.level = 10;
  assert.deepEqual(jb.checkSpecials(), ["sunset"]);
  p.gamesPlayed = 12;
  assert.deepEqual(jb.checkSpecials(), ["hymn"]);
  assert.deepEqual(jb.checkSpecials(), [], "nur einmal");
  for (const t of TRACKS.filter((x) => x.kind === "special")) assert.ok(t.unlock && t.unlock.text);
  assert.equal(specialUnlocked({ unlock: { type: "level", value: 5 } }, { level: 4 }), false);
});

test("Jukebox: Auswahl, Weiter/Zurück, Zufall und Einstellungen", () => {
  const { jb } = setup(30000);
  jb.buy();
  jb.buySong("house");
  const lib = jb.library().map((t) => t.id);
  assert.equal(jb.select("pixel"), false, "nicht in der Bibliothek");
  assert.equal(jb.select(lib[0]), true);
  assert.equal(jb.neighbour(1), lib[1]);
  assert.equal(jb.neighbour(-1), lib[lib.length - 1]);
  jb.setShuffle(true);
  for (let i = 0; i < 20; i++) assert.notEqual(jb.neighbour(1), lib[0], "Zufall wählt ein anderes Stück");
  jb.setInGames("off");
  assert.equal(jb.state().inGames, "off");
  jb.setInGames("lauter");
  assert.equal(jb.state().inGames, "off", "ungültiger Modus ignoriert");
});

test("Jukebox-Bereinigung: kaputte Werte, fremde Songs, nicht gekaufte Jukebox", () => {
  assert.deepEqual(sanitizeJukebox(null), defaultJukebox());
  const j = sanitizeJukebox({ owned: true, songs: ["pixel", "pixel", "evil", 3], current: "evil", inGames: "x", shuffle: "ja" });
  assert.ok(j.songs.includes("drive") && j.songs.includes("lounge"), "Starter gehören zur gekauften Jukebox");
  assert.equal(j.songs.filter((x) => x === "pixel").length, 1);
  assert.ok(!j.songs.includes("evil"));
  assert.ok(j.songs.includes(j.current));
  assert.equal(j.inGames, "duck");
  assert.equal(j.shuffle, false);
  const n = sanitizeJukebox({ owned: false, songs: ["pixel"] });
  assert.deepEqual(n.songs, [], "ohne Jukebox keine Songs");
});

test("Migration v2 → v3: Fortschritt bleibt, neue Bereiche leer, „Gesunde Pause“ entfällt", () => {
  const v2 = { v: 2, balance: 7777, xp: 3210, achievements: { "first-win": 1, "break-taken": 2 }, settings: { theme: "ocean" }, stats: { rounds: 9, wagered: 100, won: 50 }, bests: { hoops: 40 }, games: { coinpusher: { world: { c: [] } } }, control: { pauseUntil: 0, excludeUntil: Date.now() + 86400000, remindMin: 60 } };
  const s = sanitizeState(v2);
  assert.equal(s.v, 3);
  assert.equal(s.balance, 7777);
  assert.equal(s.xp, 3210);
  assert.equal(s.achievements["first-win"], 1);
  assert.equal(s.achievements["break-taken"], undefined);
  assert.equal(s.settings.theme, "ocean");
  assert.equal(s.settings.music, 0.6);
  assert.equal(s.bests.hoops, 40);
  assert.ok(s.games.coinpusher.world);
  assert.ok(s.control.excludeUntil > Date.now(), "Auszeit bleibt bestehen");
  assert.equal(s.jukebox.owned, false);
  assert.deepEqual(s.lotto.tickets, {});
  assert.deepEqual(s.inbox.items, []);
  // erneute Migration ändert nichts mehr
  const again = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again, sanitizeState(again));
  assert.equal(migrateState({ v: 3, x: 1 }).x, 1);
});

// ---------- Musik-Engine mit Attrappe eines AudioContext ----------

function mockAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error("exponentialRamp braucht > 0"); }, setTargetAtTime() {}, cancelScheduledValues() {} });
  let nodes = 0;
  const node = (extra = {}) => {
    nodes++;
    return { connect: () => {}, disconnect: () => {}, gain: param(), frequency: param(), detune: param(), Q: param(), delayTime: param(), start() {}, stop() {}, setPeriodicWave() {}, ...extra };
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createGain: () => node(),
    createOscillator: () => node({ type: "sine" }),
    createBiquadFilter: () => node({ type: "lowpass" }),
    createBufferSource: () => node({ buffer: null, loop: false }),
    createConvolver: () => node({ buffer: null }),
    createDelay: () => node(),
    createPeriodicWave: () => ({}),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, count: () => nodes };
}

test("Musik-Engine: jedes Stück spielt alle Takte fehlerfrei durch (inkl. Schleife)", () => {
  const { ctx, count } = mockAudio();
  initSynth(ctx);
  assert.equal(new Set(TRACK_IDS).size, TRACKS.length, "eindeutige ids");
  for (const tr of TRACKS) {
    const bus = makeBus(tr, ctx.createGain());
    tr.start?.(bus);
    const sd = stepDur(tr);
    const before = count();
    let t = 0;
    let bar = 0;
    for (let n = 0; n < (tr.bars + 4) * 16; n++) {
      const step = n % 16;
      tr.step(bus, bar, step, t, sd);
      t += sd;
      if (step === 15) bar = bar + 1 >= tr.bars ? tr.loopFrom : bar + 1;
    }
    assert.ok(count() - before > tr.bars * 16, `${tr.id} erzeugt Klänge`);
    assert.ok(tr.title && tr.style && tr.desc && tr.bpm > 50 && tr.bpm < 200, `${tr.id} Metadaten`);
    assert.ok(typeof tr.section(0) === "string");
  }
});
