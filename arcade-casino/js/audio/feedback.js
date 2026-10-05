// Zentrales Feedback: verbindet Klang, echte Vibration (falls vorhanden und
// erlaubt) und Fake-Haptik (kurze tieffrequente Audio-Impulse).
// Kein Spiel hängt davon ab, dass irgendetwas davon funktioniert.

import { play } from "./audio.js";

let opts = { vibration: true, audioHaptics: true };
const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
let lastVibe = 0;

export function setFeedbackSettings(next) {
  opts = { ...opts, ...next };
}

function vibrate(pattern) {
  if (!opts.vibration || !canVibrate) return;
  const now = performance.now();
  if (now - lastVibe < 35) return;
  lastVibe = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* manche Browser werfen ohne Benutzergeste */
  }
}

const HAPTICS = {
  tick: { sound: "h.tick", vibe: 4 },
  tap: { sound: "h.tap", vibe: 8 },
  impulse: { sound: "h.impulse", vibe: 16 },
  heavy: { sound: "h.heavy", vibe: [28] },
  success: { sound: "h.impulse", vibe: [12, 40, 18] },
  big: { sound: "h.heavy", vibe: [30, 50, 30, 50, 60] },
};

/**
 * Physischer Impuls. kind: tick | tap | impulse | heavy | success | big
 * vol skaliert die Audio-Transiente (z. B. nach Aufprallstärke).
 */
export function haptic(kind = "tap", vol = 1) {
  const h = HAPTICS[kind] || HAPTICS.tap;
  vibrate(h.vibe);
  if (opts.audioHaptics) play(h.sound, { vol });
}

/** Klang + Impuls in einem Aufruf. */
export function fx(sound, kind, soundOpts) {
  if (sound) play(sound, soundOpts);
  if (kind) haptic(kind, soundOpts?.vol ?? 1);
}

/** Standard-Tap für Buttons. */
export function uiTap() {
  play("ui.tap");
  haptic("tick", 0.7);
}
