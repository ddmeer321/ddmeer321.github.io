// Aura-Boxen-Katalog. odds sind Prozentwerte je Aura-Seltenheit (data/rarities.js)
// und müssen sich zu 100 summieren — exakt dasselbe Muster wie data/boxes.js.
export const AURA_BOXES = [
  {
    id: "aura-starter",
    name: "Aura-Box: Funke",
    price: 150,
    icon: "◐",
    description: "Günstiger Einstieg ins Aura-System, meist gewöhnliche Auren.",
    odds: { common: 55, uncommon: 28, rare: 12, epic: 4, legendary: 0.8, mythic: 0.18, secret: 0.02 },
  },
  {
    id: "aura-advanced",
    name: "Aura-Box: Glut",
    price: 900,
    icon: "◑",
    description: "Deutlich bessere Chancen auf seltene bis epische Auren.",
    odds: { common: 30, uncommon: 30, rare: 22, epic: 13, legendary: 4, mythic: 0.8, secret: 0.2 },
  },
  {
    id: "aura-premium",
    name: "Aura-Box: Kern",
    price: 4000,
    icon: "●",
    description: "Für Sammler: hohe Chance auf legendäre bis geheime Auren.",
    odds: { common: 10, uncommon: 18, rare: 25, epic: 24, legendary: 15, mythic: 6, secret: 2 },
  },
];

const BY_ID = new Map(AURA_BOXES.map((b) => [b.id, b]));

export function getAuraBox(id) {
  return BY_ID.get(id) || null;
}
