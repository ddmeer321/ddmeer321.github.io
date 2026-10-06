// Chill Plaza — Vorschau der Lobby-Auswahl.
//
// ATTRAPPE. Hier wird nichts verbunden und nichts gesendet. Die Zahlen sind
// erfunden, damit man die vier Zustaende einer Lobby einmal nebeneinander
// sieht — vor allem den, den man sonst nur zufaellig erwischt: die
// schlafende.
//
// Warum ausgerechnet der Aufwach-Ablauf hier drinsteckt: Auf einer
// kostenlosen Stufe schlaeft der Server ein, wenn eine Stunde niemand da
// war. Der erste Besucher des Abends traegt diese Wartezeit fuer alle
// anderen mit. Ob das ertraeglich ist, entscheidet sich an diesem
// Bildschirm — deshalb ist er der Teil, der sich zu bauen lohnt, bevor es
// die Welt gibt.

(function () {
  // So lange dauert das Aufwecken in der Attrappe. Der echte Wert liegt bei
  // Koyeb bei 1-5 Sekunden; drei ist der ehrliche Mittelwert.
  var WECKDAUER_MS = 3000;

  // Die Nummer ist der Name. Themen ("Park", "Café") wuerden eine Welt
  // versprechen, die es noch nicht gibt - und muessten spaeter doch wieder
  // umbenannt werden, sobald die Karte aussieht wie sie aussieht.
  var VORLAGE = [
    { id: "l1", nr: 1, max: 15, spieler: 7,  band: [5, 9],   ping: 24,   schlaeft: false },
    { id: "l2", nr: 2, max: 15, spieler: 13, band: [12, 14], ping: 31,   schlaeft: false },
    { id: "l3", nr: 3, max: 15, spieler: 15, band: [15, 15], ping: 28,   schlaeft: false },
    { id: "l4", nr: 4, max: 15, spieler: 0,  band: [1, 4],   ping: null, schlaeft: true },
  ];

  function nameVon(l) { return "Lobby #" + l.nr; }

  var lobbys = [];
  var knoten = {};          // id -> { li, chip, zahl, balken, knopf, wecken }
  var sanft = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var elListe   = document.getElementById("lobbys");
  var elGesamt  = document.getElementById("gesamt");
  var elAuswahl = document.getElementById("auswahl");
  var elDrin    = document.getElementById("drin");

  function zustandVon(l) {
    if (l.weckt) return "weckt";
    if (l.schlaeft) return "schlaeft";
    if (l.spieler >= l.max) return "voll";
    if (l.spieler >= l.max - 2) return "fastvoll";
    return "aktiv";
  }

  var TEXTE = {
    aktiv:    { chip: "aktiv",     knopf: "Beitreten" },
    fastvoll: { chip: "fast voll", knopf: "Beitreten" },
    voll:     { chip: "voll",      knopf: "Voll" },
    schlaeft: { chip: "schläft",   knopf: "Aufwecken" },
    weckt:    { chip: "wacht auf", knopf: "Moment…" },
  };

  function bauen() {
    elListe.textContent = "";
    knoten = {};

    lobbys.forEach(function (l) {
      var li = document.createElement("li");
      li.className = "lobby";

      // Die Nummer steht schon im Namen daneben - fuer Screenreader waere
      // sie also eine Dopplung.
      var nummer = document.createElement("span");
      nummer.className = "lobby-nr";
      nummer.setAttribute("data-nr", String(l.nr));
      nummer.textContent = l.nr;
      nummer.setAttribute("aria-hidden", "true");

      var text = document.createElement("div");
      text.className = "lobby-text";

      var name = document.createElement("p");
      name.className = "lobby-name";
      name.textContent = nameVon(l);

      var zeile = document.createElement("p");
      zeile.className = "lobby-zeile";
      var chip = document.createElement("span");
      var zahl = document.createElement("span");
      zeile.appendChild(chip);
      zeile.appendChild(zahl);

      var balken = document.createElement("div");
      balken.className = "balken";
      var fuell = document.createElement("i");
      balken.appendChild(fuell);

      text.appendChild(name);
      text.appendChild(zeile);
      text.appendChild(balken);

      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "btn btn-primary";
      knopf.addEventListener("click", function () { geklickt(l); });

      li.appendChild(nummer);
      li.appendChild(text);
      li.appendChild(knopf);

      elListe.appendChild(li);
      knoten[l.id] = { li: li, chip: chip, zahl: zahl, fuell: fuell, knopf: knopf, wecken: null };
    });

    zeichnen();
  }

  function zeichnen() {
    var belegt = 0, plaetze = 0;

    lobbys.forEach(function (l) {
      var k = knoten[l.id];
      var z = zustandVon(l);
      var t = TEXTE[z];

      k.li.setAttribute("data-zustand", z);
      k.chip.className = "chip chip-" + (z === "weckt" ? "schlaeft" : z);
      k.chip.textContent = t.chip;

      k.zahl.textContent = l.schlaeft
        ? "niemand da · " + l.max + " Plätze"
        : l.spieler + " / " + l.max + " · " + l.ping + " ms";

      k.fuell.style.width = Math.round((l.spieler / l.max) * 100) + "%";

      k.knopf.textContent = t.knopf;
      k.knopf.disabled = (z === "voll" || z === "weckt");
      k.knopf.className = "btn " + (z === "voll" ? "btn-ghost" : "btn-primary");

      belegt += l.spieler;
      plaetze += l.max;
    });

    elGesamt.textContent = belegt + " von " + plaetze + " Plätzen belegt · " + lobbys.length + " Lobbys";
  }

  /** Bewegung in den Zahlen, damit die Vorschau nicht wie ein Standbild
      wirkt. Jede Lobby bleibt in ihrem Band, sonst waeren nach einer Minute
      alle vier gleich voll und die Zustaende nicht mehr zu sehen. */
  function pulsieren() {
    lobbys.forEach(function (l) {
      if (l.schlaeft || l.weckt) return;
      var schritt = Math.random() < 0.5 ? -1 : 1;
      var neu = l.spieler + schritt;
      if (neu < l.band[0] || neu > l.band[1]) return;
      l.spieler = neu;
    });
    zeichnen();
  }

  function geklickt(l) {
    if (l.schlaeft) { wecken(l); return; }
    if (l.spieler >= l.max) return;
    betreten(l);
  }

  function wecken(l) {
    var k = knoten[l.id];
    l.weckt = true;
    zeichnen();

    var box = document.createElement("div");
    box.className = "wecken";

    var text = document.createElement("p");
    text.className = "wecken-text";
    text.setAttribute("role", "status");
    text.textContent = "Plaza wacht auf … etwa 3 Sekunden";

    var grund = document.createElement("p");
    grund.className = "wecken-grund";
    grund.textContent =
      "Der Server schläft, wenn eine Stunde niemand da war. Das hält den " +
      "Plaza kostenlos — du bist gerade der Erste.";

    var leiste = document.createElement("div");
    leiste.className = "wecken-balken";
    var fuell = document.createElement("i");
    leiste.appendChild(fuell);

    box.appendChild(text);
    box.appendChild(grund);
    box.appendChild(leiste);
    k.li.appendChild(box);
    k.wecken = box;

    if (!sanft) {
      // Erst im naechsten Frame, sonst springt die Breite ohne Uebergang.
      window.requestAnimationFrame(function () {
        fuell.style.transition = "width " + WECKDAUER_MS + "ms linear";
        fuell.style.width = "100%";
      });
    } else {
      fuell.style.width = "100%";
    }

    window.setTimeout(function () {
      l.weckt = false;
      l.schlaeft = false;
      l.spieler = 1;          // Man selbst.
      l.ping = 26;
      if (k.wecken) { k.wecken.remove(); k.wecken = null; }
      zeichnen();
      betreten(l);
    }, WECKDAUER_MS);
  }

  function betreten(l) {
    document.getElementById("drin-kicker").textContent = "Du bist in der Lobby";
    document.getElementById("drin-name").textContent = nameVon(l);
    elAuswahl.hidden = true;
    elDrin.hidden = false;
    window.scrollTo(0, 0);
  }

  document.getElementById("verlassen").addEventListener("click", function () {
    elDrin.hidden = true;
    elAuswahl.hidden = false;
    window.scrollTo(0, 0);
  });

  function zuruecksetzen() {
    // Tiefe Kopie, damit ein zweiter Durchlauf wieder bei der schlafenden
    // Lobby anfaengt.
    lobbys = VORLAGE.map(function (v) {
      return { id: v.id, nr: v.nr, max: v.max, spieler: v.spieler,
               band: v.band, ping: v.ping, schlaeft: v.schlaeft,
               weckt: false };
    });
    bauen();
  }

  // Ein Weg zurueck zum Anfangszustand - sonst ist der schlafende Zustand
  // nach dem ersten Klick fuer immer weg und niemand sieht ihn nochmal.
  var zurueck = document.createElement("button");
  zurueck.type = "button";
  zurueck.className = "btn btn-ghost";
  zurueck.style.marginTop = "14px";
  zurueck.textContent = "Vorschau zurücksetzen";
  zurueck.addEventListener("click", zuruecksetzen);
  document.querySelector(".hinweis").after(zurueck);

  zuruecksetzen();
  window.setInterval(pulsieren, 2500);
})();
