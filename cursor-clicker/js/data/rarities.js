// Seltenheitsstufen: einzige Quelle der Wahrheit für Reihenfolge, Farbe und Glow.
// Neue Stufen können hier ergänzt werden, ohne dass Gacha- oder UI-Code angepasst werden muss.
export const RARITIES = [
  { id: "common", label: "Common", order: 0, color: "#9ca3af", glow: "rgba(156,163,175,0.55)" },
  { id: "uncommon", label: "Uncommon", order: 1, color: "#4ade80", glow: "rgba(74,222,128,0.55)" },
  { id: "rare", label: "Rare", order: 2, color: "#38bdf8", glow: "rgba(56,189,248,0.55)" },
  { id: "epic", label: "Epic", order: 3, color: "#a855f7", glow: "rgba(168,85,247,0.6)" },
  { id: "legendary", label: "Legendary", order: 4, color: "#f59e0b", glow: "rgba(245,158,11,0.65)" },
  { id: "mythic", label: "Mythic", order: 5, color: "#f43f5e", glow: "rgba(244,63,94,0.7)" },
  { id: "secret", label: "Secret", order: 6, color: "#e879f9", glow: "rgba(232,121,249,0.85)", rainbow: true },
];

const BY_ID = new Map(RARITIES.map((r) => [r.id, r]));

export function getRarity(id) {
  return BY_ID.get(id) || RARITIES[0];
}

export function isRareDrop(rarityId) {
  return getRarity(rarityId).order >= getRarity("legendary").order;
}
