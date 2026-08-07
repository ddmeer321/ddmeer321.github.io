// Mutationskatalog für die Fusion (siehe core/fusion.js). Jede Mutation gehört zu
// einer Stufe (major/minor) und trägt ihre eigenen Effekte. Jede Fusion MUSS
// einen echten Gameplay-Vorteil geben (Multiplikator, Coins oder Fusionschance)
// — rein kosmetische Mutationen (0-Boni überall) sind bewusst NICHT erlaubt,
// das ist Aufgabe von Auren/Cosmetics. Neue Mutationen = neuer Eintrag hier,
// kein Code an anderer Stelle nötig.

export const MUTATION_TIERS = ["minor", "major"];

// Innerhalb einer Fusion: Chance auf nur Minor / nur Major / beide zusammen
// (die vom Nutzer vorgegebene Obergrenze "eine Haupt- und eine Nebenmutation").
export const FUSION_OUTCOME_ODDS = {
  minorOnly: 55,
  majorOnly: 30,
  majorAndMinor: 15,
};

export const MUTATIONS = [
  // --- Minor: häufiger, dezenter ---
  {
    id: "lucky",
    name: "Lucky",
    tier: "minor",
    weight: 30,
    spectacular: false,
    color: "#facc15",
    description: "Ein kleiner Glücksbringer. Verbessert leicht deine Fusionschancen mit diesem Cursor.",
    effects: { multiplierBonusPercent: 0, coinBonusPercent: 0, dropChanceBonusPercent: 6 },
    visualClass: "mut-lucky",
    particle: "lucky",
    sound: "lucky",
  },
  {
    id: "golden",
    name: "Golden",
    tier: "minor",
    weight: 26,
    spectacular: false,
    color: "#fbbf24",
    description: "Golden verzierter Cursor mit spürbar mehr Coins pro Klick.",
    effects: { multiplierBonusPercent: 0, coinBonusPercent: 15, dropChanceBonusPercent: 0 },
    visualClass: "mut-golden",
    particle: "golden",
    sound: "golden",
  },
  {
    id: "frozen",
    name: "Frozen",
    tier: "minor",
    weight: 20,
    spectacular: false,
    color: "#bfe7ff",
    description: "Ein fein vereister Cursor — die Kälte schärft jeden Klick spürbar.",
    effects: { multiplierBonusPercent: 8, coinBonusPercent: 0, dropChanceBonusPercent: 0 },
    visualClass: "mut-frozen",
    particle: "frozen",
    sound: "frost",
  },
  {
    id: "toxic",
    name: "Toxic",
    tier: "minor",
    weight: 16,
    spectacular: false,
    color: "#84cc16",
    description: "Giftgrün leuchtend — sickert spürbar mehr Wert in jeden Klick.",
    effects: { multiplierBonusPercent: 0, coinBonusPercent: 10, dropChanceBonusPercent: 0 },
    visualClass: "mut-toxic",
    particle: "toxic",
    sound: "toxic",
  },
  {
    id: "shiny",
    name: "Shiny",
    tier: "minor",
    weight: 8,
    spectacular: false,
    color: "#f8fafc",
    description: "Die seltenste Minor-Mutation — funkelnder Schimmer mit dem stärksten Minor-Bonus.",
    effects: { multiplierBonusPercent: 14, coinBonusPercent: 0, dropChanceBonusPercent: 0 },
    visualClass: "mut-shiny",
    particle: "shiny",
    sound: "shiny",
  },

  // --- Major: seltener, deutlich stärker ---
  {
    id: "inferno",
    name: "Inferno",
    tier: "major",
    weight: 32,
    spectacular: false,
    color: "#fb5f1a",
    description: "Der Cursor brennt förmlich — kräftiger Multiplikator-Bonus.",
    effects: { multiplierBonusPercent: 18, coinBonusPercent: 0, dropChanceBonusPercent: 0 },
    visualClass: "mut-inferno",
    particle: "inferno",
    sound: "inferno",
  },
  {
    id: "corrupted",
    name: "Corrupted",
    tier: "major",
    weight: 24,
    spectacular: false,
    color: "#d946ef",
    description: "Fehlerhaft-schön: verzerrte Optik mit spürbarem Coin- und Glücks-Bonus.",
    effects: { multiplierBonusPercent: 0, coinBonusPercent: 22, dropChanceBonusPercent: 4 },
    visualClass: "mut-corrupted",
    particle: "corrupted",
    sound: "corrupted",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    tier: "major",
    weight: 20,
    spectacular: false,
    color: "#f43f5e",
    description: "Durchgehend changierende Farben, dazu ein solider Multiplikator-Bonus.",
    effects: { multiplierBonusPercent: 12, coinBonusPercent: 0, dropChanceBonusPercent: 0 },
    visualClass: "mut-rainbow",
    particle: "rainbow",
    sound: "rainbow",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    tier: "major",
    weight: 16,
    spectacular: true,
    color: "#7c3aed",
    description: "Ein Cursor voller Sternenstaub — starker Multiplikator-Bonus, spektakuläre Enthüllung.",
    effects: { multiplierBonusPercent: 28, coinBonusPercent: 0, dropChanceBonusPercent: 0 },
    visualClass: "mut-galaxy",
    particle: "galaxy",
    sound: "galaxy",
  },
  {
    id: "void",
    name: "Void",
    tier: "major",
    weight: 8,
    spectacular: true,
    color: "#4c1d95",
    description: "Die seltenste aller Mutationen. Enormer Bonus, dunkle spektakuläre Optik.",
    effects: { multiplierBonusPercent: 40, coinBonusPercent: 10, dropChanceBonusPercent: 0 },
    visualClass: "mut-void",
    particle: "void",
    sound: "void",
  },
];

const BY_ID = new Map(MUTATIONS.map((mutation) => [mutation.id, mutation]));
const BY_TIER = new Map(MUTATION_TIERS.map((tier) => [tier, MUTATIONS.filter((m) => m.tier === tier)]));

export function getMutation(id) {
  return id ? BY_ID.get(id) || null : null;
}

// Einzige Stelle, die Mutation-Boni in Anzeige-Text übersetzt (inventoryPanel.js
// und modals.js nutzen dies statt jeweils eigene, potenziell abweichende
// Berechnungen zu pflegen — genau das hätte vorher dazu geführt, dass eine
// Lucky-Fusion im Reveal-Modal fälschlich als "rein kosmetisch" auftauchte,
// obwohl ihr Fusionschance-Bonus real ist). Berücksichtigt bewusst ALLE drei
// Effekt-Felder, nicht nur Multiplikator/Coins.
export function getMutationBonusParts(mutation) {
  if (!mutation) return [];
  const parts = [];
  if (mutation.effects.multiplierBonusPercent) parts.push("+" + mutation.effects.multiplierBonusPercent + "% Multiplikator");
  if (mutation.effects.coinBonusPercent) parts.push("+" + mutation.effects.coinBonusPercent + "% Coins");
  if (mutation.effects.dropChanceBonusPercent) parts.push("+" + mutation.effects.dropChanceBonusPercent + "% Fusionschance");
  return parts;
}

export function getMutationsByTier(tier) {
  return BY_TIER.get(tier) || [];
}
