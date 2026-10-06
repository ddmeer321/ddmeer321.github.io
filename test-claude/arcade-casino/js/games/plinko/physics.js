// Plinko – deterministische 2D-Physik (rein, ohne DOM, in Node testbar).
//
// EHRLICHKEIT: Das Zielfach wird NICHT vorher ausgewürfelt. Zufällig ist nur
// der Einwurf (Startposition und ein kleiner seitlicher Impuls). Danach rechnet
// eine reproduzierbare Simulation mit festem Zeitschritt Kugel-Pin-Kollisionen
// (Kreis gegen Kreis, Rückprall mit Energieverlust) – genau diese Bewegung wird
// angezeigt, und aus ihr ergibt sich das Fach. Gleiche Startwerte ⇒ gleicher Weg.
// Kugeln beeinflussen sich gegenseitig nicht; jede Bahn ist unabhängig.
//
// Koordinaten in „Pin-Abständen“: x = 0 ist die Mitte, y wächst nach unten.

export const ROWS = 12;
export const SLOTS = ROWS + 1;
export const DX = 1; // horizontaler Pin-Abstand
export const DY = 0.86; // Reihenabstand
export const PIN_R = 0.09;
export const BALL_R = 0.22;
export const G = 45; // Schwerkraft (Einheiten/s²)
export const RESTITUTION = 0.45;
export const TANGENT_KEEP = 0.75;
export const DT = 1 / 240;
export const AIR = 6; // seitliche Dämpfung (1/s)
export const MIN_HIT = 0.35; // ab dieser Aufprallgeschwindigkeit zählt ein Kontakt als „Treffer“
export const TOP = -0.9; // Start-y oberhalb der ersten Reihe
export const DROP_JITTER = 0.32; // ± Startversatz in Pin-Abständen
export const DROP_VX = 0.35; // ± seitlicher Startimpuls

/** Pins: Reihe r hat r + 3 Pins, zentriert. */
export const PINS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    const n = r + 3;
    const row = [];
    for (let i = 0; i < n; i++) row.push({ x: (i - (n - 1) / 2) * DX, y: r * DY });
    out.push(row);
  }
  return out;
})();

export const FLOOR_Y = (ROWS - 1) * DY + 0.75;

/** Linke Wand bei Höhe y (entlang der äußeren Pins, etwas nach außen versetzt). */
function wallX(y) {
  const r = Math.max(0, y / DY);
  return ((r + 2) / 2) * DX + 0.12;
}

/** Fachindex für eine x-Position am Boden (0 … SLOTS-1). */
export function slotOf(x) {
  const left = -(SLOTS / 2) * DX;
  const i = Math.floor((x - left) / DX);
  return Math.max(0, Math.min(SLOTS - 1, i));
}

export function slotCenterX(i) {
  return (i - (SLOTS - 1) / 2) * DX;
}

/** Neue Kugel. u1, u2 ∈ [0,1) sind die einzigen Zufallswerte. */
export function createBall(u1, u2) {
  return {
    x: (u1 * 2 - 1) * DROP_JITTER,
    y: TOP,
    vx: (u2 * 2 - 1) * DROP_VX,
    vy: 0,
    t: 0,
    slot: -1,
    done: false,
    stuck: 0,
    hits: 0,
    lastPin: null,
  };
}

/**
 * Ein Zeitschritt. onHit(row, index, speed) wird bei jeder Pin-Kollision aufgerufen.
 */
export function stepBall(b, onHit) {
  if (b.done) return;
  b.t += DT;
  b.vy += G * DT;
  b.vx *= 1 - AIR * DT;
  b.x += b.vx * DT;
  b.y += b.vy * DT;

  // Nur Pins der benachbarten Reihen prüfen (Performance)
  const rc = Math.round(b.y / DY);
  const minD = BALL_R + PIN_R;
  for (let r = rc - 1; r <= rc + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    const row = PINS[r];
    const n = row.length;
    const ic = Math.round(b.x / DX + (n - 1) / 2);
    for (let i = ic - 1; i <= ic + 1; i++) {
      if (i < 0 || i >= n) continue;
      const p = row[i];
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      let nx;
      let ny;
      if (d < 1e-9) {
        nx = 0;
        ny = -1;
        d = 0;
      } else {
        nx = dx / d;
        ny = dy / d;
      }
      // herausschieben
      const push = minD - d;
      b.x += nx * push;
      b.y += ny * push;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const tx = -ny;
        const ty = nx;
        const vt = b.vx * tx + b.vy * ty;
        const nvn = -vn * RESTITUTION;
        const nvt = vt * TANGENT_KEEP;
        b.vx = nvn * nx + nvt * tx;
        b.vy = nvn * ny + nvt * ty;
        if (-vn > MIN_HIT) {
          b.hits++;
          b.lastPin = r * 100 + i;
          if (onHit) onHit(r, i, -vn);
        }
      }
      // Liegt die Kugel praktisch exakt auf einem Pin (instabiles Gleichgewicht),
      // rollt sie deterministisch zur Seite ab, auf der sie ohnehin minimal liegt.
      if (Math.abs(b.vx) < 0.02 && Math.abs(b.vy) < 0.05 && ny < -0.95) {
        b.stuck++;
        if (b.stuck > 12) b.vx += (dx >= 0 ? 1 : -1) * 0.4;
      } else b.stuck = 0;
    }
  }

  // Seitenwände
  const w = wallX(b.y) - BALL_R;
  if (b.x < -w) {
    b.x = -w;
    if (b.vx < 0) b.vx = -b.vx * 0.5;
  } else if (b.x > w) {
    b.x = w;
    if (b.vx > 0) b.vx = -b.vx * 0.5;
  }

  if (b.y >= FLOOR_Y) {
    b.slot = slotOf(b.x);
    b.done = true;
  } else if (b.t > 30) {
    // Sicherheitsnetz (tritt in Tests nie auf): Fach an aktueller Position
    b.slot = slotOf(b.x);
    b.done = true;
  }
}

/** Simuliert eine Kugel komplett. Rückgabe: Fach + Pfad (optional). */
export function simulateDrop(u1, u2, { path = false } = {}) {
  const b = createBall(u1, u2);
  const pts = path ? [] : null;
  let n = 0;
  while (!b.done) {
    stepBall(b);
    if (pts && n++ % 4 === 0) pts.push([b.x, b.y]);
  }
  return { slot: b.slot, time: b.t, hits: b.hits, path: pts };
}

/** Verteilung über die Fächer per Monte-Carlo (für Tests/Simulationen). */
export function slotDistribution(n, rnd) {
  const counts = new Array(SLOTS).fill(0);
  for (let i = 0; i < n; i++) counts[simulateDrop(rnd(), rnd()).slot]++;
  return counts.map((c) => c / n);
}
