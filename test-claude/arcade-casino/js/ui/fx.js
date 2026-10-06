// Zentrales, gedeckeltes Partikelsystem auf einem Overlay-Canvas über der App.
// Läuft nur, solange Partikel leben (kein Dauer-Render-Loop).

import { COLORS } from "../render/palette.js";

const MAX = 220;
let canvas = null;
let ctx = null;
let dpr = 1;
let parts = [];
let raf = 0;
let last = 0;
let reduced = false;
let target = null; // Element, zu dem fliegende Münzen streben (Guthabenanzeige)
let onArrive = null;

export function initFx(el, { balanceEl } = {}) {
  canvas = el;
  ctx = canvas.getContext("2d");
  target = balanceEl || null;
  resize();
  window.addEventListener("resize", resize);
}

export function setReducedMotion(v) {
  reduced = v;
}

export function onCoinArrive(fn) {
  onArrive = fn;
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

function add(p) {
  if (parts.length >= MAX) parts.shift();
  parts.push(p);
}

function start() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}

const R = (a, b) => a + Math.random() * (b - a);

/** Explosion an Bildschirmkoordinate. kind: coins | confetti | sparks | stars */
export function burst(x, y, { kind = "sparks", count = 24, color, spread = 1, power = 1 } = {}) {
  if (!ctx) return;
  const n = Math.round(reduced ? count * 0.35 : count);
  const palette = color ? [color] : kind === "confetti" ? [COLORS.pink, COLORS.cyan, COLORS.gold, COLORS.lime, COLORS.violet] : [COLORS.gold, "#fff3b0", COLORS.orange];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + R(-1, 1) * (Math.PI / 2) * spread;
    const sp = R(180, 520) * power;
    add({
      kind,
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (kind === "sparks" ? 0 : 120),
      g: kind === "sparks" ? 500 : 900,
      life: 0,
      max: R(0.6, 1.3) * (kind === "confetti" ? 1.6 : 1),
      size: kind === "coins" ? R(7, 11) : kind === "confetti" ? R(5, 9) : R(2, 4),
      rot: R(0, Math.PI * 2),
      vr: R(-12, 12),
      color: palette[i % palette.length],
    });
  }
  start();
}

/** Münzen fliegen von (x,y) zur Guthabenanzeige. */
export function coinsToBalance(x, y, count = 10) {
  if (!ctx || !target) return;
  const r = target.getBoundingClientRect();
  const tx = r.left + 16;
  const ty = r.top + r.height / 2;
  const n = Math.min(reduced ? 4 : 18, count);
  for (let i = 0; i < n; i++) {
    add({
      kind: "fly",
      x: x + R(-20, 20),
      y: y + R(-20, 20),
      sx: 0,
      sy: 0,
      tx,
      ty,
      delay: i * 0.045,
      life: 0,
      max: 0.75,
      size: 9,
      rot: R(0, 6),
      vr: R(8, 14),
      color: COLORS.gold,
      arrived: false,
    });
  }
  start();
}

/** Schwebende Zahl („+250“) an einer Stelle. */
export function floatText(x, y, text, color = COLORS.gold) {
  if (!ctx) return;
  add({ kind: "text", x, y, vx: 0, vy: -70, g: 0, life: 0, max: 1.2, size: 22, text, color, rot: 0, vr: 0 });
  start();
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const alive = [];
  for (const p of parts) {
    p.life += dt;
    if (p.kind === "fly") {
      if (p.life < p.delay) {
        alive.push(p);
        continue;
      }
      if (!p.sx) {
        p.sx = p.x;
        p.sy = p.y;
      }
      const k = Math.min(1, (p.life - p.delay) / p.max);
      const e = k * k * (3 - 2 * k);
      const arc = Math.sin(k * Math.PI) * -80;
      p.cx = p.sx + (p.tx - p.sx) * e;
      p.cy = p.sy + (p.ty - p.sy) * e + arc;
      p.rot += p.vr * dt;
      if (k >= 1) {
        if (!p.arrived) {
          p.arrived = true;
          onArrive?.();
        }
        continue;
      }
      drawCoin(p.cx, p.cy, p.size, p.rot, 1);
      alive.push(p);
      continue;
    }
    if (p.life >= p.max) continue;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.99;
    p.rot += p.vr * dt;
    const a = 1 - Math.pow(p.life / p.max, 2);
    if (p.kind === "coins") drawCoin(p.x, p.y, p.size, p.rot, a);
    else if (p.kind === "confetti") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === "text") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `900 ${p.size}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    alive.push(p);
  }
  parts = alive;
  if (parts.length) raf = requestAnimationFrame(tick);
  else {
    raf = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawCoin(x, y, r, rot, alpha) {
  const sx = Math.abs(Math.cos(rot)) * 0.85 + 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.fillStyle = "#b87800";
  ctx.beginPath();
  ctx.arc(0, 1.5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff0a8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
