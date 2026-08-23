// Wiederverwendbare Wahrscheinlichkeits-Balken-Liste — von Boxen UND Fusion
// genutzt, damit Chancen im ganzen Spiel gleich aussehen und sich anfühlen.
// rows: [{ label, percent, color, subtitle? }], bereits sortiert/gefiltert vom
// Aufrufer. subtitle ist optional (z.B. Fusion zeigt hier den echten Bonus,
// Boxen brauchen es nicht) — ohne subtitle sieht die Zeile aus wie zuvor.
export function renderOddsRows(rows, { minPercentToShow = 0.05 } = {}) {
  return rows
    .filter((row) => row.percent >= minPercentToShow)
    .map(
      (row) =>
        '<div class="cc-odds-row">' +
        '<span class="cc-odds-label" style="color:' + row.color + '">' + row.label +
        (row.subtitle ? '<small class="cc-odds-subtitle">' + row.subtitle + "</small>" : "") +
        "</span>" +
        '<i class="cc-odds-bar" style="--odds:' + Math.max(row.percent, 2) + "%;--odds-color:" + row.color + '"></i>' +
        '<strong class="cc-odds-value">' + formatPercent(row.percent) + "</strong>" +
        "</div>"
    )
    .join("");
}

function formatPercent(percent) {
  const rounded = percent >= 1 ? Math.round(percent * 10) / 10 : Math.round(percent * 100) / 100;
  return rounded.toLocaleString("de-DE") + "%";
}
