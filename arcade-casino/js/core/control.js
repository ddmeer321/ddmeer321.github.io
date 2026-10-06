// Spielkontrolle: Pause, freiwillige Auszeit (Selbstsperre), Session-Erinnerung.
//
// * Pause und Auszeit sind nach Bestätigung bis zum angezeigten Endzeitpunkt
//   verbindlich – es gibt bewusst keinen Knopf, der sie vorzeitig aufhebt.
// * Während einer aktiven Sperre kann kein Spiel gestartet und kein Einsatz
//   gemacht werden (zusätzlich in der Wirtschaft abgesichert).
// * Der Zustand liegt – wie der ganze Spielstand – lokal im Browser.

export const PAUSE_OPTIONS = [15, 30, 60]; // Minuten
export const EXCLUSION_OPTIONS = [1, 3, 7, 30, 90]; // Tage
export const REMINDER_OPTIONS = [0, 30, 60, 90]; // Minuten, 0 = aus
export const IDLE_RESET_MS = 10 * 60 * 1000;

export function defaultControl() {
  return { pauseUntil: 0, excludeUntil: 0, remindMin: 60, lastBlockStart: 0 };
}

export function sanitizeControl(raw) {
  const d = defaultControl();
  const c = raw && typeof raw === "object" ? raw : {};
  const t = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0);
  return {
    pauseUntil: t(c.pauseUntil),
    excludeUntil: t(c.excludeUntil),
    remindMin: REMINDER_OPTIONS.includes(c.remindMin) ? c.remindMin : d.remindMin,
    lastBlockStart: t(c.lastBlockStart),
  };
}

/** Ob gerade gespielt werden darf. */
export function playStatus(control, now = Date.now()) {
  if (control.excludeUntil > now) return { ok: false, kind: "exclusion", until: control.excludeUntil };
  if (control.pauseUntil > now) return { ok: false, kind: "pause", until: control.pauseUntil };
  return { ok: true };
}

/** Startet eine Pause. Eine bestehende längere Sperre wird nie verkürzt. */
export function startPause(control, minutes, now = Date.now()) {
  if (!PAUSE_OPTIONS.includes(minutes)) return false;
  const until = now + minutes * 60000;
  control.pauseUntil = Math.max(control.pauseUntil, until);
  control.lastBlockStart = now;
  return true;
}

export function startExclusion(control, days, now = Date.now()) {
  if (!EXCLUSION_OPTIONS.includes(days)) return false;
  const until = now + days * 86400000;
  control.excludeUntil = Math.max(control.excludeUntil, until);
  control.lastBlockStart = now;
  return true;
}

export function formatUntil(ts) {
  try {
    return new Date(ts).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date(ts).toISOString();
  }
}

export function formatRemaining(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 60) return `${m} Min.`;
  const hrs = Math.floor(m / 60);
  if (hrs < 48) return `${hrs} Std. ${m % 60} Min.`;
  return `${Math.ceil(hrs / 24)} Tage`;
}

/**
 * Misst ununterbrochene aktive Spielzeit. Inaktivität (kein Input) oder ein
 * verborgener Tab von mehr als IDLE_RESET_MS setzt die Session zurück.
 */
export function createSessionTracker() {
  let start = 0;
  let last = 0;
  let reminded = 0;
  return {
    activity(now = Date.now()) {
      if (!start || now - last > IDLE_RESET_MS) {
        start = now;
        reminded = 0;
      }
      last = now;
    },
    /** Minuten aktiver Session (0 wenn keine). */
    minutes(now = Date.now()) {
      if (!start || now - last > IDLE_RESET_MS) return 0;
      return (now - start) / 60000;
    },
    /** true, wenn eine (weitere) Erinnerung fällig ist. */
    due(remindMin, now = Date.now()) {
      if (!remindMin) return false;
      const m = this.minutes(now);
      const step = Math.floor(m / remindMin);
      if (step > reminded) {
        reminded = step;
        return true;
      }
      return false;
    },
    reset() {
      start = 0;
      last = 0;
      reminded = 0;
    },
  };
}
