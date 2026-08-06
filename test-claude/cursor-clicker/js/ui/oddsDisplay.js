// Wiederverwendbare Wahrscheinlichkeits-Balken-Liste — von Boxen UND Fusion
// genutzt, damit Chancen im ganzen Spiel gleich aussehen und sich anfühlen.
// rows: [{ label, percent, color }], bereits sortiert/gefiltert vom Aufrufer.
export function renderOddsRows(rows, { minPercentToShow = 0.05 } = {}) {
  return rows
    .filter((row) => row.percent >= minPercentToShow)
    .map(
      (row) =>
        '<div class="cc-odds-row">' +
        '<span class="cc-odds-label" style="color:' + row.color + '">' + row.label + "</span>" +
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
