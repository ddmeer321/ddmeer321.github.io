// Sicherer Zugriff auf localStorage. Im privaten Modus, bei vollem Speicher oder
// gesperrten Cookies wirft localStorage – dann läuft das Spiel mit einem
// In-Memory-Ersatz weiter (Fortschritt geht beim Neuladen verloren, aber nichts bricht).

const memory = new Map();
let available = null;

function probe() {
  if (available !== null) return available;
  try {
    const key = "__np_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function storageAvailable() {
  return probe();
}

export function readJSON(key) {
  try {
    const raw = probe() ? window.localStorage.getItem(key) : memory.get(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] "${key}" konnte nicht gelesen werden`, err);
    return null;
  }
}

export function writeJSON(key, value) {
  let raw;
  try {
    raw = JSON.stringify(value);
  } catch (err) {
    console.error(`[storage] "${key}" ist nicht serialisierbar`, err);
    return false;
  }
  if (probe()) {
    try {
      window.localStorage.setItem(key, raw);
      return true;
    } catch (err) {
      console.warn(`[storage] Schreiben von "${key}" fehlgeschlagen – nutze Speicher im RAM`, err);
      available = false;
    }
  }
  memory.set(key, raw);
  return true;
}

export function removeKey(key) {
  memory.delete(key);
  try {
    if (probe()) window.localStorage.removeItem(key);
  } catch {
    /* ignorieren */
  }
}
