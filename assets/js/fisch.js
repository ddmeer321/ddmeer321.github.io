// Der Fisch: erklaert ein Spiel beim ersten Mal, wartet danach in der Ecke
// und meldet sich, wenn jemand feststeckt.
//
// EINBINDEN: zwei Zeilen am Ende des <body>, nach dem Spiel.
//
//   <script src="/assets/js/fisch-texte.js?v=1"></script>
//   <script src="/assets/js/fisch.js?v=1" data-spiel="snake"></script>
//
// Optional: data-steckt-nach="<Sekunden>" stellt ein, ab wann er von selbst
// auftaucht. Ohne Angabe sind es vier Minuten.
//
// data-spiel zeigt auf einen Eintrag in fisch-texte.js. Fehlt der Eintrag,
// passiert gar nichts -- kein Fehler, keine halbe Figur. Das CSS laedt diese
// Datei selbst nach, abgeleitet aus ihrem eigenen src; es gibt also keinen
// dritten Tag, den man vergessen kann.
//
// BEWUSST NICHT MIT data-noetig-fuer ANGEMELDET (siehe steckengeblieben.js):
// wer ohne den Fisch dasteht, dem fehlt nichts. Eine Leiste, die meldet
// "Der Tutorial-Fisch fehlt", waere genau die Art von Laerm, gegen die diese
// Datei sonst antritt.
//
// WARUM KEINE KI (jedenfalls hier nicht):
// Das Erklaeren ist geschrieben, nicht generiert. Drei Gruende, alle
// praktisch: es funktioniert offline und die Bibliothek ist eine PWA; es
// kostet nichts pro Aufruf; und es kann nichts Falsches ueber ein Spiel
// behaupten, das es nicht kennt. Wenn spaeter jemand Fragen stellen koennen
// soll, haengt das AN dieser Figur dran -- es ersetzt sie nicht.
//
// WARUM DER FISCH SICH SO SELTEN MELDET:
// Ein Maskottchen, das dreimal pro Sitzung auftaucht, ist kein Helfer,
// sondern eine Bueroklammer. Deshalb: einmal erklaeren, danach still in der
// Ecke, und von sich aus hoechstens EIN einziges Mal pro Sitzung.

(function () {
  "use strict";

  // Feststecken heisst nicht "lange keine Punkte", sondern "spielt, kommt
  // aber nicht weiter". Wer die Seite offen liegen laesst und Kaffee holt,
  // steckt nicht fest -- der ist weg. Deshalb zaehlt unten nur Zeit, in der
  // das Fenster sichtbar ist UND kuerzlich etwas passiert ist.
  var STECKT_MS = 4 * 60 * 1000;   // per data-steckt-nach="<Sekunden>" anpassbar
  var AKTIV_FENSTER_MS = 60 * 1000;
  var TAKT_MS = 1000;

  // Nach dem Auftauchen erst einmal Ruhe geben, auch wenn weiter nichts
  // vorangeht. Sonst wird aus einem Hinweis ein Gegner.
  var NUR_EINMAL_PRO_SITZUNG = true;

  var script = document.currentScript;
  if (!script) return;
  var spiel = script.getAttribute("data-spiel");
  if (!spiel) return;

  // Ohne Eintrag in fisch-texte.js gibt es nichts zu erzaehlen. Dann lieber
  // gar kein Fisch als einer, der schweigend in der Ecke sitzt.
  var texte = (window.FischTexte || {})[spiel];
  if (!texte) return;
  if (!texte.name) texte.name = "Der Fisch";

  // Vier Minuten passen fuer ein Idle-Spiel, fuer ein schnelles Minigame
  // nicht. Deshalb pro Seite nachstellbar -- und die Spielwiese nutzt es,
  // damit man nicht vier Minuten warten muss, um den Zustand zu sehen.
  var eigeneSchwelle = Number(script.getAttribute("data-steckt-nach"));
  if (eigeneSchwelle > 0) STECKT_MS = eigeneSchwelle * 1000;

  var ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------------------------------------- Gedaechtnis

     localStorage kann fehlschlagen (privates Fenster, gesperrte Seitendaten).
     Dann merkt sich der Fisch eben nichts und erklaert noch einmal -- das ist
     die harmlosere Haelfte des Problems, also faellt hier alles still auf
     "weiss nichts" zurueck statt zu werfen. */
  function lies(schluessel) {
    try { return localStorage.getItem("fisch." + schluessel); } catch (e) { return null; }
  }
  function merke(schluessel, wert) {
    try { localStorage.setItem("fisch." + schluessel, wert); } catch (e) { /* egal */ }
  }
  function abgeschaltet() { return lies("aus") === "1" || lies(spiel + ".aus") === "1"; }

  if (abgeschaltet()) return;

  /* ------------------------------------------------------------------ Aufbau */

  // Das Stylesheet liegt neben dieser Datei, nicht neben der Seite, die sie
  // einbindet -- deshalb aus dem eigenen src abgeleitet und nicht geraten.
  function stilLaden() {
    var href = script.src.replace(/\/js\/fisch\.js.*$/, "/css/fisch.css");
    if (href === script.src) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  // Reihenfolge = Ebenen: Flossen hinter den Koerper, Gesicht davor. Der
  // Bauch ist eine zweite, hellere Ellipse -- billiger als ein Verlauf und
  // haelt die Figur auch bei 58px noch lesbar.
  var FISCH_SVG =
    '<svg class="fisch-bild" viewBox="0 0 64 48" aria-hidden="true">' +
      '<g class="fisch-schwanz-g">' +
        '<path class="fisch-schwanz" d="M13 24 L2 11 L6 24 L2 37 Z"/>' +
      '</g>' +
      '<path class="fisch-flosse" d="M25 11 Q31 1 39 10 Z"/>' +
      '<path class="fisch-flosse" d="M26 36 Q31 45 38 37 Z"/>' +
      '<ellipse class="fisch-koerper" cx="34" cy="24" rx="24" ry="14.5"/>' +
      '<ellipse class="fisch-bauch" cx="37" cy="29.5" rx="17" ry="7.5"/>' +
      '<path class="fisch-kieme" d="M41 15 q-3 6.5 -0.5 12"/>' +
      '<path class="fisch-flosse-seite" d="M39 28 q-9 4.5 -6.5 11 q6.5 -1.5 6.5 -11 Z"/>' +
      '<circle class="fisch-auge-weiss" cx="48" cy="19" r="4.6"/>' +
      '<circle class="fisch-pupille" cx="49.2" cy="19.2" r="2.3"/>' +
      '<circle class="fisch-glanz" cx="50.3" cy="17.6" r="1"/>' +
      '<path class="fisch-mund" d="M53 29 q3 2.6 5.4 -0.6"/>' +
    '</svg>';

  var wurzel, knopf, blase, blasenText, weiterKnopf, ausKnopf;

  function bauen() {
    wurzel = document.createElement("div");
    wurzel.className = "fisch-wurzel" + (ruhig ? " fisch-ruhig" : "");
    wurzel.hidden = true;
    wurzel.innerHTML =
      '<div class="fisch-blase" role="status" aria-live="polite" hidden>' +
        '<p class="fisch-text"></p>' +
        '<div class="fisch-knoepfe">' +
          '<button type="button" class="fisch-weiter"></button>' +
          '<button type="button" class="fisch-aus">Nicht mehr zeigen</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="fisch-knopf" aria-label="' + texte.name + ' fragen">' +
        FISCH_SVG +
      '</button>';
    document.body.appendChild(wurzel);

    knopf = wurzel.querySelector(".fisch-knopf");
    blase = wurzel.querySelector(".fisch-blase");
    blasenText = wurzel.querySelector(".fisch-text");
    weiterKnopf = wurzel.querySelector(".fisch-weiter");
    ausKnopf = wurzel.querySelector(".fisch-aus");

    knopf.addEventListener("click", function () {
      if (blase.hidden) tippZeigen(); else blaseSchliessen();
    });
    ausKnopf.addEventListener("click", function () {
      merke(spiel + ".aus", "1");
      wurzel.remove();
      anhalten();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !blase.hidden) { blaseSchliessen(); knopf.focus(); }
    });
  }

  /* ------------------------------------------------------------------ Reden */

  var folge = [];          // noch zu sagende Zeilen
  var amReden = false;

  function sagen(zeilen, letzterKnopf) {
    folge = zeilen.slice();
    amReden = true;
    weiterKnopf.textContent = folge.length > 1 ? "Weiter" : (letzterKnopf || "Alles klar");
    weiterKnopf.onclick = function () {
      folge.shift();
      if (!folge.length) { blaseSchliessen(); return; }
      blasenText.textContent = folge[0];
      weiterKnopf.textContent = folge.length > 1 ? "Weiter" : (letzterKnopf || "Alles klar");
    };
    blasenText.textContent = folge[0];
    blase.hidden = false;
    wurzel.classList.add("fisch-redet");
  }

  function blaseSchliessen() {
    blase.hidden = true;
    amReden = false;
    wurzel.classList.remove("fisch-redet");
  }

  // Die Tipps laufen der Reihe nach durch, nicht zufaellig: zweimal
  // denselben Tipp hintereinander zu bekommen fuehlt sich kaputt an.
  var tippNr = Number(lies(spiel + ".tipp")) || 0;
  function tippZeigen() {
    var tipps = texte.tipps || [];
    if (!tipps.length) { sagen([texte.leer || "Viel Erfolg!"]); return; }
    var t = tipps[tippNr % tipps.length];
    tippNr++;
    merke(spiel + ".tipp", String(tippNr));
    sagen([t]);
  }

  /* ------------------------------------------------- Auftauchen und Erklaeren */

  function auftauchen(dann) {
    wurzel.hidden = false;
    if (ruhig) { if (dann) dann(); return; }
    wurzel.classList.add("fisch-kommt");
    setTimeout(function () {
      wurzel.classList.remove("fisch-kommt");
      if (dann) dann();
    }, 620);
  }

  function erklaeren() {
    auftauchen(function () {
      sagen(texte.start || [], "Los geht's");
      merke(spiel + ".erklaert", "1");
    });
  }

  /* --------------------------------------------------------- Feststeck-Wache */

  var letzteEingabe = Date.now();
  var stilleMs = 0;
  var letzterStand = null;
  var schonGemeldet = false;
  var uhr = null;

  ["keydown", "pointerdown", "wheel", "touchstart"].forEach(function (ereignis) {
    addEventListener(ereignis, function () { letzteEingabe = Date.now(); }, { passive: true });
  });

  function standLesen() {
    if (typeof texte.fortschritt !== "function") return null;
    try { return texte.fortschritt(); } catch (e) { return null; }
  }

  function takt() {
    // Ohne Fortschrittsmass gibt es kein Feststecken, das man erkennen
    // koennte. Tic-Tac-Toe zum Beispiel hat keinen Stand, der waechst --
    // dort waere jede Meldung geraten, also schweigt er.
    if (typeof texte.fortschritt !== "function") return;

    var jetzt = standLesen();
    if (jetzt !== null && jetzt !== letzterStand) {
      letzterStand = jetzt;
      stilleMs = 0;                       // es geht voran, alles gut
      return;
    }
    if (document.visibilityState !== "visible") return;
    if (Date.now() - letzteEingabe > AKTIV_FENSTER_MS) return;   // abwesend, nicht festgefahren
    if (amReden || schonGemeldet) return;

    stilleMs += TAKT_MS;
    if (stilleMs < STECKT_MS) return;

    schonGemeldet = NUR_EINMAL_PRO_SITZUNG;
    stilleMs = 0;
    var hilfe = texte.steckt || texte.tipps || [];
    if (!hilfe.length) return;
    auftauchen(function () { sagen([hilfe[0]], "Danke"); });
  }

  function anhalten() { if (uhr) { clearInterval(uhr); uhr = null; } }

  /* ------------------------------------------------------------------ Start */

  stilLaden();
  bauen();

  letzterStand = standLesen();
  var neuHier = lies(spiel + ".erklaert") !== "1";
  var amAnfang = letzterStand === null || letzterStand === 0 || letzterStand === false;

  if (neuHier && amAnfang) {
    // Kurz warten: das Spiel soll zuerst da sein. Der Fisch kommentiert,
    // er eroeffnet nicht.
    setTimeout(erklaeren, ruhig ? 0 : 900);
  } else {
    wurzel.hidden = false;
  }

  uhr = setInterval(takt, TAKT_MS);
  addEventListener("pagehide", anhalten);

  // Kleine Schnittstelle fuer die Spiele: sie koennen den Fisch etwas sagen
  // lassen, ohne diese Datei zu kennen. Absichtlich winzig gehalten.
  window.Fisch = {
    sagen: function (text) { if (wurzel && !abgeschaltet()) { wurzel.hidden = false; sagen([String(text)]); } },
    verstecken: function () { if (wurzel) wurzel.hidden = true; }
  };
})();
