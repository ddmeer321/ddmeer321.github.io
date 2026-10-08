// „Spiegelparkett“ – Eigenkomposition, geheimnisvoller, treibender 80er-Dance-Pop, g-Moll, 124 BPM.
// Trockener Drumcomputer, synkopierte Ostinato-Basslinie, Synth-Stabs, gedämpfte Funk-Gitarre,
// Streicherflächen und ein Synth-Lead. Offline-Synthese → WAV.
import fs from "node:fs";

const SR = 44100, BPM = 124, BEAT = 60 / BPM, BAR = BEAT * 4, S16 = BEAT / 4;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BARS = 64;
const LEN = Math.ceil((BARS * BAR + 4) * SR);
const T = (bar, beat = 0) => bar * BAR + beat * BEAT;
const lerp = (a, b, x) => a + (b - a) * x;
const expo = (a, b, x) => a * Math.pow(b / a, x);

const L0 = new Float32Array(LEN), R0 = new Float32Array(LEN);
const verbSend = new Float32Array(LEN);
const dlyL = new Float32Array(LEN), dlyR = new Float32Array(LEN);
function put(i, v, pan = 0, verb = 0) {
  if (i < 0 || i >= LEN) return;
  L0[i] += v * Math.cos((pan + 1) * Math.PI / 4);
  R0[i] += v * Math.sin((pan + 1) * Math.PI / 4);
  if (verb) verbSend[i] += v * verb;
}
let seed = 31;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;

class SVF {
  constructor(fc = 1000, q = 0.7) { this.ic1 = 0; this.ic2 = 0; this.set(fc, q); }
  set(fc, q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1; this.hp = v0 - this.k * v1 - v2;
    return (this.lp = v2);
  }
}
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
class Saw {
  constructor(f) { this.f = f; this.p = rnd(); }
  next() { const dt = this.f / SR; this.p += dt; if (this.p >= 1) this.p -= 1; return 2 * this.p - 1 - blep(this.p, dt); }
}

// ---------- Drumcomputer (trocken, knackig) ----------
function kick(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.35 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    ph += (52 + 95 * Math.exp(-tt * 40)) / SR;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 11) + noise() * Math.exp(-tt * 500) * 0.4;
    put(s + k, Math.tanh(v * 1.4) * vel * 0.6, 0, 0.01);
  }
}
function snare(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.25 * SR);
  const f = new SVF(2400, 0.7), snap = new SVF(1400, 1.5);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const x = noise();
    f.run(x); snap.run(x);
    ph += (190 + 30 * Math.exp(-tt * 50)) / SR;
    // Snare + Fingerschnipp-/Klatsch-Schicht, kurz „gegatet“ wie bei 80er-Drumcomputern
    const gate = tt < 0.16 ? 1 : Math.max(0, 1 - (tt - 0.16) / 0.04);
    const v = (f.bp * 1.2 + f.hp * 0.5) * Math.exp(-tt * 16) + Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 30) * 0.6
      + snap.bp * (tt < 0.025 ? Math.exp(-(tt % 0.008) * 400) : Math.exp(-(tt - 0.025) * 40)) * 1.2;
    put(s + k, v * gate * vel * 0.42, 0.04, 0.12);
  }
}
function hat(t, vel = 1, open = false) {
  const s = Math.round(t * SR), n = Math.round((open ? 0.22 : 0.045) * SR);
  const f = new SVF(9000, 0.8);
  for (let k = 0; k < n; k++) {
    f.run(noise());
    put(s + k, f.hp * Math.exp(-(k / SR) * (open ? 13 : 75)) * vel * 0.32, 0.3, 0.02);
  }
}
function shaker(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.08 * SR);
  const f = new SVF(6500, 1.2);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    f.run(noise());
    put(s + k, f.bp * Math.min(1, tt / 0.012) * Math.exp(-tt * 45) * vel * 0.26, -0.35, 0.05);
  }
}
function clap(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.3 * SR);
  const f = new SVF(1200, 1.1);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    f.run(noise());
    const env = tt < 0.03 ? Math.exp(-(tt % 0.01) * 330) : Math.exp(-(tt - 0.03) * 22);
    put(s + k, f.bp * env * vel * 0.8, -0.1, 0.3);
  }
}
function crash(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(2.2 * SR);
  const f = new SVF(6000, 0.7);
  for (let k = 0; k < n; k++) {
    f.run(noise());
    put(s + k, f.hp * Math.exp(-(k / SR) * 2) * vel * 0.12, -0.4, 0.3);
  }
}

function riser(t, dur, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const f = new SVF(400, 2);
  for (let k = 0; k < n; k++) {
    const x = k / n;
    if (k % 32 === 0) f.set(expo(400, 9000, x), 2);
    f.run(noise());
    put(s + k, f.bp * x * x * vel * 0.35, Math.sin(x * 30) * 0.5, 0.3);
  }
}
// Synth-Bläser-Stoß (kräftiger, heller Akkord)
function brass(t, notes, dur, vel = 1) {
  const s = Math.round(t * SR), n = Math.round((dur + 0.15) * SR), nd = Math.round(dur * SR);
  const osc = notes.flatMap((m) => [new Saw(midi(m) * 0.996), new Saw(midi(m) * 1.004), new Saw(midi(m) * 0.5)]);
  const f = new SVF(1000, 1.2);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) f.set(600 + 4200 * Math.min(1, tt / 0.03) * Math.exp(-tt * 5), 1.2);
    let x = 0;
    osc.forEach((o, j) => (x += o.next() * (j % 3 === 2 ? 0.5 : 1)));
    const env = Math.min(1, k / 80) * (k > nd ? Math.max(0, 1 - (k - nd) / (0.15 * SR)) : 1);
    const y = f.run(x) * env * vel * 0.045;
    const i = s + k;
    if (i >= LEN) break;
    L0[i] += y * 0.9; R0[i] += y; verbSend[i] += y * 0.4;
  }
}

// ---------- Instrumente ----------
// Moog-artiger Bass: Säge + Puls, knackiger Filter-Anschlag, kurz und trocken
function bass(t, m, dur, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const o1 = new Saw(midi(m)), o2 = new Saw(midi(m) * 1.003);
  const f = new SVF(600, 1.3);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) f.set(260 + 1500 * Math.exp(-tt * 26), 1.3);
    o2.next();
    const x = o1.next() * 0.6 + (o2.p < 0.5 ? 0.5 : -0.5); // Säge + Rechteck
    const env = Math.min(1, k / 30) * (k > n - 250 ? (n - k) / 250 : 1) * (0.75 + 0.25 * Math.exp(-tt * 8));
    put(s + k, Math.tanh(f.run(x) * 1.6) * env * vel * 0.22, 0, 0);
  }
}
// Synth-Stab: kurze, gefilterte Akkord-Stöße
function stab(t, notes, dur, vel = 1, bright = 2400) {
  const s = Math.round(t * SR), n = Math.round((dur + 0.08) * SR), nd = Math.round(dur * SR);
  const osc = notes.flatMap((m) => [new Saw(midi(m) * 0.997), new Saw(midi(m) * 1.003)]);
  const fl = new SVF(1000, 1.1), fr = new SVF(1000, 1.1);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    if (k % 32 === 0) { const fc = 350 + bright * Math.exp(-tt * 14); fl.set(fc, 1.1); fr.set(fc, 1.1); }
    let l = 0, r = 0;
    osc.forEach((o, j) => { const x = o.next(); if (j % 2) r += x; else l += x; });
    const env = Math.min(1, k / 60) * (k > nd ? Math.max(0, 1 - (k - nd) / (0.08 * SR)) : 1);
    const g = env * vel * 0.06;
    const i = s + k;
    if (i >= LEN) break;
    const yl = fl.run(l) * g, yr = fr.run(r) * g;
    L0[i] += yl; R0[i] += yr; verbSend[i] += (yl + yr) * 0.3;
    dlyL[i] += yl * 0.15; dlyR[i] += yr * 0.1;
  }
}
// Streicher: breite, langsam einschwellende Fläche
function strings(t, notes, dur, vel = 1, att = 0.5, cut = 2600) {
  const s = Math.round(t * SR), n = Math.round((dur + 0.6) * SR), nd = Math.round(dur * SR);
  const det = [-14, -6, 0, 6, 14];
  const osc = [];
  for (const m of notes) det.forEach((c, j) => osc.push({ o: new Saw(midi(m) * Math.pow(2, c / 1200)), side: j % 2 }));
  const fl = new SVF(cut, 0.7), fr = new SVF(cut, 0.7);
  const norm = 1 / Math.sqrt(osc.length);
  for (let k = 0; k < n; k++) {
    let l = 0, r = 0;
    for (const v of osc) { const x = v.o.next(); if (v.side) r += x; else l += x; }
    const tt = k / SR;
    const vib = 1 + 0.1 * Math.sin(2 * Math.PI * 0.3 * tt);
    const env = Math.min(1, tt / att) * (k > nd ? Math.max(0, 1 - (k - nd) / (0.6 * SR)) : 1);
    const g = env * vel * norm * 0.11 * vib;
    const i = s + k;
    if (i >= LEN) break;
    const yl = fl.run(l + r * 0.3) * g, yr = fr.run(r + l * 0.3) * g;
    L0[i] += yl; R0[i] += yr; verbSend[i] += (yl + yr) * 0.5;
  }
}
// E-Piano (FM, Rhodes-artig)
function epiano(t, notes, dur, vel = 1) {
  for (const [j, m] of notes.entries()) {
    const s = Math.round((t + j * 0.006) * SR), n = Math.round((dur + 0.3) * SR), nd = Math.round(dur * SR);
    const f = midi(m);
    for (let k = 0; k < n; k++) {
      const tt = k / SR;
      const idx = 1.6 * Math.exp(-tt * 5) + 0.2;
      const mod = Math.sin(2 * Math.PI * f * tt) * idx;
      const v = Math.sin(2 * Math.PI * f * tt + mod) * Math.exp(-tt * 1.4) + Math.sin(2 * Math.PI * f * 14 * tt) * Math.exp(-tt * 60) * 0.05;
      const env = Math.min(1, k / 50) * (k > nd ? Math.max(0, 1 - (k - nd) / (0.3 * SR)) : 1);
      put(s + k, v * env * vel * 0.07, j % 2 ? 0.3 : -0.3, 0.35);
    }
  }
}
// Gedämpfte Funk-Gitarre (Karplus-Strong, kurz, Bandpass)
function guitar(t, notes, vel = 1, dur = S16 * 0.8) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const f = new SVF(1800, 0.9);
  const strs = notes.map((m) => {
    const N = Math.max(2, Math.round(SR / midi(m)));
    const buf = new Float32Array(N);
    for (let k = 0; k < N; k++) buf[k] = noise();
    return { buf, N, idx: 0 };
  });
  for (let k = 0; k < n; k++) {
    let x = 0;
    for (const st of strs) {
      const cur = st.buf[st.idx];
      st.buf[st.idx] = 0.492 * (cur + st.buf[(st.idx + 1) % st.N]);
      st.idx = (st.idx + 1) % st.N;
      x += cur;
    }
    f.run(x);
    const env = Math.exp(-(k / SR) * 22) * (k > n - 100 ? (n - k) / 100 : 1);
    put(s + k, f.bp * env * vel * 0.2, 0.55, 0.1);
  }
}
// Synth-Lead: Sinus + Dreieck + etwas Puls, Vibrato, Echo
let leadPrev = null;
function lead(t, m, dur, vel = 1, pan = -0.05) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const f1 = midi(m), f0 = leadPrev ? midi(leadPrev) : f1;
  const lp = new SVF(5200, 0.8);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const vib = 1 + 0.007 * Math.sin(2 * Math.PI * 5.6 * tt) * Math.min(1, Math.max(0, (tt - 0.15) / 0.2));
    ph += (f0 + (f1 - f0) * Math.min(1, tt / 0.04)) * vib / SR;
    const p = ph % 1;
    const v = Math.sin(2 * Math.PI * ph) * 0.5 + (4 * Math.abs(p - 0.5) - 1) * 0.2 + (2 * p - 1) * 0.3 + (p < 0.3 ? 0.12 : -0.12);
    const env = Math.min(1, k / 250) * (k > n - 700 ? Math.max(0, (n - k) / 700) : 1);
    const y = lp.run(v) * env * vel * 0.2;
    put(s + k, y, pan, 0.25);
    if (s + k < LEN) { dlyL[s + k] += y * 0.35; dlyR[s + k] += y * 0.25; }
  }
  leadPrev = m;
}

// ---------- Harmonie ----------
// Akkord-Voicings über dem Bass, Bass-Grundton, Terz (3 = Moll, 4 = Dur), Septime relativ zum Grundton
const CH = {
  Gm9: { v: [58, 62, 65, 69], r: 31, third: 3, sev: -2 },
  Cm7: { v: [58, 60, 63, 67], r: 36, third: 3, sev: -2 },
  Eb: { v: [58, 62, 63, 67], r: 39, third: 4, sev: -1 },
  F: { v: [57, 60, 65, 69], r: 41, third: 4, sev: -2 },
  D7: { v: [57, 60, 62, 66], r: 38, third: 4, sev: -2 },
};
// Eigene, synkopierte Basslinie (16tel-Raster): [Position, Intervall, Länge]
const RIFF = [[0, "r", 3], [3, "r", 1], [4, "3", 2], [8, "5", 2], [10, "4", 1], [11, "3", 1], [12, "r", 2], [14, "7", 2]];
function bassBar(b, ch, vel = 1) {
  for (const [pos, iv, len] of RIFF) {
    const m = ch.r + (iv === "r" ? 0 : iv === "3" ? ch.third : iv === "4" ? 5 : iv === "5" ? 7 : ch.sev);
    bass(T(b) + pos * S16, m, len * S16 * 0.82, vel * (pos % 4 === 0 ? 1 : 0.85));
  }
}
function groove(b, { open = true, shake = true, clapOn = true, fillEnd = false, four = false, hats16 = false } = {}) {
  kick(T(b, 0)); kick(T(b, 2));
  if (four) { kick(T(b, 1), 0.9); kick(T(b, 3), 0.9); } else kick(T(b, 2.75), 0.6);
  snare(T(b, 1)); snare(T(b, 3));
  if (clapOn) { clap(T(b, 1), four ? 0.85 : 0.55); clap(T(b, 3), four ? 0.85 : 0.55); }
  if (hats16) for (let i = 0; i < 16; i++) hat(T(b) + i * S16, i % 4 === 2 ? 1 : i % 2 ? 0.4 : 0.65, i % 4 === 2);
  else for (let i = 0; i < 8; i++) hat(T(b, i / 2), i % 2 ? 0.7 : 0.85, open && i % 2 === 1);
  if (shake) for (let i = 0; i < 16; i++) shaker(T(b) + i * S16, i % 4 === 2 ? 1 : 0.55);
  if (fillEnd) for (let i = 12; i < 16; i++) snare(T(b) + i * S16, 0.45 + (i - 12) * 0.12);
}
function stabsBar(b, ch, vel = 1, bright = 2400) {
  // auf den „Und“-Zählzeiten, mit einem Vorzieher
  for (const q of [0.5, 1.5, 2.75, 3.5]) stab(T(b, q), ch.v, S16 * 1.3, vel, bright);
}
function guitarBar(b, ch, vel = 1) {
  const notes = ch.v.map((m) => m + 12).slice(0, 3);
  for (let i = 0; i < 16; i++) {
    const accent = i % 4 === 2 || i === 7 || i === 13;
    guitar(T(b) + i * S16, notes, accent ? vel : vel * 0.35);
  }
}
function play(bar, mel, vel = 1, shift = 0, pan) {
  for (const [off, m, d] of mel) lead(T(bar, off), m + shift, d * BEAT * 0.95, vel, pan);
}

const VERSE_CH = ["Gm9", "Cm7", "Gm9", "D7", "Gm9", "Cm7", "Gm9", "D7"];
const PRE_CH = ["Eb", "F", "Eb", "D7"];
const CHORUS_CH = ["Gm9", "Eb", "Cm7", "D7", "Gm9", "Eb", "Cm7", "D7"];
const VERSE_MEL = [
  [[0.5, 74, 0.5], [1, 72, 0.5], [1.5, 70, 1], [3, 67, 0.5], [3.5, 70, 0.5]],
  [[0, 72, 1.5], [1.5, 70, 0.5], [2, 67, 1], [3, 65, 1]],
  [[0.5, 74, 0.5], [1, 72, 0.5], [1.5, 70, 0.5], [2, 72, 0.5], [2.5, 74, 1.5]],
  [[0, 69, 1], [1, 66, 1], [2, 69, 2]],
  [[0.5, 74, 0.5], [1, 72, 0.5], [1.5, 70, 1], [3, 67, 0.5], [3.5, 70, 0.5]],
  [[0, 72, 1.5], [1.5, 74, 0.5], [2, 75, 1], [3, 74, 1]],
  [[0, 74, 1], [1, 70, 1], [2, 67, 2]],
  [[0, 66, 1], [1, 69, 1], [2, 72, 1], [3, 69, 1]],
];
const PRE_MEL = [[[0, 70, 2], [2, 72, 2]], [[0, 74, 2], [2, 72, 2]], [[0, 75, 3], [3, 74, 1]], [[0, 72, 1], [1, 74, 1], [2, 78, 2]]];
const CHORUS_MEL = [
  [[0, 79, 1], [1, 77, 0.5], [1.5, 74, 1], [2.5, 74, 0.5], [3, 77, 1]],
  [[0, 75, 1.5], [1.5, 74, 0.5], [2, 70, 2]],
  [[0, 72, 0.5], [0.5, 74, 0.5], [1, 75, 1], [2, 77, 1], [3, 75, 1]],
  [[0, 74, 2], [2, 72, 1], [3, 78, 1]],
  [[0, 79, 1], [1, 77, 0.5], [1.5, 74, 1], [2.5, 74, 0.5], [3, 77, 1]],
  [[0, 75, 1.5], [1.5, 74, 0.5], [2, 70, 2]],
  [[0, 72, 0.5], [0.5, 74, 0.5], [1, 75, 1], [2, 79, 1], [3, 77, 1]],
  [[0, 74, 3], [3, 78, 1]],
];

// ---------- Ablauf ----------
let bar = 0;
// Intro (4): Schlagzeug sofort, dann Bass, Stabs, Riser
for (let j = 0; j < 4; j++, bar++) {
  const ch = CH[VERSE_CH[j]];
  groove(bar, { open: j >= 1, shake: j >= 1, clapOn: j >= 2 });
  if (j >= 1) bassBar(bar, ch);
  if (j >= 2) stabsBar(bar, ch, 0.9, expo(1200, 3000, (j - 2) / 1));
  if (j === 3) { riser(T(bar), BAR, 0.8); for (let i = 12; i < 16; i++) snare(T(bar) + i * S16, 0.5 + (i - 12) * 0.12); }
}
crash(T(bar), 0.8);
function verse(nBars) {
  for (let j = 0; j < nBars; j++, bar++) {
    const ch = CH[VERSE_CH[j % 8]];
    groove(bar, { fillEnd: j === nBars - 1, hats16: j >= 4 });
    bassBar(bar, ch);
    stabsBar(bar, ch, 1, 3000);
    guitarBar(bar, ch, 0.85);
    play(bar, VERSE_MEL[j % 8], 1.05);
    if (j % 4 === 3) brass(T(bar, 3.5), ch.v, BEAT * 0.4, 0.7);
  }
}
function pre() {
  for (let j = 0; j < 4; j++, bar++) {
    const ch = CH[PRE_CH[j]];
    groove(bar, { open: true, hats16: true, four: j >= 2 });
    bassBar(bar, ch, 1);
    epiano(T(bar), ch.v, BAR * 0.95, 1);
    strings(T(bar), ch.v.map((m) => m + 12), BAR, lerp(0.6, 1.1, j / 3), 0.4, expo(1800, 4200, j / 3));
    play(bar, PRE_MEL[j], 1.05);
    if (j === 3) {
      riser(T(bar), BAR, 1);
      for (let i = 0; i < 16; i++) snare(T(bar) + i * S16, 0.3 + i * 0.045);
    }
  }
}
function chorus(final = false) {
  crash(T(bar), 1);
  brass(T(bar), CH[CHORUS_CH[0]].v.map((m) => m + 12), BEAT * 0.8, 1);
  for (let j = 0; j < 8; j++, bar++) {
    const ch = CH[CHORUS_CH[j]];
    groove(bar, { four: true, hats16: true, fillEnd: j === 7 && !final });
    if (j === 4) { crash(T(bar), 0.8); brass(T(bar), ch.v.map((m) => m + 12), BEAT * 0.8, 0.9); }
    bassBar(bar, ch, 1.1);
    stabsBar(bar, ch, 1, 3600);
    strings(T(bar), ch.v.map((m) => m + 12), BAR, 1.1, 0.15, 4200);
    guitarBar(bar, ch, 1.05);
    play(bar, CHORUS_MEL[j], 1.2);
    play(bar, CHORUS_MEL[j], 0.5, -12, 0.25);
    if (final) play(bar, CHORUS_MEL[j], 0.35, 12, -0.35);
    if (j % 4 === 3) brass(T(bar, 2.5), ch.v.map((m) => m + 12), BEAT * 0.4, 0.8), brass(T(bar, 3), ch.v.map((m) => m + 12), BEAT * 0.4, 0.9);
  }
}
verse(8);
pre();
chorus();
verse(8);
pre();
chorus();
// Break (8): Drums + Bass treiben weiter, Stabs mit sich öffnendem Filter, Riser und Wirbel zum Schluss
for (let j = 0; j < 8; j++, bar++) {
  const ch = CH[VERSE_CH[j]];
  groove(bar, { open: true, hats16: j >= 2, four: j >= 4 });
  bassBar(bar, ch, 1.1);
  if (j >= 2) stabsBar(bar, ch, 0.95, expo(500, 3800, (j - 2) / 5));
  if (j >= 6) strings(T(bar), ch.v.map((m) => m + 12), BAR, 0.9, 1.0, 3000);
  if (j === 6) riser(T(bar), BAR * 2, 1);
  if (j === 7) for (let i = 0; i < 16; i++) snare(T(bar) + i * S16, 0.35 + i * 0.045);
}
chorus(true);
// Outro (4): volle Energie bis zum harten Schluss
for (let j = 0; j < 4; j++, bar++) {
  const ch = CH[VERSE_CH[j]];
  if (j < 3) {
    groove(bar, { four: true, hats16: true });
    bassBar(bar, ch, 1.1);
    stabsBar(bar, ch, 1, 3000);
    guitarBar(bar, ch, 0.9);
  } else {
    kick(T(bar)); bass(T(bar), 31, BEAT * 2, 1.1);
    brass(T(bar), CH.Gm9.v.map((m) => m + 12), BEAT * 2, 1.1);
    strings(T(bar), CH.Gm9.v, BEAT * 2.5, 0.9, 0.02, 3000);
    crash(T(bar), 1);
  }
}

// ---------- Effekte & Mix ----------
const dly = Math.round(BEAT * 0.75 * SR);
for (let i = dly; i < LEN; i++) { dlyL[i] += dlyR[i - dly] * 0.32; dlyR[i] += dlyL[i - dly] * 0.32; }
function reverb(input, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(LEN);
  for (let n = 0; n < LEN; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.6 + c.lp * 0.4;
      c.buf[c.i] = x + c.lp * 0.82;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    for (const a of aps) { const b = a.buf[a.i]; a.buf[a.i] = y + b * 0.5; y = b - y; a.i = (a.i + 1) % a.buf.length; }
    out[n] = y;
  }
  return out;
}
const vL = reverb(verbSend, 0), vR = reverb(verbSend, 23);
const L = new Float32Array(LEN), R = new Float32Array(LEN);
for (let i = 0; i < LEN; i++) {
  L[i] = L0[i] + vL[i] * 0.7 + dlyL[i] * 0.45;
  R[i] = R0[i] + vR[i] * 0.7 + dlyR[i] * 0.45;
}
function hpf(x, fc) {
  const a = 1 / (1 + 2 * Math.PI * fc / SR);
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - px); px = x[i]; x[i] = y; }
}
for (const ch of [L, R]) { hpf(ch, 30); hpf(ch, 30); }
const fadeN = Math.round(1.5 * SR);
for (let k = 0; k < fadeN; k++) { const g = 1 - k / fadeN; L[LEN - fadeN + k] *= g; R[LEN - fadeN + k] *= g; }
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const DRIVE = 2.1, gain = 1 / peak, norm = 0.93 / Math.tanh(DRIVE);
const out = Buffer.alloc(44 + LEN * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + LEN * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  out.writeInt16LE(Math.round(Math.tanh(L[i] * gain * DRIVE) * norm * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.tanh(R[i] * gain * DRIVE) * norm * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || "spiegelparkett.wav", out);
console.log(`${bar} Takte gesetzt (geplant ${BARS}), ${(LEN / SR).toFixed(1)} s, Spitze ${peak.toFixed(2)}`);
