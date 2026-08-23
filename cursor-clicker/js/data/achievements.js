// Achievement-Katalog. type/value beschreiben die Freischaltbedingung deklarativ,
// ausgewertet von core/achievements.js — neue Achievements brauchen keinen neuen
// Code. reward = Coins beim Freischalten. rewardCosmeticId schaltet zusätzlich
// ein Cosmetic frei (siehe data/cosmetics.js) — Platzhalter-Erwerbsweg, bis es
// eigene Cosmetic-Boxen gibt.
export const ACHIEVEMENTS = [
  { id: "first_click", name: "Der erste Klick", description: "Klicke zum ersten Mal auf den Cursor.", icon: "🖱️", type: "clicks", value: 1, reward: 20 },
  { id: "clicks_100", name: "Warmgeklickt", description: "Erreiche 100 Klicks.", icon: "👆", type: "clicks", value: 100, reward: 100, rewardCosmeticId: "outline" },
  { id: "clicks_1000", name: "Klickmaschine", description: "Erreiche 1.000 Klicks.", icon: "🖐️", type: "clicks", value: 1000, reward: 500 },
  { id: "clicks_10000", name: "Klick-Legende", description: "Erreiche 10.000 Klicks.", icon: "🔥", type: "clicks", value: 10000, reward: 2500 },

  { id: "first_box", name: "Erste Öffnung", description: "Öffne deine erste Cursor-Box.", icon: "📦", type: "boxesOpened", value: 1, reward: 50 },
  { id: "boxes_10", name: "Sammelwut", description: "Öffne 10 Boxen.", icon: "🎁", type: "boxesOpened", value: 10, reward: 300, rewardCosmeticId: "border" },
  { id: "boxes_50", name: "Boxen-Profi", description: "Öffne 50 Boxen.", icon: "🏭", type: "boxesOpened", value: 50, reward: 1500 },

  { id: "coins_10000", name: "Kleines Vermögen", description: "Verdiene insgesamt 10.000 Coins.", icon: "🪙", type: "coinsEarned", value: 10000, reward: 500 },
  { id: "coins_100000", name: "Coin-Magnat", description: "Verdiene insgesamt 100.000 Coins.", icon: "💰", type: "coinsEarned", value: 100000, reward: 3000 },

  { id: "first_epic", name: "Episch!", description: "Ziehe deinen ersten Epic-Cursor.", icon: "🟣", type: "rarityObtained", value: "epic", reward: 200, rewardCosmeticId: "ice" },
  { id: "first_legendary", name: "Legendär!", description: "Ziehe deinen ersten Legendary-Cursor.", icon: "🟠", type: "rarityObtained", value: "legendary", reward: 600, rewardCosmeticId: "fire" },
  { id: "first_mythic", name: "Mythisch!", description: "Ziehe deinen ersten Mythic-Cursor.", icon: "🔴", type: "rarityObtained", value: "mythic", reward: 1500, rewardCosmeticId: "neon" },
  { id: "first_secret", name: "Geheimnis gelüftet", description: "Ziehe einen Secret-Cursor.", icon: "🌈", type: "rarityObtained", value: "secret", reward: 5000, rewardCosmeticId: "galaxy" },

  { id: "unique_10", name: "Vielfalt", description: "Sammle 10 verschiedene Cursor.", icon: "🗂️", type: "uniqueCursors", value: 10, reward: 800, rewardCosmeticId: "matrix" },
  { id: "unique_all", name: "Vollständige Sammlung", description: "Sammle alle verfügbaren Cursor.", icon: "🏆", type: "uniqueCursors", value: "all", reward: 8000 },

  { id: "daily_streak_7", name: "Treuer Spieler", description: "Hole dir 7 Tage in Folge deine tägliche Belohnung.", icon: "📅", type: "dailyStreak", value: 7, reward: 700, rewardCosmeticId: "sakura" },

  { id: "first_upgrade", name: "Erstes Upgrade", description: "Werte einen Cursor zum ersten Mal auf.", icon: "⬆️", type: "cursorLevel", value: 2, reward: 100 },
  { id: "first_fusion", name: "Erste Fusion", description: "Fusioniere zum ersten Mal Duplikate.", icon: "🧬", type: "fusionsPerformed", value: 1, reward: 400, rewardCosmeticId: "rainbow" },
  { id: "first_major_mutation", name: "Große Mutation", description: "Erhalte durch Fusion eine Hauptmutation.", icon: "✨", type: "mutationTierObtained", value: "major", reward: 800 },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return BY_ID.get(id) || null;
}
