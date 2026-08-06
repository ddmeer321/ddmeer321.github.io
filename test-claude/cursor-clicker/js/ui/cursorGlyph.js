// Wiederverwendbare Cursor-Silhouette. Sorgt dafür, dass jeder Cursor immer
// klar als Mauszeiger erkennbar bleibt (Feature 4) — Individualität kommt
// ausschließlich über Farbe, Mutations-Overlay-Klassen und Cosmetic-Overlay-
// Klassen, nie über eine andere Grundform.
const POINTER_PATH = "M12 6 L12 78 L30 62 L42 88 L54 82 L40 58 L64 58 Z";

export function renderCursorGlyph({ color = "#7c5cff", extraClasses = [], badgeIcon = null } = {}) {
  const classAttr = ["cc-cursor-glyph", ...extraClasses].filter(Boolean).join(" ");
  const badge = badgeIcon ? `<span class="cc-cursor-badge">${badgeIcon}</span>` : "";
  return (
    `<span class="${classAttr}" style="--glyph-color:${color}">` +
    `<svg viewBox="0 0 100 100" class="cc-cursor-svg" aria-hidden="true"><path d="${POINTER_PATH}"></path></svg>` +
    badge +
    `</span>`
  );
}
