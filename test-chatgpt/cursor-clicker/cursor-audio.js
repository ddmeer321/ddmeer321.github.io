let context;
let musicTimer;
let musicStep = 0;
let settings = { music: false, sounds: true };

function getContext() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === "suspended") context.resume();
  return context;
}

function tone(frequency, duration = 0.08, volume = 0.05, type = "sine", delay = 0) {
  if (!settings.sounds && type !== "triangle") return;
  const ctx = getContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function configureAudio(nextSettings) {
  const wasPlaying = settings.music;
  settings = { ...settings, ...nextSettings };
  if (settings.music && !wasPlaying) startMusic();
  if (!settings.music && wasPlaying) stopMusic();
}

export function playSound(name, rarityRank = 0) {
  if (!settings.sounds) return;
  if (name === "click") tone(220 + Math.random() * 35, 0.045, 0.025, "square");
  if (name === "buy") [330, 440, 660].forEach((f, i) => tone(f, 0.12, 0.04, "sine", i * 0.07));
  if (name === "equip") [520, 780].forEach((f, i) => tone(f, 0.1, 0.035, "sine", i * 0.06));
  if (name === "reward") [440, 554, 659, 880].forEach((f, i) => tone(f, 0.16, 0.04, "sine", i * 0.08));
  if (name === "reveal") {
    const base = 260 + rarityRank * 90;
    [base, base * 1.25, base * 1.5].forEach((f, i) => tone(f, 0.2, 0.05, rarityRank > 3 ? "sawtooth" : "sine", i * 0.08));
  }
}

export function startMusic() {
  if (musicTimer || !settings.music) return;
  const notes = [110, 138.59, 164.81, 207.65, 164.81, 138.59];
  const tick = () => {
    if (!settings.music) return stopMusic();
    tone(notes[musicStep++ % notes.length], 0.7, 0.012, "triangle");
  };
  tick();
  musicTimer = window.setInterval(tick, 700);
}

export function stopMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = null;
}
