// Aura-Katalog. Auren sind der einzige Weg, den Klick-Ertrag über einen
// zusätzlichen Faktor zu multiplizieren (siehe core/loadout.js für die
// zentrale Formel). Eine Aura pro Seltenheitsstufe, damit Aura-Boxen dieselbe
// Seltenheitsfarbe/-sortierung wie Cursor-Boxen nutzen können (data/rarities.js).
//
// clickBonus ist der ADDITIVE Bonus-Anteil (z.B. 0,75 = "+0,75× Klick-Ertrag"),
// nicht der fertige Faktor. Der fertige Aura-Faktor ist immer 1 + clickBonus.
export const AURAS = [
  {
    id: "ember",
    name: "Ember Aura",
    rarity: "common",
    clickBonus: 0.1,
    description: "Ein schwacher, warmer Schimmer. Bescheiden, aber ein Anfang.",
    visualClass: "aura-ember",
  },
  {
    id: "frost",
    name: "Frost Aura",
    rarity: "uncommon",
    clickBonus: 0.2,
    description: "Feiner Frost — Schneeflocken treiben sacht nach unten.",
    visualClass: "aura-frost",
  },
  {
    id: "verdant",
    name: "Verdant Aura",
    rarity: "rare",
    clickBonus: 0.35,
    description: "Blätter und Pollen umkreisen den Cursor in sanftem Grün.",
    visualClass: "aura-verdant",
  },
  {
    id: "storm",
    name: "Storm Aura",
    rarity: "epic",
    clickBonus: 0.55,
    description: "Kurze Blitze zucken um den Cursor, elektrisch aufgeladen.",
    visualClass: "aura-storm",
  },
  {
    id: "radiant",
    name: "Radiant Aura",
    rarity: "legendary",
    clickBonus: 0.75,
    description: "Goldene Lichtstrahlen und funkelnde Partikel um den Cursor.",
    visualClass: "aura-radiant",
  },
  {
    id: "nebula",
    name: "Nebula Aura",
    rarity: "mythic",
    clickBonus: 1.0,
    description: "Ein kosmischer Wirbel aus Sternenstaub und tiefem Violett.",
    visualClass: "aura-nebula",
  },
  {
    id: "voidstorm",
    name: "Voidstorm Aura",
    rarity: "secret",
    clickBonus: 1.5,
    description: "Die seltenste Aura. Dunkle Energie, schwarze Fragmente, violette Blitze.",
    visualClass: "aura-voidstorm",
  },
];

const BY_ID = new Map(AURAS.map((aura) => [aura.id, aura]));

export function getAura(id) {
  return id ? BY_ID.get(id) || null : null;
}

export function getAuraFactor(aura) {
  return 1 + (aura?.clickBonus || 0);
}
