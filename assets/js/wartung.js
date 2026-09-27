// Wartungs-Banner für die ganze Bibliothek.
//
// AUSSCHALTEN: unten `aktiv: false` setzen. Sonst nichts. Die Datei bleibt
// eingebunden und tut dann gar nichts — kein Suchen in zwölf HTML-Dateien.
//
// Warum Stil und Text hier drin stehen und nicht in einer eigenen CSS-Datei:
// Das Banner soll auf jeder Seite gleich aussehen, auch auf den dunklen
// (Neon Bot Arena) — es bringt seine Farben deshalb selbst mit, statt sich
// auf Variablen der jeweiligen Seite zu verlassen. Und es soll sich in einem
// Zug wieder entfernen lassen: eine Datei löschen, fertig.

(function () {
  var WARTUNG = {
    aktiv: false,
    text:
      "An der Bibliothek wird gerade gebaut. Einzelne Seiten können sich " +
      "von Tag zu Tag ändern oder kurz nicht funktionieren.",
  };

  if (!WARTUNG.aktiv) return;

  var stil = document.createElement("style");
  stil.textContent = [
    ".wartung-banner{",
    // Der obere Abstand ist der Platz für Notch bzw. Statusleiste: Das Banner
    // ist ab jetzt das oberste Element jeder Seite und erbt damit deren
    // Aufgabe. env() wirkt nur zusammen mit viewport-fit=cover.
    "padding:max(9px,env(safe-area-inset-top)) 14px 9px;",
    "background:#3a2a05;color:#ffe9b0;",
    "border-bottom:1px solid rgba(255,200,87,.35);",
    "font:700 .82rem/1.35 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;",
    "text-align:center;text-wrap:balance;}",
    ".wartung-banner b{color:#ffc857;}",
    // Seiten, die selbst schon einen Notch-Abstand setzen, brauchen ihn nicht
    // mehr — sonst steht dort auf iPhones eine doppelte Lücke.
    ".wartung-an .topline{padding-top:10px;}",
  ].join("");
  document.head.appendChild(stil);

  var el = document.createElement("div");
  el.className = "wartung-banner";
  el.setAttribute("role", "status");
  // textContent, nicht innerHTML: der Text steht zwar oben in dieser Datei,
  // aber die Gewohnheit gehört eingehalten, nicht die Ausnahme.
  var stark = document.createElement("b");
  stark.textContent = "🛠️ Wartungsarbeiten — ";
  el.appendChild(stark);
  el.appendChild(document.createTextNode(WARTUNG.text));

  function einsetzen() {
    if (!document.body || document.querySelector(".wartung-banner")) return;
    document.documentElement.classList.add("wartung-an");
    document.body.insertBefore(el, document.body.firstChild);
  }

  if (document.body) einsetzen();
  else document.addEventListener("DOMContentLoaded", einsetzen);
})();
