// Vektor-Symbole für die Slotwalzen, auf Canvas gezeichnet und pro Größe
// zwischengespeichert (Offscreen-Canvas), damit der Walzen-Render-Loop nur
// noch drawImage braucht.

const cache = new Map();

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function rgrad(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function star(ctx, cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function text(ctx, t, x, y, size, fill, stroke, lw = size * 0.08) {
  ctx.font = `900 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(t, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(t, x, y);
}

// Jede Funktion zeichnet in ein Quadrat der Kantenlänge s (Ursprung oben links).
const DRAW = {
  cherry(ctx, s) {
    ctx.strokeStyle = "#3fbf4f";
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s * 0.55, s * 0.15);
    ctx.quadraticCurveTo(s * 0.35, s * 0.35, s * 0.32, s * 0.58);
    ctx.moveTo(s * 0.55, s * 0.15);
    ctx.quadraticCurveTo(s * 0.62, s * 0.4, s * 0.7, s * 0.6);
    ctx.stroke();
    ctx.fillStyle = "#3fbf4f";
    ctx.beginPath();
    ctx.ellipse(s * 0.66, s * 0.17, s * 0.14, s * 0.06, -0.4, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [
      [0.32, 0.68],
      [0.7, 0.7],
    ]) {
      ctx.fillStyle = rgrad(ctx, s * x, s * y, s * 0.19, [
        [0, "#ff8fa8"],
        [0.4, "#ff2d55"],
        [1, "#9c0026"],
      ]);
      ctx.beginPath();
      ctx.arc(s * x, s * y, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.beginPath();
      ctx.ellipse(s * (x - 0.06), s * (y - 0.07), s * 0.04, s * 0.025, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  lemon(ctx, s) {
    ctx.fillStyle = rgrad(ctx, s * 0.5, s * 0.5, s * 0.4, [
      [0, "#fff7a8"],
      [0.5, "#ffe14d"],
      [1, "#d6a000"],
    ]);
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.5, s * 0.38, s * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.13, s * 0.58, s * 0.06, s * 0.045, -0.2, 0, Math.PI * 2);
    ctx.ellipse(s * 0.87, s * 0.42, s * 0.06, s * 0.045, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.ellipse(s * 0.4, s * 0.38, s * 0.12, s * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  grapes(ctx, s) {
    const pts = [
      [0.36, 0.35],
      [0.56, 0.33],
      [0.27, 0.52],
      [0.47, 0.52],
      [0.67, 0.5],
      [0.37, 0.69],
      [0.57, 0.69],
      [0.47, 0.85],
    ];
    ctx.fillStyle = "#3fbf4f";
    ctx.beginPath();
    ctx.ellipse(s * 0.62, s * 0.17, s * 0.15, s * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of pts) {
      ctx.fillStyle = rgrad(ctx, s * x, s * y, s * 0.12, [
        [0, "#e0b3ff"],
        [0.45, "#a64dff"],
        [1, "#4a128f"],
      ]);
      ctx.beginPath();
      ctx.arc(s * x, s * y, s * 0.115, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  bell(ctx, s) {
    ctx.fillStyle = grad(ctx, 0, s * 0.15, 0, s * 0.8, [
      [0, "#fff1a8"],
      [0.5, "#ffc53d"],
      [1, "#c27c00"],
    ]);
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.12);
    ctx.bezierCurveTo(s * 0.25, s * 0.12, s * 0.27, s * 0.45, s * 0.2, s * 0.68);
    ctx.lineTo(s * 0.12, s * 0.76);
    ctx.lineTo(s * 0.88, s * 0.76);
    ctx.lineTo(s * 0.8, s * 0.68);
    ctx.bezierCurveTo(s * 0.73, s * 0.45, s * 0.75, s * 0.12, s * 0.5, s * 0.12);
    ctx.fill();
    ctx.fillStyle = "#c27c00";
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.82, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(s * 0.36, s * 0.25, s * 0.06, s * 0.36);
  },
  seven(ctx, s) {
    ctx.save();
    ctx.shadowColor = "rgba(255,45,85,.7)";
    ctx.shadowBlur = s * 0.12;
    text(ctx, "7", s * 0.5, s * 0.54, s * 0.92, grad(ctx, 0, s * 0.1, 0, s * 0.9, [[0, "#ff8a8a"], [0.5, "#ff2d2d"], [1, "#a00010"]]), "#ffd34d", s * 0.07);
    ctx.restore();
  },
  bar(ctx, s) {
    ctx.fillStyle = "#1b1530";
    ctx.strokeStyle = "#ffc53d";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.roundRect(s * 0.08, s * 0.3, s * 0.84, s * 0.4, s * 0.08);
    ctx.fill();
    ctx.stroke();
    text(ctx, "BAR", s * 0.5, s * 0.515, s * 0.3, "#ffc53d");
  },
  star(ctx, s) {
    ctx.save();
    ctx.shadowColor = "rgba(255,216,77,.8)";
    ctx.shadowBlur = s * 0.15;
    ctx.fillStyle = grad(ctx, 0, 0, 0, s, [
      [0, "#fff7c2"],
      [0.5, "#ffd84d"],
      [1, "#e09a00"],
    ]);
    star(ctx, s * 0.5, s * 0.53, s * 0.42, s * 0.18);
    ctx.fill();
    ctx.restore();
  },
  blank(ctx, s) {
    ctx.strokeStyle = "rgba(0,0,0,.08)";
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.5);
    ctx.lineTo(s * 0.7, s * 0.5);
    ctx.stroke();
  },
  rocket(ctx, s) {
    ctx.save();
    ctx.translate(s * 0.5, s * 0.5);
    ctx.rotate(-0.5);
    ctx.fillStyle = "#ff3d9a";
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.18);
    ctx.lineTo(-s * 0.26, s * 0.36);
    ctx.lineTo(-s * 0.1, s * 0.3);
    ctx.moveTo(s * 0.12, s * 0.18);
    ctx.lineTo(s * 0.26, s * 0.36);
    ctx.lineTo(s * 0.1, s * 0.3);
    ctx.fill();
    ctx.fillStyle = grad(ctx, -s * 0.15, 0, s * 0.15, 0, [
      [0, "#b7a8d6"],
      [0.5, "#ffffff"],
      [1, "#8a7bb0"],
    ]);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.2, -s * 0.25, s * 0.16, s * 0.15, s * 0.12, s * 0.3);
    ctx.lineTo(-s * 0.12, s * 0.3);
    ctx.bezierCurveTo(-s * 0.16, s * 0.15, -s * 0.2, -s * 0.25, 0, -s * 0.42);
    ctx.fill();
    ctx.fillStyle = "#2de2e6";
    ctx.strokeStyle = "#1b1530";
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.arc(0, -s * 0.08, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = grad(ctx, 0, s * 0.3, 0, s * 0.5, [
      [0, "#fff3a8"],
      [0.4, "#ffc53d"],
      [1, "rgba(255,90,0,0)"],
    ]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.09, s * 0.3);
    ctx.quadraticCurveTo(0, s * 0.62, s * 0.09, s * 0.3);
    ctx.fill();
    ctx.restore();
  },
  planet(ctx, s) {
    const c = s * 0.5;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "#2de2e6";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.44, s * 0.12, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgrad(ctx, 0, 0, s * 0.27, [
      [0, "#e2d1ff"],
      [0.5, "#9b5cff"],
      [1, "#3b0d8c"],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.44, s * 0.12, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  },
  gem(ctx, s) {
    ctx.save();
    ctx.shadowColor = "rgba(45,226,230,.7)";
    ctx.shadowBlur = s * 0.1;
    ctx.fillStyle = "#2de2e6";
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.22);
    ctx.lineTo(s * 0.75, s * 0.22);
    ctx.lineTo(s * 0.92, s * 0.4);
    ctx.lineTo(s * 0.5, s * 0.88);
    ctx.lineTo(s * 0.08, s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.22);
    ctx.lineTo(s * 0.5, s * 0.22);
    ctx.lineTo(s * 0.38, s * 0.4);
    ctx.lineTo(s * 0.08, s * 0.4);
    ctx.fill();
    ctx.fillStyle = "rgba(0,60,80,.35)";
    ctx.beginPath();
    ctx.moveTo(s * 0.62, s * 0.4);
    ctx.lineTo(s * 0.92, s * 0.4);
    ctx.lineTo(s * 0.5, s * 0.88);
    ctx.fill();
  },
  moon(ctx, s) {
    ctx.fillStyle = rgrad(ctx, s * 0.45, s * 0.5, s * 0.36, [
      [0, "#fffbe0"],
      [0.6, "#ffe9a0"],
      [1, "#c9a43a"],
    ]);
    ctx.beginPath();
    ctx.arc(s * 0.48, s * 0.5, s * 0.34, Math.PI * 0.3, Math.PI * 1.7);
    ctx.arc(s * 0.64, s * 0.42, s * 0.28, Math.PI * 1.55, Math.PI * 0.45, true);
    ctx.fill();
  },
  orb(ctx, s) {
    ctx.fillStyle = rgrad(ctx, s * 0.5, s * 0.5, s * 0.32, [
      [0, "#ffd1ea"],
      [0.5, "#ff3d9a"],
      [1, "#7a0c45"],
    ]);
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.38, -0.6, 0.6);
    ctx.stroke();
  },
  nova(ctx, s) {
    ctx.save();
    ctx.shadowColor = "#ff3d9a";
    ctx.shadowBlur = s * 0.2;
    ctx.fillStyle = grad(ctx, 0, 0, s, s, [
      [0, "#ff9be0"],
      [0.5, "#ff3d9a"],
      [1, "#9b5cff"],
    ]);
    star(ctx, s * 0.5, s * 0.5, s * 0.46, s * 0.2, 8, -Math.PI / 2);
    ctx.fill();
    ctx.restore();
    text(ctx, "WILD", s * 0.5, s * 0.52, s * 0.2, "#fff", "#5b0b3a", s * 0.05);
  },
  comet(ctx, s) {
    ctx.save();
    ctx.fillStyle = grad(ctx, s * 0.1, s * 0.9, s * 0.6, s * 0.4, [
      [0, "rgba(45,226,230,0)"],
      [1, "rgba(45,226,230,.9)"],
    ]);
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.95);
    ctx.lineTo(s * 0.52, s * 0.3);
    ctx.lineTo(s * 0.72, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "#2de2e6";
    ctx.shadowBlur = s * 0.2;
    ctx.fillStyle = rgrad(ctx, s * 0.64, s * 0.38, s * 0.2, [
      [0, "#ffffff"],
      [0.5, "#bff9fa"],
      [1, "#2de2e6"],
    ]);
    ctx.beginPath();
    ctx.arc(s * 0.64, s * 0.38, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text(ctx, "BONUS", s * 0.5, s * 0.88, s * 0.16, "#fff", "#063b3d", s * 0.05);
  },
};

/** Offscreen-Bild eines Symbols in Pixelgröße px. */
export function symbolImage(name, px) {
  const size = Math.max(8, Math.round(px));
  const key = `${name}@${size}`;
  let c = cache.get(key);
  if (c) return c;
  c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = c.getContext("2d");
  if (!ctx.roundRect) ctx.roundRect = (x, y, w, hh) => ctx.rect(x, y, w, hh);
  (DRAW[name] || DRAW.blank)(ctx, size);
  cache.set(key, c);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return c;
}

/** Kleines DOM-Canvas für Gewinntabellen. */
export function symbolIcon(name, cssPx = 34) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(cssPx * dpr);
  c.style.width = c.style.height = cssPx + "px";
  c.style.verticalAlign = "middle";
  c.getContext("2d").drawImage(symbolImage(name, cssPx * dpr), 0, 0);
  return c;
}

export const SYMBOL_NAMES = {
  cherry: "Kirsche",
  lemon: "Zitrone",
  grapes: "Trauben",
  bell: "Glocke",
  seven: "Sieben",
  bar: "Bar",
  star: "Stern",
  rocket: "Rakete",
  planet: "Planet",
  gem: "Kristall",
  moon: "Mond",
  orb: "Orb",
  nova: "Nova (Wild)",
  comet: "Komet (Bonus)",
};
