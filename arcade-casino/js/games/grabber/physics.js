// Münzgreifer – vereinfachte, deterministische Physik (rein, in Node testbar).
//
// Seitenansicht in den Glaskasten: Münzen sind Kreise, die unter Schwerkraft
// einen Haufen bilden (positionsbasierte Kollisionen, Boden, Wände). Der
// Greifer senkt sich an der gewählten x-Position, bis seine Zinken den Haufen
// berühren, und schließt sich.
//
// Was er hält, folgt ausschließlich aus der Lage der Münzen im Greifbereich –
// es gibt KEINE zufällige oder versteckte Greifkraft:
//  * „Halt“ einer Münze = wie zentral sie zwischen den Zinken liegt (1 = Mitte,
//    0 = am Rand) – Münzen ganz oben im Greifbereich sitzen lockerer.
//  * Die Zinken fassen höchstens CAPACITY Münzen; überzählige (die mit dem
//    schlechtesten Halt) rutschen beim Hochfahren heraus.
//  * Halt < LOOSE: fällt beim Hochfahren. Halt < SWAY: fällt beim Schwanken
//    während der Fahrt zum Schacht. Sonst: wird ausgeliefert.
// Die Fallzeitpunkte hängen nur vom Halt ab (lockerer = früher).

export const BOX_W = 24; // Innenbreite
export const CHUTE_W = 4.6; // Ausgabeschacht links (x < CHUTE_W)
export const WALL_X = CHUTE_W + 0.3; // Trennwand zwischen Schacht und Haufen
export const BOX_H = 20;
export const PALM_START_Y = 17.5;
export const GRIP_HALF = 1.75; // halbe Zinkenspannweite
export const GRIP_DEPTH = 2.1; // Höhe des Greifbereichs unter der Kralle
export const CAPACITY = 5;
export const LOOSE = 0.3;
export const SWAY = 0.5;
export const CLAW_MIN_X = WALL_X + 1.6;
export const CLAW_MAX_X = BOX_W - 1.6;
export const PILE_TARGET = 46;

/** Münztypen: Wert in „Grundeinheiten“ (× Einsatzstufe/20 = Credits). */
export const COIN_TYPES = {
  bronze: { value: 1, r: 0.9, weight: 64 },
  silver: { value: 2, r: 0.86, weight: 22 },
  gold: { value: 5, r: 0.95, weight: 9 },
  chip: { value: 10, r: 1.0, weight: 4 },
  diamond: { value: 30, r: 1.0, weight: 1 },
};

const TYPE_LIST = Object.keys(COIN_TYPES);
const TYPE_WEIGHTS = TYPE_LIST.map((t) => COIN_TYPES[t].weight);

export function rollType(rnd) {
  let total = 0;
  for (const w of TYPE_WEIGHTS) total += w;
  let r = rnd() * total;
  for (let i = 0; i < TYPE_LIST.length; i++) {
    r -= TYPE_WEIGHTS[i];
    if (r < 0) return TYPE_LIST[i];
  }
  return "bronze";
}

let nextId = 1;
export function makeCoin(type, x, y) {
  return { id: nextId++, type, r: COIN_TYPES[type].r, x, y, px: x, py: y, rot: (x * 7.3 + y * 3.1) % 6.28 };
}

export function createWorld(rnd) {
  const w = { coins: [], rnd };
  for (let i = 0; i < PILE_TARGET; i++) {
    const x = WALL_X + 1 + rnd() * (BOX_W - WALL_X - 2);
    w.coins.push(makeCoin(rollType(rnd), x, 1 + (i % 12) * 1.9 + rnd()));
  }
  settle(w, 900);
  return w;
}

/**
 * Ein Physikschritt (Verlet + Kollisionsauflösung). Deterministisch.
 * `free` = Münzen, die gerade nicht im Greifer stecken.
 */
export function step(w, dt = 1 / 120, coins = w.coins) {
  const g = 60;
  for (const c of coins) {
    const vx = (c.x - c.px) * 0.985;
    const vy = (c.y - c.py) * 0.985;
    c.px = c.x;
    c.py = c.y;
    c.x += vx;
    c.y += vy - g * dt * dt;
  }
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < coins.length; i++) {
      const a = coins[i];
      for (let j = i + 1; j < coins.length; j++) {
        const b = coins[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        if (dx > min || dx < -min || dy > min || dy < -min) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        let nx = 0;
        let ny = 1;
        if (d > 1e-9) {
          nx = dx / d;
          ny = dy / d;
        } else d = 0;
        const push = (min - d) * 0.5;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
    for (const c of coins) constrain(c);
  }
}

function constrain(c) {
  if (c.y < c.r) {
    c.y = c.r;
    // Bodenreibung
    c.px = c.x - (c.x - c.px) * 0.6;
  }
  if (c.inChute) {
    if (c.x < c.r) c.x = c.r;
    if (c.x > CHUTE_W - c.r) c.x = CHUTE_W - c.r;
    return;
  }
  if (c.x < WALL_X + c.r) c.x = WALL_X + c.r;
  if (c.x > BOX_W - c.r) c.x = BOX_W - c.r;
}

/** Lässt den Haufen zur Ruhe kommen. */
export function settle(w, steps = 600) {
  for (let i = 0; i < steps; i++) step(w);
  for (const c of w.coins) {
    c.px = c.x;
    c.py = c.y;
  }
}

/** Höhe, auf der die Kralle (Unterkante) beim Absenken an Position x aufsetzt. */
export function contactY(w, x) {
  let top = 0.4;
  for (const c of w.coins) {
    const dx = Math.abs(c.x - x);
    if (dx < GRIP_HALF + c.r * 0.5) top = Math.max(top, c.y + c.r * 0.6);
  }
  return top;
}

/**
 * Greifvorgang an Position x. Rein: verändert die Welt nicht.
 * @returns {{palmY:number, items:{coin:object, hold:number, fate:"deliver"|"dropLift"|"dropMove", dropAt:number}[]}}
 */
export function planGrab(w, x) {
  const cx = Math.max(CLAW_MIN_X, Math.min(CLAW_MAX_X, x));
  const palmY = contactY(w, cx);
  const zoneTop = palmY + 0.3;
  const zoneBottom = palmY - GRIP_DEPTH;
  const inZone = w.coins.filter((c) => Math.abs(c.x - cx) < GRIP_HALF && c.y < zoneTop && c.y > zoneBottom);
  const items = inZone.map((coin) => {
    const central = 1 - Math.abs(coin.x - cx) / GRIP_HALF; // 1 = Mitte
    const depth = (zoneTop - coin.y) / (zoneTop - zoneBottom); // 1 = tief zwischen den Zinken
    const hold = Math.max(0, Math.min(1, central * 0.75 + depth * 0.35 - 0.05));
    return { coin, hold };
  });
  items.sort((a, b) => b.hold - a.hold || a.coin.id - b.coin.id);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i >= CAPACITY || it.hold < LOOSE) {
      it.fate = "dropLift";
      it.dropAt = 0.1 + it.hold * 0.5; // Sekunden nach Beginn des Hochfahrens
    } else if (it.hold < SWAY) {
      it.fate = "dropMove";
      it.dropAt = 0.15 + (it.hold - LOOSE) * 2; // Sekunden nach Beginn der Fahrt
    } else {
      it.fate = "deliver";
      it.dropAt = Infinity;
    }
  }
  return { x: cx, palmY, items };
}

/** Wert der ausgelieferten Münzen eines Plans (Grundeinheiten). */
export function deliveredValue(plan) {
  return plan.items.filter((i) => i.fate === "deliver").reduce((s, i) => s + COIN_TYPES[i.coin.type].value, 0);
}

/** Entfernt Münzen aus dem Haufen (z. B. ausgelieferte). */
export function removeCoins(w, ids) {
  const set = new Set(ids);
  w.coins = w.coins.filter((c) => !set.has(c.id));
}

/** Füllt den Haufen von oben auf (sichtbar), bis PILE_TARGET erreicht ist. */
export function refill(w, rnd) {
  const added = [];
  while (w.coins.length < PILE_TARGET) {
    const x = WALL_X + 1 + rnd() * (BOX_W - WALL_X - 2);
    const c = makeCoin(rollType(rnd), x, BOX_H - 1 - added.length * 0.4);
    w.coins.push(c);
    added.push(c);
  }
  return added;
}

/** Kompletter Zug ohne Animation (Tests/Simulation): Plan → Auslieferung → Nachrutschen → Auffüllen. */
export function resolveGrab(w, x) {
  const plan = planGrab(w, x);
  const delivered = plan.items.filter((i) => i.fate === "deliver").map((i) => i.coin.id);
  removeCoins(w, delivered);
  settle(w, 240);
  refill(w, w.rnd);
  settle(w, 360);
  return { plan, value: deliveredValue(plan), delivered: delivered.length };
}

export function serialize(w) {
  return w.coins.map((c) => [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100, TYPE_LIST.indexOf(c.type)]);
}

export function deserialize(data, rnd) {
  if (!Array.isArray(data) || data.length < 10 || data.length > 80) return null;
  const w = { coins: [], rnd };
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 3) return null;
    const [x, y, t] = row;
    if (![x, y].every((v) => typeof v === "number" && Number.isFinite(v)) || !TYPE_LIST[t]) return null;
    w.coins.push(makeCoin(TYPE_LIST[t], Math.min(BOX_W - 1, Math.max(WALL_X + 1, x)), Math.min(BOX_H, Math.max(0.5, y))));
  }
  settle(w, 200);
  return w;
}
