// Vereinfachte Coin-Pusher-Physik (rein, ohne DOM – in Node simulierbar).
//
// Modell (Draufsicht, Einheiten ≈ mm/10):
//  * Spielfeld x ∈ [-HALF_W, HALF_W], y von der Rückwand (0) bis zur Vorderkante (LEN).
//  * Der Schieber ist ein Block über die volle Breite; seine Vorderseite liegt bei
//    py(t) und pendelt sinusförmig. Oben auf dem Schieber liegt das „Regal“.
//  * Ebene 0 (Regal): Münzen fahren beim Ausfahren mit, beim Einfahren hält die
//    Rückwand sie fest. Rutscht eine Münze über die Regalkante, fällt sie aufs Feld.
//  * Ebene 1 (Feld): Münzen sind Scheiben ohne Trägheit (hohe Reibung auf Filz).
//    Der Schieber drückt sie nach vorn, Überlappungen werden iterativ aufgelöst –
//    so pflanzt sich der Druck durch das Münzbett fort.
//  * Münzen, deren Mittelpunkt über die Vorderkante wandert, fallen in die
//    Gewinnschale. Vorne fehlen die Seitenwände (ab SIDE_OPEN): wer dort seitlich
//    über den Rand gedrückt wird, fällt in die Seitenrinne und ist verloren.
//
// Kein Zufall entscheidet über Gewinn oder Verlust – nur Einwurfposition,
// Timing und die Lage der Münzen. Zufall gibt es nur beim Münztyp eines
// Einwurfs (Gold/Bonus, Wahrscheinlichkeiten unten) und minimal beim Aufprall.

export const HALF_W = 50;
export const LEN = 120;
export const R = 5.4;
export const PUSH_MID = 29;
export const PUSH_AMP = 12;
export const PUSH_PERIOD = 3.4;
export const SIDE_OPEN = 92;
export const MAX_COINS = 150;

export const COIN_TYPES = {
  normal: { value: 1 },
  gold: { value: 5 },
  star: { value: 1, bonus: 6 },
};

/** Wahrscheinlichkeiten für den Typ einer eingeworfenen Münze. */
export const DROP_ODDS = { gold: 1 / 18, star: 1 / 60 };

export function pusherY(t) {
  return PUSH_MID + PUSH_AMP * Math.sin((2 * Math.PI * t) / PUSH_PERIOD);
}

let nextId = 1;

export function makeCoin(x, y, layer, type = "normal") {
  return { id: nextId++, x, y, layer, type, z: 0, vz: 0, fall: null };
}

export function createWorld(rnd = Math.random) {
  return { t: 0, py: pusherY(0), coins: [], falling: [], rnd };
}

/** Füllt ein frisches Feld (Startzustand) nahe am Gleichgewicht: dichtes
 * Gitter mit leichten Zufallslücken, damit es sofort „arbeitet“. */
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
  if (r < DROP_ODDS.star) return "star";
  if (r < DROP_ODDS.star + DROP_ODDS.gold) return "gold";
  return "normal";
}

/** Wirft eine Münze an Position x ein (landet auf dem Regal). */
export function dropCoin(world, x, type = "normal") {
  const cx = Math.max(-HALF_W + R, Math.min(HALF_W - R, x));
  const y = Math.max(R, world.py - R * 1.6);
  const c = makeCoin(cx + (world.rnd() - 0.5) * 0.6, y, 0, type);
  c.z = 26;
  c.vz = 0;
  world.coins.push(c);
  return c;
}

function resolvePairs(list, iterations, py, fieldMode) {
  const D = 2 * R;
  const D2 = D * D;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.x - a.x;
        if (dx > D || dx < -D) continue;
        const dy = b.y - a.y;
        if (dy > D || dy < -D) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        let d = Math.sqrt(d2);
        let nx;
        let ny;
        if (d < 1e-6) {
          nx = 0;
          ny = 1;
          d = 0;
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        const push = (D - d) * 0.5;
        // Am Schieber anliegende Münzen geben nicht nach hinten nach
        const aLocked = fieldMode && a.y - R <= py + 0.01;
        const bLocked = fieldMode && b.y - R <= py + 0.01;
        if (aLocked && !bLocked) {
          b.x += nx * push * 2;
          b.y += ny * push * 2;
        } else if (bLocked && !aLocked) {
          a.x -= nx * push * 2;
          a.y -= ny * push * 2;
        } else {
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    if (fieldMode) for (const c of list) constrainField(c, py);
  }
}

function constrainField(c, py) {
  if (c.y - R < py) c.y = py + R;
  if (c.y < SIDE_OPEN) {
    if (c.x < -HALF_W + R) c.x = -HALF_W + R;
    if (c.x > HALF_W - R) c.x = HALF_W - R;
  }
}

function constrainShelf(c, py) {
  if (c.y < R) c.y = R;
  if (c.x < -HALF_W + R) c.x = -HALF_W + R;
  if (c.x > HALF_W - R) c.x = HALF_W - R;
  void py;
}

export function relax(world, iterations = 4) {
  const field = world.coins.filter((c) => c.layer === 1 && c.z <= 0);
  const shelf = world.coins.filter((c) => c.layer === 0 && c.z <= 0);
  resolvePairs(field, iterations, world.py, true);
  resolvePairs(shelf, iterations, world.py, false);
}

/**
 * Ein Simulationsschritt. Liefert Ereignisse:
 * { kind: "land"|"shelfDrop"|"win"|"lost", coin }
 */
export function step(world, dt) {
  const events = [];
  const prev = world.py;
  world.t += dt;
  world.py = pusherY(world.t);
  const dpy = world.py - prev;

  for (const c of world.coins) {
    // Fallende Münzen (Einwurf oder Regal→Feld)
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
      if (dpy > 0) c.y += dpy; // fährt mit
      constrainShelf(c, world.py);
      if (c.y > world.py + R * 0.15) {
        // über die Regalkante gekippt → fällt aufs Feld
        c.layer = 1;
        c.z = 4;
        c.vz = 0;
        c.y = Math.max(c.y, world.py + R);
        events.push({ kind: "shelfDrop", coin: c });
      }
    } else {
      if (c.y - R < world.py) c.y = world.py + R;
    }
  }

  relax(world, 3);

  // Kanten prüfen
  const keep = [];
  for (const c of world.coins) {
    if (c.layer === 1 && c.z <= 0) {
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

  // Fallanimationen altern lassen
  for (const f of world.falling) f.fall.t += dt;
  world.falling = world.falling.filter((f) => f.fall.t < 0.9);
  return events;
}

/** Kompakter Speicherstand (gerundet). */
export function serialize(world) {
  return {
    t: Math.round(world.t * 100) / 100,
    c: world.coins.filter((c) => c.z <= 0 || c.layer === 0).map((c) => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.layer, c.type === "gold" ? 1 : c.type === "star" ? 2 : 0]),
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
    world.coins.push(makeCoin(x, y, layer === 0 ? 0 : 1, tp === 1 ? "gold" : tp === 2 ? "star" : "normal"));
  }
  relax(world, 6);
  return world;
}
