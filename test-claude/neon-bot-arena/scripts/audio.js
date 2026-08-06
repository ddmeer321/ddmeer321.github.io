let audioContext = null;
let masterGain = null;
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let mutedByPause = false;

const melody = [196, 247, 294, 247, 220, 262, 330, 262];
const musicVolume = 0.085;

function getContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.32;
  masterGain.connect(audioContext.destination);
  musicGain = audioContext.createGain();
  musicGain.gain.value = musicVolume;
  musicGain.connect(masterGain);
  return audioContext;
}

async function resumeContext() {
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

function playTone({ frequency, duration, type = "sine", volume = 0.1, destination = masterGain, slideTo = null }) {
  const ctx = getContext();
  if (!ctx || !destination) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(now);
  osc.stop(now + duration + 0.025);
}

function playMusicStep() {
  if (!audioContext || mutedByPause) return;
  const frequency = melody[musicStep % melody.length];
  musicStep += 1;
  playTone({ frequency, duration: 0.18, type: "triangle", volume: 0.072, destination: musicGain });
  if (musicStep % 4 === 1) {
    playTone({ frequency: frequency / 2, duration: 0.32, type: "sine", volume: 0.048, destination: musicGain });
  }
}

export async function startMusic() {
  await resumeContext();
  mutedByPause = false;
  if (musicGain) musicGain.gain.value = musicVolume;
  if (musicTimer) return;
  playMusicStep();
  musicTimer = window.setInterval(playMusicStep, 260);
}

export function setMusicPaused(paused) {
  mutedByPause = paused;
  if (musicGain) musicGain.gain.value = paused ? 0 : musicVolume;
}

export function stopMusic() {
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  mutedByPause = false;
}

export function playShoot() {
  resumeContext();
  playTone({ frequency: 720, slideTo: 1320, duration: 0.085, type: "square", volume: 0.055 });
}
