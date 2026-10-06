// Zentrales Audiosystem. Alle Klänge werden zur Laufzeit mit Web Audio
// synthetisiert – es gibt keine Audiodateien.
//
// * Genau EIN AudioContext für die ganze App (lazy beim ersten Antippen erzeugt,
//   weil Browser Audio erst nach einer Benutzergeste erlauben).
// * Busse: sfx, haptic (Fake-Haptik-Transienten), ambience, music (Jukebox,
//   V1.2) → master → Kompressor. Musik hat eine eigene Lautstärke und wird in
//   Spielen „geduckt“ (leiser), damit keine Klang-Kakophonie entsteht.
// * Stimmenbegrenzung + Mindestabstand pro Klang, damit z. B. 30 Münzen
//   gleichzeitig nicht übersteuern oder die CPU fluten.
// * Fehlt Web Audio oder wirft irgendetwas, wird still weitergespielt.

const VOICE_LIMIT = 44;

let ctx = null;
let failed = false;
let master = null;
let buses = null;
let noiseBuf = null;
let voices = [];
let settings = { master: 0.8, sfx: 0.9, ambience: 0.35, music: 0.6, audioHaptics: true };
let musicDuck = 1;
const lastPlayed = new Map();
let ambience = null;
let ambienceWanted = false;

function AC() {
  return typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
}

function ensure() {
  if (ctx || failed) return ctx;
  const Ctor = AC();
  if (!Ctor) {
    failed = true;
    return null;
  }
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);
    master = ctx.createGain();
    master.connect(comp);
    buses = {
      sfx: ctx.createGain(),
      haptic: ctx.createGain(),
      ambience: ctx.createGain(),
      music: ctx.createGain(),
    };
    for (const b of Object.values(buses)) b.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyVolumes();
  } catch (err) {
    console.warn("[audio] Web Audio nicht verfügbar – Spiel läuft ohne Ton.", err);
    failed = true;
    ctx = null;
  }
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.master, t, 0.02);
  buses.sfx.gain.setTargetAtTime(settings.sfx, t, 0.02);
  buses.haptic.gain.setTargetAtTime(settings.audioHaptics ? settings.sfx * 0.9 : 0, t, 0.02);
  buses.ambience.gain.setTargetAtTime(settings.ambience * 0.5, t, 0.08);
  buses.music.gain.setTargetAtTime(settings.music * 0.8 * musicDuck, t, 0.25);
}

/** Musik leiser (0–1) – z. B. 0,3 während eines Spiels. Weiche Blende. */
export function setMusicDuck(level) {
  musicDuck = Math.max(0, Math.min(1, level));
  applyVolumes();
}

/** Laufender AudioContext + Musik-Bus für die Jukebox (null, solange gesperrt). */
export function musicOutput() {
  const c = ensure();
  if (!c || c.state !== "running") return null;
  return { ctx: c, bus: buses.music };
}

/** Promise, das erfüllt wird, sobald Audio laufen darf (nach Benutzergeste). */
export async function resumeAudio() {
  const c = ensure();
  if (!c) return false;
  if (c.state !== "running") await c.resume().catch(() => {});
  return c.state === "running";
}

export function setAudioSettings(next) {
  settings = { ...settings, ...next };
  applyVolumes();
  if (ambience && settings.ambience <= 0) {
    ambience.stop();
    ambience = null;
  } else if (ambienceWanted) {
    startAmbience();
  }
}

/** Muss früh aufgerufen werden: hängt die „Entsperren bei erster Geste“-Logik an. */
export function initAudio(initialSettings) {
  if (initialSettings) settings = { ...settings, ...initialSettings };
  const unlock = () => {
    const c = ensure();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    if (c && ambienceWanted) startAmbience();
  };
  for (const ev of ["pointerdown", "touchend", "keydown"]) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export function audioState() {
  return ctx ? ctx.state : failed ? "unavailable" : "locked";
}

// ---------- Bausteine ----------

function canVoice(n = 1) {
  const now = ctx.currentTime;
  voices = voices.filter((end) => end > now);
  if (voices.length + n > VOICE_LIMIT) return false;
  return true;
}

function track(end) {
  voices.push(end);
}

function out(bus, pan) {
  const dest = buses[bus] || buses.sfx;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(dest);
    return p;
  }
  return dest;
}

function env(g, t, attack, decay, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone({ t, type = "sine", f, f2, dur = 0.1, attack = 0.002, peak = 0.3, bus = "sfx", pan = 0, detune = 0 }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + attack + dur);
  if (detune) o.detune.value = detune;
  env(g, t, attack, dur, peak);
  o.connect(g).connect(out(bus, pan));
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  track(t + attack + dur);
}

function noise({ t, dur = 0.05, attack = 0.001, peak = 0.3, filter = "bandpass", f = 2000, f2, q = 1, bus = "sfx", pan = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const offset = Math.random() * 0.5;
  const fl = ctx.createBiquadFilter();
  fl.type = filter;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + attack + dur);
  fl.Q.value = q;
  const g = ctx.createGain();
  env(g, t, attack, dur, peak);
  src.connect(fl).connect(g).connect(out(bus, pan));
  src.start(t, offset);
  src.stop(t + attack + dur + 0.05);
  track(t + attack + dur);
}

/** Metallischer Klang aus unharmonischen Teiltönen (Münzen, Ring, Glocken). */
function metal({ t, f, ratios = [1, 2.76, 5.4, 8.93], dur = 0.2, peak = 0.12, bus = "sfx", pan = 0 }) {
  const nyquist = ctx.sampleRate * 0.45;
  ratios.forEach((r, i) => {
    if (f * r > nyquist) return;
    tone({ t, f: f * r, dur: dur / (1 + i * 0.6), peak: peak / (1 + i * 0.8), bus, pan, attack: 0.001 });
  });
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

function arp({ t, notes, step = 0.07, dur = 0.18, type = "triangle", peak = 0.16, bus = "sfx" }) {
  notes.forEach((n, i) => tone({ t: t + i * step, type, f: NOTE(n), dur, peak, bus, attack: 0.004 }));
}

// ---------- Klangkatalog ----------
// Jeder Eintrag: [Mindestabstand in s, Stimmenbedarf, Funktion(t, o)]
// o: { pitch, vol, pan }

const R = (a, b) => a + Math.random() * (b - a);

const SOUNDS = {
  // UI
  "ui.tap": [0.03, 2, (t, o) => {
    noise({ t, dur: 0.012, f: 3200, q: 2, peak: 0.12 * o.vol });
    tone({ t, f: 900 * o.pitch, f2: 620 * o.pitch, dur: 0.03, peak: 0.06 * o.vol });
  }],
  "ui.open": [0.05, 2, (t, o) => {
    tone({ t, type: "triangle", f: 520, dur: 0.06, peak: 0.1 * o.vol });
    tone({ t: t + 0.06, type: "triangle", f: 780, dur: 0.1, peak: 0.1 * o.vol });
  }],
  "ui.back": [0.05, 1, (t, o) => tone({ t, type: "triangle", f: 600, f2: 360, dur: 0.09, peak: 0.1 * o.vol })],
  "ui.toggle": [0.03, 1, (t, o) => noise({ t, dur: 0.015, f: 2400, q: 3, peak: 0.16 * o.vol })],
  "ui.error": [0.15, 2, (t, o) => {
    tone({ t, type: "square", f: 180, dur: 0.07, peak: 0.05 * o.vol });
    tone({ t: t + 0.09, type: "square", f: 150, dur: 0.09, peak: 0.05 * o.vol });
  }],

  // Chips & Karten
  "chip": [0.03, 3, (t, o) => {
    noise({ t, dur: 0.02, f: 2300 * o.pitch, q: 3, peak: 0.28 * o.vol, pan: o.pan });
    tone({ t, f: 2600 * o.pitch, dur: 0.03, peak: 0.05 * o.vol, pan: o.pan });
    tone({ t, f: 3900 * o.pitch, dur: 0.02, peak: 0.03 * o.vol, pan: o.pan });
  }],
  "chip.stack": [0.05, 5, (t, o) => {
    for (let i = 0; i < 3; i++) noise({ t: t + i * 0.035, dur: 0.018, f: 2200 + i * 300, q: 3, peak: 0.2 * o.vol });
  }],
  "card.deal": [0.04, 2, (t, o) => {
    noise({ t, dur: 0.07, attack: 0.01, filter: "highpass", f: 5000, f2: 1800, q: 0.7, peak: 0.16 * o.vol, pan: o.pan });
    noise({ t: t + 0.075, dur: 0.012, f: 3500, q: 2, peak: 0.12 * o.vol, pan: o.pan });
  }],
  "card.flip": [0.04, 1, (t, o) => noise({ t, dur: 0.025, f: 4200, q: 1.5, peak: 0.2 * o.vol })],

  // Münzen
  "coin.clink": [0.02, 4, (t, o) => metal({ t, f: 2100 * o.pitch * R(0.95, 1.05), dur: 0.18, peak: 0.08 * o.vol, pan: o.pan })],
  "coin.insert": [0.08, 8, (t, o) => {
    metal({ t, f: 1900, dur: 0.12, peak: 0.08 * o.vol, pan: o.pan });
    noise({ t: t + 0.04, dur: 0.08, filter: "bandpass", f: 1500, q: 1, peak: 0.06 * o.vol, pan: o.pan });
    metal({ t: t + 0.11, f: 2300, dur: 0.1, peak: 0.05 * o.vol, pan: o.pan });
  }],
  "coin.land": [0.025, 2, (t, o) => {
    tone({ t, f: 240 * o.pitch, f2: 120, dur: 0.05, peak: 0.12 * o.vol, pan: o.pan });
    metal({ t, f: 2600 * o.pitch, ratios: [1, 2.4], dur: 0.06, peak: 0.04 * o.vol, pan: o.pan });
  }],
  "coin.fall": [0.04, 6, (t, o) => {
    for (let i = 0; i < 3; i++) metal({ t: t + R(0, 0.12), f: R(1800, 2600), ratios: [1, 2.76], dur: 0.12, peak: 0.05 * o.vol, pan: o.pan });
  }],
  "coin.win": [0.06, 8, (t, o) => {
    for (let i = 0; i < 4; i++) metal({ t: t + i * 0.05, f: 2000 + i * 180, ratios: [1, 2.76], dur: 0.16, peak: 0.07 * o.vol });
  }],

  // Roulette
  "roulette.tick": [0.012, 1, (t, o) => noise({ t, dur: 0.006, f: 5200 * o.pitch, q: 4, peak: 0.22 * o.vol, pan: o.pan })],
  "roulette.drop": [0.1, 4, (t, o) => {
    tone({ t, f: 300, f2: 160, dur: 0.06, peak: 0.15 * o.vol });
    noise({ t, dur: 0.02, f: 4000, q: 3, peak: 0.25 * o.vol });
    noise({ t: t + 0.07, dur: 0.012, f: 4600, q: 3, peak: 0.14 * o.vol });
  }],
  "roulette.launch": [0.2, 2, (t, o) => {
    noise({ t, dur: 0.25, attack: 0.02, f: 900, f2: 2600, q: 1.2, peak: 0.12 * o.vol });
    tone({ t, f: 220, f2: 330, dur: 0.15, peak: 0.05 * o.vol });
  }],

  // Slots
  "reel.start": [0.1, 3, (t, o) => {
    tone({ t, f: 160, f2: 90, dur: 0.07, peak: 0.18 * o.vol });
    noise({ t, dur: 0.18, attack: 0.03, filter: "lowpass", f: 600, f2: 1800, q: 1, peak: 0.08 * o.vol });
  }],
  "reel.tick": [0.025, 1, (t, o) => noise({ t, dur: 0.008, f: 2600 * o.pitch, q: 6, peak: 0.08 * o.vol, pan: o.pan })],
  "reel.stop": [0.04, 3, (t, o) => {
    tone({ t, f: 150 * o.pitch, f2: 60, dur: 0.09, peak: 0.28 * o.vol, pan: o.pan });
    noise({ t, dur: 0.03, filter: "lowpass", f: 1400, q: 1, peak: 0.18 * o.vol, pan: o.pan });
    noise({ t: t + 0.005, dur: 0.01, f: 3800, q: 4, peak: 0.08 * o.vol, pan: o.pan });
  }],
  "reel.anticipation": [0.3, 2, (t, o) => {
    tone({ t, type: "sawtooth", f: 220, f2: 440, dur: 0.6, attack: 0.05, peak: 0.03 * o.vol });
    tone({ t, type: "triangle", f: 330, f2: 660, dur: 0.6, attack: 0.05, peak: 0.04 * o.vol });
  }],

  // Basketball
  "ball.throw": [0.1, 1, (t, o) => noise({ t, dur: 0.14, attack: 0.03, f: 700, f2: 1700, q: 1.4, peak: 0.12 * o.vol })],
  "ball.bounce": [0.04, 2, (t, o) => {
    tone({ t, f: 130 * o.pitch, f2: 70, dur: 0.1, peak: 0.35 * o.vol, pan: o.pan });
    noise({ t, dur: 0.03, filter: "lowpass", f: 500, q: 1, peak: 0.2 * o.vol, pan: o.pan });
  }],
  "ball.rim": [0.05, 5, (t, o) => {
    metal({ t, f: 540 * o.pitch, ratios: [1, 2.32, 4.25, 6.63], dur: 0.45, peak: 0.12 * o.vol, pan: o.pan });
    noise({ t, dur: 0.02, f: 2000, q: 2, peak: 0.12 * o.vol, pan: o.pan });
  }],
  "ball.board": [0.05, 2, (t, o) => {
    tone({ t, f: 210, f2: 110, dur: 0.07, peak: 0.25 * o.vol, pan: o.pan });
    noise({ t, dur: 0.04, f: 900, q: 1.2, peak: 0.2 * o.vol, pan: o.pan });
  }],
  "ball.swish": [0.1, 2, (t, o) => {
    noise({ t, dur: 0.22, attack: 0.04, f: 2600, f2: 5200, q: 0.8, peak: 0.2 * o.vol });
    noise({ t: t + 0.05, dur: 0.18, attack: 0.03, filter: "highpass", f: 6000, q: 0.5, peak: 0.08 * o.vol });
  }],

  // Skill-Automaten
  "stack.place": [0.04, 2, (t, o) => {
    tone({ t, type: "square", f: 220 * o.pitch, dur: 0.06, peak: 0.07 * o.vol });
    tone({ t, f: 110 * o.pitch, f2: 70, dur: 0.08, peak: 0.2 * o.vol });
  }],
  "stack.perfect": [0.05, 3, (t, o) => arp({ t, notes: [79, 86, 91].map((n) => n + (o.semi || 0)), step: 0.04, dur: 0.14, peak: 0.12 * o.vol })],
  "stack.chop": [0.05, 2, (t, o) => noise({ t, dur: 0.12, attack: 0.002, filter: "lowpass", f: 1800, f2: 300, q: 1, peak: 0.2 * o.vol })],
  "cyclone.tick": [0.008, 1, (t, o) => tone({ t, type: "square", f: 1200 * o.pitch, dur: 0.012, peak: 0.035 * o.vol })],

  // Rückmeldungen
  "count": [0.1, 1, (t, o) => tone({ t, type: "square", f: 660, dur: 0.08, peak: 0.07 * o.vol })],
  "go": [0.1, 2, (t, o) => {
    tone({ t, type: "square", f: 990, dur: 0.16, peak: 0.07 * o.vol });
    tone({ t, type: "triangle", f: 1980, dur: 0.16, peak: 0.05 * o.vol });
  }],
  "buzzer": [0.3, 2, (t, o) => {
    tone({ t, type: "sawtooth", f: 110, dur: 0.6, attack: 0.01, peak: 0.08 * o.vol });
    tone({ t, type: "square", f: 113, dur: 0.6, attack: 0.01, peak: 0.05 * o.vol });
  }],
  "lose": [0.2, 2, (t, o) => {
    tone({ t, type: "triangle", f: 330, dur: 0.12, peak: 0.08 * o.vol });
    tone({ t: t + 0.12, type: "triangle", f: 262, f2: 240, dur: 0.22, peak: 0.07 * o.vol });
  }],
  "push": [0.2, 2, (t, o) => {
    tone({ t, type: "triangle", f: 440, dur: 0.1, peak: 0.08 * o.vol });
    tone({ t: t + 0.1, type: "triangle", f: 440, dur: 0.14, peak: 0.07 * o.vol });
  }],
  "win.small": [0.15, 4, (t, o) => arp({ t, notes: [72, 76, 79], step: 0.06, dur: 0.16, peak: 0.14 * o.vol })],
  "win.medium": [0.2, 8, (t, o) => {
    arp({ t, notes: [72, 76, 79, 84, 88], step: 0.06, dur: 0.2, peak: 0.13 * o.vol });
    metal({ t: t + 0.3, f: 2637, ratios: [1, 2.01], dur: 0.4, peak: 0.05 * o.vol });
  }],
  "win.big": [0.4, 16, (t, o) => {
    arp({ t, notes: [60, 64, 67, 72, 76, 79, 84], step: 0.07, dur: 0.22, peak: 0.12 * o.vol });
    [72, 76, 79, 84].forEach((n) => tone({ t: t + 0.55, type: "triangle", f: NOTE(n), dur: 0.9, attack: 0.02, peak: 0.07 * o.vol }));
    [72, 76, 79].forEach((n) => tone({ t: t + 0.55, type: "sawtooth", f: NOTE(n - 12), dur: 0.7, attack: 0.02, peak: 0.02 * o.vol }));
    for (let i = 0; i < 6; i++) metal({ t: t + 0.6 + i * 0.09, f: R(2400, 4200), ratios: [1, 2.01], dur: 0.25, peak: 0.035 * o.vol });
  }],
  // V1.2: Jukebox & Lotto
  "jukebox.on": [0.5, 10, (t, o) => {
    tone({ t, type: "sawtooth", f: 60, f2: 240, dur: 0.45, peak: 0.05 * o.vol });
    noise({ t, dur: 0.06, filter: "lowpass", f: 300, q: 0.7, peak: 0.25 * o.vol });
    noise({ t: t + 0.12, dur: 0.03, f: 4000, q: 3, peak: 0.1 * o.vol });
    noise({ t: t + 0.22, dur: 0.03, f: 4500, q: 3, peak: 0.1 * o.vol });
    arp({ t: t + 0.45, notes: [57, 64, 69, 72, 76], step: 0.07, dur: 0.5, type: "triangle", peak: 0.09 * o.vol });
  }],
  "unlock.song": [0.3, 5, (t, o) => {
    arp({ t, notes: [79, 84, 88], step: 0.05, dur: 0.35, type: "sine", peak: 0.08 * o.vol });
    metal({ t: t + 0.15, f: 1760, dur: 0.5, peak: 0.04 * o.vol });
  }],
  "lotto.intro": [0.5, 12, (t, o) => {
    arp({ t, notes: [60, 64, 67, 72], step: 0.11, dur: 0.22, type: "square", peak: 0.05 * o.vol });
    arp({ t: t + 0.5, notes: [65, 69, 72, 77], step: 0.11, dur: 0.22, type: "square", peak: 0.05 * o.vol });
    tone({ t: t + 1.0, type: "sawtooth", f: NOTE(72), dur: 0.7, peak: 0.05 * o.vol });
    tone({ t: t + 1.0, type: "sawtooth", f: NOTE(76), dur: 0.7, peak: 0.04 * o.vol });
    tone({ t: t + 1.0, type: "sawtooth", f: NOTE(79), dur: 0.7, peak: 0.04 * o.vol });
  }],
  "lotto.ball": [0.2, 4, (t, o) => {
    tone({ t, type: "sine", f: 300, f2: 120, dur: 0.12, peak: 0.25 * o.vol });
    noise({ t, dur: 0.03, filter: "bandpass", f: 1200, q: 2, peak: 0.15 * o.vol });
    tone({ t: t + 0.16, type: "sine", f: 240, f2: 110, dur: 0.08, peak: 0.12 * o.vol });
  }],
  "lotto.reveal": [0.2, 3, (t, o) => {
    metal({ t, f: 880 * o.pitch, dur: 0.6, peak: 0.08 * o.vol });
    tone({ t, type: "triangle", f: 1320 * o.pitch, dur: 0.25, peak: 0.06 * o.vol });
  }],
  "lotto.hit": [0.05, 2, (t, o) => tone({ t, type: "triangle", f: NOTE(84 + o.semi), dur: 0.14, peak: 0.08 * o.vol })],
  "lotto.end": [0.4, 4, (t, o) => arp({ t, notes: [67, 64, 60], step: 0.1, dur: 0.3, type: "triangle", peak: 0.06 * o.vol })],

  "levelup": [0.4, 12, (t, o) => {
    arp({ t, notes: [67, 72, 76, 79, 84, 88, 91], step: 0.05, dur: 0.2, peak: 0.1 * o.vol, type: "square" });
    tone({ t: t + 0.35, type: "triangle", f: NOTE(91), dur: 0.8, peak: 0.06 * o.vol });
  }],
  "achievement": [0.4, 6, (t, o) => {
    metal({ t, f: 1318, ratios: [1, 2.0, 3.01], dur: 0.6, peak: 0.08 * o.vol });
    metal({ t: t + 0.14, f: 1975, ratios: [1, 2.0, 3.01], dur: 0.8, peak: 0.08 * o.vol });
  }],

  // Jackpot / Mega (V1.1)
  "jackpot.impact": [0.5, 6, (t, o) => {
    tone({ t, f: 70, f2: 32, dur: 0.6, attack: 0.004, peak: 0.55 * o.vol });
    tone({ t, type: "triangle", f: 140, f2: 60, dur: 0.35, peak: 0.25 * o.vol });
    noise({ t, dur: 0.4, filter: "lowpass", f: 900, f2: 120, q: 0.8, peak: 0.35 * o.vol });
    metal({ t: t + 0.02, f: 880, ratios: [1, 2.4, 3.9], dur: 1.2, peak: 0.07 * o.vol });
  }],
  "win.jackpot": [0.8, 24, (t, o) => {
    arp({ t, notes: [60, 64, 67, 72, 76, 79, 84, 88], step: 0.06, dur: 0.22, peak: 0.11 * o.vol, type: "square" });
    [72, 76, 79, 84].forEach((n) => tone({ t: t + 0.5, type: "triangle", f: NOTE(n), dur: 1.4, attack: 0.02, peak: 0.07 * o.vol }));
    [60, 67].forEach((n) => tone({ t: t + 0.5, type: "sawtooth", f: NOTE(n - 12), dur: 1.2, attack: 0.03, peak: 0.025 * o.vol }));
    arp({ t: t + 1.2, notes: [84, 88, 91, 96], step: 0.08, dur: 0.4, peak: 0.07 * o.vol });
    for (let i = 0; i < 8; i++) metal({ t: t + 0.6 + i * 0.12, f: R(2600, 4400), ratios: [1, 2.01], dur: 0.3, peak: 0.03 * o.vol });
  }],

  // Plinko: kurzer Pin-Tick. Mindestabstand + Stimmenlimit verhindern Audio-Chaos
  // bei vielen gleichzeitigen Kugeln (zu schnelle Ticks werden zusammengefasst).
  "plinko.pin": [0.018, 1, (t, o) => tone({ t, type: "triangle", f: 1900 * o.pitch, dur: 0.018, peak: 0.05 * Math.min(1, o.vol), pan: o.pan })],
  "plinko.slot": [0.04, 3, (t, o) => {
    tone({ t, f: 300 * o.pitch, f2: 150, dur: 0.07, peak: 0.16 * o.vol, pan: o.pan });
    noise({ t, dur: 0.02, f: 2500, q: 2, peak: 0.08 * o.vol, pan: o.pan });
  }],
  "plinko.drop": [0.05, 1, (t, o) => tone({ t, type: "sine", f: 700, f2: 980, dur: 0.06, peak: 0.06 * o.vol, pan: o.pan })],

  // Münzgreifer
  "grab.clamp": [0.1, 4, (t, o) => {
    metal({ t, f: 420, ratios: [1, 2.7, 4.1], dur: 0.25, peak: 0.1 * o.vol });
    noise({ t, dur: 0.04, filter: "lowpass", f: 1500, q: 1, peak: 0.18 * o.vol });
  }],
  "grab.stop": [0.1, 2, (t, o) => {
    tone({ t, f: 120, f2: 70, dur: 0.08, peak: 0.25 * o.vol });
    noise({ t, dur: 0.03, filter: "lowpass", f: 700, q: 1, peak: 0.15 * o.vol });
  }],
  "grab.chute": [0.15, 6, (t, o) => {
    for (let i = 0; i < 4; i++) metal({ t: t + i * 0.06 + R(0, 0.03), f: R(1700, 2400), ratios: [1, 2.76], dur: 0.14, peak: 0.05 * o.vol });
  }],

  // Pferderennen
  "race.bell": [0.5, 6, (t, o) => {
    for (let i = 0; i < 6; i++) metal({ t: t + i * 0.09, f: 1250, ratios: [1, 2.3, 3.8], dur: 0.12, peak: 0.07 * o.vol });
  }],
  "race.gate": [0.3, 3, (t, o) => {
    metal({ t, f: 300, ratios: [1, 2.2, 3.3], dur: 0.3, peak: 0.12 * o.vol });
    noise({ t, dur: 0.08, filter: "lowpass", f: 900, q: 1, peak: 0.25 * o.vol });
  }],
  "race.hoof": [0.03, 1, (t, o) => tone({ t, f: 95 * o.pitch, f2: 55, dur: 0.045, peak: 0.13 * o.vol, pan: o.pan })],
  "race.cheer": [0.6, 4, (t, o) => {
    noise({ t, dur: 1.4, attack: 0.25, filter: "bandpass", f: 900, f2: 1400, q: 0.5, peak: 0.09 * o.vol });
    noise({ t: t + 0.1, dur: 1.2, attack: 0.3, filter: "bandpass", f: 2200, q: 0.7, peak: 0.04 * o.vol });
  }],

  // Fake-Haptik: sehr kurze, tieffrequente Impulse (Bus "haptic").
  "h.tick": [0.012, 1, (t, o) => tone({ t, f: 230, f2: 160, dur: 0.008, peak: 0.25 * o.vol, bus: "haptic" })],
  "h.tap": [0.02, 1, (t, o) => tone({ t, f: 170, f2: 110, dur: 0.016, peak: 0.35 * o.vol, bus: "haptic" })],
  "h.impulse": [0.03, 2, (t, o) => {
    tone({ t, f: 120, f2: 65, dur: 0.03, peak: 0.45 * o.vol, bus: "haptic" });
    noise({ t, dur: 0.012, filter: "lowpass", f: 400, q: 0.7, peak: 0.2 * o.vol, bus: "haptic" });
  }],
  "h.heavy": [0.06, 2, (t, o) => {
    tone({ t, f: 85, f2: 40, dur: 0.07, peak: 0.6 * o.vol, bus: "haptic" });
    noise({ t, dur: 0.035, filter: "lowpass", f: 260, q: 0.7, peak: 0.3 * o.vol, bus: "haptic" });
  }],
};

/**
 * Spielt einen Klang aus dem Katalog.
 * @param {string} name
 * @param {{pitch?: number, vol?: number, pan?: number, delay?: number, semi?: number}} [opts]
 */
export function play(name, opts = {}) {
  const c = ensure();
  if (!c || c.state !== "running") return;
  const def = SOUNDS[name];
  if (!def) {
    console.warn(`[audio] unbekannter Klang "${name}"`);
    return;
  }
  const [gap, cost, fn] = def;
  const t = c.currentTime + 0.005 + (opts.delay || 0);
  const last = lastPlayed.get(name) || 0;
  if (!opts.delay && t - last < gap) return;
  if (!canVoice(cost)) return;
  lastPlayed.set(name, t);
  try {
    fn(t, { pitch: opts.pitch ?? 1, vol: opts.vol ?? 1, pan: opts.pan ?? 0, semi: opts.semi ?? 0 });
  } catch (err) {
    console.warn(`[audio] Klang "${name}" fehlgeschlagen`, err);
  }
}

// ---------- Endlos-Klänge (Kugel rollt, Walzen surren) ----------

/**
 * Startet einen gefilterten Rausch-Loop. Rückgabe: { set({gain, freq}), stop() }.
 * Ohne Audio wird ein Dummy zurückgegeben.
 */
export function loop({ filter = "bandpass", f = 800, q = 1, gain = 0.05, bus = "sfx" } = {}) {
  const c = ensure();
  const dummy = { set() {}, stop() {} };
  if (!c || c.state !== "running") return dummy;
  try {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = filter;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(gain, c.currentTime, 0.05);
    src.connect(fl).connect(g).connect(buses[bus] || buses.sfx);
    src.start();
    let stopped = false;
    return {
      set({ gain: ng, freq } = {}) {
        if (stopped) return;
        const now = c.currentTime;
        if (ng !== undefined) g.gain.setTargetAtTime(Math.max(0.0001, ng), now, 0.05);
        if (freq !== undefined) fl.frequency.setTargetAtTime(freq, now, 0.05);
      },
      stop(fade = 0.12) {
        if (stopped) return;
        stopped = true;
        const now = c.currentTime;
        g.gain.setTargetAtTime(0.0001, now, fade / 3);
        src.stop(now + fade + 0.1);
      },
    };
  } catch {
    return dummy;
  }
}

// ---------- Hallen-Ambience ----------

function buildAmbience() {
  const c = ctx;
  const g = c.createGain();
  g.gain.value = 0.0001;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  lp.Q.value = 0.6;
  lp.connect(g).connect(buses.ambience);
  const oscs = [55, 82.4, 110, 164.8].map((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? "triangle" : "sine";
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 4;
    const og = c.createGain();
    og.gain.value = [0.35, 0.18, 0.22, 0.1][i];
    o.connect(og).connect(lp);
    o.start();
    return o;
  });
  // langsame Bewegung im Filter
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  g.gain.setTargetAtTime(0.35, c.currentTime, 1.2);

  // gelegentliches entferntes Automaten-Glitzern
  let timer = 0;
  const sparkle = () => {
    timer = setTimeout(sparkle, 2500 + Math.random() * 5000);
    if (!ctx || ctx.state !== "running" || document.hidden) return;
    const t = ctx.currentTime + 0.02;
    const base = [72, 74, 76, 79, 81][Math.floor(Math.random() * 5)];
    const pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < 3; i++) {
      tone({ t: t + i * 0.09, type: "sine", f: NOTE(base + i * 4), dur: 0.35, peak: 0.05, bus: "ambience", pan });
    }
  };
  timer = setTimeout(sparkle, 1500);

  return {
    stop() {
      clearTimeout(timer);
      const t = c.currentTime;
      g.gain.setTargetAtTime(0.0001, t, 0.3);
      for (const o of [...oscs, lfo]) o.stop(t + 1.5);
    },
  };
}

export function startAmbience() {
  ambienceWanted = true;
  if (!ctx || ctx.state !== "running" || ambience || settings.ambience <= 0) return;
  try {
    ambience = buildAmbience();
  } catch {
    ambience = null;
  }
}

export function stopAmbience() {
  ambienceWanted = false;
  if (ambience) {
    ambience.stop();
    ambience = null;
  }
}
