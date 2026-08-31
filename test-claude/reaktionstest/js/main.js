// Reaktionstest.
//
// Der ganze Sinn des Spiels hängt an einer einzigen Zahl, deshalb steht die
// Messung im Mittelpunkt dieser Datei und nicht die Bildschirmverwaltung.
//
// ZWEI DINGE, DIE MAN LEICHT FALSCH MACHT:
//
// 1. Ab wann gemessen wird. Naheliegend wäre der Moment, in dem der Timer
//    feuert und die Klasse gesetzt wird. Bis das Grün aber wirklich auf dem
//    Bildschirm steht, vergeht noch ein Bildaufbau — bei 60 Hz bis zu 16 ms.
//    Gegenüber einer menschlichen Reaktionszeit von rund 250 ms ist das kein
//    Rundungsfehler, sondern geschenkte Zeit. Gemessen wird deshalb ab dem
//    Bild NACH dem Umschalten (doppeltes requestAnimationFrame).
//
// 2. Wann der Klick war. `event.timeStamp` ist der Zeitpunkt des Ereignisses
//    selbst, nicht der seiner Verarbeitung, und läuft auf derselben Uhr wie
//    performance.now(). Ist der Hauptthread kurz beschäftigt, ist das der
//    ehrlichere Wert.

(function () {
  var MIN_WARTE_MS = 2000;
  var MAX_WARTE_MS = 9000;
  var ANZAHL_LETZTE = 5;

  // Eigener Schlüssel je Bereich: Eine Kopie im Testbereich darf niemals die
  // echten Zeiten überschreiben. Gleiche Regel wie beim Cursor Clicker.
  var SPEICHER_KEY = window.location.pathname.indexOf("/test-") !== -1
    ? "reaktionstest:letzte:test"
    : "reaktionstest:letzte";

  var el = {
    topline: document.getElementById("topline"),
    menu: document.getElementById("screen-menu"),
    stage: document.getElementById("screen-stage"),
    result: document.getElementById("screen-result"),
    stageGross: document.getElementById("stage-gross"),
    stageKlein: document.getElementById("stage-klein"),
    ergebnisLabel: document.getElementById("ergebnis-label"),
    ergebnisZahl: document.getElementById("ergebnis-zahl"),
    ergebnisText: document.getElementById("ergebnis-text"),
    liste: document.getElementById("letzte-liste"),
    leer: document.getElementById("letzte-leer"),
    btnStart: document.getElementById("btn-start"),
    btnAgain: document.getElementById("btn-again"),
    btnMenu: document.getElementById("btn-menu"),
  };

  // "menu" | "warten" | "los" | "ergebnis"
  var phase = "menu";
  var startZeit = null;
  var timer = null;

  // ---------- Speicher ----------

  function ladeLetzte() {
    try {
      var roh = JSON.parse(window.localStorage.getItem(SPEICHER_KEY) || "[]");
      if (!Array.isArray(roh)) return [];
      // Fremde oder kaputte Werte wegwerfen statt anzeigen. Die Obergrenze
      // fängt Einträge ab, die nie eine echte Reaktion waren.
      return roh
        .filter(function (n) { return typeof n === "number" && isFinite(n) && n > 0 && n < 60000; })
        .slice(0, ANZAHL_LETZTE);
    } catch (e) {
      return [];
    }
  }

  function merkeZeit(ms) {
    var liste = [Math.round(ms)].concat(ladeLetzte()).slice(0, ANZAHL_LETZTE);
    try {
      window.localStorage.setItem(SPEICHER_KEY, JSON.stringify(liste));
    } catch (e) {
      /* Privater Modus o. Ä. — die Runde zählt trotzdem, nur nicht dauerhaft. */
    }
    return liste;
  }

  // ---------- Anzeige ----------

  function zeigeListe(liste) {
    el.liste.innerHTML = "";
    el.leer.hidden = liste.length > 0;

    var beste = liste.length ? Math.min.apply(null, liste) : null;
    liste.forEach(function (ms, i) {
      var li = document.createElement("li");

      var nr = document.createElement("span");
      nr.className = "letzte-nr";
      nr.textContent = i + 1 + ".";

      var wert = document.createElement("span");
      wert.className = "letzte-wert";
      wert.textContent = ms + " ms";

      li.appendChild(nr);
      li.appendChild(wert);

      // Nur der erste Treffer wird markiert — bei zwei gleich schnellen
      // Runden sähen sonst beide wie "die" Bestzeit aus.
      if (ms === beste && liste.indexOf(ms) === i) {
        var b = document.createElement("span");
        b.className = "letzte-beste";
        b.textContent = "Beste";
        li.appendChild(b);
      }
      el.liste.appendChild(li);
    });
  }

  function zeigeBildschirm(welcher) {
    el.menu.hidden = welcher !== "menu";
    el.stage.hidden = welcher !== "stage";
    el.result.hidden = welcher !== "result";
    // Der Zurück-Pfeil verschwindet nur auf der Testfläche: dort ist der
    // ganze Bildschirm Klickfläche, ein Link darin wäre eine Fehlklickfalle.
    el.topline.hidden = welcher === "stage";
  }

  function einordnen(ms) {
    if (ms < 200) return "Das ist richtig schnell.";
    if (ms < 280) return "Guter Schnitt.";
    if (ms < 400) return "Solide.";
    return "Da geht noch was.";
  }

  // ---------- Ablauf ----------

  function starten() {
    if (timer !== null) window.clearTimeout(timer);
    phase = "warten";
    startZeit = null;
    el.stage.dataset.phase = "warten";
    el.stageGross.textContent = "Warte …";
    el.stageKlein.textContent = "Tippen, sobald es grün wird";
    zeigeBildschirm("stage");
    el.stage.focus();

    var warte = MIN_WARTE_MS + Math.random() * (MAX_WARTE_MS - MIN_WARTE_MS);
    timer = window.setTimeout(gruenZeigen, warte);
  }

  function gruenZeigen() {
    timer = null;
    if (phase !== "warten") return;
    phase = "los";
    el.stage.dataset.phase = "los";
    el.stageGross.textContent = "JETZT!";
    el.stageKlein.textContent = "";

    // Notnagel, falls requestAnimationFrame nicht läuft (Hintergrund-Tab):
    // lieber eine leicht zu große Zeit als gar keine.
    startZeit = performance.now();
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function (zeitStempel) {
        // Dieser Rückruf gehört zum Bild NACH dem Umschalten — ab hier ist
        // Grün wirklich zu sehen.
        if (phase === "los") startZeit = zeitStempel;
      });
    });
  }

  function reagiert(ereignis) {
    if (phase === "warten") {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      phase = "ergebnis";
      el.ergebnisLabel.textContent = "Zu früh";
      el.ergebnisZahl.textContent = "Nicht gewertet";
      el.ergebnisZahl.className = "ergebnis-zahl zufrueh";
      el.ergebnisText.textContent = "Du hast getippt, solange der Bildschirm noch rot war.";
      zeigeBildschirm("result");
      el.btnAgain.focus();
      return;
    }

    if (phase !== "los") return;

    var jetzt = (ereignis && typeof ereignis.timeStamp === "number" && ereignis.timeStamp > 0)
      ? ereignis.timeStamp
      : performance.now();
    var ms = jetzt - startZeit;

    // Zwischen Bildaufbau und Eingabe können die Uhren minimal auseinander
    // liegen; ein negativer Wert wäre schlicht unsinnig.
    if (!(ms > 0)) ms = 0;

    phase = "ergebnis";
    el.ergebnisLabel.textContent = "Deine Zeit";
    el.ergebnisZahl.className = "ergebnis-zahl";
    el.ergebnisZahl.innerHTML = Math.round(ms) + '<span class="einheit"> ms</span>';
    el.ergebnisText.textContent = einordnen(ms);
    zeigeListe(merkeZeit(ms));
    zeigeBildschirm("result");
    el.btnAgain.focus();
  }

  function zumMenue() {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    phase = "menu";
    zeigeBildschirm("menu");
    el.btnStart.focus();
  }

  // ---------- Eingaben ----------

  el.btnStart.addEventListener("click", starten);
  el.btnAgain.addEventListener("click", starten);
  el.btnMenu.addEventListener("click", zumMenue);

  // pointerdown statt click: gemessen wird der Moment des Drückens, nicht der
  // des Loslassens. Ein click feuert erst danach und verschenkt die Zeit
  // dazwischen.
  el.stage.addEventListener("pointerdown", reagiert);

  el.stage.addEventListener("keydown", function (e) {
    if (e.key !== " " && e.key !== "Enter" && e.code !== "Space") return;
    e.preventDefault();   // sonst scrollt die Leertaste die Seite
    if (e.repeat) return; // gedrückt halten ist keine Reaktion
    reagiert(e);
  });

  // Wer den Tab wechselt, während es noch rot ist, käme sonst zurück und
  // fände ein längst umgesprungenes Grün vor — das wäre keine gemessene
  // Reaktion mehr, sondern eine geratene.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && (phase === "warten" || phase === "los")) zumMenue();
  });

  zeigeListe(ladeLetzte());
  zeigeBildschirm("menu");
})();
