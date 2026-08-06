// Boxen-Katalog. odds sind Prozentwerte je Seltenheit und müssen sich zu 100 summieren.
export const BOXES = [
  {
    id: "starter",
    name: "Starter Box",
    price: 50,
    icon: "📦",
    description: "Günstiger Einstieg mit fairer Chance auf frühe Cursor.",
    odds: { common: 60, uncommon: 26, rare: 10, epic: 3.2, legendary: 0.7, mythic: 0.1, secret: 0 },
  },
  {
    id: "advanced",
    name: "Advanced Box",
    price: 300,
    icon: "🎁",
    description: "Bessere Chancen auf seltene und epische Cursor.",
    odds: { common: 38, uncommon: 30, rare: 20, epic: 9, legendary: 2.5, mythic: 0.45, secret: 0.05 },
  },
  {
    id: "premium",
    name: "Premium Box",
    price: 1200,
    icon: "💎",
    description: "Für Sammler: deutlich höhere Chancen auf Legendary und mehr.",
    odds: { common: 18, uncommon: 24, rare: 26, epic: 18, legendary: 10, mythic: 3.5, secret: 0.5 },
  },
];

const BY_ID = new Map(BOXES.map((b) => [b.id, b]));

export function getBox(id) {
  return BY_ID.get(id) || null;
}
