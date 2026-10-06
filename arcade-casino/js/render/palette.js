// JS-Spiegel der Design-Tokens aus css/tokens.css für Canvas-Zeichnungen.

export const COLORS = {
  bg0: "#0b0614",
  bg1: "#140b24",
  bg2: "#1e1236",
  bg3: "#2a1a4a",
  ink: "#f4ecff",
  inkDim: "#b7a8d6",
  inkMute: "#7d6f9c",
  pink: "#ff3d9a",
  cyan: "#2de2e6",
  gold: "#ffc53d",
  lime: "#8cff5a",
  violet: "#9b5cff",
  red: "#ff5a5a",
  orange: "#ff8a3d",
  felt: "#0c5c55",
  feltDark: "#073a36",
  wood: "#5a2f1e",
  cardRed: "#e0245e",
  cardBlack: "#1b1530",
};

export const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif';

/** Liest den aktuellen Theme-Akzent aus CSS (Themes ändern --accent). */
export function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}
