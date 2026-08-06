// Achievement-Katalog. type/value beschreiben die Freischaltbedingung deklarativ,
// ausgewertet von core/achievements.js — neue Achievements brauchen keinen neuen Code.
export const ACHIEVEMENTS = [
  { id: "first_click", name: "Der erste Klick", description: "Klicke zum ersten Mal auf den Cursor.", icon: "🖱️", type: "clicks", value: 1 },
  { id: "clicks_100", name: "Warmgeklickt", description: "Erreiche 100 Klicks.", icon: "👆", type: "clicks", value: 100 },
  { id: "clicks_1000", name: "Klickmaschine", description: "Erreiche 1.000 Klicks.", icon: "🖐️", type: "clicks", value: 1000 },
  { id: "clicks_10000", name: "Klick-Legende", description: "Erreiche 10.000 Klicks.", icon: "🔥", type: "clicks", value: 10000 },

  { id: "first_box", name: "Erste Öffnung", description: "Öffne deine erste Cursor-Box.", icon: "📦", type: "boxesOpened", value: 1 },
  { id: "boxes_10", name: "Sammelwut", description: "Öffne 10 Boxen.", icon: "🎁", type: "boxesOpened", value: 10 },
  { id: "boxes_50", name: "Boxen-Profi", description: "Öffne 50 Boxen.", icon: "🏭", type: "boxesOpened", value: 50 },

  { id: "coins_10000", name: "Kleines Vermögen", description: "Verdiene insgesamt 10.000 Coins.", icon: "🪙", type: "coinsEarned", value: 10000 },
  { id: "coins_100000", name: "Coin-Magnat", description: "Verdiene insgesamt 100.000 Coins.", icon: "💰", type: "coinsEarned", value: 100000 },

  { id: "first_epic", name: "Episch!", description: "Ziehe deinen ersten Epic-Cursor.", icon: "🟣", type: "rarityObtained", value: "epic" },
  { id: "first_legendary", name: "Legendär!", description: "Ziehe deinen ersten Legendary-Cursor.", icon: "🟠", type: "rarityObtained", value: "legendary" },
  { id: "first_mythic", name: "Mythisch!", description: "Ziehe deinen ersten Mythic-Cursor.", icon: "🔴", type: "rarityObtained", value: "mythic" },
  { id: "first_secret", name: "Geheimnis gelüftet", description: "Ziehe einen Secret-Cursor.", icon: "🌈", type: "rarityObtained", value: "secret" },

  { id: "unique_10", name: "Vielfalt", description: "Sammle 10 verschiedene Cursor.", icon: "🗂️", type: "uniqueCursors", value: 10 },
  { id: "unique_all", name: "Vollständige Sammlung", description: "Sammle alle verfügbaren Cursor.", icon: "🏆", type: "uniqueCursors", value: "all" },

  { id: "daily_streak_7", name: "Treuer Spieler", description: "Hole dir 7 Tage in Folge deine tägliche Belohnung.", icon: "📅", type: "dailyStreak", value: 7 },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return BY_ID.get(id) || null;
}
