/* Terminalstart. Der Text steht vollstaendig im Dokument; hier wird nur
   je Zeile die Zeichenzahl und die Startverzoegerung gesetzt, die
   CSS-Animation legt sie dann schrittweise frei. Ohne dieses Skript ist
   sofort alles sichtbar -- das ist der gewollte Rueckfall. */
(function () {
  var wurzel = document.documentElement;
  var ausgabe = document.getElementById("ausgabe");
  var knopf = document.getElementById("ueberspringen");
  var neustart = document.getElementById("neustart");
  if (!ausgabe) return;

  // Ein Neuladen von Hand soll ebenfalls oben anfangen.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var sparsam = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var zeilen = ausgabe.querySelectorAll(".z");
  var MS_ZEICHEN = 9, PAUSE = 45;
  var uhr = null;

  var summe = 0;
  for (var i = 0; i < zeilen.length; i++) {
    var n = zeilen[i].textContent.length;
    zeilen[i].style.setProperty("--n", n);
    zeilen[i].style.setProperty("--d", summe + "ms");
    summe += n * MS_ZEICHEN + PAUSE;
  }

  function fertig() {
    clearTimeout(uhr);
    wurzel.classList.add("fertig");
    entferneHorcher();
  }
  function beiTaste(ev) {
    // Tabulator nicht abfangen: sonst kommt man per Tastatur nicht weiter.
    if (ev.key !== "Tab") fertig();
  }
  function setzeHorcher() {
    addEventListener("keydown", beiTaste);
    addEventListener("wheel", fertig, { passive: true });
    addEventListener("touchstart", fertig, { passive: true });
    addEventListener("pointerdown", fertig);
  }
  function entferneHorcher() {
    removeEventListener("keydown", beiTaste);
    removeEventListener("wheel", fertig);
    removeEventListener("touchstart", fertig);
    removeEventListener("pointerdown", fertig);
  }

  function starteTippen() {
    if (sparsam) { wurzel.classList.add("tippt", "fertig"); return; }
    wurzel.classList.remove("tippt", "fertig");
    // Reflow erzwingen: ohne das laeuft eine bereits abgespielte
    // CSS-Animation beim erneuten Setzen der Klasse nicht noch einmal an.
    void ausgabe.offsetWidth;
    wurzel.classList.add("tippt");
    clearTimeout(uhr);
    uhr = setTimeout(fertig, summe + 150);
    setzeHorcher();
  }

  starteTippen();
  if (knopf) knopf.addEventListener("click", fertig);

  // Der Neustart laedt die Seite NICHT neu -- das gibt nur ein kurzes
  // Weissblitzen und man sieht den Wechsel gar nicht. Stattdessen faehrt
  // die Seite sichtbar nach oben, und erst wenn sie oben angekommen ist,
  // laeuft der Start noch einmal.
  if (neustart) neustart.addEventListener("click", function () {
    try {
      scrollTo({ top: 0, behavior: sparsam ? "auto" : "smooth" });
    } catch (e) {
      scrollTo(0, 0);
    }
    if (sparsam) { starteTippen(); return; }
    var frist = Date.now() + 1800;
    (function warte() {
      // Nicht nach fester Zeit tippen: wie lange das Hochfahren dauert,
      // haengt an Seitenlaenge und Browser. Also warten, bis es oben ist.
      if (pageYOffset <= 2 || Date.now() > frist) starteTippen();
      else requestAnimationFrame(warte);
    })();
  });
})();
