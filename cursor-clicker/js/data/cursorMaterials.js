// Material-Definitionen je Cursor: Farbverlauf + Textur-Akzent INNERHALB der
// Pfeilform (siehe ui/cursorGlyph.js). Kein Emoji, kein Gegenstand über dem
// Cursor — Individualität kommt ausschließlich aus Farbe/Verlauf/Textur/Glow.
//
// accent: "lines-curved" | "lines-jagged" | "stripes" | "dots" | "shine" | "stroke" | "none"
export const CURSOR_MATERIALS = {
  wooden: { gradient: "linear", stops: ["#d9a566", "#8a5a2e"], accent: "lines-curved", accentColor: "#5c3a1e", accentCount: 3, glow: "rgba(201,138,75,0.55)" },
  stone: { gradient: "linear", stops: ["#cfd2d8", "#6c6f78"], accent: "lines-jagged", accentColor: "#4a4c54", accentCount: 3, glow: "rgba(160,164,174,0.5)" },

  copper: { gradient: "linear", stops: ["#eaa564", "#9c5a2a"], accent: "shine", accentColor: "#ffe3b0", accentCount: 1, glow: "rgba(234,165,100,0.6)" },
  neon: { gradient: "linear", stops: ["#14152a", "#0b0c1c"], accent: "stroke", accentColor: "#22d3ee", accentCount: 1, glow: "rgba(34,211,238,0.85)" },

  ice: { gradient: "linear", stops: ["#eefaff", "#a9dcef"], accent: "lines-jagged", accentColor: "#ffffff", accentCount: 4, fillOpacity: 0.85, glow: "rgba(167,220,242,0.65)" },
  steel: { gradient: "linear", stops: ["#e2e8ee", "#7e8996"], accent: "stripes", accentColor: "#f6fafd", accentCount: 4, glow: "rgba(150,168,182,0.55)" },

  fire: { gradient: "radial", stops: ["#ffe08a", "#fb5f1a"], accent: "dots", accentColor: "#ffd166", accentCount: 5, glow: "rgba(251,95,26,0.75)" },
  storm: { gradient: "linear", stops: ["#4650a0", "#171a3a"], accent: "lines-jagged", accentColor: "#f5e663", accentCount: 2, glow: "rgba(245,230,99,0.65)" },

  hacker: { gradient: "linear", stops: ["#0f1a14", "#050a08"], accent: "stripes", accentColor: "#39ff88", accentCount: 6, glow: "rgba(57,255,136,0.6)" },
  phoenix: { gradient: "radial", stops: ["#ffd27a", "#c22a1f"], accent: "lines-curved", accentColor: "#ffedb0", accentCount: 4, glow: "rgba(255,150,60,0.7)" },

  galaxy: { gradient: "radial", stops: ["#6a54c4", "#160b32"], accent: "dots", accentColor: "#f7f2ff", accentCount: 7, glow: "rgba(124,58,237,0.75)" },
  quantum: { gradient: "linear", stops: ["#6ff0da", "#0f766e"], accent: "lines-jagged", accentColor: "#c8fff5", accentCount: 3, glow: "rgba(45,212,191,0.7)", unstable: true },

  void: { gradient: "radial", stops: ["#2c1348", "#05010c"], accent: "dots", accentColor: "#b478ff", accentCount: 4, glow: "rgba(139,58,237,0.9)" },
  origin: { gradient: "linear", stops: ["#ffffff", "#f5eeff"], accent: "none", glow: "rgba(255,255,255,0.9)" },
};

export function getCursorMaterial(cursorId) {
  return CURSOR_MATERIALS[cursorId] || null;
}
