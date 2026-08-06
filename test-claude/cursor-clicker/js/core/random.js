// Gemeinsame Gewichtungs-Zufallslogik, genutzt von gacha.js (Boxen) und
// fusion.js (Mutationen) — eine Implementierung statt zweier fast identischer.

// items: Array beliebiger Objekte. getWeight(item) -> Zahl (Prozent oder Gewicht).
// Fällt bei Rundungsfehlern auf den letzten Eintrag mit Gewicht > 0 zurück.
export function weightedPick(items, getWeight) {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);
  let roll = Math.random() * total;
  let lastPositive = null;
  for (const item of items) {
    const weight = getWeight(item);
    if (weight > 0) lastPositive = item;
    if (roll < weight) return item;
    roll -= weight;
  }
  return lastPositive;
}

// Wandelt eine { key: gewicht } Tabelle in normierte Prozent-Zeilen um, sortiert
// absteigend — Basis für jede sichtbare Wahrscheinlichkeits-Anzeige im Spiel.
export function toPercentRows(weightMap) {
  const total = Object.values(weightMap).reduce((sum, w) => sum + w, 0) || 1;
  return Object.entries(weightMap)
    .map(([key, weight]) => ({ key, percent: (weight / total) * 100 }))
    .sort((a, b) => b.percent - a.percent);
}
