// Zahlenformatierung für die Anzeige: Tausendertrennzeichen, ab 100.000 abgekürzt.
// threshold = ab wann diese Stufe greift, divisor = wodurch tatsächlich geteilt
// wird — bei "Tsd" bewusst getrennt (greift erst ab 100.000, zeigt aber in
// vollen Tausendern, z.B. 110.500 -> "110,5 Tsd", nicht "1,1 Tsd").
const SUFFIXES = [
  { threshold: 1e9, divisor: 1e9, suffix: "Mrd" },
  { threshold: 1e6, divisor: 1e6, suffix: "Mio" },
  { threshold: 1e5, divisor: 1e3, suffix: "Tsd" },
];

export function formatNumber(value) {
  const rounded = Math.round(value);
  for (const { threshold, divisor, suffix } of SUFFIXES) {
    if (Math.abs(rounded) >= threshold) {
      return (rounded / divisor).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " " + suffix;
    }
  }
  return rounded.toLocaleString("de-DE");
}

// Multiplikatoren einheitlich formatieren, z.B. 1.2 -> "1,2×", 2.1 -> "2,1×".
export function formatMultiplier(value) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + "×";
}

// Coins/Klick ist intern eine Dezimalzahl (siehe core/loadout.js — bewusst
// nicht früh gerundet, sonst gehen kleine Boni spurlos verloren). Bei kleinen
// Werten zeigen wir Nachkommastellen, damit ein Bonus wie +0,1× auch sichtbar
// bleibt; ab 100.000 reicht die normale formatNumber-Abkürzung (Tsd/Mio/Mrd).
export function formatCoinsPerClick(value) {
  if (Math.abs(value) >= 1e5) return formatNumber(value);
  const decimals = Math.abs(value) < 10 ? 2 : Math.abs(value) < 100 ? 1 : 0;
  return value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
