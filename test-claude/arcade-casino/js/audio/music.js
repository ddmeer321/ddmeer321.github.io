// Jukebox-Abspieler (V1.2): plant die Noten des laufenden Stücks ~150 ms im
// Voraus (Lookahead-Scheduler) und spielt sie über den Musik-Bus aus audio.js.
//
// * Startet nur nach einer Benutzergeste (Browser-Autoplay-Regeln).
// * Versteckter Tab: der AudioContext wird von audio.js angehalten; der
//   Scheduler wartet dann einfach (keine aufgestauten Noten, kein Lastspitzen).
// * Beim Stoppen/Wechseln werden alle Knoten des Stücks ausgeblendet und
//   getrennt – kein Speicherleck.

import { musicOutput, resumeAudio } from "./audio.js";
import { initSynth, makeBus, closeBus, stepDur } from "./synth.js";
import { trackById } from "./tracks.js";

const LOOKAHEAD = 0.15;

export function createMusicPlayer({ onChange = () => {} } = {}) {
  let player = null; // { track, bus, bar, step, next }
  let timer = 0;
  let marks = [];
  let section = "";
  let barNo = 0;

  function tick() {
    if (!player) return;
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
    if (player) closeBus(player.bus);
    player = null;
    marks = [];
    section = "";
  }

  const api = {
    /** Spielt ein Stück von vorn. Rückgabe: true, wenn Ton tatsächlich startet. */
    async play(id, startBar = 0) {
      const tr = trackById(id);
      if (!tr) return false;
      if (!(await resumeAudio())) return false;
      const out = musicOutput();
      if (!out) return false;
      initSynth(out.ctx);
      stopInternal();
      const bus = makeBus(tr, out.bus);
      tr.start?.(bus);
      const bar0 = Number.isInteger(startBar) && startBar >= 0 && startBar < tr.bars ? startBar : 0;
      player = { track: tr, bus, bar: bar0, step: 0, next: out.ctx.currentTime + 0.08 };
      tick();
      timer = setInterval(tick, 25);
      onChange(api.status());
      return true;
    },
    stop() {
      const had = Boolean(player);
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
