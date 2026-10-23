/* Ladebildschirm. Der Text steht vollstaendig im Dokument; hier wird nur
   je Zeile die Zeichenzahl und die Startverzoegerung gesetzt, die
   CSS-Animation legt sie dann schrittweise frei.
   Die Klasse .laedt setzt ein winziges Skript im Kopf, damit die Seite
   nicht kurz ohne Ladebildschirm aufblitzt. Ohne JS wird sie nie gesetzt
   und der Schirm erscheint gar nicht -- er darf niemandem die Seite
   versperren, nur weil das Skript nicht laeuft. */
(function () {
  var wurzel = document.documentElement;
  var ausgabe = document.getElementById("ausgabe");
  var neustart = document.getElementById("neustart");
  if (!ausgabe) { wurzel.classList.remove("laedt"); return; }

  // Ein Neuladen von Hand soll ebenfalls oben anfangen.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var sparsam = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var zeilen = ausgabe.querySelectorAll(".z");
  var MS_ZEICHEN = 9, PAUSE = 45, NACHLAUF = 850;
  // Dieselbe Zahl treibt die CSS-Dauer, sonst laufen Dauer und
  // Startverzoegerung auseinander und die Zeilen ueberlappen sich.
  wurzel.style.setProperty("--ms", MS_ZEICHEN + "ms");
  var uhr = null, wegUhr = null;

  var summe = 0;
  for (var i = 0; i < zeilen.length; i++) {
    var n = zeilen[i].textContent.length;
    zeilen[i].style.setProperty("--n", n);
    zeilen[i].style.setProperty("--d", summe + "ms");
    summe += n * MS_ZEICHEN + PAUSE;
  }

  function verstecke() {
    clearTimeout(wegUhr);
    wurzel.classList.remove("laedt");
  }
  function fertig() {
    clearTimeout(uhr);
    wurzel.classList.add("fertig");
    entferneHorcher();
    clearTimeout(wegUhr);
    // Kurz stehen lassen, damit die letzte Zeile noch zu lesen ist.
    wegUhr = setTimeout(verstecke, NACHLAUF);
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
    clearTimeout(uhr); clearTimeout(wegUhr);
    wurzel.classList.add("laedt");
    wurzel.classList.remove("tippt", "fertig");
    // Reflow erzwingen: ohne das laeuft eine bereits abgespielte
    // CSS-Animation beim erneuten Setzen der Klasse nicht noch einmal an.
    void ausgabe.offsetWidth;
    if (sparsam) {
      wurzel.classList.add("tippt", "fertig");
      wegUhr = setTimeout(verstecke, 900);
      return;
    }
    wurzel.classList.add("tippt");
    uhr = setTimeout(fertig, summe + 150);
    setzeHorcher();
  }

  starteTippen();

  // Abschnitte blenden beim Scrollen ein. .jsan erst hier setzen: faellt
  // das Skript aus, bleibt alles sichtbar statt dauerhaft unsichtbar.
  var teile = document.querySelectorAll(".anim");
  if (teile.length && "IntersectionObserver" in window) {
    wurzel.classList.add("jsan");
    var auge = new IntersectionObserver(function (eintraege) {
      for (var k = 0; k < eintraege.length; k++) {
        if (eintraege[k].isIntersecting) {
          eintraege[k].target.classList.add("sichtbar");
          auge.unobserve(eintraege[k].target);
        }
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    for (var m = 0; m < teile.length; m++) auge.observe(teile[m]);
  }

  // Neustart: erst sichtbar nach oben fahren, dann faellt der
  // Ladebildschirm wieder davor und der Start laeuft noch einmal.
  if (neustart) neustart.addEventListener("click", function () {
    try {
      scrollTo({ top: 0, behavior: sparsam ? "auto" : "smooth" });
    } catch (e) {
      scrollTo(0, 0);
    }
    if (sparsam) { starteTippen(); return; }
    var frist = Date.now() + 1800;
    (function warte() {
      // Nicht nach fester Zeit: wie lange das Hochfahren dauert, haengt an
      // Seitenlaenge und Browser. Also warten, bis es oben angekommen ist.
      if (pageYOffset <= 2 || Date.now() > frist) starteTippen();
      else requestAnimationFrame(warte);
    })();
  });
})();
