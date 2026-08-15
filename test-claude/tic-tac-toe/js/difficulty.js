// Die vier Schwierigkeitsstufen.
//
// Diese Datei ist die EINZIGE Stelle, an der eine Stufe definiert wird:
// Anzeigename, Emoji und die Kennung der Bot-Strategie stehen hier
// zusammen. Die Oberfläche liest daraus ihre Texte, der Bot seine Strategie
// — keine der beiden Seiten kennt die Stufen sonst irgendwo hartcodiert.
//
// `strategy` verweist auf eine Funktion in bot.js. Eine neue Stufe braucht
// hier einen Eintrag und dort eine passende Strategie, sonst nichts.

export const DIFFICULTIES = [
  {
    step: 1,
    id: "einfach",
    label: "Einfach",
    emoji: "🙂",
    strategy: "random",
    description: "Spielt fast zufällig und übersieht vieles.",
  },
  {
    step: 2,
    id: "mittel",
    label: "Mittel",
    emoji: "🤔",
    strategy: "heuristic",
    description: "Gewinnt und blockt, denkt aber nur einen Zug weit.",
  },
  {
    step: 3,
    id: "schwer",
    label: "Schwer",
    emoji: "😈",
    strategy: "minimaxSlip",
    description: "Rechnet die Partie durch, patzt nur selten.",
  },
  {
    step: 4,
    id: "extrem",
    label: "Extrem",
    emoji: "💀",
    strategy: "minimaxPerfect",
    description: "Perfektes Spiel. Bestenfalls unentschieden.",
  },
];

export const MIN_STEP = 1;
export const MAX_STEP = DIFFICULTIES.length;
export const DEFAULT_STEP = 2;

/** Stufe zu einer Reglerposition, gegen unsinnige Werte abgesichert. */
export function getDifficultyByStep(step) {
  const number = Math.round(Number(step));
  const clamped = Math.min(MAX_STEP, Math.max(MIN_STEP, Number.isFinite(number) ? number : DEFAULT_STEP));
  return DIFFICULTIES[clamped - 1];
}
