// Musik-Synthesizer der Jukebox (V1.2): Instrumente, die zur Laufzeit mit Web
// Audio erzeugt werden – keine Audiodateien, keine Lizenzfragen.
// Wird von js/audio/tracks.js (Kompositionen) und js/audio/music.js (Abspieler)
// benutzt. Beim Import passiert nichts; erst initSynth() braucht einen AudioContext.

let ctx = null;
let noiseBuf = null;
let irBuf = null;
export let pulse25 = null;
export let pulse12 = null;

const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function nm(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) throw new Error(`Unbekannte Note ${n}`);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}
/** Ein Takt Melodie: "A4:3 C5:3 E5:6 D5:4" (Längen in Sechzehnteln, Summe 16). */
export function bar(str) {
  const map = {};
  let s = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split(":");
    if (n !== "-") map[s] = [nm(n), Number(l)];
    s += Number(l);
  }
  if (s !== 16) throw new Error(`Takt hat ${s} statt 16 Sechzehntel: ${str}`);
  return map;
}

function pulseWave(duty) {
  const n = 64;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(re, im);
}

export function initSynth(audioCtx) {
  if (ctx === audioCtx) return;
  ctx = audioCtx;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const len = Math.floor(ctx.sampleRate * 2.6);
  irBuf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = irBuf.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  pulse25 = pulseWave(0.25);
  pulse12 = pulseWave(0.125);
  ksCache.clear();
}

export const stepDur = (tr) => 60 / tr.bpm / 4;

/**
 * Ausgang eines Stücks: eigener Hall, eigenes Echo, Klangfilter und ein
 * „Pump“-Bus (Sidechain). Alles hängt an `dest` und blendet gemeinsam aus.
 */
export function makeBus(tr, dest) {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(tr.gain ?? 1, ctx.currentTime, 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = tr.lp || 18000;
  out.connect(lp);
  lp.connect(dest);
  const rev = ctx.createConvolver();
  rev.buffer = irBuf;
  const revIn = ctx.createGain();
  revIn.connect(rev);
  rev.connect(out);
  const dl = ctx.createDelay(2);
  dl.delayTime.value = (tr.delaySteps || 3) * stepDur(tr);
  const fb = ctx.createGain();
  fb.gain.value = tr.feedback ?? 0.3;
  const dlf = ctx.createBiquadFilter();
  dlf.type = "lowpass";
  dlf.frequency.value = 2800;
  const dlIn = ctx.createGain();
  dlIn.connect(dl);
  dl.connect(dlf);
  dlf.connect(fb);
  fb.connect(dl);
  dlf.connect(out);
  const pump = ctx.createGain();
  pump.connect(out);
  return { out, pump, rev: revIn, dly: dlIn, extras: [], voices: 0 };
}

/** Mischt ein Stück aus und räumt danach alle Knoten weg (kein Speicherleck). */
export function closeBus(bus, fade = 0.12) {
  if (!bus || bus.closed) return;
  bus.closed = true;
  try {
    bus.out.gain.cancelScheduledValues(ctx.currentTime);
    bus.out.gain.setTargetAtTime(0, ctx.currentTime, fade);
  } catch {
    /* ignorieren */
  }
  setTimeout(() => {
    try {
      bus.extras.forEach((n) => n.stop());
      bus.out.disconnect();
    } catch {
      /* bereits getrennt */
    }
  }, fade * 1000 * 8 + 600);
}

function sends(bus, node, o) {
  if (o.rev) {
    const g = ctx.createGain();
    g.gain.value = o.rev;
    node.connect(g);
    g.connect(bus.rev);
  }
  if (o.dly) {
    const g = ctx.createGain();
    g.gain.value = o.dly;
    node.connect(g);
    g.connect(bus.dly);
  }
}

// ---------- Instrumente ----------

export function voice(bus, t, midi, dur, o = {}) {
  const f = mtof(midi);
  const v = o.vol ?? 0.1;
  const a = o.a ?? 0.005;
  const d = o.d ?? 0.1;
  const s = o.s ?? 0.7;
  const r = o.r ?? 0.08;
  const end = t + Math.max(dur, a + 0.01);
  const stop = end + r * 3 + 0.05;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.setTargetAtTime(v * s, t + a, d / 3);
  g.gain.setTargetAtTime(0, end, r / 3);
  let dest = g;
  if (o.cutoff) {
    const fl = ctx.createBiquadFilter();
    fl.type = "lowpass";
    fl.Q.value = o.q ?? 0.8;
    fl.frequency.setValueAtTime(o.cutoff, t);
    if (o.cutoffEnd) fl.frequency.exponentialRampToValueAtTime(o.cutoffEnd, t + (o.fdecay ?? dur));
    fl.connect(g);
    dest = fl;
  }
  const dets = o.detunes || [0];
  const oscs = dets.map((dc) => {
    const os = ctx.createOscillator();
    if (o.wave) os.setPeriodicWave(o.wave);
    else os.type = o.type || "sawtooth";
    os.frequency.setValueAtTime(f, t);
    os.detune.value = dc;
    const og = ctx.createGain();
    og.gain.value = 1 / Math.sqrt(dets.length);
    os.connect(og);
    og.connect(dest);
    os.start(t);
    os.stop(stop);
    return os;
  });
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibRate || 5.5;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(dur * 0.6, 0.35));
    lfo.connect(lg);
    oscs.forEach((os) => lg.connect(os.detune));
    lfo.start(t);
    lfo.stop(stop);
  }
  g.connect(o.to || bus.out);
  sends(bus, g, o);
}

/** E-Piano / Vibraphon / Glocke per FM-Synthese. */
export function ep(bus, t, midi, dur, o = {}) {
  const f = mtof(midi);
  const v = o.vol ?? 0.08;
  const end = t + dur;
  const car = ctx.createOscillator();
  car.type = "sine";
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.value = f * (o.ratio || 1);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * (o.index || 2.2), t);
  mg.gain.exponentialRampToValueAtTime(f * 0.12, t + (o.bright || 0.9));
  mod.connect(mg);
  mg.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.006);
  g.gain.setTargetAtTime(v * (o.s ?? 0.35), t + 0.01, o.decay ?? 0.6);
  g.gain.setTargetAtTime(0, end, o.r ?? 0.12);
  car.connect(g);
  g.connect(bus.out);
  sends(bus, g, o);
  car.start(t);
  mod.start(t);
  car.stop(end + 0.8);
  mod.stop(end + 0.8);
}

export function kick(bus, t, o = {}) {
  const os = ctx.createOscillator();
  os.type = o.type || "sine";
  const g = ctx.createGain();
  const v = o.vol ?? 0.9;
  const dec = o.dec ?? 0.32;
  os.frequency.setValueAtTime(o.f0 ?? 150, t);
  os.frequency.exponentialRampToValueAtTime(o.f1 ?? 42, t + (o.sweep ?? 0.12));
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dec);
  os.connect(g);
  g.connect(bus.out);
  sends(bus, g, o);
  os.start(t);
  os.stop(t + dec + 0.05);
}

export function noise(bus, t, o) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = o.ftype || "highpass";
  fl.frequency.value = o.freq || 6000;
  fl.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  const v = o.vol ?? 0.1;
  const dec = o.dec ?? 0.06;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dec);
  src.connect(fl);
  fl.connect(g);
  g.connect(bus.out);
  sends(bus, g, o);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dec + 0.05);
}

export function snare(bus, t, o = {}) {
  const v = o.vol ?? 0.35;
  const tone = o.tone || 190;
  noise(bus, t, { ftype: "bandpass", freq: o.freq || 1900, q: 0.6, vol: v, dec: o.dec ?? 0.2, rev: o.rev });
  const os = ctx.createOscillator();
  os.type = "triangle";
  os.frequency.setValueAtTime(tone, t);
  os.frequency.exponentialRampToValueAtTime(tone * 0.6, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(v * 0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  os.connect(g);
  g.connect(bus.out);
  os.start(t);
  os.stop(t + 0.15);
}

export function hat(bus, t, o = {}) {
  noise(bus, t, { ftype: "highpass", freq: o.freq || 7500, vol: o.vol ?? 0.07, dec: o.dec ?? 0.045 });
}

export function rim(bus, t, o = {}) {
  const os = ctx.createOscillator();
  os.type = "triangle";
  os.frequency.value = 1750;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  os.connect(g);
  g.connect(bus.out);
  os.start(t);
  os.stop(t + 0.05);
  noise(bus, t, { ftype: "bandpass", freq: 2600, q: 1.2, vol: (o.vol ?? 0.12) * 0.66, dec: 0.03, rev: 0.25 });
}

export function clap(bus, t, o = {}) {
  for (let i = 0; i < 3; i++) {
    noise(bus, t + i * 0.011, { ftype: "bandpass", freq: 1300, q: 0.9, vol: (o.vol ?? 0.3) * (i === 2 ? 1 : 0.6), dec: i === 2 ? 0.16 : 0.02, rev: i === 2 ? o.rev : 0 });
  }
}

export function tom(bus, t, midi, o = {}) {
  kick(bus, t, { type: "sine", f0: mtof(midi) * 1.6, f1: mtof(midi), sweep: 0.08, dec: o.dec ?? 0.35, vol: o.vol ?? 0.45, rev: o.rev ?? 0.3 });
}

export function pop(bus, t) {
  noise(bus, t, { ftype: "highpass", freq: 2500, vol: 0.015 + Math.random() * 0.035, dec: 0.006 });
}

/** Rauschfahne, die nach oben filtert – Spannungsaufbau vor einem Drop. */
export function riser(bus, t, dur) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = "bandpass";
  fl.Q.value = 1.2;
  fl.frequency.setValueAtTime(400, t);
  fl.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + dur);
  g.gain.setTargetAtTime(0, t + dur, 0.05);
  src.connect(fl);
  fl.connect(g);
  g.connect(bus.out);
  sends(bus, g, { rev: 0.4 });
  src.start(t);
  src.stop(t + dur + 0.3);
}

/** Endlos-Rauschen (Plattenknistern, Regen) – wird mit dem Bus gestoppt. */
export function bed(bus, { ftype = "bandpass", freq = 2500, q = 0.3, vol = 0.008 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = ftype;
  fl.frequency.value = freq;
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(fl);
  fl.connect(g);
  g.connect(bus.out);
  src.start();
  bus.extras.push(src);
}

// Gitarrensaite per Karplus-Strong (Rauschimpuls in gedämpfter Verzögerungsschleife)
const ksCache = new Map();
function ksBuffer(midi) {
  if (ksCache.has(midi)) return ksCache.get(midi);
  const sr = ctx.sampleRate;
  const N = Math.max(2, Math.round(sr / mtof(midi)));
  const len = Math.floor(sr * 1.8);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    ring[i] = (r + prev) * 0.5;
    prev = r;
  }
  for (let i = 0, k = 0; i < len; i++) {
    const a = ring[k];
    const b = ring[(k + 1) % N];
    d[i] = a;
    ring[k] = (a + b) * 0.5 * 0.996;
    k = (k + 1) % N;
  }
  ksCache.set(midi, buf);
  return buf;
}

export function pluck(bus, t, midi, dur, o = {}) {
  const src = ctx.createBufferSource();
  src.buffer = ksBuffer(midi);
  const fl = ctx.createBiquadFilter();
  fl.type = "lowpass";
  fl.frequency.value = o.cutoff || 3200;
  const g = ctx.createGain();
  const v = o.vol ?? 0.25;
  g.gain.setValueAtTime(v, t);
  g.gain.setTargetAtTime(0, t + dur, 0.06);
  src.connect(fl);
  fl.connect(g);
  g.connect(bus.out);
  sends(bus, g, o);
  src.start(t);
  src.stop(t + Math.min(1.8, dur + 0.4));
}

/** Blechbläser-Fläche: Sägezahn mit sich öffnendem Filter. */
export function brass(bus, t, midi, dur, o = {}) {
  voice(bus, t, midi, dur, { type: "sawtooth", detunes: [-7, 7], vol: o.vol ?? 0.07, a: o.a ?? 0.04, d: 0.25, s: 0.8, r: 0.15, cutoff: o.cutoff ?? 900, cutoffEnd: o.cutoffEnd ?? 3200, fdecay: 0.12, q: 1, vib: o.vib ?? 10, vibRate: 5, rev: o.rev ?? 0.3, dly: o.dly });
}
