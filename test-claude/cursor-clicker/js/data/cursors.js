// Cursor-Katalog: zwei Cursor je Seltenheitsstufe. Ein neuer Cursor = ein neuer
// Eintrag hier, Gacha/Inventar/Achievements lesen diese Liste generisch aus.
export const CURSORS = [
  { id: "wooden", name: "Wooden Cursor", rarity: "common", multiplier: 1.2, icon: "🪵", description: "Ein einfacher Cursor aus Holz. Nichts Besonderes, aber ein Anfang." },
  { id: "stone", name: "Stone Cursor", rarity: "common", multiplier: 1.3, icon: "🪨", description: "Robust und schwer. Zumindest bricht er nicht so schnell." },

  { id: "copper", name: "Copper Cursor", rarity: "uncommon", multiplier: 1.6, icon: "🔶", description: "Leitet ein wenig mehr Energie in jeden Klick." },
  { id: "neon", name: "Neon Cursor", rarity: "uncommon", multiplier: 1.8, icon: "💠", description: "Leuchtet sanft im Dunkeln und klickt spürbar stärker." },

  { id: "ice", name: "Ice Cursor", rarity: "rare", multiplier: 2.4, icon: "❄️", description: "Kalt, klar und überraschend treffsicher." },
  { id: "steel", name: "Steel Cursor", rarity: "rare", multiplier: 2.7, icon: "⚙️", description: "Industriequalität. Gebaut, um zu klicken." },

  { id: "fire", name: "Fire Cursor", rarity: "epic", multiplier: 3.6, icon: "🔥", description: "Brennt bei jedem Klick ein kleines bisschen heißer." },
  { id: "storm", name: "Storm Cursor", rarity: "epic", multiplier: 4.0, icon: "⚡", description: "Ein Hauch von Blitz in jeder Bewegung." },

  { id: "hacker", name: "Hacker Cursor", rarity: "legendary", multiplier: 5.5, icon: "💻", description: "01001000... übersetzt: sehr effektiv." },
  { id: "phoenix", name: "Phoenix Cursor", rarity: "legendary", multiplier: 6.0, icon: "🦅", description: "Erhebt sich aus der Asche jedes einzelnen Klicks." },

  { id: "galaxy", name: "Galaxy Cursor", rarity: "mythic", multiplier: 9.0, icon: "🌌", description: "Enthält mehr Sterne, als du je zählen könntest." },
  { id: "quantum", name: "Quantum Cursor", rarity: "mythic", multiplier: 9.5, icon: "⚛️", description: "Existiert an jedem Klickpunkt gleichzeitig." },

  { id: "void", name: "Void Cursor", rarity: "secret", multiplier: 16.0, icon: "🕳️", description: "Aus dem Nichts gezogen. Manche behaupten, er klickt von selbst." },
  { id: "origin", name: "Origin Cursor", rarity: "secret", multiplier: 18.0, icon: "✨", description: "Der erste Cursor, der je existierte. Oder der letzte." },
];

const BY_ID = new Map(CURSORS.map((c) => [c.id, c]));
const BY_RARITY = new Map();
for (const cursor of CURSORS) {
  if (!BY_RARITY.has(cursor.rarity)) BY_RARITY.set(cursor.rarity, []);
  BY_RARITY.get(cursor.rarity).push(cursor);
}

export function getCursor(id) {
  return BY_ID.get(id) || null;
}

export function getCursorsByRarity(rarityId) {
  return BY_RARITY.get(rarityId) || [];
}
