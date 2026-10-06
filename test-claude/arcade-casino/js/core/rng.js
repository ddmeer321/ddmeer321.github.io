// Zufall. Für Spielergebnisse wird crypto.getRandomValues verwendet (nicht
// vorhersagbar); fehlt es, fällt der Code auf Math.random zurück. Für Tests und
// Simulationen gibt es einen deterministischen, seedbaren Generator.

const hasCrypto = typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function";
const buf = new Uint32Array(1);

/** Gleichverteilte Zahl in [0, 1). */
export function random() {
  if (hasCrypto) {
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

/** Ganzzahl in [0, n). */
export function randInt(n, rnd = random) {
  return Math.floor(rnd() * n);
}

/** Gewichtete Auswahl: items[i] mit Gewicht weights[i]. */
export function weightedPick(items, weights, rnd = random) {
  let total = 0;
  for (const w of weights) total += w;
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Fisher-Yates in place. */
export function shuffle(arr, rnd = random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** Deterministischer Generator (mulberry32) für Tests/Simulationen. */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
