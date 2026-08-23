// Cosmetics-Katalog: rein visuelle Overlays für den ausgerüsteten Cursor.
// Bewusst komplett getrennt vom Gameplay (keine Boni, keine Multiplikatoren) und
// von Mutationen (eigener Namespace, eigenes Freischaltsystem). "Cosmetic-Boxen"
// sind laut Aufgabe ein späteres Feature — bis dahin werden Cosmetics über
// Achievements freigeschaltet (siehe data/achievements.js: rewardCosmeticId).
export const COSMETICS = [
  { id: "glow", name: "Glow", description: "Sanftes Leuchten um den Cursor.", cssClass: "cos-glow", unlockedByDefault: true },
  { id: "outline", name: "Outline", description: "Klare, helle Umrandung.", cssClass: "cos-outline" },
  { id: "border", name: "Border", description: "Dezenter Rahmen mit Abstand.", cssClass: "cos-border" },
  { id: "neon", name: "Neon", description: "Grell pulsierende Neon-Kontur.", cssClass: "cos-neon" },
  { id: "fire", name: "Feuer", description: "Züngelnde Flammen am Cursorrand.", cssClass: "cos-fire" },
  { id: "ice", name: "Eis", description: "Fein vereister Rand mit Frost-Schimmer.", cssClass: "cos-ice" },
  { id: "galaxy", name: "Galaxy", description: "Sternenstaub zieht um den Cursor.", cssClass: "cos-galaxy" },
  { id: "rainbow", name: "Rainbow", description: "Durchgehend changierender Regenbogen-Schein.", cssClass: "cos-rainbow" },
  { id: "matrix", name: "Matrix", description: "Herabfallende Zeichen im Hintergrund.", cssClass: "cos-matrix" },
  { id: "sakura", name: "Sakura", description: "Vorbeiwehende Kirschblüten.", cssClass: "cos-sakura" },
];

const BY_ID = new Map(COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]));

export function getCosmetic(id) {
  return id ? BY_ID.get(id) || null : null;
}

export function getDefaultUnlockedCosmeticIds() {
  return COSMETICS.filter((c) => c.unlockedByDefault).map((c) => c.id);
}
