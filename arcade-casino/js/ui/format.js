// Zahlenformatierung (deutsch).

const nf = new Intl.NumberFormat("de-DE");

export function fmt(n) {
  return nf.format(Math.round(Number(n) || 0));
}

export function signed(n) {
  const v = Math.round(Number(n) || 0);
  return (v > 0 ? "+" : v < 0 ? "−" : "±") + nf.format(Math.abs(v));
}

/** Kurzform für enge Displays: 12.500 → 12,5k */
export function short(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1e6) return (v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio";
  if (Math.abs(v) >= 1e4) return (v / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k";
  return nf.format(v);
}
