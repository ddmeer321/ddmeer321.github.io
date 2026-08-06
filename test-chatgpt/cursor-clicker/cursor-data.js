export const RARITIES = {
  common: { label: "Common", rank: 0, color: "#9ca3af" },
  uncommon: { label: "Uncommon", rank: 1, color: "#4ade80" },
  rare: { label: "Rare", rank: 2, color: "#38bdf8" },
  epic: { label: "Epic", rank: 3, color: "#c084fc" },
  legendary: { label: "Legendary", rank: 4, color: "#fbbf24" },
  mythic: { label: "Mythic", rank: 5, color: "#fb7185" },
  secret: { label: "Secret", rank: 6, color: "#f8fafc" },
};

export const CURSORS = [
  { id: "wooden", name: "Wooden Cursor", icon: "◆", rarity: "common", multiplier: 1, description: "Ein solider Anfang. Einfach, ehrlich und zuverlässig." },
  { id: "paper", name: "Paper Cursor", icon: "◇", rarity: "common", multiplier: 1.12, description: "Federleicht und ein kleines bisschen schneller." },
  { id: "pixel", name: "Pixel Cursor", icon: "▰", rarity: "common", multiplier: 1.25, description: "Direkt aus einem alten Arcade-Automaten." },
  { id: "leaf", name: "Leaf Cursor", icon: "❖", rarity: "common", multiplier: 1.35, description: "Naturbelassen mit sanftem Coin-Schub." },

  { id: "neon", name: "Neon Cursor", icon: "✦", rarity: "uncommon", multiplier: 1.65, description: "Leuchtet bei jedem Klick durch die Nacht." },
  { id: "ice", name: "Ice Cursor", icon: "❄", rarity: "uncommon", multiplier: 1.85, description: "Eiskalt kalkuliert: jeder 10. Klick gibt einen Bonus.", effect: { type: "every", every: 10, bonus: 4 } },
  { id: "copper", name: "Copper Cursor", icon: "⬡", rarity: "uncommon", multiplier: 2.05, description: "Ein leitfähiger Cursor mit kräftigem Grundwert." },

  { id: "fire", name: "Fire Cursor", icon: "♨", rarity: "rare", multiplier: 2.7, description: "Heiße Klicks mit 8 % Chance auf dreifache Coins.", effect: { type: "critical", chance: 0.08, bonus: 3 } },
  { id: "crystal", name: "Crystal Cursor", icon: "◈", rarity: "rare", multiplier: 3.05, description: "Bricht das Licht und vervielfacht deinen Ertrag." },
  { id: "plasma", name: "Plasma Cursor", icon: "ϟ", rarity: "rare", multiplier: 3.4, description: "Geladene Energie für schnelle Coin-Sprünge." },

  { id: "hacker", name: "Hacker Cursor", icon: ">_", rarity: "epic", multiplier: 4.8, description: "Manipuliert den Coin-Stream zu deinen Gunsten." },
  { id: "storm", name: "Storm Cursor", icon: "⚡", rarity: "epic", multiplier: 5.35, description: "Jeder 20. Klick entfesselt einen Coin-Blitz.", effect: { type: "every", every: 20, bonus: 12 } },
  { id: "royal", name: "Royal Cursor", icon: "♛", rarity: "epic", multiplier: 5.9, description: "Ein Cursor für Klicker mit königlichem Anspruch." },

  { id: "galaxy", name: "Galaxy Cursor", icon: "✺", rarity: "legendary", multiplier: 8.2, description: "Trägt den Ertrag einer ganzen Galaxie in sich." },
  { id: "solar", name: "Solar Cursor", icon: "☀", rarity: "legendary", multiplier: 9.4, description: "10 % Chance auf einen fünffachen Sonnenburst.", effect: { type: "critical", chance: 0.1, bonus: 5 } },

  { id: "void", name: "Void Cursor", icon: "◉", rarity: "mythic", multiplier: 14.5, description: "Zieht Coins aus der Leere zwischen den Klicks." },
  { id: "chrono", name: "Chrono Cursor", icon: "⌛", rarity: "mythic", multiplier: 16.2, description: "Jeder 25. Klick springt durch die Zeit.", effect: { type: "every", every: 25, bonus: 30 } },

  { id: "singularity", name: "Singularity Cursor", icon: "✹", rarity: "secret", multiplier: 26, description: "Ein unmöglicher Cursor, der den Coin-Raum krümmt." },
  { id: "golden-hand", name: "Golden Hand", icon: "☝", rarity: "secret", multiplier: 32, description: "Der geheime Meisterklick: 12 % Chance auf zehnfache Coins.", effect: { type: "critical", chance: 0.12, bonus: 10 } },
];

export const BOXES = [
  {
    id: "starter", name: "Starter Box", icon: "▣", price: 75,
    description: "Günstige Box für deine ersten Upgrades.",
    chances: { common: 65, uncommon: 25, rare: 8, epic: 1.7, legendary: 0.25, mythic: 0.04, secret: 0.01 },
  },
  {
    id: "advanced", name: "Advanced Box", icon: "◫", price: 1500,
    description: "Deutlich bessere Chancen auf starke Cursor.",
    chances: { common: 25, uncommon: 35, rare: 25, epic: 11, legendary: 3.5, mythic: 0.45, secret: 0.05 },
  },
  {
    id: "premium", name: "Premium Box", icon: "⬢", price: 15000,
    description: "Für Sammler auf der Jagd nach Mythic und Secret.",
    chances: { common: 5, uncommon: 15, rare: 30, epic: 28, legendary: 17, mythic: 4.5, secret: 0.5 },
  },
];

export const ACHIEVEMENTS = [
  { id: "first-box", title: "Ausgepackt!", description: "Öffne deine erste Box.", icon: "▣", reward: 50, test: s => s.stats.boxesOpened >= 1 },
  { id: "click-100", title: "Klickstarter", description: "Erreiche 100 Klicks.", icon: "☝", reward: 100, test: s => s.stats.totalClicks >= 100 },
  { id: "click-1000", title: "Klickmaschine", description: "Erreiche 1.000 Klicks.", icon: "⚡", reward: 500, test: s => s.stats.totalClicks >= 1000 },
  { id: "legendary", title: "Goldener Moment", description: "Ziehe deinen ersten Legendary Cursor.", icon: "✦", reward: 1000, test: s => s.stats.highestRarity >= RARITIES.legendary.rank },
  { id: "collector-10", title: "Cursor-Sammler", description: "Sammle 10 verschiedene Cursor.", icon: "◈", reward: 2000, test: s => Object.keys(s.inventory).length >= 10 },
  { id: "box-25", title: "Boxenprofi", description: "Öffne insgesamt 25 Boxen.", icon: "⬢", reward: 2500, test: s => s.stats.boxesOpened >= 25 },
  { id: "million", title: "Coin-Millionär", description: "Verdiene insgesamt 1.000.000 Coins.", icon: "●", reward: 10000, test: s => s.stats.totalCoinsEarned >= 1_000_000 },
];

export const cursorById = id => CURSORS.find(cursor => cursor.id === id);
export const boxById = id => BOXES.find(box => box.id === id);
