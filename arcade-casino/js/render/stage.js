// Canvas-Bühne mit korrekter Pixeldichte, automatischer Größenanpassung und einem
// requestAnimationFrame-Loop, der pausiert, wenn der Tab unsichtbar ist.
//
// V1.1 – adaptive Auflösung: Ruckelt ein Spiel dauerhaft (Ø Bildzeit über 90
// Bilder > 26 ms, also unter ~38 fps), wird die Pixeldichte aller Bühnen
// schrittweise um 0,5 gesenkt (minimal 1). Auf schwachen Geräten wird das Bild
// so etwas weicher, bleibt aber flüssig. Wieder angehoben wird nicht (kein Pendeln).

const stages = new Set();
let dprCap = 3;
const perf = { n: 0, sum: 0 };
const SLOW_FRAME_MS = 26;

function noteFrame(ms) {
  if (ms <= 0 || ms > 250) return; // Tab-Wechsel, Pausen
  perf.n++;
  perf.sum += ms;
  if (perf.n < 90) return;
  const avg = perf.sum / perf.n;
  perf.n = 0;
  perf.sum = 0;
  if (avg <= SLOW_FRAME_MS || !stages.size) return;
  const current = Math.max(1, ...[...stages].map((s) => s.dpr));
  if (current <= 1) return;
  dprCap = Math.max(1, current - 0.5);
  stages.forEach((s) => s.resize());
}

/** Aktuelle Obergrenze der Pixeldichte (für Tests/Diagnose). */
export function qualityInfo() {
  return { dprCap };
}

export function createStage(container, { maxDpr = 2, className = "stage-canvas" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  container.append(canvas);
  const ctx = canvas.getContext("2d");
  const stage = { canvas, ctx, width: 1, height: 1, dpr: 1, onResize: null };

  function resize() {
    const r = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const hgt = Math.max(1, Math.round(r.height));
    const dpr = Math.min(maxDpr, dprCap, window.devicePixelRatio || 1);
    if (w === stage.width && hgt === stage.height && dpr === stage.dpr) return;
    stage.width = w;
    stage.height = hgt;
    stage.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = hgt + "px";
    stage.onResize?.(w, hgt);
  }

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();
  stages.add(stage);

  stage.resize = resize;
  /** Setzt die Transformation auf CSS-Pixel. */
  stage.begin = () => {
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
  };
  stage.destroy = () => {
    stages.delete(stage);
    ro?.disconnect();
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
  /** Bildschirmkoordinate (clientX/Y) → Canvas-Koordinate (CSS-Pixel). */
  stage.toLocal = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };
  return stage;
}

/**
 * rAF-Loop mit begrenztem dt. update(dt, now) – dt in Sekunden.
 * Pausiert automatisch, wenn der Tab im Hintergrund ist.
 */
export function createLoop(update) {
  let raf = 0;
  let last = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    noteFrame(now - last);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      update(dt, now);
    } catch (err) {
      console.error("[loop] Fehler im Frame – Loop gestoppt", err);
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function onVis() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (running && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  document.addEventListener("visibilitychange", onVis);

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    destroy() {
      this.stop();
      document.removeEventListener("visibilitychange", onVis);
    },
    get running() {
      return running;
    },
  };
}
