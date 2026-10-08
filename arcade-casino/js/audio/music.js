// Jukebox-Abspieler (V1.2): plant die Noten des laufenden Stücks ~150 ms im
// Voraus (Lookahead-Scheduler) und spielt sie über den Musik-Bus aus audio.js.
//
// * Startet nur nach einer Benutzergeste (Browser-Autoplay-Regeln).
// * Versteckter Tab: der AudioContext wird von audio.js angehalten; der
//   Scheduler wartet dann einfach (keine aufgestauten Noten, kein Lastspitzen).
// * Beim Stoppen/Wechseln werden alle Knoten des Stücks ausgeblendet und
//   getrennt – kein Speicherleck.
// * Studio-Aufnahmen (track.audio, V1.5) laufen über ein <audio>-Element, das
//   in denselben Musik-Bus geleitet wird (gleiche Lautstärke, gleiches Ducking).
//   Gestreamt statt dekodiert: Ein dekodiertes 2-Minuten-Stück bräuchte ~45 MB.

import { musicOutput, resumeAudio } from "./audio.js";
import { initSynth, makeBus, closeBus, stepDur } from "./synth.js";
import { trackById } from "./tracks.js";

const LOOKAHEAD = 0.15;
const barDur = (tr) => (60 / tr.bpm) * 4;

/** Startet eine Aufnahme im Musik-Bus. Rückgabe: { el, gain, nodes } oder Fehler. */
async function startFile(tr, out, startBar) {
  const el = new Audio();
  el.preload = "auto";
  el.loop = true;
  el.src = tr.audio;
  const src = out.ctx.createMediaElementSource(el);
  const gain = out.ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(tr.gain ?? 1, out.ctx.currentTime, 0.05);
  src.connect(gain);
  gain.connect(out.bus);
  const file = { el, src, gain, hold: false };
  if (startBar > 0) el.currentTime = startBar * barDur(tr);
  try {
    await el.play();
  } catch (err) {
    stopFile(file, out.ctx, 0);
    throw err;
  }
  return file;
}

function stopFile(file, ctx, fade = 0.12) {
  if (!file || file.closed) return;
  file.closed = true;
  try {
    file.gain.gain.cancelScheduledValues(ctx.currentTime);
    file.gain.gain.setTargetAtTime(0, ctx.currentTime, fade);
  } catch {
    /* ignorieren */
  }
  setTimeout(() => {
    try {
      file.el.pause();
      file.el.removeAttribute("src");
      file.el.load(); // Netz-/Pufferspeicher freigeben
      file.src.disconnect();
      file.gain.disconnect();
    } catch {
      /* bereits getrennt */
    }
  }, fade * 1000 * 5 + 50);
}

export function createMusicPlayer({ onChange = () => {} } = {}) {
  let player = null; // { track, bus, bar, step, next }
  let timer = 0;
  let marks = [];
  let section = "";
  let barNo = 0;
  let playToken = {}; // verwirft verspätet geladene Aufnahmen

  function tickFile() {
    const tr = player.track;
    const { el } = player.file;
    // versteckter Tab: AudioContext ist angehalten – das Element pausiert mit
    if (document.hidden && !el.paused) {
      el.pause();
      player.file.hold = true;
    } else if (!document.hidden && player.file.hold) {
      player.file.hold = false;
      el.play().catch(() => {});
    }
    const bar = Math.min(tr.bars - 1, Math.floor(el.currentTime / barDur(tr)));
    const sec = tr.section(bar);
    if (sec !== section || bar !== barNo) {
      section = sec;
      barNo = bar;
      onChange(api.status());
    }
  }

  function tick() {
    if (!player) return;
    if (player.file) return tickFile();
    const out = musicOutput();
    if (!out) return;
    const { ctx } = out;
    const tr = player.track;
    const sd = stepDur(tr);
    // nach langer Pause (z. B. Tab im Hintergrund) nicht alles nachholen
    if (player.next < ctx.currentTime - 0.25) player.next = ctx.currentTime + 0.05;
    while (player.next < ctx.currentTime + LOOKAHEAD) {
      let t = player.next;
      if (tr.swing && player.step % 2) t += tr.swing * sd;
      if (tr.swing8 && player.step % 4 === 2) t += tr.swing8 * sd;
      if (player.step === 0) marks.push({ t, bar: player.bar, section: tr.section(player.bar) });
      try {
        tr.step(player.bus, player.bar, player.step, t, sd);
      } catch (err) {
        console.warn("[music] Fehler im Stück", tr.id, err);
      }
      player.next += sd;
      if (++player.step === 16) {
        player.step = 0;
        player.bar = player.bar + 1 >= tr.bars ? tr.loopFrom : player.bar + 1;
      }
    }
    while (marks.length && marks[0].t <= ctx.currentTime) {
      const m = marks.shift();
      if (m.section !== section || m.bar !== barNo) {
        section = m.section;
        barNo = m.bar;
        onChange(api.status());
      }
    }
  }

  function stopInternal() {
    clearInterval(timer);
    timer = 0;
    if (player?.file) stopFile(player.file, player.ctx);
    else if (player) closeBus(player.bus);
    player = null;
    marks = [];
    section = "";
  }

  const api = {
    /** Spielt ein Stück von vorn. Rückgabe: true, wenn Ton tatsächlich startet. */
    async play(id, startBar = 0) {
      const tr = trackById(id);
      if (!tr) return false;
      const ticket = (playToken = {});
      if (!(await resumeAudio()) || ticket !== playToken) return false;
      const out = musicOutput();
      if (!out) return false;
      stopInternal();
      const bar0 = Number.isInteger(startBar) && startBar >= 0 && startBar < tr.bars ? startBar : 0;
      if (tr.audio) {
        let file;
        try {
          file = await startFile(tr, out, bar0);
        } catch (err) {
          console.warn("[music] Aufnahme nicht abspielbar", tr.id, err);
          return false;
        }
        if (ticket !== playToken) {
          // während des Ladens wurde schon etwas anderes gestartet/gestoppt
          stopFile(file, out.ctx, 0);
          return false;
        }
        file.el.addEventListener("error", () => {
          if (player?.file === file) api.stop();
        });
        player = { track: tr, file, ctx: out.ctx };
        tick();
        timer = setInterval(tick, 250);
        onChange(api.status());
        return true;
      }
      initSynth(out.ctx);
      const bus = makeBus(tr, out.bus);
      tr.start?.(bus);
      player = { track: tr, bus, bar: bar0, step: 0, next: out.ctx.currentTime + 0.08 };
      tick();
      timer = setInterval(tick, 25);
      onChange(api.status());
      return true;
    },
    stop() {
      const had = Boolean(player);
      playToken = {};
      stopInternal();
      if (had) onChange(api.status());
    },
    get playing() {
      return Boolean(player);
    },
    get current() {
      return player?.track.id || null;
    },
    status() {
      return { playing: Boolean(player), id: player?.track.id || null, section, bar: barNo };
    },
  };
  return api;
}
