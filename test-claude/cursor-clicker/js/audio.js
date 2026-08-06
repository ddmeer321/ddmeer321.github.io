// Synthetisierte Sounds über WebAudio — keine externen Audio-Dateien nötig.
// Alles wird erst bei der ersten Nutzerinteraktion initialisiert (Autoplay-Policy).
import { state } from "./core/state.js";

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration, type = "sine", gainValue = 0.08, delay = 0) {
  if (!state.settings.sfx) return;
  const audioCtx = getCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  osc.connect(gain).connect(audioCtx.destination);
  const startAt = audioCtx.currentTime + delay;
  osc.start(startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.stop(startAt + duration + 0.05);
}

export function playClickSound() {
  tone(680 + Math.random() * 80, 0.05, "square", 0.035);
}

export function playBoxOpenSound() {
  tone(300, 0.12, "sine", 0.07);
  tone(500, 0.12, "sine", 0.06, 0.08);
  tone(760, 0.18, "sine", 0.06, 0.16);
}

export function playRareDropSound(rarityOrder) {
  const notes = [523, 659, 784, 988, 1175, 1568, 1976];
  const count = Math.min(rarityOrder + 2, notes.length);
  for (let i = 0; i < count; i++) {
    tone(notes[i], 0.24, "triangle", 0.07, i * 0.09);
  }
}

export function playAchievementSound() {
  tone(880, 0.1, "sine", 0.06);
  tone(1174, 0.18, "sine", 0.06, 0.1);
}

export function playUiSound() {
  tone(440, 0.04, "sine", 0.03);
}

// Leiser, sich langsam schwebender Ambient-Loop aus drei verstimmten Sinustönen.
let musicNodes = null;

export function startMusic() {
  if (!state.settings.music || musicNodes) return;
  const audioCtx = getCtx();
  const master = audioCtx.createGain();
  master.gain.value = 0.022;
  master.connect(audioCtx.destination);

  const oscillators = [110, 164.81, 220].map((freq, i) => {
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    lfo.frequency.value = 0.05 + i * 0.02;
    lfoGain.gain.value = 1.5;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(master);
    osc.start();
    lfo.start();
    return osc;
  });

  musicNodes = { master, oscillators };
}

export function stopMusic() {
  if (!musicNodes) return;
  musicNodes.oscillators.forEach((osc) => osc.stop());
  musicNodes.master.disconnect();
  musicNodes = null;
}

export function syncMusicWithSettings() {
  if (state.settings.music) startMusic();
  else stopMusic();
}
