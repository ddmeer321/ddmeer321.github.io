// Wiederverwendbare Aura-Darstellung: jede Aura bekommt eine eigene, klar
// wiedererkennbare Partikel-Identität statt gestapelter, gleich aussehender
// Ringe (siehe css/auras.css für die Primitive: rise/fall/orbit/flash/beam/
// fog/star). Ein sehr weicher, kleiner Grundschimmer hält alle Auren optisch
// am Cursor "verankert", ohne ihn je zu verdecken (siehe .cc-aura-anchor).
// Rendert nichts (leerer Layer), wenn keine Aura ausgerüstet ist.
import { getRarity } from "../data/rarities.js";

// Deterministisch statt Math.random(): der Layer wird bei jeder Zustands-
// änderung neu gerendert (siehe mainPanel.js), zufällige Positionen würden bei
// jedem Klick neu würfeln und unruhig wirken. Eine einfache Pseudo-Zufalls-
// funktion auf Basis des Index reicht für "organisch verteilt, aber stabil".
function pseudo(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function particle(cls, vars) {
  const style = Object.entries(vars)
    .map(([key, value]) => `--${key}:${value}`)
    .join(";");
  return `<span class="cc-aura-p ${cls}" style="${style}"></span>`;
}

function rise(count, color, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const x = (pseudo(i, 1) - 0.5) * (opts.spread ?? 70);
    const size = 3.5 + pseudo(i, 2) * (opts.sizeVar ?? 2.5);
    const duration = (opts.durationBase ?? 2.6) + pseudo(i, 3) * (opts.durationVar ?? 1.4);
    const delay = -pseudo(i, 4) * duration;
    return particle("cc-aura-p-rise", { x: x.toFixed(1) + "px", size: size.toFixed(1) + "px", color, duration: duration.toFixed(2) + "s", delay: delay.toFixed(2) + "s" });
  }).join("");
}

function fall(count, color, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const x = (pseudo(i, 5) - 0.5) * (opts.spread ?? 76);
    const size = 4 + pseudo(i, 6) * (opts.sizeVar ?? 2.5);
    const duration = (opts.durationBase ?? 3.4) + pseudo(i, 7) * (opts.durationVar ?? 1.8);
    const delay = -pseudo(i, 8) * duration;
    return particle("cc-aura-p-fall", { x: x.toFixed(1) + "px", size: size.toFixed(1) + "px", color, duration: duration.toFixed(2) + "s", delay: delay.toFixed(2) + "s" });
  }).join("");
}

function orbitDots(count, color, opts = {}) {
  const radiusBase = opts.radiusBase ?? 58;
  return Array.from({ length: count }, (_, i) => {
    const radius = radiusBase + pseudo(i, 9) * (opts.radiusVar ?? 14);
    const size = (opts.sizeBase ?? 6) + pseudo(i, 10) * (opts.sizeVar ?? 2);
    const duration = (opts.durationBase ?? 6) + pseudo(i, 11) * (opts.durationVar ?? 4);
    const delay = -pseudo(i, 12) * duration;
    const reverse = pseudo(i, 13) > 0.5 ? "reverse" : "normal";
    return (
      `<span class="cc-aura-p-orbit-spoke" style="--duration:${duration.toFixed(2)}s;--delay:${delay.toFixed(2)}s;--direction:${reverse}">` +
      `<span class="${opts.dotClass || "cc-aura-p-orbit-dot"}" style="--radius:${radius.toFixed(1)}px;--size:${size.toFixed(1)}px;--color:${color}"></span>` +
      `</span>`
    );
  }).join("");
}

function flash(count, color, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i + pseudo(i, 14) * 40;
    const rad = (angle * Math.PI) / 180;
    const dist = opts.distance ?? 46;
    const x = Math.cos(rad) * dist;
    const y = Math.sin(rad) * dist;
    const duration = (opts.durationBase ?? 2.8) + pseudo(i, 15) * (opts.durationVar ?? 1.6);
    const delay = -pseudo(i, 16) * duration;
    const size = opts.size ?? 15;
    return particle("cc-aura-p-flash", { x: x.toFixed(1) + "px", y: y.toFixed(1) + "px", size: size + "px", color, duration: duration.toFixed(2) + "s", delay: delay.toFixed(2) + "s" });
  }).join("");
}

function beams(count, color, opts = {}) {
  const length = opts.length ?? 52;
  const spokes = Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i;
    const delay = -pseudo(i, 17) * 2.4;
    return `<span class="cc-aura-p-beam" style="--angle:${angle}deg;--length:${length}px;--color:${color};--delay:${delay.toFixed(2)}s"></span>`;
  }).join("");
  const duration = opts.spinDuration ?? 22;
  return `<span class="cc-aura-p-beam-group" style="--duration:${duration}s">${spokes}</span>`;
}

function fog(count, color, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const size = (opts.sizeBase ?? 60) + pseudo(i, 18) * (opts.sizeVar ?? 24);
    const x1 = (pseudo(i, 19) - 0.5) * 40;
    const y1 = (pseudo(i, 20) - 0.5) * 40;
    const x2 = (pseudo(i, 21) - 0.5) * 46;
    const y2 = (pseudo(i, 22) - 0.5) * 46;
    const duration = (opts.durationBase ?? 6) + pseudo(i, 23) * (opts.durationVar ?? 3);
    const delay = -pseudo(i, 24) * duration;
    return particle("cc-aura-p-fog", { size: size.toFixed(0) + "px", color, x1: x1.toFixed(1) + "px", y1: y1.toFixed(1) + "px", x2: x2.toFixed(1) + "px", y2: y2.toFixed(1) + "px", duration: duration.toFixed(2) + "s", delay: delay.toFixed(2) + "s" });
  }).join("");
}

function shards(count, color, opts = {}) {
  const radiusBase = opts.radiusBase ?? 50;
  return Array.from({ length: count }, (_, i) => {
    const radius = radiusBase + pseudo(i, 25) * (opts.radiusVar ?? 16);
    const size = (opts.sizeBase ?? 8) + pseudo(i, 26) * (opts.sizeVar ?? 3);
    const duration = (opts.durationBase ?? 8) + pseudo(i, 27) * (opts.durationVar ?? 5);
    const delay = -pseudo(i, 28) * duration;
    const reverse = pseudo(i, 29) > 0.5 ? "reverse" : "normal";
    return (
      `<span class="cc-aura-p-orbit-spoke" style="--duration:${duration.toFixed(2)}s;--delay:${delay.toFixed(2)}s;--direction:${reverse}">` +
      `<span class="cc-aura-p-shard" style="--radius:${radius.toFixed(1)}px;--size:${size.toFixed(1)}px;--color:${color}"></span>` +
      `</span>`
    );
  }).join("");
}

function stars(count, color, opts = {}) {
  return Array.from({ length: count }, (_, i) => {
    const spread = opts.spread ?? 82;
    const x = (pseudo(i, 30) - 0.5) * spread;
    const y = (pseudo(i, 31) - 0.5) * spread;
    const size = (opts.sizeBase ?? 5) + pseudo(i, 32) * (opts.sizeVar ?? 3);
    const duration = (opts.durationBase ?? 1.8) + pseudo(i, 33) * (opts.durationVar ?? 1.6);
    const delay = -pseudo(i, 34) * duration;
    return particle("cc-aura-p-star", { x: x.toFixed(1) + "px", y: y.toFixed(1) + "px", size: size.toFixed(1) + "px", color, duration: duration.toFixed(2) + "s", delay: delay.toFixed(2) + "s" });
  }).join("");
}

// Jede Aura kombiniert wenige Primitive zu einem eigenen Erscheinungsbild.
// Komplexität/Dichte steigt mit Seltenheit, nie durch simples "mehr Ringe".
const RECIPES = {
  ember: (color) => rise(5, color, { spread: 56, durationBase: 2.2, durationVar: 1.2 }),
  frost: (color) => fall(6, color, { spread: 70 }),
  verdant: (color) => orbitDots(4, color, { radiusBase: 54, durationBase: 7, dotClass: "cc-aura-p-leaf" }) + rise(4, "#d9f99d", { spread: 44, durationBase: 3.4, durationVar: 1.6, sizeVar: 1.4 }),
  storm: (color) => flash(3, color, { distance: 48, durationBase: 2.6, durationVar: 1.4 }) + orbitDots(2, color, { radiusBase: 62, durationBase: 10, sizeBase: 3 }),
  radiant: (color) => beams(8, color, { length: 50, spinDuration: 24 }) + stars(5, "#fff7d6", { spread: 70, durationBase: 1.6 }),
  nebula: (color) => fog(2, color, { sizeBase: 64, durationBase: 7 }) + stars(8, "#f3e8ff", { spread: 88, durationBase: 2 }),
  voidstorm: (color) => fog(2, "#1e1033", { sizeBase: 74, durationBase: 8 }) + shards(6, "#120a1f", { radiusBase: 52, radiusVar: 20 }) + flash(3, "#a855f7", { distance: 56, durationBase: 1.8, durationVar: 1 }),
};

export function renderAuraLayer(aura) {
  if (!aura) return '<div class="cc-aura-layer" aria-hidden="true"></div>';

  const color = getRarity(aura.rarity).color;
  const recipe = RECIPES[aura.id];
  const content = recipe ? recipe(color) : rise(4, color);

  return (
    `<div class="cc-aura-layer ${aura.visualClass}" style="--aura-color:${color}" aria-hidden="true">` +
    `<span class="cc-aura-anchor"></span>` +
    content +
    `</div>`
  );
}
