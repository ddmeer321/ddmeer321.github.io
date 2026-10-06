// Münzkaskade 2.0 – vereinfachte, deterministische Coin-Pusher-Physik
// (rein, ohne DOM – in Node simulierbar).
//
// Modell (Draufsicht, Einheiten ≈ mm/10):
//  * Spielfeld x ∈ [-HALF_W, HALF_W], y von der Rückwand (0) bis zur Vorderkante (LEN).
//  * Der Schieber pendelt sinusförmig; seine Vorderseite liegt bei py(t).
//  * Ebene 0 (Regal oben auf dem Schieber): Münzen fahren beim Ausfahren mit,
//    die Rückwand hält sie beim Einfahren fest; über die Regalkante fallen sie aufs Feld.
//  * Ebene 1 (Feld): Scheiben mit Trägheit und starker Filzreibung. Was der
//    Schieber oder eine andere Münze anstößt, gleitet ein Stück nach – so
//    entstehen sichtbare Kettenreaktionen.
//  * Ebene 2 (Stapel): Wird eine Münze im Gedränge zu stark eingequetscht,
//    rutscht sie auf ihre Nachbarn. Gestapelte Münzen fahren auf ihrer Unterlage
//    mit; verschwindet die Unterlage (z. B. über die Kante), fallen sie mit.
//  * Eine Münze fällt, wenn ihr MITTELPUNKT die Vorderkante überschreitet – bis
//    dahin kann sie gefährlich weit überstehen („Kipp-Zustand“). Vorne an den
//    Seiten (ab SIDE_OPEN) fehlen die Wände: dort fällt sie in die Rinne.
//
// Auszahlung entsteht ausschließlich aus Münzen, die in dieser Simulation über die
// Vorderkante fallen. Zufall gibt es nur beim Einwurf (Münztyp, minimaler Versatz).

export const HALF_W = 50;
export const LEN = 120;
export const R = 5.4;
export const PUSH_MID = 29;
export const PUSH_AMP = 12;
export const PUSH_PERIOD = 3.4;
export const SIDE_OPEN = 85;
export const MAX_COINS = 150;
export const MAX_STACKED = 22;
export const FRICTION = 11; // 1/s – Filzreibung der Feldmünzen
export const KICK = 0.35; // Anteil des Stoßes, der als Schwung erhalten bleibt
export const CLIMB_OVERLAP = 0.7; // ab dieser Quetschung (× R) klettert eine Münze auf den Stapel
export const TEETER = 0.55; // ab LEN - TEETER·R steht eine Münze sichtbar über

export const COIN_TYPES = {
  normal: { value: 1, r: R },
  gold: { value: 5, r: R },
  star: { value: 1, r: R, bonus: 6 },
  mega: { value: 15, r: R * 1.45 },
};

/** Wahrscheinlichkeiten für den Typ einer eingeworfenen Münze. */
export const DROP_ODDS = { gold: 1 / 18, star: 1 / 60, mega: 1 / 150 };

const TYPE_CODES = ["normal", "gold", "star", "mega"];

export function pusherY(t) {
  return PUSH_MID + PUSH_AMP * Math.sin((2 * Math.PI * t) / PUSH_PERIOD);
}

let nextId = 1;

export function makeCoin(x, y, layer, type = "normal") {
  const t = COIN_TYPES[type] ? type : "normal";
  return { id: nextId++, x, y, layer, type: t, r: COIN_TYPES[t].r, z: 0, vz: 0, vx: 0, vy: 0, rot: ((x * 12.9898 + y * 78.233) % 6.283), fall: null, sx: 0, sy: 0 };
}

export function createWorld(rnd = Math.random) {
  return { t: 0, py: pusherY(0), coins: [], falling: [], rnd };
}

/** Frisches Feld nahe am Gleichgewicht: dichtes Gitter mit Zufallslücken. */
export function seedField(world, fill = 0.9) {
  const { rnd } = world;
  const dx = 2.08 * R;
  const dy = dx * 0.87;
  let row = 0;
  for (let y = PUSH_MID + PUSH_AMP * 0.2 + R; y < LEN - 1.6 * R; y += dy, row++) {
    const off = row % 2 ? dx / 2 : 0;
    for (let x = -HALF_W + R + off; x <= HALF_W - R; x += dx) {
      if (rnd() > fill) continue;
      world.coins.push(makeCoin(x + (rnd() - 0.5), y + (rnd() - 0.5), 1, rnd() < 0.05 ? "gold" : "normal"));
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = (rnd() * 2 - 1) * (HALF_W - R);
    world.coins.push(makeCoin(x, R + rnd() * 8, 0));
  }
  relax(world, 8);
}

export function rollType(rnd) {
  const r = rnd();
  if (r < DROP_ODDS.mega) return "mega";
  if (r < DROP_ODDS.mega + DROP_ODDS.star) return "star";
  if (r < DROP_ODDS.mega + DROP_ODDS.star + DROP_ODDS.gold) return "gold";
  return "normal";
}

/** Wirft eine Münze an Position x ein (landet auf dem Regal). */
export function dropCoin(world, x, type = "normal") {
  const r = (COIN_TYPES[type] || COIN_TYPES.normal).r;
  const cx = Math.max(-HALF_W + r, Math.min(HALF_W - r, x));
  const y = Math.max(r, world.py - r * 1.6);
  const c = makeCoin(cx + (world.rnd() - 0.5) * 0.6, y, 0, type);
  c.z = 26;
  world.coins.push(c);
  return c;
}

// ---------- Kollisionen (Raster-Suche) ----------

const CELL = 2 * R * 1.45;

function buildGrid(list) {
  const grid = new Map();
  for (const c of list) {
    const k = Math.floor(c.x / CELL) * 4096 + Math.floor(c.y / CELL);
    let arr = grid.get(k);
    if (!arr) grid.set(k, (arr = []));
    arr.push(c);
  }
  return grid;
}

/** Löst Überlappungen auf; gibt pro Münze die verbleibende Quetschung zurück. */
function resolvePairs(list, iterations, py, fieldMode, squeeze) {
  for (let it = 0; it < iterations; it++) {
    const grid = buildGrid(list);
    const last = it === iterations - 1;
    for (const a of list) {
      const gx = Math.floor(a.x / CELL);
      const gy = Math.floor(a.y / CELL);
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          const arr = grid.get(ix * 4096 + iy);
          if (!arr) continue;
          for (const b of arr) {
            if (b.id <= a.id) continue;
            const D = a.r + b.r;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= D * D) continue;
            let d = Math.sqrt(d2);
            let nx = 0;
            let ny = 1;
            if (d > 1e-6) {
              nx = dx / d;
              ny = dy / d;
            } else d = 0;
            const over = D - d;
            if (last && squeeze) {
              squeeze.set(a.id, (squeeze.get(a.id) || 0) + over);
              squeeze.set(b.id, (squeeze.get(b.id) || 0) + over);
            }
            // schwere Mega-Münzen geben weniger nach
            const wa = a.type === "mega" ? 0.25 : 1;
            const wb = b.type === "mega" ? 0.25 : 1;
            const aLocked = fieldMode && a.y - a.r <= py + 0.01;
            const bLocked = fieldMode && b.y - b.r <= py + 0.01;
            let ka = wa / (wa + wb);
            let kb = wb / (wa + wb);
            if (aLocked && !bLocked) {
              ka = 0;
              kb = 1;
            } else if (bLocked && !aLocked) {
              ka = 1;
              kb = 0;
            }
            a.x -= nx * over * ka;
            a.y -= ny * over * ka;
            b.x += nx * over * kb;
            b.y += ny * over * kb;
          }
        }
      }
    }
    if (fieldMode) for (const c of list) constrainField(c, py);
  }
}

function constrainField(c, py) {
  if (c.y - c.r < py) c.y = py + c.r;
  if (c.y < SIDE_OPEN) {
    if (c.x < -HALF_W + c.r) c.x = -HALF_W + c.r;
    if (c.x > HALF_W - c.r) c.x = HALF_W - c.r;
  }
}

function constrainShelf(c) {
  if (c.y < c.r) c.y = c.r;
  if (c.x < -HALF_W + c.r) c.x = -HALF_W + c.r;
  if (c.x > HALF_W - c.r) c.x = HALF_W - c.r;
}

export function relax(world, iterations = 4) {
  const field = world.coins.filter((c) => c.layer === 1 && c.z <= 0);
  const shelf = world.coins.filter((c) => c.layer === 0 && c.z <= 0);
  resolvePairs(field, iterations, world.py, true, null);
  resolvePairs(shelf, iterations, world.py, false, null);
}

/** Unterstützende Feldmünzen einer Stapelmünze. */
function supporters(c, grid) {
  const out = [];
  const gx = Math.floor(c.x / CELL);
  const gy = Math.floor(c.y / CELL);
  for (let ix = gx - 1; ix <= gx + 1; ix++)
    for (let iy = gy - 1; iy <= gy + 1; iy++) {
      const arr = grid.get(ix * 4096 + iy);
      if (!arr) continue;
      for (const b of arr) {
        const dx = b.x - c.x;
        const dy = b.y - c.y;
        if (dx * dx + dy * dy < (b.r + c.r) * (b.r + c.r) * 0.72) out.push(b);
      }
    }
  return out;
}

/**
 * Ein Simulationsschritt. Ereignisse:
 * { kind: "land"|"shelfDrop"|"climb"|"topple"|"win"|"lost", coin }
 */
export function step(world, dt) {
  const events = [];
  const prev = world.py;
  world.t += dt;
  world.py = pusherY(world.t);
  const dpy = world.py - prev;
  const damp = Math.exp(-FRICTION * dt);

  for (const c of world.coins) {
    c.sx = c.x;
    c.sy = c.y;
    if (c.z > 0) {
      c.vz -= 260 * dt;
      c.z += c.vz * dt;
      if (c.layer === 0 && dpy > 0) c.y += dpy;
      if (c.z <= 0) {
        c.z = 0;
        c.vz = 0;
        events.push({ kind: "land", coin: c });
      }
      continue;
    }
    if (c.layer === 0) {
      if (dpy > 0) c.y += dpy;
      constrainShelf(c);
      if (c.y > world.py + c.r * 0.15) {
        c.layer = 1;
        c.z = 4;
        c.vz = 0;
        c.y = Math.max(c.y, world.py + c.r);
        c.vy = Math.max(0, dpy / dt) * 0.5;
        events.push({ kind: "shelfDrop", coin: c });
      }
    } else {
      // Trägheit + Reibung
      c.ivx = c.vx;
      c.ivy = c.vy;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= damp;
      c.vy *= damp;
      if (c.y - c.r < world.py) c.y = world.py + c.r;
    }
  }

  // Feld auflösen und Quetschung messen
  const field = world.coins.filter((c) => c.layer === 1 && c.z <= 0);
  const squeeze = new Map();
  resolvePairs(field, 3, world.py, true, squeeze);

  // Gedrängte Münzen klettern auf den Stapel
  let stacked = world.coins.filter((c) => c.layer === 2);
  if (stacked.length < MAX_STACKED) {
    const cand = field.filter((c) => (squeeze.get(c.id) || 0) > CLIMB_OVERLAP * R && c.type !== "mega" && c.y - c.r > world.py + 1);
    cand.sort((a, b) => (squeeze.get(b.id) || 0) - (squeeze.get(a.id) || 0) || a.id - b.id);
    for (const c of cand.slice(0, MAX_STACKED - stacked.length)) {
      c.layer = 2;
      c.vx = 0;
      c.vy = 0;
      events.push({ kind: "climb", coin: c });
    }
  }

  // Stapelmünzen fahren auf ihrer Unterlage mit oder fallen herunter
  const fieldNow = world.coins.filter((c) => c.layer === 1 && c.z <= 0);
  const grid = buildGrid(fieldNow);
  stacked = world.coins.filter((c) => c.layer === 2);
  for (const c of stacked) {
    const sup = supporters(c, grid);
    if (!sup.length) {
      c.layer = 1;
      c.z = 3;
      c.vz = 0;
      events.push({ kind: "topple", coin: c });
      continue;
    }
    let mx = 0;
    let my = 0;
    for (const s of sup) {
      mx += s.x - s.sx;
      my += s.y - s.sy;
    }
    c.x += mx / sup.length;
    c.y += my / sup.length;
    if (c.y - c.r < world.py) c.y = world.py + c.r;
  }
  if (stacked.length > 1) resolvePairs(stacked, 2, world.py, false, null);

  // Stöße übertragen Schwung: Nur der Anteil der Bewegung, der NICHT aus der
  // eigenen Trägheit stammt (Schieber, Nachbarn), wird zur Hälfte zu Geschwindigkeit.
  for (const c of fieldNow) {
    const corrX = c.x - c.sx - (c.ivx || 0) * dt;
    const corrY = c.y - c.sy - (c.ivy || 0) * dt;
    c.vx = Math.max(-45, Math.min(45, c.vx + (corrX / dt) * KICK));
    c.vy = Math.max(-45, Math.min(45, c.vy + (corrY / dt) * KICK));
    c.rot += ((c.x - c.sx) * 0.9 + (c.y - c.sy) * 0.4) / c.r;
  }

  // Kanten prüfen
  const keep = [];
  for (const c of world.coins) {
    if (c.layer >= 1 && c.z <= 0) {
      if (c.y > LEN) {
        c.fall = { t: 0, side: 0 };
        world.falling.push(c);
        events.push({ kind: "win", coin: c });
        continue;
      }
      if (c.y >= SIDE_OPEN && Math.abs(c.x) > HALF_W) {
        c.fall = { t: 0, side: Math.sign(c.x) };
        world.falling.push(c);
        events.push({ kind: "lost", coin: c });
        continue;
      }
    }
    keep.push(c);
  }
  world.coins = keep;

  for (const f of world.falling) f.fall.t += dt;
  world.falling = world.falling.filter((f) => f.fall.t < 0.9);
  return events;
}

/** Wie weit eine Münze über die Vorderkante ragt (0 = nicht, 1 = kurz vor dem Fallen). */
export function teeter(c) {
  const start = LEN - TEETER * c.r;
  if (c.y <= start) return 0;
  return Math.min(1, (c.y - start) / (LEN - start));
}

/** Kompakter Speicherstand. Format: [x, y, Ebene, Typcode] – kompatibel zu V1.0. */
export function serialize(world) {
  return {
    t: Math.round(world.t * 100) / 100,
    c: world.coins.filter((c) => c.z <= 0 || c.layer === 0).map((c) => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.layer, Math.max(0, TYPE_CODES.indexOf(c.type))]),
  };
}

export function deserialize(data, rnd = Math.random) {
  if (!data || !Array.isArray(data.c) || data.c.length > MAX_COINS) return null;
  const world = createWorld(rnd);
  world.t = typeof data.t === "number" && Number.isFinite(data.t) ? data.t % PUSH_PERIOD : 0;
  world.py = pusherY(world.t);
  for (const row of data.c) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [x, y, layer, tp] = row;
    if (![x, y].every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    if (Math.abs(x) > HALF_W + R || y < 0 || y > LEN) continue;
    const l = layer === 0 ? 0 : layer === 2 ? 2 : 1;
    world.coins.push(makeCoin(x, y, l, TYPE_CODES[tp] || "normal"));
  }
  relax(world, 6);
  return world;
}
