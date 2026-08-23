// Wiederverwendbare Cursor-Silhouette. Sorgt dafür, dass jeder Cursor immer
// klar als Mauszeiger erkennbar bleibt — kein Emoji, kein Gegenstand über dem
// Cursor. Individualität kommt aus Material (Farbverlauf), Textur-Akzenten
// und Glow INNERHALB der Pfeilform (siehe data/cursorMaterials.js), plus
// Mutations-Overlay-Klassen (mutations-cosmetics.css). Cosmetics fassen den
// Glyphen NICHT an — die sitzen als Hintergrund/Rahmen auf dem Kreis drumherum
// (siehe mainPanel.js/cosmeticsPanel.js), nicht hier.
const POINTER_PATH = "M12 6 L12 78 L30 62 L42 88 L54 82 L40 58 L64 58 Z";

// Jede Instanz braucht eindeutige <defs>-IDs, sonst kollidieren mehrere
// gleichzeitig gerenderte Glyphen (z.B. viele Inventar-Karten) über dieselbe
// globale SVG-ID.
let instanceCounter = 0;

const ACCENT_LINES_CURVED = [
  { d: "M 15 20 Q 26 24 40 18" },
  { d: "M 15 38 Q 27 44 42 36" },
  { d: "M 15 56 Q 26 60 38 54" },
  { d: "M 16 70 Q 25 74 35 68" },
];

const ACCENT_LINES_JAGGED = [
  { d: "M 18 22 L 24 28 L 20 34 L 27 40" },
  { d: "M 34 16 L 30 24 L 36 30" },
  { d: "M 18 52 L 25 58 L 21 64" },
  { d: "M 40 46 L 35 54 L 41 60" },
];

const ACCENT_DOTS = [
  [20, 20], [34, 16], [24, 34], [40, 30], [18, 48], [32, 52], [22, 66],
];

function renderAccent(accent, color, count) {
  switch (accent) {
    case "lines-curved":
      return ACCENT_LINES_CURVED.slice(0, count)
        .map((p) => `<path d="${p.d}" stroke="${color}" stroke-width="1.3" fill="none" opacity="0.55" stroke-linecap="round"/>`)
        .join("");
    case "lines-jagged":
      return ACCENT_LINES_JAGGED.slice(0, count)
        .map((p) => `<path d="${p.d}" stroke="${color}" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round" stroke-linejoin="round"/>`)
        .join("");
    case "stripes": {
      const spacing = 60 / (count + 1);
      let out = "";
      for (let i = 0; i < count; i++) {
        const y = 14 + spacing * (i + 1);
        out += `<line x1="14" y1="${y}" x2="47" y2="${y - 4}" stroke="${color}" stroke-width="0.9" opacity="0.45"/>`;
      }
      return out;
    }
    case "dots":
      return ACCENT_DOTS.slice(0, count)
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${color}" opacity="0.85"/>`)
        .join("");
    case "shine":
      return `<path d="M 14 60 L 30 20 L 36 22 L 20 62 Z" fill="${color}" opacity="0.35"/>`;
    default:
      return "";
  }
}

export function renderCursorGlyph({ cursor = null, color = "#7c5cff", extraClasses = [], material = null } = {}) {
  instanceCounter += 1;
  const uid = "ccg" + instanceCounter;
  const mat = material;

  const classAttr = ["cc-cursor-glyph", ...extraClasses].filter(Boolean).join(" ");
  const glowColor = mat?.glow || (color + "aa");

  if (!mat) {
    // Neutrale Darstellung (kein Cursor ausgerüstet / generische Vorschau z.B. bei Cosmetics).
    return (
      `<span class="${classAttr}" style="--glyph-color:${color};--glyph-glow:${glowColor}">` +
      `<svg viewBox="0 0 100 100" class="cc-cursor-svg" aria-hidden="true"><path d="${POINTER_PATH}"></path></svg>` +
      `</span>`
    );
  }

  const gradId = "grad-" + uid;
  const clipId = "clip-" + uid;
  const [stopA, stopB] = mat.stops;
  const gradientTag =
    mat.gradient === "radial"
      ? `<radialGradient id="${gradId}" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="${stopA}"/><stop offset="100%" stop-color="${stopB}"/></radialGradient>`
      : `<linearGradient id="${gradId}" x1="0%" y1="0%" x2="60%" y2="100%"><stop offset="0%" stop-color="${stopA}"/><stop offset="100%" stop-color="${stopB}"/></linearGradient>`;

  const isOutline = mat.accent === "stroke";
  const pathFill = isOutline ? `url(#${gradId})` : `url(#${gradId})`;
  const pathStroke = isOutline ? ` stroke="${mat.accentColor}" stroke-width="2.6"` : "";
  const fillOpacity = mat.fillOpacity ? ` fill-opacity="${mat.fillOpacity}"` : "";

  const accentMarkup = isOutline ? "" : renderAccent(mat.accent, mat.accentColor, mat.accentCount || 0);

  return (
    `<span class="${classAttr}${mat.unstable ? " cc-cursor-unstable" : ""}" style="--glyph-color:${color};--glyph-glow:${glowColor}">` +
    `<svg viewBox="0 0 100 100" class="cc-cursor-svg" aria-hidden="true">` +
    `<defs>${gradientTag}<clipPath id="${clipId}"><path d="${POINTER_PATH}"></path></clipPath></defs>` +
    `<path d="${POINTER_PATH}" fill="${pathFill}"${fillOpacity}${pathStroke}></path>` +
    `<g clip-path="url(#${clipId})">${accentMarkup}</g>` +
    `</svg>` +
    `</span>`
  );
}
