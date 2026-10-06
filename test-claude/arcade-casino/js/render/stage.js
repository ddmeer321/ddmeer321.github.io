// Canvas-Bühne mit korrekter Pixeldichte, automatischer Größenanpassung und einem
// requestAnimationFrame-Loop, der pausiert, wenn der Tab unsichtbar ist.

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
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
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

  stage.resize = resize;
  /** Setzt die Transformation auf CSS-Pixel. */
  stage.begin = () => {
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
  };
  stage.destroy = () => {
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
