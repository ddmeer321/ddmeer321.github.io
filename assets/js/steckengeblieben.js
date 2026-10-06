// Meldet, wenn ein Teil der Seite nicht kommt.
//
// KEIN LADEBILDSCHIRM. Gemessen am 29.08.2026 ist das Fenster zwischen
// "Seite sichtbar" und "Seite bedienbar" 17 bis 265 ms breit — ein Overlay,
// das dafür aufblitzt, macht es gefühlt langsamer statt schneller. Dieselbe
// Begründung steht in bild-laden.js.
//
// Worum es wirklich geht, zeigte derselbe Test: Faellt cdn.jsdelivr.net aus,
// bleiben die meisten Seiten benutzbar — aber wo ein Skript still scheitert,
// sitzt der Nutzer vor einer Seite, die aussieht wie fertig und auf nichts
// reagiert. Genau dafuer ist diese Datei da: nicht fuers Warten, sondern
// fuers Steckenbleiben.
//
// EINBINDEN: als ERSTES Skript im <body>, vor allem, was sie beobachten soll.
//
// WAS EIN SKRIPT ANMELDET: das Attribut data-noetig-fuer sagt, was ohne
// dieses Skript fehlt. Nur angemeldete Skripte loesen eine Meldung aus, denn
// nur bei ihnen laesst sich sagen, WAS dem Nutzer fehlt. Raten waere
// schlimmer als schweigen.
//
//   <script src="..." data-noetig-fuer="Das Spiel"></script>

(function () {
  // Ein Skript, das GESCHEITERT ist, ist eine Tatsache — das darf frueh raus.
  var KAPUTT_MS = 3000;
  // Ein Skript, das nur noch nicht da ist, kann auch einfach eine langsame
  // Leitung sein. Erst deutlich spaeter melden, sonst schreit die Leiste
  // jeden im Zug an, dessen Seite gleich fertig geworden waere.
  var LANGSAM_MS = 8000;
  // Danach nicht weiter beobachten. Ein Melder, der ewig lauert, ist selbst
  // ein Leck — und wer bis hierhin gewartet hat, hat laengst neu geladen.
  var AUFGEBEN_MS = 15000;

  var gescheitert = [];
  var fertig = [];
  var gemeldet = false;
  var uhren = [];
  var beobachter = null;

  // Ein <script> meldet sein Ende NUR an sich selbst: "load" kommt am window
  // auch in der Capture-Phase nicht an (am 01.09.2026 in Chromium nachgemessen
  // — "error" kaeme an, aber zwei Wege fuer dieselbe Frage sind einer zu
  // viel). Auch die Resource-Timing-Liste hilft nicht: dort steht ein
  // abgebrochener Ladevorgang mit demselben responseEnd wie ein geglueckter.
  //
  // Also bekommt jedes angemeldete Skript seine Lauscher in dem Moment, in dem
  // der Parser es einhaengt. Das ist der einzige Weg, der auch dann noch
  // funktioniert, wenn ein blockierendes Skript haengt — dann naemlich wird
  // die Seite nie fertig geparst und DOMContentLoaded kommt nie.
  function beobachte(el) {
    if (!el || el.tagName !== "SCRIPT" || !el.hasAttribute("data-noetig-fuer")) return;
    el.addEventListener("load", function () { if (fertig.indexOf(el) === -1) fertig.push(el); });
    el.addEventListener("error", function () { if (gescheitert.indexOf(el) === -1) gescheitert.push(el); });
  }

  if (window.MutationObserver) {
    beobachter = new MutationObserver(function (aenderungen) {
      for (var a = 0; a < aenderungen.length; a++) {
        var neue = aenderungen[a].addedNodes;
        for (var n = 0; n < neue.length; n++) beobachte(neue[n]);
      }
    });
    beobachter.observe(document.documentElement, { childList: true, subtree: true });
  }
  // Was schon dasteht, gleich mitnehmen.
  var schonDa = document.querySelectorAll("script[data-noetig-fuer]");
  for (var i = 0; i < schonDa.length; i++) beobachte(schonDa[i]);

  function aufzaehlen(liste) {
    var einmalig = [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i] && einmalig.indexOf(liste[i]) === -1) einmalig.push(liste[i]);
    }
    if (einmalig.length <= 1) return einmalig[0] || "Ein Teil der Seite";
    return einmalig.slice(0, -1).join(", ") + " und " + einmalig[einmalig.length - 1];
  }

  function melde(text) {
    if (gemeldet || !document.body) return;
    gemeldet = true;

    var stil = document.createElement("style");
    stil.textContent = [
      // Unten und schmal, nicht ueber dem Inhalt: Was funktioniert, soll
      // weiter benutzbar bleiben. Ein Overlay waere hier das Gegenteil von
      // hilfreich.
      ".steckt{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;",
      "display:flex;align-items:center;gap:10px;flex-wrap:wrap;",
      "padding:10px 14px calc(10px + env(safe-area-inset-bottom));",
      "background:#3a1010;color:#ffdede;",
      "border-top:1px solid rgba(255,140,140,.4);",
      "font:600 .82rem/1.35 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}",
      ".steckt p{margin:0;flex:1 1 14rem;text-wrap:balance;}",
      ".steckt button{appearance:none;border:1px solid rgba(255,140,140,.5);",
      "border-radius:999px;padding:6px 12px;background:none;color:inherit;",
      "font:inherit;cursor:pointer;}",
      ".steckt button:hover{background:rgba(255,140,140,.15);}",
    ].join("");
    document.head.appendChild(stil);

    var leiste = document.createElement("div");
    leiste.className = "steckt";
    leiste.setAttribute("role", "status");

    var p = document.createElement("p");
    leiste.appendChild(p);

    // Fussraum merken, bevor wir ihn gleich veraendern.
    var vorher = document.body.style.paddingBottom;

    var neu = document.createElement("button");
    neu.type = "button";
    neu.textContent = "Neu laden";
    neu.addEventListener("click", function () { window.location.reload(); });
    leiste.appendChild(neu);

    var zu = document.createElement("button");
    zu.type = "button";
    zu.textContent = "Ausblenden";
    zu.setAttribute("aria-label", "Hinweis ausblenden");
    zu.addEventListener("click", function () {
      leiste.remove();
      document.body.style.paddingBottom = vorher;
    });
    leiste.appendChild(zu);

    document.body.appendChild(leiste);

    // Die Leiste liegt fest ueber der Seite. Damit sie die letzte Zeile nicht
    // abschneidet, bekommt der Seiteninhalt genau ihre Hoehe als Fussraum.
    document.body.style.paddingBottom = leiste.offsetHeight + "px";

    // Der Text kommt erst, nachdem die Leiste steht: Ein role="status" wird
    // nur vorgelesen, wenn er sich AENDERT, nachdem er im Dokument ist.
    window.setTimeout(function () { p.textContent = text; }, 0);
  }

  function pruefe(auchLangsame) {
    if (gemeldet) return;
    var skripte = document.querySelectorAll("script[data-noetig-fuer]");
    var kaputt = [], langsam = [];
    for (var i = 0; i < skripte.length; i++) {
      var el = skripte[i];
      // Die Seite wurde ausgetauscht (z. B. von test-gate.js, wenn der Zugang
      // fehlt). Dann sagt jemand anderes schon, was los ist — und unsere
      // Beobachtung ist ohnehin wertlos.
      if (!el.isConnected) return;
      if (gescheitert.indexOf(el) !== -1) kaputt.push(el.getAttribute("data-noetig-fuer"));
      else if (fertig.indexOf(el) === -1) langsam.push(el.getAttribute("data-noetig-fuer"));
    }
    if (kaputt.length) {
      melde(aufzaehlen(kaputt) + " konnte nicht geladen werden. Vielleicht hilft neu laden.");
    } else if (auchLangsame && langsam.length) {
      melde(aufzaehlen(langsam) + " dauert ungewöhnlich lange. Vielleicht hilft neu laden.");
    }
  }

  function aufgeben() {
    for (var i = 0; i < uhren.length; i++) window.clearTimeout(uhren[i]);
    uhren = [];
    if (beobachter) { beobachter.disconnect(); beobachter = null; }
    gescheitert = [];
    fertig = [];
  }

  // Die Uhren laufen ab jetzt, nicht ab DOMContentLoaded: Genau im
  // schlimmsten Fall — ein haengendes blockierendes Skript — kommt
  // DOMContentLoaded nie.
  uhren.push(window.setTimeout(function () { pruefe(false); }, KAPUTT_MS));
  uhren.push(window.setTimeout(function () { pruefe(true); }, LANGSAM_MS));
  uhren.push(window.setTimeout(aufgeben, AUFGEBEN_MS));
})();
