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
    ringCount: 1,
    visualClass: "aura-ember",
  },
  {
    id: "frost",
    name: "Frost Aura",
    rarity: "uncommon",
    clickBonus: 0.2,
    description: "Ein kühler, klarer Ring aus feinem Frost.",
    ringCount: 1,
    visualClass: "aura-frost",
  },
  {
    id: "verdant",
    name: "Verdant Aura",
    rarity: "rare",
    clickBonus: 0.35,
    description: "Zwei sich langsam drehende Ringe aus lebendigem Grün.",
    ringCount: 2,
    visualClass: "aura-verdant",
  },
  {
    id: "storm",
    name: "Storm Aura",
    rarity: "epic",
    clickBonus: 0.55,
    description: "Elektrisch geladene Ringe mit kurzen Blitzimpulsen.",
    ringCount: 2,
    visualClass: "aura-storm",
  },
  {
    id: "radiant",
    name: "Radiant Aura",
    rarity: "legendary",
    clickBonus: 0.75,
    description: "Goldene Lichtstrahlen und funkelnde Partikel um den Cursor.",
    ringCount: 3,
    visualClass: "aura-radiant",
  },
  {
    id: "nebula",
    name: "Nebula Aura",
    rarity: "mythic",
    clickBonus: 1.0,
    description: "Ein kosmischer Wirbel aus Sternenstaub und tiefem Violett.",
    ringCount: 3,
    visualClass: "aura-nebula",
  },
  {
    id: "voidstorm",
    name: "Voidstorm Aura",
    rarity: "secret",
    clickBonus: 1.5,
    description: "Die seltenste Aura. Gegenläufige Ringe, dunkle Energie, ständige Partikelausbrüche.",
    ringCount: 4,
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
