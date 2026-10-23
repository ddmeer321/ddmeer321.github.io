/* Terminalstart. Der Text steht vollstaendig im Dokument; hier wird nur
   je Zeile die Zeichenzahl und die Startverzoegerung gesetzt, die
   CSS-Animation legt sie dann schrittweise frei. Ohne dieses Skript ist
   sofort alles sichtbar -- das ist der gewollte Rueckfall. */
(function () {
  var wurzel = document.documentElement;
  var ausgabe = document.getElementById("ausgabe");
  var knopf = document.getElementById("ueberspringen");
  if (!ausgabe) return;

  // Neu laden soll oben anfangen. Ohne das stellt der Browser die alte
  // Scrollposition wieder her und der Start waere gar nicht zu sehen.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  var neustart = document.getElementById("neustart");
  if (neustart) neustart.addEventListener("click", function () {
    scrollTo(0, 0);
    location.reload();
  });

  var sparsam = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var zeilen = ausgabe.querySelectorAll(".z");
  var MS_ZEICHEN = 14, PAUSE = 70;

  var summe = 0;
  for (var i = 0; i < zeilen.length; i++) {
    var n = zeilen[i].textContent.length;
    zeilen[i].style.setProperty("--n", n);
    zeilen[i].style.setProperty("--d", summe + "ms");
    summe += n * MS_ZEICHEN + PAUSE;
  }

  if (sparsam) { wurzel.classList.add("tippt", "fertig"); return; }

  wurzel.classList.add("tippt");
  var uhr = setTimeout(fertig, summe + 150);

  function fertig() {
    clearTimeout(uhr);
    wurzel.classList.add("fertig");
    entferneHorcher();
  }
  function beiTaste(ev) {
    // Tabulator nicht abfangen: sonst kommt man per Tastatur nicht weiter.
    if (ev.key !== "Tab") fertig();
  }
  function entferneHorcher() {
    removeEventListener("keydown", beiTaste);
    removeEventListener("wheel", fertig);
    removeEventListener("touchstart", fertig);
    removeEventListener("pointerdown", fertig);
  }
  addEventListener("keydown", beiTaste);
  addEventListener("wheel", fertig, { passive: true, once: true });
  addEventListener("touchstart", fertig, { passive: true, once: true });
  addEventListener("pointerdown", fertig, { once: true });
  if (knopf) knopf.addEventListener("click", fertig);
})();
