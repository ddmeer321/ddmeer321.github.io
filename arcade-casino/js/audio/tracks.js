// Jukebox-Bibliothek (V1.2). Alle Stücke sind Eigenkompositionen für
// Neonpalast und werden live im Browser erzeugt (js/audio/synth.js) – es gibt
// keine Audiodateien und keine fremden Rechte (Herkunft: docs/MUSIC.md).
//
// kind:
//   starter – gehört zur Jukebox dazu
//   shop    – mit Credits freischaltbar, ALLE zum selben Preis (Geschmack ist subjektiv)
//   special – nicht käuflich, sondern über einen Meilenstein (siehe `unlock`)
//
// step(bus, bar, step, t, sd): plant die Noten eines Sechzehntels.

import { bar, voice, ep, kick, noise, snare, hat, rim, clap, tom, pop, riser, bed, pluck, brass, pulse25, pulse12, mtof } from "./synth.js";

const drive = {
  id: "drive", title: "Mitternachtsfahrt", style: "Synthwave", kind: "starter", color: "#ff3d9a",
  bpm: 100, key: "a-Moll", prog: "Am – F – C – G", form: "Intro → Groove → Refrain → Break",
  desc: "Analoge Flächen, Arpeggio mit Echo, pumpender Bass, Drumcomputer, Lead mit Vibrato.",
  bars: 24, loopFrom: 4, delaySteps: 3, feedback: 0.34, gain: 0.9,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Groove" : b < 20 ? "Refrain" : "Break"),
  chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
  roots: [33, 29, 36, 31],
  lead: ["A4:3 C5:3 E5:6 D5:4", "C5:6 A4:2 C5:4 F5:4", "E5:6 D5:2 C5:4 G4:4", "D5:6 B4:2 D5:4 B4:4",
         "A4:3 C5:3 E5:6 G5:4", "F5:6 E5:2 C5:4 A4:4", "G5:6 E5:2 C5:4 E5:4", "D5:4 E5:4 B4:8"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci];
    const intro = sec === "Intro", brk = sec === "Break";
    if (s === 0) {
      const cut = intro ? 380 + b * 260 : brk ? 900 : 1500;
      ch.forEach((m) => voice(bus, t, m, 16 * sd, { type: "sawtooth", detunes: [-14, 0, 14], vol: 0.045, a: 0.5, d: 1, s: 0.85, r: 1.1, cutoff: cut, q: 0.6, rev: 0.55 }));
      voice(bus, t, ch[0] - 12, 16 * sd, { type: "triangle", vol: 0.05, a: 0.4, s: 0.9, r: 1 });
    }
    const tones = [...ch, ch[0] + 12], pat = [0, 1, 2, 3, 2, 1, 3, 1];
    voice(bus, t, tones[pat[s % 8]] + 12, sd * 0.85, { type: "square", vol: brk ? 0.035 : 0.045, a: 0.002, d: 0.09, s: 0.15, r: 0.05, cutoff: intro ? 600 + b * 450 : 2600, q: 2, dly: 0.35, rev: 0.12 });
    if (intro) return;
    if (brk) {
      if (s % 4 === 2) hat(bus, t, { vol: 0.06 });
      if (b === this.bars - 1 && s >= 8) snare(bus, t, { vol: 0.08 + (s - 8) * 0.03, rev: 0.3, dec: 0.12 });
      return;
    }
    if (s === 0 || s === 8 || (s === 14 && b % 2 === 1)) kick(bus, t, { vol: 0.95 });
    if (s === 4 || s === 12) snare(bus, t, { vol: 0.32, rev: 0.45 });
    if (s % 4 === 2) hat(bus, t, { vol: 0.08 });
    if (sec === "Refrain" && s % 2 === 1) hat(bus, t, { vol: 0.03, dec: 0.03 });
    if (s % 2 === 0) {
      const oct = [0, 0, 12, 0, 0, 0, 12, 0][s / 2];
      voice(bus, t, this.roots[ci] + 12 + oct, sd * 1.7, { type: "sawtooth", detunes: [-6, 6], vol: 0.13, a: 0.004, d: 0.15, s: 0.5, r: 0.06, cutoff: 900, cutoffEnd: 220, fdecay: 0.18, q: 3 });
    }
    if (sec === "Refrain") {
      const n = this.lead[(b - 12) % 8][s];
      if (n) voice(bus, t, n[0], n[1] * sd * 0.95, { type: "sawtooth", detunes: [-8, 8], vol: 0.075, a: 0.02, d: 0.3, s: 0.8, r: 0.22, cutoff: 3200, q: 0.7, vib: 16, vibRate: 5.6, dly: 0.32, rev: 0.35 });
    }
  },
};

const pixel = {
  id: "pixel", title: "Pixel-Jackpot", style: "Chiptune", kind: "shop", color: "#2de2e6",
  bpm: 138, key: "C-Dur", prog: "C – Am – F – G · F – G – Em – Am", form: "Thema A → Thema B",
  desc: "Pulswellen wie in alten Spielhallen-Automaten, Dreiecks-Bass, Rausch-Schlagzeug.",
  bars: 16, loopFrom: 0, delaySteps: 2, feedback: 0.2, gain: 0.85,
  section: (b) => (b < 8 ? "Thema A" : "Thema B"),
  chordsA: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
  chordsB: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [60, 64, 67]],
  melA: ["E5:2 G5:2 C6:4 G5:2 E5:2 G5:4", "A5:2 G5:2 E5:4 C5:2 E5:2 A5:4", "F5:2 A5:2 C6:4 A5:2 F5:2 A5:4", "G5:4 B5:2 D6:2 B5:4 G5:4",
         "E5:2 G5:2 C6:4 D6:2 E6:2 C6:4", "A5:4 C6:2 A5:2 E5:4 -:4", "F5:2 G5:2 A5:2 C6:2 B5:2 A5:2 G5:4", "G5:2 F5:2 E5:2 D5:2 B4:4 -:4"].map(bar),
  melB: ["A5:6 G5:2 F5:4 C5:4", "D5:6 E5:2 G5:4 B5:4", "B5:6 A5:2 G5:4 E5:4", "C6:8 B5:4 A5:4",
         "A5:4 C6:4 F6:4 E6:2 D6:2", "D6:4 B5:4 G5:4 D6:4", "E6:8 D6:4 C6:4", "C6:12 -:4"].map(bar),
  step(bus, b, s, t, sd) {
    const A = b < 8, ch = A ? this.chordsA[b % 4] : this.chordsB[b - 8];
    const n = (A ? this.melA[b] : this.melB[b - 8])[s];
    if (n) voice(bus, t, n[0], n[1] * sd * 0.9, { wave: pulse25, vol: 0.07, a: 0.002, d: 0.05, s: 0.8, r: 0.03, vib: n[1] >= 6 ? 22 : 0, vibRate: 6.5, rev: 0.08, dly: 0.12 });
    const tones = [ch[0], ch[1], ch[2], ch[0] + 12];
    voice(bus, t, tones[s % 4], sd * 0.8, { wave: pulse12, vol: 0.028, a: 0.001, d: 0.04, s: 0.6, r: 0.02 });
    if (s % 2 === 0) voice(bus, t, (ch[0] % 12) + 36 + ((s / 2) % 2 ? 12 : 0), sd * 1.6, { type: "triangle", vol: 0.22, a: 0.002, d: 0.1, s: 0.9, r: 0.02 });
    const fill = (b === 7 || b === 15) && s >= 12;
    if (fill) {
      noise(bus, t, { ftype: "bandpass", freq: 1800 + (s - 12) * 500, q: 0.6, vol: 0.18, dec: 0.07 });
      return;
    }
    if (s === 0 || s === 8 || (s === 10 && b % 2 === 1)) kick(bus, t, { type: "triangle", f0: 220, f1: 50, sweep: 0.07, dec: 0.14, vol: 0.6 });
    if (s === 4 || s === 12) noise(bus, t, { ftype: "bandpass", freq: 2600, q: 0.5, vol: 0.22, dec: 0.11 });
    if (s % 2 === 1) noise(bus, t, { ftype: "highpass", freq: 9000, vol: 0.05, dec: 0.025 });
  },
};

const lounge = {
  id: "lounge", title: "Lounge um drei", style: "Lounge · Lo-Fi", kind: "starter", color: "#ffc53d",
  bpm: 82, swing: 0.28, key: "D-Dur", prog: "Dmaj9 – Bm9 – Em9 – A13", form: "Intro → Groove → Melodie",
  desc: "E-Piano und Vibraphon, Kontrabass mit Durchgangstönen, Besen im Swing, Plattenknistern.",
  bars: 20, loopFrom: 4, delaySteps: 3, feedback: 0.22, gain: 1, lp: 5200,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Groove" : "Melodie"),
  chords: [[54, 57, 61, 64], [50, 54, 57, 61], [55, 59, 62, 66], [55, 61, 64, 66]],
  roots: [38, 35, 40, 33],
  mel: ["F#5:6 E5:2 D5:4 A4:4", "B4:6 C#5:2 D5:4 F#5:4", "G5:6 F#5:2 E5:4 B4:4", "C#5:6 E5:2 G5:4 A5:4",
        "A5:8 F#5:4 D5:4", "D5:6 C#5:2 B4:8", "E5:4 G5:4 B5:4 A5:4", "G5:4 E5:4 C#5:4 A4:4"].map(bar),
  start(bus) {
    bed(bus, { freq: 2500, q: 0.3, vol: 0.008 });
  },
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci], root = this.roots[ci], next = this.roots[(ci + 1) % 4];
    const intro = sec === "Intro";
    if (Math.random() < 0.18) pop(bus, t + Math.random() * sd);
    if (s === 0) ch.forEach((m, i) => ep(bus, t + i * 0.012, m, (intro ? 14 : 6) * sd, { vol: 0.06, rev: 0.3 }));
    if (!intro && s === 10) ch.forEach((m, i) => ep(bus, t + i * 0.01, m, 4 * sd, { vol: 0.045, rev: 0.3 }));
    const bass = (m, len) => {
      voice(bus, t, m, len, { type: "triangle", vol: 0.28, a: 0.008, d: 0.25, s: 0.45, r: 0.08 });
      voice(bus, t, m, len, { type: "sawtooth", vol: 0.05, a: 0.008, d: 0.2, s: 0.4, r: 0.08, cutoff: 500 });
    };
    if (s === 0) bass(root, (intro ? 14 : 7) * sd);
    if (intro) return;
    if (s === 8) bass(root + 7, 3 * sd);
    if (s === 12) bass(next - 1, 3 * sd);
    if (s === 0 || s === 10) kick(bus, t, { f0: 110, f1: 45, sweep: 0.09, dec: 0.28, vol: 0.55 });
    if (s === 4 || s === 12) rim(bus, t);
    if (s % 2 === 0) noise(bus, t, { ftype: "highpass", freq: 8000, vol: s % 4 === 0 ? 0.035 : 0.05, dec: 0.04 });
    else if (Math.random() < 0.35) noise(bus, t, { ftype: "highpass", freq: 9000, vol: 0.015, dec: 0.02 });
    if (s % 4 === 2) noise(bus, t, { ftype: "bandpass", freq: 3500, q: 0.4, vol: 0.02, dec: 0.16 });
    if (sec === "Melodie") {
      const n = this.mel[(b - 12) % 8][s];
      if (n) ep(bus, t, n[0], n[1] * sd, { ratio: 4, index: 0.7, bright: 0.5, vol: 0.075, s: 0.45, decay: 0.9, r: 0.3, rev: 0.45, dly: 0.18 });
    }
  },
};

const house = {
  id: "house", title: "Neon-Nacht", style: "House", kind: "shop", color: "#b98cff",
  bpm: 122, swing: 0.08, key: "f-Moll", prog: "Fm7 – Dbmaj7 – Eb – Cm7", form: "Intro → Groove → Drop → Breakdown",
  desc: "Four-on-the-floor, Claps, pumpende Akkord-Stabs, Offbeat-Bass, Pluck-Hook mit Echo.",
  bars: 24, loopFrom: 4, delaySteps: 3, feedback: 0.3, gain: 0.85,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Groove" : b < 20 ? "Drop" : "Breakdown"),
  chords: [[56, 60, 63, 65], [56, 60, 61, 65], [55, 58, 63, 67], [55, 58, 60, 63]],
  roots: [41, 37, 39, 36],
  hook: ["C5:2 -:1 C5:1 D#5:2 F5:2 -:2 G#5:2 G5:2 F5:2", "F5:3 D#5:3 C5:2 -:4 G#4:2 C5:2",
         "A#4:2 -:1 A#4:1 D#5:2 G5:2 -:2 A#5:2 G#5:2 G5:2", "G5:3 F5:3 D#5:2 -:4 C5:4"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci];
    const intro = sec === "Intro", brk = sec === "Breakdown", drop = sec === "Drop";
    if (!brk && s % 4 === 0) {
      kick(bus, t, { f0: 140, f1: 45, sweep: 0.1, dec: 0.3, vol: 1 });
      bus.pump.gain.setValueAtTime(0.25, t);
      bus.pump.gain.linearRampToValueAtTime(1, t + 0.2);
    }
    if (s % 4 === 2) hat(bus, t, { vol: brk ? 0.04 : 0.075, dec: 0.18, freq: 7000 });
    if (drop && s % 2 === 1) hat(bus, t, { vol: 0.03, dec: 0.03 });
    if (!intro && !brk && (s === 4 || s === 12)) clap(bus, t, { vol: 0.32, rev: 0.3 });
    if (!brk && [2, 6, 10, 13].includes(s)) {
      const cut = intro ? 500 + b * 220 : drop ? 3800 : 2200;
      ch.forEach((m) => voice(bus, t, m, 1.6 * sd, { type: "sawtooth", detunes: [-10, 10], vol: 0.05, a: 0.003, d: 0.12, s: 0.4, r: 0.08, cutoff: cut, q: 1.5, to: bus.pump, rev: 0.18 }));
    }
    if (brk && s === 0) ch.forEach((m) => voice(bus, t, m, 16 * sd, { type: "sawtooth", detunes: [-12, 0, 12], vol: 0.045, a: 0.6, s: 0.9, r: 1.2, cutoff: 1400 + (b - 20) * 500, rev: 0.6 }));
    if (brk && b === this.bars - 1 && s === 0) riser(bus, t, 16 * sd);
    if (brk && b === this.bars - 1 && s >= 8) clap(bus, t, { vol: 0.06 + (s - 8) * 0.03 });
    if (intro || brk) return;
    if (s % 4 === 2 || s === 7 || (s === 15 && b % 2)) {
      const m = this.roots[ci] + (s === 15 ? 12 : 0);
      voice(bus, t, m, 1.4 * sd, { type: "sawtooth", detunes: [-5, 5], vol: 0.15, a: 0.003, d: 0.12, s: 0.6, r: 0.05, cutoff: 1100, cutoffEnd: 300, fdecay: 0.15, q: 4 });
    }
    if (drop) {
      const n = this.hook[(b - 12) % 4][s];
      if (n) voice(bus, t, n[0], n[1] * sd * 0.8, { type: "square", vol: 0.06, a: 0.002, d: 0.12, s: 0.25, r: 0.08, cutoff: 3000, cutoffEnd: 900, fdecay: 0.2, q: 2, dly: 0.4, rev: 0.25 });
    }
  },
};

const bossa = {
  id: "bossa", title: "Bossa Royale", style: "Bossa Nova", kind: "shop", color: "#8cff5a",
  bpm: 128, key: "C-Dur", prog: "Fmaj9 – Em7 – Dm9 – G13", form: "Intro → Groove → Thema",
  desc: "Gezupfte Nylon-Gitarre (Karplus-Strong), Bossa-Bass, Clave im 3-2-Muster, Shaker, Querflöte.",
  bars: 20, loopFrom: 4, delaySteps: 3, feedback: 0.18, gain: 1, lp: 7000,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Groove" : "Thema"),
  chords: [[53, 57, 64, 67], [52, 55, 59, 62], [50, 53, 60, 64], [55, 59, 64, 65]],
  roots: [41, 40, 38, 31],
  comp: [[0, 3, 6, 10, 12], [0, 3, 6, 9, 12, 14]],
  clave: [[0, 6, 12], [4, 8]],
  flute: ["A5:6 G5:2 E5:4 C5:4", "D5:6 E5:2 G5:4 B5:4", "A5:4 F5:4 E5:4 D5:4", "E5:8 F5:4 G5:4",
          "C6:6 B5:2 A5:4 E5:4", "G5:6 F#5:2 E5:4 B4:4", "F5:4 A5:4 C6:4 E6:4", "D6:8 B5:4 G5:4"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci], root = this.roots[ci];
    const bass = (m, len) => {
      voice(bus, t, m, len, { type: "triangle", vol: 0.26, a: 0.006, d: 0.3, s: 0.4, r: 0.08 });
      voice(bus, t, m, len, { type: "sawtooth", vol: 0.04, a: 0.006, d: 0.2, s: 0.3, r: 0.08, cutoff: 450 });
    };
    if (this.comp[b % 2].includes(s)) ch.forEach((m, i) => pluck(bus, t + i * 0.014, m, 2.2 * sd, { vol: s === 0 ? 0.2 : 0.15, rev: 0.25 }));
    noise(bus, t, { ftype: "highpass", freq: 6500, vol: s % 2 === 0 ? 0.03 : 0.018, dec: 0.05 });
    if (sec === "Intro") return;
    if (s === 0 || s === 8) bass(root, 6 * sd);
    if (s === 6 || s === 14) bass(root + 7, 2 * sd);
    if (s === 0 || s === 8) kick(bus, t, { f0: 90, f1: 50, sweep: 0.1, dec: 0.3, vol: 0.4 });
    if (this.clave[b % 2].includes(s)) rim(bus, t);
    if (sec === "Thema") {
      const n = this.flute[(b - 12) % 8][s];
      if (n) {
        voice(bus, t, n[0], n[1] * sd * 0.95, { type: "sine", vol: 0.1, a: 0.05, d: 0.2, s: 0.85, r: 0.15, vib: 14, vibRate: 5, rev: 0.4, dly: 0.12 });
        voice(bus, t, n[0], n[1] * sd * 0.95, { type: "triangle", vol: 0.025, a: 0.05, s: 0.8, r: 0.15, cutoff: 2500 });
        noise(bus, t, { ftype: "bandpass", freq: mtof(n[0]) * 2, q: 2, vol: 0.02, dec: 0.08 });
      }
    }
  },
};

const rain = {
  id: "rain", title: "Neonregen", style: "Ambient", kind: "shop", color: "#6fb7ff",
  bpm: 70, key: "C-Dur", prog: "Fmaj7 – Em7 – Dm7 – Cmaj7", form: "Nebel → Regen",
  desc: "Ruhige Flächen, Glocken-Arpeggio, weicher Sub-Bass und Regen auf der Leuchtreklame.",
  bars: 16, loopFrom: 0, delaySteps: 6, feedback: 0.42, gain: 0.95, lp: 6500,
  section: (b) => (b < 8 ? "Nebel" : "Regen"),
  chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
  roots: [41, 40, 38, 36],
  bells: ["E5:6 C5:2 A5:8", "D5:6 B4:2 G5:8", "C5:6 A4:2 F5:8", "B4:4 C5:4 G5:8",
          "A5:6 G5:2 E5:8", "G5:6 E5:2 D5:8", "F5:4 E5:4 C5:8", "D5:8 B4:8"].map(bar),
  start(bus) {
    bed(bus, { ftype: "highpass", freq: 5200, q: 0.2, vol: 0.006 });
    bed(bus, { ftype: "lowpass", freq: 600, q: 0.3, vol: 0.004 });
  },
  step(bus, b, s, t, sd) {
    const ci = b % 4, ch = this.chords[ci];
    if (Math.random() < 0.25) noise(bus, t + Math.random() * sd, { ftype: "bandpass", freq: 3000 + Math.random() * 4000, q: 4, vol: 0.008 + Math.random() * 0.012, dec: 0.02 });
    if (s === 0) {
      ch.forEach((m) => voice(bus, t, m, 16 * sd, { type: "sawtooth", detunes: [-10, 10], vol: 0.03, a: 1.2, d: 1, s: 0.9, r: 1.6, cutoff: 900, q: 0.4, rev: 0.7 }));
      ch.forEach((m) => voice(bus, t, m + 12, 16 * sd, { type: "sine", vol: 0.018, a: 1.5, s: 0.9, r: 1.6, rev: 0.6 }));
      voice(bus, t, this.roots[ci], 16 * sd, { type: "sine", vol: 0.16, a: 0.6, s: 0.9, r: 1 });
    }
    if (s % 4 === 0) {
      const tones = [ch[0] + 12, ch[2] + 12, ch[1] + 24, ch[3] + 12];
      ep(bus, t, tones[(s / 4) % 4], 3 * sd, { ratio: 3.5, index: 0.9, bright: 0.4, vol: 0.035, s: 0.3, decay: 0.8, r: 0.5, rev: 0.5, dly: 0.35 });
    }
    if (b >= 8) {
      if (s === 0) kick(bus, t, { f0: 70, f1: 40, sweep: 0.12, dec: 0.5, vol: 0.35 });
      const n = this.bells[b - 8][s];
      if (n) ep(bus, t, n[0], n[1] * sd, { ratio: 4, index: 0.6, bright: 0.6, vol: 0.06, s: 0.5, decay: 1.1, r: 0.5, rev: 0.55, dly: 0.3 });
    }
  },
};

const swing = {
  id: "swing", title: "Casino-Swing", style: "Jazz-Swing", kind: "shop", color: "#ff8a3d",
  bpm: 148, swing8: 0.62, key: "B♭-Dur", prog: "Cm9 – F13 – B♭maj9 – G7♭9", form: "Intro → Comping → Chorus",
  desc: "Laufender Kontrabass, Ride-Becken im Swing, Klavier-Akzente und eine Bläser-Melodie.",
  bars: 20, loopFrom: 4, delaySteps: 4, feedback: 0.15, gain: 0.95, lp: 8000,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Comping" : "Chorus"),
  chords: [[51, 55, 58, 62], [51, 55, 57, 62], [50, 53, 57, 60], [50, 53, 56, 59]],
  walk: [[36, 39, 43, 40], [41, 45, 48, 47], [46, 45, 41, 44], [43, 41, 38, 37]],
  walk2: [[36, 38, 39, 40], [41, 43, 45, 47], [46, 50, 53, 44], [43, 47, 50, 37]],
  lead: ["G4:3 A#4:1 C5:4 D#5:4 D5:4", "C5:6 A4:2 D#5:4 -:4", "D5:3 C5:1 A#4:4 F4:4 A4:4", "G#4:4 B4:4 D5:4 F5:4",
         "D#5:6 D5:2 C5:4 G4:4", "A4:3 C5:1 D#5:4 F5:4 D#5:4", "D5:8 F5:4 D5:4", "B4:4 G#4:4 F4:4 D4:4"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci];
    if (s % 4 === 0) {
      const line = (b >> 2) % 2 ? this.walk2 : this.walk;
      const m = line[ci][s / 4];
      voice(bus, t, m, 3.6 * sd, { type: "triangle", vol: 0.26, a: 0.006, d: 0.25, s: 0.5, r: 0.06 });
      voice(bus, t, m, 3.6 * sd, { type: "sawtooth", vol: 0.04, a: 0.006, d: 0.2, s: 0.35, r: 0.06, cutoff: 500 });
    }
    // Ride: ding – ding-ga – ding – ding-ga
    if (s % 4 === 0 || s === 6 || s === 14) noise(bus, t, { ftype: "highpass", freq: 6000, vol: s % 8 === 4 ? 0.05 : 0.04, dec: 0.22, rev: 0.15 });
    if (s === 4 || s === 12) noise(bus, t, { ftype: "highpass", freq: 8000, vol: 0.03, dec: 0.03 });
    if (sec === "Intro") return;
    if (s === 0 && b % 2 === 0) kick(bus, t, { f0: 90, f1: 50, sweep: 0.1, dec: 0.25, vol: 0.3 });
    if ((s === 6 || s === 14) && Math.random() < 0.6) snare(bus, t, { vol: 0.06, dec: 0.08, tone: 220 });
    if (s === 6 || (s === 14 && b % 2 === 1) || (s === 0 && b % 4 === 0)) ch.forEach((m, i) => ep(bus, t + i * 0.006, m, 1.6 * sd, { vol: 0.05, ratio: 1, index: 1.4, rev: 0.2 }));
    if (sec === "Chorus") {
      const n = this.lead[(b - 12) % 8][s];
      if (n) brass(bus, t, n[0], n[1] * sd * 0.9, { vol: 0.07, cutoff: 1200, cutoffEnd: 3600, vib: 14 });
    }
  },
};

const turbo = {
  id: "turbo", title: "Turbo-Bonus", style: "Drum & Bass", kind: "shop", color: "#ff5a5a",
  bpm: 172, key: "d-Moll", prog: "Dm – B♭ – F – C", form: "Intro → Drop → Break → Drop II",
  desc: "Breakbeat mit Ghost-Snares, schwebender Reese-Bass, Flächen und eine kurze Lead-Hookline.",
  bars: 24, loopFrom: 4, delaySteps: 3, feedback: 0.3, gain: 0.85,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Drop" : b < 16 ? "Break" : "Drop II"),
  chords: [[57, 62, 65], [58, 62, 65], [57, 60, 65], [55, 60, 64]],
  roots: [38, 34, 41, 36],
  lead: ["D5:2 F5:2 A5:4 G5:2 F5:2 E5:4", "F5:6 D5:2 -:4 A#4:4", "C5:2 F5:2 A5:4 C6:4 A5:4", "G5:6 E5:2 C5:4 E5:4"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci];
    const drop = sec === "Drop" || sec === "Drop II";
    if (s === 0) ch.forEach((m) => voice(bus, t, m, 16 * sd, { type: "sawtooth", detunes: [-12, 12], vol: drop ? 0.03 : 0.045, a: 0.3, s: 0.9, r: 0.8, cutoff: drop ? 1600 : 900 + (b % 4) * 250, rev: 0.5 }));
    if (s % 2 === 0) noise(bus, t, { ftype: "highpass", freq: 8500, vol: s % 4 === 2 ? 0.06 : 0.035, dec: 0.03 });
    if (sec === "Intro" || sec === "Break") {
      if (sec === "Break") voice(bus, t, ch[s % 3] + 12, sd * 0.8, { type: "square", vol: 0.03, a: 0.002, d: 0.08, s: 0.2, r: 0.04, cutoff: 2200, dly: 0.35 });
      if (b === 3 && s >= 8) snare(bus, t, { vol: 0.06 + (s - 8) * 0.03, dec: 0.08 });
      if (b === 15 && s === 0) riser(bus, t, 16 * sd);
      return;
    }
    if (s === 0 || s === 10) kick(bus, t, { f0: 160, f1: 45, sweep: 0.06, dec: 0.22, vol: 0.95 });
    if (s === 4 || s === 12) snare(bus, t, { vol: 0.34, rev: 0.2, dec: 0.16, tone: 210 });
    if (s === 7 || s === 9 || s === 15) snare(bus, t, { vol: 0.07, dec: 0.06, tone: 230 });
    if (s === 0 || s === 6 || s === 11) {
      const len = s === 0 ? 6 : s === 6 ? 5 : 5;
      voice(bus, t, this.roots[ci], len * sd, { type: "sawtooth", detunes: [-22, 22], vol: 0.16, a: 0.01, d: 0.2, s: 0.8, r: 0.06, cutoff: 600, cutoffEnd: 240, fdecay: len * sd, q: 5 });
      voice(bus, t, this.roots[ci] - 12, len * sd, { type: "sine", vol: 0.18, a: 0.01, s: 0.9, r: 0.06 });
    }
    if (sec === "Drop II") {
      const n = this.lead[b % 4][s];
      if (n) voice(bus, t, n[0], n[1] * sd * 0.9, { type: "sawtooth", detunes: [-9, 9], vol: 0.065, a: 0.01, d: 0.2, s: 0.7, r: 0.12, cutoff: 3400, vib: 12, vibRate: 6, dly: 0.3, rev: 0.25 });
    }
  },
};

const sunset = {
  id: "sunset", title: "Sonnenuntergang 1986", style: "City-Pop · Funk", kind: "special", color: "#ff7ab8",
  unlock: { type: "level", value: 10, text: "Erreiche Level 10" },
  bpm: 108, key: "a-Moll", prog: "Fmaj7 – E7 – Am7 – Gm7 C7", form: "Intro → Groove → Chorus",
  desc: "Funky Sechzehntel-Bass, E-Piano-Stabs, Handclaps und eine Synth-Brass-Melodie wie aus einem Werbespot von 1986.",
  bars: 20, loopFrom: 4, delaySteps: 3, feedback: 0.25, gain: 0.9,
  section: (b) => (b < 4 ? "Intro" : b < 12 ? "Groove" : "Chorus"),
  chords: [[53, 57, 60, 64], [52, 56, 59, 62], [55, 57, 60, 64], [53, 55, 58, 62]],
  chordC7: [52, 55, 58, 62],
  roots: [41, 40, 45, 43],
  lead: ["C5:2 E5:2 G5:4 A5:6 -:2", "G#5:4 B4:2 D5:2 E5:8", "C5:2 E5:2 A5:4 G5:4 E5:4", "F5:4 D5:4 A#4:4 C5:4"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4;
    const second = ci === 3 && s >= 8;
    const ch = second ? this.chordC7 : this.chords[ci];
    const root = second ? 36 : this.roots[ci];
    if (s === 0 || (ci === 3 && s === 8)) ch.forEach((m) => voice(bus, t, m, 8 * sd, { type: "sawtooth", detunes: [-8, 8], vol: 0.022, a: 0.15, s: 0.8, r: 0.4, cutoff: 1500, rev: 0.35 }));
    if (s === 2 || s === 6 || s === 11) ch.forEach((m, i) => ep(bus, t + i * 0.005, m, 1.5 * sd, { vol: 0.045, index: 1.8, rev: 0.2 }));
    if (sec === "Intro") {
      if (s % 2 === 0) hat(bus, t, { vol: 0.04 });
      return;
    }
    const pat = { 0: 0, 3: 12, 6: 0, 8: 7, 10: 0, 13: 12, 14: 10 };
    if (s in pat) voice(bus, t, root + pat[s], 1.3 * sd, { type: "sawtooth", vol: 0.13, a: 0.002, d: 0.08, s: 0.4, r: 0.04, cutoff: 1400, cutoffEnd: 350, fdecay: 0.12, q: 6 });
    if (s === 0 || s === 7 || s === 8) kick(bus, t, { f0: 130, f1: 48, sweep: 0.09, dec: 0.26, vol: 0.85 });
    if (s === 4 || s === 12) { snare(bus, t, { vol: 0.24, rev: 0.4, dec: 0.18 }); clap(bus, t, { vol: 0.14 }); }
    hat(bus, t, { vol: s % 4 === 2 ? 0.06 : 0.03, dec: s === 14 ? 0.16 : 0.035 });
    if (sec === "Chorus") {
      const n = this.lead[(b - 12) % 4][s];
      if (n) brass(bus, t, n[0], n[1] * sd * 0.9, { vol: 0.065, cutoff: 1400, cutoffEnd: 3800, vib: 12, dly: 0.25 });
    }
  },
};

const hymn = {
  id: "hymn", title: "Palasthymne", style: "Hymne", kind: "special", color: "#ffe28a",
  unlock: { type: "variety", value: 12, text: "Spiele jeden der 12 Automaten mindestens einmal" },
  bpm: 92, key: "C-Dur", prog: "C – G – Am – F", form: "Fanfare → Hymne → Finale",
  desc: "Synth-Fanfare, Chorfläche, Pauken-Tom-Fills und eine Melodie zum Mitsummen – die Hymne des Neonpalasts.",
  bars: 20, loopFrom: 4, delaySteps: 4, feedback: 0.2, gain: 0.9,
  section: (b) => (b < 4 ? "Fanfare" : b < 12 ? "Hymne" : "Finale"),
  chords: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
  roots: [36, 43, 45, 41],
  mel: ["E5:4 E5:2 F5:2 G5:8", "G5:4 F5:2 E5:2 D5:8", "C5:4 D5:2 E5:2 A5:6 G5:2", "F5:4 E5:4 D5:8",
        "E5:4 E5:2 F5:2 G5:4 C6:4", "B5:4 A5:2 G5:2 D5:8", "C6:4 B5:2 A5:2 E5:4 A5:4", "G5:4 F5:4 C5:8"].map(bar),
  step(bus, b, s, t, sd) {
    const sec = this.section(b), ci = b % 4, ch = this.chords[ci];
    const fin = sec === "Finale";
    if (s === 0) {
      ch.forEach((m) => voice(bus, t, m, 16 * sd, { type: "sawtooth", detunes: [-9, 0, 9], vol: 0.03, a: 0.5, s: 0.9, r: 1, cutoff: 1300, rev: 0.6 }));
      ch.forEach((m) => voice(bus, t, m + 12, 16 * sd, { type: "sine", vol: 0.02, a: 0.6, s: 0.9, r: 1, rev: 0.6 }));
      voice(bus, t, this.roots[ci], 16 * sd, { type: "triangle", vol: 0.2, a: 0.05, s: 0.8, r: 0.5 });
    }
    if (sec === "Fanfare") {
      if ([0, 3, 6, 8].includes(s)) ch.forEach((m) => brass(bus, t, m, (s === 8 ? 7 : 2.5) * sd, { vol: 0.05, a: 0.02, cutoff: 1000, cutoffEnd: 3000 }));
      if (b === 3 && s >= 8 && s % 2 === 0) tom(bus, t, 45 - (s - 8), { vol: 0.4 });
      return;
    }
    if (s === 0 || s === 8) kick(bus, t, { f0: 110, f1: 42, sweep: 0.12, dec: 0.45, vol: 0.8, rev: 0.25 });
    if (s === 4 || s === 12) snare(bus, t, { vol: 0.26, rev: 0.6, dec: 0.25 });
    if (fin && s % 2 === 0) hat(bus, t, { vol: 0.04 });
    if (s === 12 && ci === 3) [50, 47, 43].forEach((m, i) => tom(bus, t + i * sd * 1.3, m, { vol: 0.35 }));
    const n = this.mel[(b - 4) % 8][s];
    if (n) {
      brass(bus, t, n[0], n[1] * sd * 0.92, { vol: fin ? 0.06 : 0.065, cutoff: 1100, cutoffEnd: 3200 });
      if (fin) brass(bus, t, n[0] - 12, n[1] * sd * 0.92, { vol: 0.04, cutoff: 900, cutoffEnd: 2200 });
    }
  },
};

/** Reihenfolge in der Bibliothek: Starter, Kaufbare (alphabetisch nach Stil gemischt), Besondere. */
export const TRACKS = [drive, lounge, pixel, house, bossa, rain, swing, turbo, sunset, hymn];
export const TRACK_IDS = TRACKS.map((t) => t.id);
export const trackById = (id) => TRACKS.find((t) => t.id === id) || null;
