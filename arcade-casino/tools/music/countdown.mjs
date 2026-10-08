// „Countdown“ – Eigenkomposition, treibender Electro/Cinematic-Track mit Spannungsaufbau.
// e-Moll → Rückung nach fis-Moll im letzten Drop, 140 BPM. Offline-Synthese → WAV.
import fs from "node:fs";

const SR = 44100, BPM = 140, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BARS = 68;
const LEN = Math.ceil((BARS * BAR + 5) * SR);
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const lerp = (a, b, x) => a + (b - a) * x;
const expo = (a, b, x) => a * Math.pow(b / a, x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Busse: „pump“ wird vom Kick weggedrückt (Sidechain), „dry“ nicht.
const pumpL = new Float32Array(LEN), pumpR = new Float32Array(LEN);
const dryL = new Float32Array(LEN), dryR = new Float32Array(LEN);
const verbSend = new Float32Array(LEN);
const dlyL = new Float32Array(LEN), dlyR = new Float32Array(LEN);
const duck = new Float32Array(LEN).fill(1);

function addTo(L, R, i, v, pan, verb) {
  if (i < 0 || i >= LEN) return;
  L[i] += v * Math.cos((pan + 1) * Math.PI / 4);
  R[i] += v * Math.sin((pan + 1) * Math.PI / 4);
  if (verb) verbSend[i] += v * verb;
}
const pump = (i, v, pan = 0, verb = 0) => addTo(pumpL, pumpR, i, v, pan, verb);
const dry = (i, v, pan = 0, verb = 0) => addTo(dryL, dryR, i, v, pan, verb);

let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;

// Zustandsvariablen-Filter (ZDF/TPT), stabil auch bei schnellen Sweeps
class SVF {
  constructor(fc = 1000, q = 0.7) { this.ic1 = 0; this.ic2 = 0; this.set(fc, q); }
  set(fc, q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1;
    this.hp = v0 - this.k * v1 - v2;
    return (this.lp = v2);
  }
}
// bandbegrenzter Sägezahn (PolyBLEP)
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
class Saw {
  constructor(f) { this.f = f; this.p = rnd(); }
  next(mul = 1) {
    const dt = this.f * mul / SR;
    this.p += dt;
    if (this.p >= 1) this.p -= 1;
    return 2 * this.p - 1 - blep(this.p, dt);
  }
}

// ---------- Schlagzeug ----------
function duckAt(t, depth = 0.7, len = 0.21) {
  const s = Math.round(t * SR), n = Math.round(len * SR);
  for (let k = 0; k < n; k++) {
    const x = k / n;
    const att = Math.min(1, k / (0.003 * SR));
    const g = 1 - depth * att * (1 - x * x * (3 - 2 * x));
    const i = s + k;
    if (i < LEN && g < duck[i]) duck[i] = g;
  }
}
function kick(t, vel = 1, duckDepth = 0.7) {
  const s = Math.round(t * SR), n = Math.round(0.5 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (46 + 150 * Math.exp(-tt * 38)) / SR;
    const body = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 6.5);
    const click = noise() * Math.exp(-tt * 350) * 0.35;
    dry(s + k, Math.tanh((body + click) * 1.6) * vel * 0.62, 0, 0.02);
  }
  if (duckDepth) duckAt(t, duckDepth);
}
function clap(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.45 * SR);
  const f = new SVF(1250, 1.1);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const env = tt < 0.03 ? Math.exp(-(tt % 0.01) * 320) : Math.exp(-(tt - 0.03) * 16);
    f.run(noise());
    dry(s + k, f.bp * env * vel * 1.1, 0.05, 0.55);
  }
}
function snare(t, vel = 1, tone = 190, verb = 0.35) {
  const s = Math.round(t * SR), n = Math.round(0.2 * SR);
  const f = new SVF(2200, 0.8);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    f.run(noise());
    ph += tone / SR;
    const v = (f.bp * 1.4 + f.hp * 0.35) * Math.exp(-tt * 22) + Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 38) * 0.5;
    dry(s + k, v * vel * 0.42, -0.05, verb);
  }
}
function hat(t, vel = 1, open = false, pan = 0.3) {
  const s = Math.round(t * SR), n = Math.round((open ? 0.25 : 0.05) * SR);
  const f = new SVF(8500, 0.8);
  for (let k = 0; k < n; k++) {
    f.run(noise());
    dry(s + k, f.hp * Math.exp(-(k / SR) * (open ? 11 : 65)) * vel * 0.2, pan, 0.08);
  }
}
function crash(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(2.6 * SR);
  const f = new SVF(5200, 0.7);
  for (let k = 0; k < n; k++) {
    f.run(noise());
    const tt = k / SR;
    const v = f.hp * Math.exp(-tt * 1.8) * vel * 0.16;
    dry(s + k, v, (k % 2 ? 0.5 : -0.5), 0.35);
  }
}
// Uhr: tick-tack
function tick(t, tock, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.05 * SR);
  const f = tock ? 1450 : 1900;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const v = Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 130) + Math.sin(2 * Math.PI * f * 2.71 * tt) * Math.exp(-tt * 220) * 0.4;
    dry(s + k, v * vel * 0.16, tock ? -0.4 : 0.4, 0.25);
  }
}
function heartbeat(t, vel = 1) {
  kick(t, 0.75 * vel, 0.35);
  kick(t + 0.17, 0.5 * vel, 0.25);
}

// ---------- Effekte (Riser / Impact) ----------
function riser(t, dur, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const f = new SVF(400, 2.2);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    if (k % 32 === 0) f.set(expo(350, 11000, x), 2.2);
    f.run(noise());
    ph += expo(180, 1500, x * x) / SR;
    const tone = Math.sin(2 * Math.PI * ph) * 0.18 * x;
    const v = (f.bp * 0.9 + tone) * x * x * vel * 0.45;
    dry(s + k, v, Math.sin(x * 40) * 0.6 * x, 0.35);
  }
}
function impact(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(2.4 * SR);
  let ph = 0;
  const f = new SVF(900, 0.7);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (32 + 100 * Math.exp(-tt * 6)) / SR;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 2.4);
    const burst = f.run(noise()) * Math.exp(-tt * 5);
    dry(s + k, (Math.tanh(boom * 1.4) * 0.55 + burst * 0.5) * vel, 0, 0.5);
  }
  crash(t, vel);
}

// ---------- Synths ----------
function bass(t, m, dur, vel, cutoff) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const saw = new Saw(midi(m));
  const f = new SVF(cutoff, 1.1);
  const fsub = midi(m - 12);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) f.set(cutoff * (1 + 2 * Math.exp(-tt * 28)), 1.1);
    const a = Math.min(1, k / 60), r = k > n - 250 ? (n - k) / 250 : 1;
    const v = f.run(saw.next()) * 0.7 + Math.sin(2 * Math.PI * fsub * tt) * 0.42;
    pump(s + k, v * a * r * vel * 0.33, 0, 0);
  }
}
function pluck(t, m, dur, vel, bright, pan) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const o1 = new Saw(midi(m)), o2 = new Saw(midi(m) * 1.005);
  const f = new SVF(1000, 1.6);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) f.set(250 + bright * Math.exp(-tt * 16), 1.6);
    const env = Math.exp(-tt * 7) * Math.min(1, k / 40) * (k > n - 200 ? (n - k) / 200 : 1);
    const v = f.run(o1.next() + o2.next()) * env * vel * 0.11;
    pump(s + k, v, pan, 0.25);
    if (s + k < LEN) { dlyL[s + k] += v * 0.25; dlyR[s + k] += v * 0.15; }
  }
}
const DET = [-17, -8, 0, 8, 17]; // Cent
function supersaw(t, notes, dur, vel, fc0, fc1 = fc0, att = 0.01, rel = 0.15) {
  const s = Math.round(t * SR), n = Math.round((dur + rel) * SR), nd = Math.round(dur * SR);
  const osc = [];
  for (const m of notes) DET.forEach((c, j) => osc.push({ o: new Saw(midi(m) * Math.pow(2, c / 1200)), side: j % 2 }));
  const fL = new SVF(fc0, 0.8), fR = new SVF(fc0, 0.8);
  const norm = 1 / Math.sqrt(osc.length);
  for (let k = 0; k < n; k++) {
    if (k % 32 === 0) { const fc = expo(fc0, fc1, Math.min(1, k / nd)); fL.set(fc, 0.8); fR.set(fc, 0.8); }
    let l = 0, r = 0;
    for (const v of osc) { const x = v.o.next(); if (v.side) r += x; else l += x; }
    const env = Math.min(1, k / (att * SR)) * (k > nd ? Math.max(0, 1 - (k - nd) / (rel * SR)) : 1);
    const g = env * vel * norm * 0.2;
    const yl = fL.run(l + r * 0.35) * g, yr = fR.run(r + l * 0.35) * g;
    const i = s + k;
    if (i >= LEN) break;
    pumpL[i] += yl; pumpR[i] += yr;
    verbSend[i] += (yl + yr) * 0.25;
  }
}
function lead(t, m, dur, vel) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const osc = DET.map((c) => new Saw(midi(m) * Math.pow(2, c * 0.6 / 1200)));
  const f = new SVF(3000, 1.0);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) f.set(2200 + 4500 * Math.exp(-tt * 7), 1.0);
    const vib = 1 + 0.005 * Math.sin(2 * Math.PI * 5.8 * tt) * clamp01((tt - 0.18) / 0.2);
    let x = 0;
    for (const o of osc) x += o.next(vib);
    const env = Math.min(1, k / 200) * (k > n - 500 ? Math.max(0, (n - k) / 500) : 1);
    const v = f.run(x) * env * vel * 0.12;
    dry(s + k, v, 0, 0.28);
    if (s + k < LEN) { dlyL[s + k] += v * 0.35; dlyR[s + k] += v * 0.25; }
  }
}

// ---------- Harmonie ----------
const CH = {
  Em: { r: 40, v: [59, 64, 67, 71] }, C: { r: 36, v: [60, 64, 67, 72] }, G: { r: 43, v: [59, 62, 67, 71] },
  D: { r: 38, v: [57, 62, 66, 69] }, Am: { r: 45, v: [57, 60, 64, 69] }, B: { r: 35, v: [59, 63, 66, 71] },
  // fis-Moll (Rückung um einen Ganzton)
  Bm: { r: 35, v: [59, 62, 66, 71] }, D2: { r: 38, v: [62, 66, 69, 74] }, E: { r: 40, v: [59, 64, 68, 71] },
  Cs: { r: 37, v: [61, 65, 68, 73] }, Fm: { r: 42, v: [61, 66, 69, 73] }, A: { r: 45, v: [61, 64, 69, 73] },
};
const ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 1, 3, 2, 4, 3, 2];
function arpBar(t0, ch, vel, bright, upto = 16, oct = 0) {
  const notes = [...ch.v, ch.v[0] + 12];
  for (let i = 0; i < upto; i++) pluck(t0 + i * S16, notes[ARP[i]] + oct, S16 * 1.8, vel * (i % 4 ? 0.75 : 1), bright, i % 2 ? 0.45 : -0.45);
}
// pattern "all": jede 16tel; "off": ohne die 16tel auf dem Schlag (Platz für den Kick)
function bassBar(t0, ch, vel, cutoff, pattern = "all", upto = 16) {
  for (let i = 0; i < upto; i++) {
    if (pattern === "off" && i % 4 === 0) continue;
    bass(t0 + i * S16, ch.r, S16 * 0.85, vel * (i % 4 === 2 ? 1 : 0.85), cutoff);
  }
}
function fourFloor(bar, upto = 4, vel = 1, depth = 0.7) {
  for (let b = 0; b < upto; b++) kick(T(bar, b), vel, depth);
}

// Hauptmelodie (8 Takte über Em C G D Em C G D): [Beat, MIDI, Dauer]
const MEL = [
  [[0, 76, .5], [.5, 79, .5], [1, 83, .75], [1.75, 81, .25], [2, 79, .5], [2.5, 78, .5], [3, 76, .5], [3.5, 71, .5]],
  [[0, 76, .5], [.5, 79, .5], [1, 84, .75], [1.75, 83, .25], [2, 79, .5], [2.5, 76, .5], [3, 72, 1]],
  [[0, 74, .5], [.5, 79, .5], [1, 83, .75], [1.75, 81, .25], [2, 79, .5], [2.5, 78, .5], [3, 74, .5], [3.5, 79, .5]],
  [[0, 78, 1.5], [1.5, 81, .5], [2, 78, .5], [2.5, 74, .5], [3, 73, .5], [3.5, 74, .5]],
  [[0, 76, .5], [.5, 79, .5], [1, 83, .75], [1.75, 81, .25], [2, 79, .5], [2.5, 78, .5], [3, 76, .5], [3.5, 71, .5]],
  [[0, 76, .5], [.5, 79, .5], [1, 84, .5], [1.5, 86, .5], [2, 88, 1], [3, 84, 1]],
  [[0, 86, .75], [.75, 83, .25], [1, 79, .5], [1.5, 83, .5], [2, 86, 1], [3, 83, .5], [3.5, 81, .5]],
  [[0, 81, 1], [1, 78, .5], [1.5, 74, .5], [2, 78, 1], [3, 81, .5], [3.5, 83, .5]],
];
const CALM_MEL = [[[0, 71, 2], [2, 76, 2]], [[0, 79, 3], [3, 76, 1]], [[0, 74, 2], [2, 79, 2]], [[0, 78, 4]]];

// ---------- Komposition ----------
const DROP = ["Em", "C", "G", "D"];

// 1) Intro (Takte 0–7): Uhr tickt, Bass pulsiert mit sich öffnendem Filter, ab Takt 4 Herzschlag
for (let b = 0; b < 8; b++) {
  const t0 = T(b), x = b / 7;
  for (let q = 0; q < 4; q++) tick(T(b, q), q % 2, lerp(0.6, 1, x));
  bassBar(t0, CH.Em, lerp(0.25, 0.55, x), expo(160, 900, x));
  if (b % 2 === 0) supersaw(t0, [52, 59, 64], BAR * 2, 0.45, 500, 900, 1.2, 0.5);
  if (b >= 4) { heartbeat(T(b, 0), lerp(0.7, 1, x)); heartbeat(T(b, 2), lerp(0.7, 1, x)); }
}
riser(T(6), BAR * 2, 0.7);

// 2) Aufbau (8–15): Kick, Arpeggio öffnet sich, ab 12 Clap und 16tel-Hats
for (let b = 8; b < 16; b++) {
  const t0 = T(b), x = (b - 8) / 7, ch = CH[DROP[(b - 8) % 4]];
  fourFloor(b, 4, 0.95, 0.55);
  bassBar(t0, ch, 0.6, expo(900, 1500, x), "off");
  arpBar(t0, ch, lerp(0.7, 1, x), expo(700, 3500, x));
  supersaw(t0, ch.v, BAR, 0.45, expo(700, 1800, x));
  for (let e = 0; e < 4; e++) hat(T(b, e + 0.5), 0.8, false);
  if (b >= 12) {
    clap(T(b, 1), 0.85); clap(T(b, 3), 0.85);
    for (let i = 0; i < 16; i++) if (i % 2 === 0) hat(t0 + i * S16, 0.45, false, -0.3);
  }
}
crash(T(8), 0.8);

// 3) Spannung (16–23): Am Am C C D D B B – Snare-Wirbel wird immer dichter, Uhr tickt doppelt so schnell,
//    Filter öffnen sich, letzter Schlag vor dem Drop ist still.
const TENSION = ["Am", "Am", "C", "C", "D", "D", "B", "B"];
function buildUp(startBar, chords, opts = {}) {
  const N = chords.length;
  for (let j = 0; j < N; j++) {
    const b = startBar + j, t0 = T(b), x = j / (N - 1), ch = CH[chords[j]];
    const last = j === N - 1;
    const upto = last ? 12 : 16; // letzter Schlag: Stille
    if (j < N - 2) fourFloor(b, 4, 0.95, 0.5);
    else if (j === N - 2) for (let e = 0; e < 8; e++) kick(T(b, e / 2), 0.8, 0.4);
    bassBar(t0, ch, lerp(0.5, 0.8, x), expo(opts.bass0 || 600, 3200, x), "all", upto);
    arpBar(t0, ch, 0.8, expo(1200, 4500, x), upto, j >= N - 2 ? 12 : 0);
    supersaw(t0, ch.v, last ? BEAT * 3 : BAR, lerp(0.45, 0.8, x), expo(600, 2500, x), expo(600, 2500, (j + 1) / N), 0.02, last ? 0.02 : 0.15);
    // Uhr: Achtel, im letzten Takt 16tel
    const step = last ? 0.25 : 0.5;
    for (let q = 0; q < (last ? 3 : 4); q += step) tick(T(b, q), Math.round(q / step) % 2, lerp(0.7, 1.1, x));
    // Snare-Wirbel: Viertel → Achtel → 16tel → 32tel
    const div = N === 8 ? [1, 1, 2, 2, 4, 4, 4, 8][j] : [2, 4, 4, 8][j];
    for (let q = 0; q < (last ? 3 : 4); q += 1 / div) {
      const p = (j + q / 4) / N;
      snare(T(b, q), lerp(0.2, 1, p * p), lerp(170, 330, p), 0.3);
    }
  }
  riser(T(startBar + N - 4), BAR * 4 - BEAT * 0.25, 0.75);
}
buildUp(16, TENSION);

// 4) Drop (24–39)
function drop(startBar, chords, transpose, octaveDouble) {
  for (let j = 0; j < 16; j++) {
    const b = startBar + j, t0 = T(b), ch = CH[chords[j % 4]];
    fourFloor(b, 4, 1, 0.75);
    bassBar(t0, ch, 1, 1700, "off");
    supersaw(t0, ch.v, BAR - S16, 0.85, 4200);
    supersaw(t0, ch.v.map((m) => m + 12), BAR - S16, 0.3, 6000);
    arpBar(t0, ch, 0.45, 2500, 16, 12);
    clap(T(b, 1)); clap(T(b, 3));
    for (let e = 0; e < 4; e++) hat(T(b, e + 0.5), 1.3, true, 0.25);
    for (let i = 0; i < 16; i++) if (i % 2) hat(t0 + i * S16, 0.8, false, -0.35);
    for (const [off, m, d] of MEL[j % 8]) {
      lead(T(b, off), m + transpose, d * BEAT, 1);
      if (octaveDouble) lead(T(b, off) + 0.004, m + transpose - 12, d * BEAT, 0.55);
    }
    if (j % 8 === 7) for (let i = 12; i < 16; i++) snare(t0 + i * S16, 0.5 + (i - 12) * 0.12, 220, 0.3);
    if (j % 8 === 0) crash(t0, 1);
  }
}
impact(T(24), 1);
drop(24, DROP, 0, false);

// 5) Breakdown (40–47): kurz durchatmen, dann Neuaufbau mit Rückung nach fis-Moll
for (let j = 0; j < 4; j++) {
  const b = 40 + j, t0 = T(b), ch = CH[DROP[j]];
  supersaw(t0, ch.v, BAR, 0.5, 900, 1200, 0.25, 0.4);
  arpBar(t0, ch, 0.55, 900);
  bass(t0, ch.r, BAR * 0.95, 0.6, 400);
  heartbeat(T(b, 0), 0.8); heartbeat(T(b, 2), 0.8);
  for (let q = 0; q < 4; q++) tick(T(b, q), q % 2, 0.55);
  for (const [off, m, d] of CALM_MEL[j]) lead(T(b, off), m, d * BEAT, 0.6);
}
crash(T(40), 0.6);
buildUp(44, ["Bm", "D2", "E", "Cs"], { bass0: 900 });

// 6) Finaler Drop (48–63) in fis-Moll, Melodie mit Oktav-Dopplung
impact(T(48), 1.1);
drop(48, ["Fm", "D2", "A", "E"], 2, true);

// 7) Schluss (64–67): großer Schlag, Akkord klingt aus, die Uhr bleibt stehen
impact(T(64), 1.1);
supersaw(T(64), CH.Fm.v, BAR * 3, 0.85, 4500, 400, 0.01, 1.5);
supersaw(T(64), [CH.Fm.v[0] - 12], BAR * 3, 0.6, 1500, 300, 0.01, 1.5);
bass(T(64), 42, BAR * 2, 0.9, 500);
for (let i = 0; i < 16; i++) pluck(T(64) + i * S16, [...CH.Fm.v, 85][ARP[i]], S16 * 2, 0.6 * (1 - i / 16), 3000, i % 2 ? 0.5 : -0.5);
[0, 1, 2, 3.5, 6].forEach((q, i) => tick(T(65, q), i % 2, 0.9 - i * 0.12));
heartbeat(T(67, 1), 0.7);

// ---------- Effekte & Mix ----------
const dly = Math.round(BEAT * 0.75 * SR);
for (let i = dly; i < LEN; i++) {
  dlyL[i] += dlyR[i - dly] * 0.35;
  dlyR[i] += dlyL[i - dly] * 0.35;
}
function reverb(input, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(LEN);
  for (let n = 0; n < LEN; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.65 + c.lp * 0.35;
      c.buf[c.i] = x + c.lp * 0.83;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = y + b * 0.5;
      y = b - y;
      a.i = (a.i + 1) % a.buf.length;
    }
    out[n] = y;
  }
  return out;
}
const vL = reverb(verbSend, 0), vR = reverb(verbSend, 23);
const L = new Float32Array(LEN), R = new Float32Array(LEN);
for (let i = 0; i < LEN; i++) {
  L[i] = pumpL[i] * duck[i] + dryL[i] + vL[i] * 0.9 + dlyL[i] * 0.5;
  R[i] = pumpR[i] * duck[i] + dryR[i] + vR[i] * 0.9 + dlyR[i] * 0.5;
}
function hpf(x, fc) {
  const a = 1 / (1 + 2 * Math.PI * fc / SR);
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - px); px = x[i]; x[i] = y; }
}
for (const ch of [L, R]) { hpf(ch, 30); hpf(ch, 30); }
// Fade am Ende
const fadeN = Math.round(1.5 * SR);
for (let k = 0; k < fadeN; k++) { const g = 1 - k / fadeN; L[LEN - fadeN + k] *= g; R[LEN - fadeN + k] *= g; }

let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const DRIVE = 1.6, gain = 1 / peak;
const out = Buffer.alloc(44 + LEN * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + LEN * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(LEN * 4, 40);
const norm = 0.93 / Math.tanh(DRIVE);
for (let i = 0; i < LEN; i++) {
  out.writeInt16LE(Math.round(Math.tanh(L[i] * gain * DRIVE) * norm * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.tanh(R[i] * gain * DRIVE) * norm * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || "countdown.wav", out);
console.log(`${BARS} Takte, ${(LEN / SR).toFixed(1)} s, Spitze vor Normalisierung ${peak.toFixed(2)}`);
