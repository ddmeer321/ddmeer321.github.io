// „Pullover-Nacht“ – Eigenkomposition, dunkler Indie-Rock, d-Moll, 100 BPM.
// Offline-Synthese in reinem JS → WAV (Stereo, 44,1 kHz, 16 Bit).
import fs from "node:fs";

const SR = 44100;
const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Ablauf ----------
// Akkord-Voicings (MIDI), tief → hoch
const CH = {
  Dm: [50, 57, 62, 65, 69],
  Bb: [46, 53, 58, 62, 65],
  F: [41, 53, 60, 65, 69],
  C: [48, 55, 60, 64, 67],
  Gm: [43, 55, 58, 62, 67],
  A: [45, 57, 61, 64, 69],
};
const sections = [
  { name: "intro", bars: ["Dm", "Bb", "F", "C"], drums: 0, bass: 0, lead: 0, pad: 0.5 },
  { name: "verse", bars: ["Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C"], drums: 1, bass: 1, lead: 0, pad: 0.6 },
  { name: "pre", bars: ["Gm", "Bb", "C", "C"], drums: 1, bass: 1, lead: 0, pad: 1, build: true },
  { name: "chorus", bars: ["Bb", "C", "Dm", "Dm", "Bb", "C", "F", "A"], drums: 2, bass: 2, lead: 1, pad: 1 },
  { name: "break", bars: ["Dm", "Bb", "F", "C"], drums: 0, bass: 1, lead: 0.5, pad: 0.7 },
  { name: "chorus2", bars: ["Bb", "C", "Dm", "Dm", "Bb", "C", "F", "A"], drums: 2, bass: 2, lead: 1, pad: 1 },
  { name: "outro", bars: ["Dm", "Bb", "Dm", "Dm"], drums: 0, bass: 1, lead: 0, pad: 0.6, fade: true },
];
const totalBars = sections.reduce((s, x) => s + x.bars.length, 0);
const LEN = Math.ceil((totalBars * BAR + 4) * SR);

// Busse
const dryL = new Float32Array(LEN), dryR = new Float32Array(LEN);
const verbSend = new Float32Array(LEN); // Mono-Send in den Hall
const delayL = new Float32Array(LEN), delayR = new Float32Array(LEN);

function add(buf, i, v) {
  if (i >= 0 && i < LEN) buf[i] += v;
}
function addStereo(i, v, pan, verb = 0) {
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  add(dryL, i, v * l);
  add(dryR, i, v * r);
  if (verb) add(verbSend, i, v * verb);
}

// deterministischer Zufall
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------- Instrumente ----------
// Gezupfte Gitarre (Karplus-Strong) mit leichtem Chorus durch zweite, verstimmte Saite
function pluck(t, m, vel, dur, pan) {
  for (const [det, p] of [[0, pan], [0.12, -pan * 0.6]]) {
    const f = midi(m) * Math.pow(2, det / 1200 * 8);
    const N = Math.max(2, Math.round(SR / f));
    const buf = new Float32Array(N);
    for (let k = 0; k < N; k++) buf[k] = (rnd() * 2 - 1) * 0.9;
    const start = Math.round(t * SR), n = Math.round(dur * SR);
    let idx = 0, prev = 0, lp = 0;
    for (let k = 0; k < n; k++) {
      const cur = buf[idx];
      const nxt = buf[(idx + 1) % N];
      buf[idx] = 0.4985 * (cur + nxt); // Dämpfung
      idx = (idx + 1) % N;
      lp += 0.35 * (cur - lp); // warm
      const env = k < 40 ? k / 40 : 1;
      const tail = k > n - 2000 ? (n - k) / 2000 : 1;
      addStereo(start + k, lp * vel * 0.4 * env * tail, p, 0.55);
      prev = cur;
    }
  }
}

function bassNote(t, m, dur, vel) {
  const f = midi(m), s = Math.round(t * SR), n = Math.round(dur * SR);
  let ph = 0, lp = 0;
  for (let k = 0; k < n; k++) {
    ph += f / SR;
    const saw = 2 * (ph % 1) - 1;
    const sine = Math.sin(2 * Math.PI * ph);
    lp += 0.06 * (saw - lp);
    const a = Math.min(1, k / 300), r = k > n - 1500 ? (n - k) / 1500 : 1;
    const v = (sine * 0.65 + lp * 0.5) * a * r * vel * 0.3;
    addStereo(s + k, v, 0, 0.04);
  }
}

function kick(t, vel = 1) {
  const s = Math.round(t * SR), n = Math.round(0.45 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const f = 45 + 95 * Math.exp(-tt * 28);
    ph += f / SR;
    const v = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 9) * vel * 0.75;
    addStereo(s + k, v, 0, 0.05);
  }
}

function snare(t, vel = 1, verb = 0.9) {
  const s = Math.round(t * SR), n = Math.round(0.35 * SR);
  let bp1 = 0, bp2 = 0, ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const noise = rnd() * 2 - 1;
    // grober Bandpass um ~2 kHz
    bp1 += 0.35 * (noise - bp1);
    bp2 += 0.08 * (bp1 - bp2);
    const nz = (bp1 - bp2) * Math.exp(-tt * 14);
    ph += 185 / SR;
    const tone = Math.sin(2 * Math.PI * ph) * Math.exp(-tt * 30);
    addStereo(s + k, (nz * 1.6 + tone * 0.5) * vel * 0.5, 0.05, verb);
  }
}

function hat(t, vel = 1, open = false) {
  const s = Math.round(t * SR), n = Math.round((open ? 0.22 : 0.05) * SR);
  let hp = 0, prev = 0;
  for (let k = 0; k < n; k++) {
    const noise = rnd() * 2 - 1;
    hp = 0.92 * (hp + noise - prev);
    prev = noise;
    const env = Math.exp(-(k / SR) * (open ? 14 : 70));
    addStereo(s + k, hp * env * vel * 0.12, 0.35, 0.15);
  }
}

// Flächen-Pad: verstimmte Sägezähne, weich gefiltert, langsamer Einsatz
function pad(t, notes, dur, vel) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const oscs = notes.flatMap((m) => [midi(m) * 1.003, midi(m) * 0.997]);
  const ph = oscs.map(() => rnd());
  let lpL = 0, lpR = 0;
  for (let k = 0; k < n; k++) {
    let l = 0, r = 0;
    for (let o = 0; o < oscs.length; o++) {
      ph[o] += oscs[o] / SR;
      const saw = 2 * (ph[o] % 1) - 1;
      if (o % 2) r += saw; else l += saw;
    }
    lpL += 0.012 * (l - lpL);
    lpR += 0.012 * (r - lpR);
    const a = Math.min(1, k / (SR * 0.9)), rel = k > n - SR * 0.6 ? (n - k) / (SR * 0.6) : 1;
    const g = a * rel * vel * 0.05;
    add(dryL, s + k, lpL * g);
    add(dryR, s + k, lpR * g);
    add(verbSend, s + k, (lpL + lpR) * g * 0.4);
  }
}

// „Falsett“-Lead: Sinus + etwas Dreieck, Vibrato, Gleiten, ins Echo
let leadPrev = null;
function lead(t, m, dur, vel) {
  const s = Math.round(t * SR), n = Math.round(dur * SR);
  const f1 = midi(m), f0 = leadPrev ? midi(leadPrev) : f1;
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const glide = Math.min(1, tt / 0.07);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.4 * tt) * Math.min(1, tt / 0.35);
    const f = (f0 + (f1 - f0) * glide) * vib;
    ph += f / SR;
    const p = ph % 1;
    const tri = 4 * Math.abs(p - 0.5) - 1;
    const v = (Math.sin(2 * Math.PI * ph) * 0.8 + tri * 0.2 + Math.sin(4 * Math.PI * ph) * 0.08);
    const a = Math.min(1, k / 1800), r = k > n - 2500 ? Math.max(0, (n - k) / 2500) : 1;
    const out = v * a * r * vel * 0.2;
    addStereo(s + k, out, -0.05, 0.45);
    add(delayL, s + k, out * 0.5);
    add(delayR, s + k, out * 0.35);
  }
  leadPrev = m;
}

// ---------- Komposition ----------
const ARP = [0, 2, 3, 4, 3, 2, 1, 2];
// Refrain-Melodie: [Beat-Offset, MIDI, Dauer in Beats] je Takt
const CHORUS_MEL = [
  [[0, 69, 1], [1, 74, 1.5], [2.5, 72, 0.5], [3, 70, 1]],
  [[0, 67, 1], [1, 72, 1], [2, 76, 1.5], [3.5, 74, 0.5]],
  [[0, 77, 2], [2, 76, 0.5], [2.5, 74, 1.5]],
  [[0, 69, 3]],
  [[0, 70, 1], [1, 74, 1], [2, 77, 1.5], [3.5, 76, 0.5]],
  [[0, 79, 1.5], [1.5, 77, 0.5], [2, 76, 1], [3, 72, 1]],
  [[0, 77, 1], [1, 76, 1], [2, 74, 2]],
  [[0, 73, 2], [2, 76, 1], [3, 74, 1]],
];
const BREAK_MEL = [[[0, 74, 3]], [[0, 70, 2], [2, 72, 2]], [[0, 72, 3]], [[0, 67, 2], [2, 69, 2]]];

let bar = 0;
for (const sec of sections) {
  sec.bars.forEach((name, bi) => {
    const t0 = bar * BAR;
    const v = CH[name];
    const fade = sec.fade ? Math.max(0.15, 1 - bi / sec.bars.length) : 1;
    // Gitarre: Achtel-Arpeggio, im Refrain zusätzlich gedoppelt eine Oktave höher
    for (let e = 0; e < 8; e++) {
      const n = v[ARP[e]];
      const vel = (e % 2 ? 0.75 : 1) * fade * (sec.drums === 2 ? 1 : 0.9);
      pluck(t0 + e * BEAT / 2 + (rnd() - 0.5) * 0.008, n, vel, BEAT * 1.6, -0.45);
      if (sec.drums === 2 && e % 2 === 0) pluck(t0 + e * BEAT / 2 + 0.012, n + 12, vel * 0.45, BEAT * 1.2, 0.5);
    }
    // Pad
    if (sec.pad) pad(t0, v.slice(1, 4), BAR + 0.3, sec.pad * fade);
    // Bass
    if (sec.bass === 1) bassNote(t0, v[0] - 12 + (v[0] < 45 ? 12 : 0), BAR * 0.95, 0.9 * fade);
    if (sec.bass === 2) for (let e = 0; e < 8; e++) bassNote(t0 + e * BEAT / 2, v[0] - 12 + (v[0] < 45 ? 12 : 0), BEAT / 2 * 0.9, e % 2 ? 0.7 : 0.95);
    // Schlagzeug: Halftime-Groove (Snare auf 3), im Refrain mit offenen Hats
    if (sec.drums) {
      kick(t0, 1);
      kick(t0 + BEAT * 1.5, 0.7);
      if (sec.drums === 2) kick(t0 + BEAT * 2.75, 0.6);
      snare(t0 + BEAT * 2, sec.drums === 2 ? 1 : 0.85);
      for (let e = 0; e < 8; e++) hat(t0 + e * BEAT / 2, e % 2 ? 0.6 : 1, sec.drums === 2 && e === 7);
      if (sec.build && bi >= 2) for (let s16 = 0; s16 < 8; s16++) snare(t0 + BEAT * 2 + s16 * BEAT / 4, 0.25 + s16 * 0.06, 0.6);
    }
    // Melodie
    if (sec.lead) {
      const mel = sec.name.startsWith("chorus") ? CHORUS_MEL[bi] : BREAK_MEL[bi];
      for (const [off, m, d] of mel || []) lead(t0 + off * BEAT, m, d * BEAT, sec.lead);
    }
    bar++;
  });
}
// Schlusston
pluck(bar * BAR, 50, 0.9, 4, -0.3);
pluck(bar * BAR + 0.02, 62, 0.6, 4, 0.3);

// ---------- Effekte ----------
// Ping-Pong-Echo (punktierte Achtel) für den Lead
const dly = Math.round(BEAT * 0.75 * SR);
for (let i = dly; i < LEN; i++) {
  delayL[i] += delayR[i - dly] * 0.38;
  delayR[i] += delayL[i - dly] * 0.38;
}
// Freeverb-artiger Hall (Kammfilter + Allpässe), großer Raum
function reverb(input, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(LEN);
  const fb = 0.86, damp = 0.3;
  for (let n = 0; n < LEN; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * (1 - damp) + c.lp * damp;
      c.buf[c.i] = x + c.lp * fb;
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
const verbL = reverb(verbSend, 0);
const verbR = reverb(verbSend, 23);

// ---------- Mix & Export ----------
const L = new Float32Array(LEN), R = new Float32Array(LEN);
let peak = 0;
for (let i = 0; i < LEN; i++) {
  L[i] = dryL[i] + verbL[i] * 1.0 + delayL[i] * 0.55;
  R[i] = dryR[i] + verbR[i] * 1.0 + delayR[i] * 0.55;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
// Tiefenfilter (2× einpolig, ~35 Hz) gegen Rumpeln unter dem Bass
function hpf(x, fc) {
  const a = 1 / (1 + 2 * Math.PI * fc / SR);
  let y = 0, px = 0;
  for (let i = 0; i < x.length; i++) {
    y = a * (y + x[i] - px);
    px = x[i];
    x[i] = y;
  }
}
for (const ch of [L, R]) {
  hpf(ch, 35);
  hpf(ch, 35);
}
peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = 0.89 / peak;
const out = Buffer.alloc(44 + LEN * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + LEN * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  const sl = Math.tanh(L[i] * gain * 1.1) / Math.tanh(1.1);
  const sr = Math.tanh(R[i] * gain * 1.1) / Math.tanh(1.1);
  out.writeInt16LE(Math.round(sl * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(sr * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || "pullover.wav", out);
console.log(`${totalBars} Takte, ${(LEN / SR).toFixed(1)} s, Spitze ${peak.toFixed(2)}`);
