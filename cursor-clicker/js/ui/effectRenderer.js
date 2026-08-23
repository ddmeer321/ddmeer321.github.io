// Zentraler Effekt-Renderer für mutationsabhängige Klickeffekte. Liest nur das
// bereits vom Loadout aufgelöste `particle`-Feld (siehe core/loadout.js) —
// UI-Module fragen NICHT selbst nach der Mutation, sondern rufen ausschließlich
// playClickEffect() auf. Ein Partikellimit + animationend-Cleanup verhindert
// unbegrenztes DOM-Wachstum bei schnellem Klicken.
import { state } from "../core/state.js";

const MAX_ACTIVE_PARTICLES = 140;
let activeParticleCount = 0;

const PROFILES = {
  lucky: { count: 6, colors: ["#facc15", "#fde68a"], shape: "spark", distance: [36, 56], duration: 650 },
  golden: { count: 7, colors: ["#fbbf24", "#fff2c9"], shape: "circle", distance: [42, 68], duration: 720 },
  frozen: { count: 6, colors: ["#bfe7ff", "#ffffff"], shape: "shard", distance: [32, 52], duration: 620 },
  toxic: { count: 5, colors: ["#84cc16", "#bef264"], shape: "circle", distance: [28, 46], duration: 850 },
  shiny: { count: 8, colors: ["#ffffff", "#f8fafc"], shape: "spark", distance: [38, 62], duration: 520 },
  inferno: { count: 8, colors: ["#fb5f1a", "#ffd166"], shape: "circle", distance: [44, 72], duration: 680 },
  corrupted: { count: 7, colors: ["#d946ef", "#22d3ee"], shape: "square", distance: [34, 58], duration: 620 },
  rainbow: { count: 9, colors: ["#f43f5e", "#f59e0b", "#4ade80", "#38bdf8", "#a855f7"], shape: "circle", distance: [44, 72], duration: 720 },
  galaxy: { count: 12, colors: ["#7c3aed", "#c4b5fd", "#ffffff"], shape: "spark", distance: [52, 86], duration: 850 },
  void: { count: 12, colors: ["#4c1d95", "#a855f7", "#1e1033"], shape: "circle", distance: [50, 84], duration: 900, implode: true, shockwaveColor: "#a855f7" },
};

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function cleanupParticle(el) {
  el.remove();
  activeParticleCount = Math.max(0, activeParticleCount - 1);
}

function spawnParticle(container, x, y, { className, angle, distance, color, duration }) {
  if (activeParticleCount >= MAX_ACTIVE_PARTICLES) return;
  const el = document.createElement("span");
  el.className = "cc-effect-particle " + className;
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.setProperty("--angle", angle + "deg");
  el.style.setProperty("--distance", distance + "px");
  el.style.setProperty("--particle-color", color);
  el.style.setProperty("--particle-duration", duration + "ms");
  container.appendChild(el);
  activeParticleCount += 1;

  const cleanup = () => cleanupParticle(el);
  el.addEventListener("animationend", cleanup, { once: true });
  // Fallback, falls animationend aus irgendeinem Grund nicht feuert.
  setTimeout(cleanup, duration + 250);
}

function spawnShockwave(container, x, y, color, duration) {
  if (activeParticleCount >= MAX_ACTIVE_PARTICLES) return;
  const el = document.createElement("span");
  el.className = "cc-effect-shockwave";
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.setProperty("--particle-color", color);
  el.style.setProperty("--particle-duration", duration + "ms");
  container.appendChild(el);
  activeParticleCount += 1;

  const cleanup = () => cleanupParticle(el);
  el.addEventListener("animationend", cleanup, { once: true });
  setTimeout(cleanup, duration + 250);
}

// container: das Element, in dem die Partikel positioniert werden (Koordinaten
// sind relativ zu dessen Bounding-Box). x/y: Klickposition in Client-Koordinaten.
export function playClickEffect(particleKey, clientX, clientY, container) {
  if (!particleKey || !container) return;
  if (!state.settings.animations || prefersReducedMotion()) return;

  const profile = PROFILES[particleKey];
  if (!profile) return;

  const rect = container.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const shapeClass = "cc-effect-" + profile.shape + (profile.implode ? " cc-effect-implode" : "");

  for (let i = 0; i < profile.count; i++) {
    const angle = (360 / profile.count) * i + (Math.random() * 16 - 8);
    const distance = profile.distance[0] + Math.random() * (profile.distance[1] - profile.distance[0]);
    const color = profile.colors[i % profile.colors.length];
    spawnParticle(container, x, y, { className: shapeClass, angle, distance, color, duration: profile.duration });
  }

  if (profile.implode) {
    spawnShockwave(container, x, y, profile.shockwaveColor || profile.colors[0], profile.duration * 0.7);
  }
}
