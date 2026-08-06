// Zahlenformatierung für die Anzeige: Tausendertrennzeichen, ab 100.000 abgekürzt.
const SUFFIXES = [
  { value: 1e9, suffix: "Mrd" },
  { value: 1e6, suffix: "Mio" },
  { value: 1e5, suffix: "Tsd" },
];

export function formatNumber(value) {
  const rounded = Math.round(value);
  for (const { value: threshold, suffix } of SUFFIXES) {
    if (Math.abs(rounded) >= threshold) {
      return (rounded / threshold).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " " + suffix;
    }
  }
  return rounded.toLocaleString("de-DE");
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
