// Neon Hoops – deterministische Wurfphysik (rein, ohne DOM, testbar in Node).
//
// Welt in Metern: x rechts, y oben, z nach vorn (vom Spieler weg).
// Gleicher Swipe ⇒ gleicher Abwurf ⇒ gleiche Flugbahn. Es gibt KEINEN
// Zufall und keine Trefferhilfe; der Ring kann sich in Stufe 2 bewegen –
// aber vorhersehbar (Sinus über die Spielzeit).

export const G = 9.81;
export const BALL_R = 0.12;
export const START = { x: 0, y: 1.0, z: 0 };
export const RIM = { y: 2.6, z: 2.6, r: 0.23, tube: 0.016 };
export const BOARD = { z: RIM.z + RIM.r + 0.14, halfW: 0.62, y0: 2.4, y1: 3.25 };
export const LAUNCH_ANGLE = (66 * Math.PI) / 180;

// Abbildung Swipe → Abwurfgeschwindigkeit (siehe swipeToVelocity)
export const SPEED_BASE = 5.38; // m/s bei Swipe-Tempo 0
export const SPEED_GAIN = 0.65; // m/s pro (Bildschirmhöhe/s)
export const SPEED_MIN = 4.6;
export const SPEED_MAX = 9.5;
export const MIN_SWIPE = 0.6; // Bildschirmhöhen/s – darunter kein Wurf

/**
 * Wandelt einen Swipe in eine Abwurfgeschwindigkeit um.
 * @param {number} up  Aufwärtstempo in Bildschirmhöhen pro Sekunde (>0 = nach oben)
 * @param {number} side Seitentempo in Bildschirmhöhen pro Sekunde (>0 = nach rechts)
 * @returns {{vx:number, vy:number, vz:number}|null}
 */
export function swipeToVelocity(up, side) {
  if (!(up > MIN_SWIPE) || !Number.isFinite(side)) return null;
  const speed = Math.max(SPEED_MIN, Math.min(SPEED_MAX, SPEED_BASE + SPEED_GAIN * up));
  const vz = speed * Math.cos(LAUNCH_ANGLE);
  const vy = speed * Math.sin(LAUNCH_ANGLE);
  // Richtung: Verhältnis seitlich/aufwärts bestimmt den Winkel (auf ±35° begrenzt)
  const ang = Math.max(-0.6, Math.min(0.6, Math.atan2(side, up) * 0.5));
  return { vx: Math.tan(ang) * vz, vy, vz };
}

/** Aufwärtstempo, mit dem ein gerader Wurf den Ringmittelpunkt trifft (für Tests/Hilfe). */
export function idealUpSpeed() {
  const dz = RIM.z - START.z;
  const dy = RIM.y - START.y;
  const c = Math.cos(LAUNCH_ANGLE);
  const v2 = (G * dz * dz) / (2 * c * c * (dz * Math.tan(LAUNCH_ANGLE) - dy));
  return (Math.sqrt(v2) - SPEED_BASE) / SPEED_GAIN;
}

export function createBall(vel, rimX = 0) {
  return {
    x: START.x,
    y: START.y,
    z: START.z,
    vx: vel.vx,
    vy: vel.vy,
    vz: vel.vz,
    t: 0,
    spin: 0,
    rimHits: 0,
    boardHits: 0,
    scored: false,
    swish: false,
    done: false,
    rimX,
  };
}

/**
 * Ein fester Simulationsschritt. rimX: aktuelle x-Position des Rings (und Bretts).
 * Rückgabe: Ereignisliste [{kind: "rim"|"board"|"floor"|"score", strength}]
 */
export function stepBall(b, dt, rimX = 0) {
  const ev = [];
  if (b.done) return ev;
  b.t += dt;
  b.vy -= G * dt;
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.spin += Math.hypot(b.vx, b.vy, b.vz) * dt * 2;

  // Brett (Vorderseite bei BOARD.z)
  if (b.vz > 0 && b.z + BALL_R > BOARD.z && pz + BALL_R <= BOARD.z + 0.05) {
    if (Math.abs(b.x - rimX) <= BOARD.halfW + BALL_R * 0.5 && b.y >= BOARD.y0 - BALL_R * 0.5 && b.y <= BOARD.y1 + BALL_R * 0.5) {
      const s = Math.abs(b.vz);
      b.z = BOARD.z - BALL_R;
      b.vz = -b.vz * 0.48;
      b.vx *= 0.85;
      b.vy *= 0.88;
      b.boardHits++;
      ev.push({ kind: "board", strength: s });
    }
  }

  // Ring als Torus: nächster Punkt auf dem Ringkreis
  const dx = b.x - rimX;
  const dz = b.z - RIM.z;
  const rho = Math.hypot(dx, dz);
  if (rho > 1e-6) {
    const cx = rimX + (dx / rho) * RIM.r;
    const cz = RIM.z + (dz / rho) * RIM.r;
    const nx0 = b.x - cx;
    const ny0 = b.y - RIM.y;
    const nz0 = b.z - cz;
    const dist = Math.hypot(nx0, ny0, nz0);
    const minD = BALL_R + RIM.tube;
    if (dist < minD && dist > 1e-6) {
      const nx = nx0 / dist;
      const ny = ny0 / dist;
      const nz = nz0 / dist;
      const vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn < 0) {
        const e = 0.55;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
        b.vz -= (1 + e) * vn * nz;
        // tangentiale Dämpfung
        b.vx *= 0.88;
        b.vy *= 0.92;
        b.vz *= 0.88;
        b.rimHits++;
        ev.push({ kind: "rim", strength: -vn });
      }
      const push = minD - dist;
      b.x += nx * push;
      b.y += ny * push;
      b.z += nz * push;
    }
  }

  // Treffer: Mittelpunkt kreuzt die Ringebene abwärts innerhalb des Rings
  if (!b.scored && py > RIM.y && b.y <= RIM.y && b.vy < 0) {
    const t = (py - RIM.y) / (py - b.y);
    const ix = px + (b.x - px) * t - rimX;
    const iz = pz + (b.z - pz) * t - RIM.z;
    if (Math.hypot(ix, iz) < RIM.r - BALL_R * 0.35) {
      b.scored = true;
      b.swish = b.rimHits === 0 && b.boardHits === 0;
      ev.push({ kind: "score", strength: 1 });
    }
  }

  // Netz bremst einen getroffenen Ball
  if (b.scored && b.y < RIM.y && b.y > RIM.y - 0.45) {
    b.vx *= 0.94;
    b.vz *= 0.94;
    if (b.vy < -2.2) b.vy *= 0.97;
  }

  // Boden
  if (b.y - BALL_R < 0) {
    b.y = BALL_R;
    if (b.vy < -1) ev.push({ kind: "floor", strength: -b.vy });
    b.vy = -b.vy * 0.55;
    b.vx *= 0.8;
    b.vz *= 0.8;
  }
  if (b.t > 3.2 || b.z > BOARD.z + 1 || b.z < -1.5 || (b.y < 0.3 && b.t > 1.2 && Math.abs(b.vy) < 1.2)) b.done = true;
  return ev;
}

/** Simuliert einen Wurf komplett (für Tests). */
export function simulate(vel, rimX = 0, dt = 1 / 240) {
  const b = createBall(vel, rimX);
  const events = [];
  while (!b.done) events.push(...stepBall(b, dt, rimX));
  return { scored: b.scored, swish: b.swish, rimHits: b.rimHits, boardHits: b.boardHits, events, ball: b };
}

/** Ringposition in Stufe 2 (vorhersehbare Pendelbewegung). */
export function rimXAt(time, moving) {
  return moving ? 0.32 * Math.sin(time * 1.15) : 0;
}
