// Ladezustand der Spielkarten.
//
// Zwei Wartezeiten sind auf einer Übersicht sichtbar, und sie brauchen
// unterschiedliche Antworten:
//
//   1. Die Karten selbst fehlen noch, weil die config.json-Dateien geholt
//      werden. Dagegen stehen Platzhalter-Karten — sonst ist die Seite in
//      diesem Moment einfach leer.
//   2. Die Karte steht, aber ihr Bild fehlt noch. Dagegen ein Schimmern auf
//      der Bildfläche — der Platz ist durch aspect-ratio schon reserviert,
//      es springt also nichts, man sah dort nur einen stillen Farbverlauf
//      und wusste nicht, ob da noch etwas kommt.
//
// Bewusst KEIN Vollbild-Ladebildschirm: Der würde die halbe Seite, die
// bereits fertig ist, hinter einem Overlay verstecken und die Wartezeit
// dadurch verlängern statt verkürzen.
//
// Die Datei kommt ohne Absprache mit library-games.js aus: Sie beobachtet
// nur das DOM. Dadurch funktioniert sie auf der config-getriebenen
// Startseite genauso wie im Testbereich, wo die Karten fest im HTML stehen.

(function () {
  // Nur so viele Platzhalter, wie erfahrungsgemäß Karten kommen. Die Zahl
  // muss nicht stimmen — sie werden ohnehin alle entfernt, sobald die
  // echten da sind.
  var PLATZHALTER = 3;

  // --- 1. Bildfläche: schimmern, bis das Bild da ist ----------------------

  function fertig(img) {
    var flaeche = img.closest && img.closest(".game-card-art");
    if (flaeche) flaeche.removeAttribute("data-laedt");
  }

  function beobachten(img) {
    var flaeche = img.closest && img.closest(".game-card-art");
    if (!flaeche) return;
    // complete + naturalWidth: aus dem Cache geladene Bilder sind sofort
    // fertig und lösen kein load-Ereignis mehr aus. Ohne diese Abfrage
    // schimmerte die Karte beim zweiten Besuch endlos.
    if (img.complete && img.naturalWidth > 0) return;
    flaeche.setAttribute("data-laedt", "");
  }

  // In der Auffangphase (true), weil load und error bei Bildern nicht nach
  // oben steigen. So genügt ein Zuhörer für alle Bilder, auch für die, die
  // erst später ins Dokument kommen.
  document.addEventListener("load", function (e) {
    if (e.target && e.target.tagName === "IMG") fertig(e.target);
  }, true);

  document.addEventListener("error", function (e) {
    // Auch bei einem kaputten Bild aufhören zu schimmern — sonst wartet die
    // Karte sichtbar auf etwas, das nie kommt.
    if (e.target && e.target.tagName === "IMG") fertig(e.target);
  }, true);

  // --- 2. Platzhalter-Karten, solange die Configs geholt werden -----------

  function platzhalterBauen() {
    var karte = document.createElement("div");
    karte.className = "game-card game-card-platzhalter";
    karte.setAttribute("aria-hidden", "true");
    karte.innerHTML =
      '<div class="game-card-art" data-laedt></div>' +
      '<div class="game-card-body">' +
        '<span class="platzhalter-zeile platzhalter-titel"></span>' +
        '<span class="platzhalter-zeile"></span>' +
        '<span class="platzhalter-zeile platzhalter-kurz"></span>' +
      "</div>";
    return karte;
  }

  function platzhalterZeigen(raster) {
    if (raster.querySelector(".game-card-platzhalter")) return;
    var teil = document.createDocumentFragment();
    for (var i = 0; i < PLATZHALTER; i++) teil.appendChild(platzhalterBauen());
    // prepend, weil library-games.js die echten Karten ebenfalls vorn
    // einfügt — die Platzhalter stehen dann an derselben Stelle.
    raster.insertBefore(teil, raster.firstChild);
  }

  function platzhalterEntfernen(raster) {
    raster.querySelectorAll(".game-card-platzhalter").forEach(function (el) {
      el.remove();
    });
  }

  function start() {
    document.querySelectorAll(".game-card-art img").forEach(beobachten);

    // Nur Raster, die ihre Karten per JavaScript bekommen. Der Testbereich
    // hat seine Karten fest im HTML und braucht keine Platzhalter.
    var raster = document.getElementById("game-grid");
    if (!raster || raster.dataset.gamesLoaded === "true") return;

    platzhalterZeigen(raster);

    // library-games.js setzt data-games-loaded, wenn es fertig ist. Darauf
    // zu horchen ist zuverlässiger, als eine Zeit zu raten.
    new MutationObserver(function (_, beobachter) {
      if (raster.dataset.gamesLoaded !== "true") return;
      platzhalterEntfernen(raster);
      raster.querySelectorAll(".game-card-art img").forEach(beobachten);
      beobachter.disconnect();
    }).observe(raster, { attributes: true, attributeFilter: ["data-games-loaded"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
