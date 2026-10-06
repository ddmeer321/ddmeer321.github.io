/* Ziehen und Ablegen: Funde zwischen Inventar und Bank bewegen.
 *
 * Die Knoepfe "Zur Bank ↗" und "Zurueck ins Inventar" bleiben unveraendert --
 * das hier ist die schnellere Geste daneben, nicht ihr Ersatz. Wer lieber
 * tippt, merkt von dieser Datei nichts.
 *
 * WARUM POINTER EVENTS UND NICHT HTML5-DRAG-AND-DROP
 * dragstart/dragover/drop feuern auf iOS Safari nicht. Auf dem Telefon --
 * also dort, wo dieses Spiel hauptsaechlich gespielt wird -- waere die
 * Funktion damit schlicht tot. Pointer Events decken Maus, Stift und Finger
 * mit demselben Code ab.
 *
 * WARUM DER FINGER ERST KURZ LIEGEN BLEIBEN MUSS
 * Karten fuellen auf dem Handy fast die halbe Breite. Wuerde jede Beruehrung
 * sofort ziehen, liesse sich die Seite nicht mehr scrollen. Also: kurz liegen
 * bleiben heisst ziehen, gleich wischen heisst scrollen. Mit der Maus gibt es
 * diesen Konflikt nicht, dort reicht ein kleiner Ruck.
 *
 * WARUM DAS SCROLLEN PER touchmove BLOCKIERT WIRD UND NICHT PER touch-action
 * touch-action muesste dauerhaft auf der Karte stehen und wuerde dann auch
 * das normale Scrollen ueber einer Karte verhindern. Der Listener wird
 * stattdessen erst gesetzt, wenn wirklich gezogen wird, und danach wieder
 * entfernt.
 */
(function () {
  "use strict";

  var stil = document.createElement("link");
  stil.rel = "stylesheet";
  stil.href = "dragdrop.css";
  document.head.appendChild(stil);

  var HALTEN_MS = 190;   // so lange muss ein Finger liegen bleiben
  var WISCH_PX = 10;     // vorher bewegt = scrollen, nicht ziehen
  var MAUS_PX = 4;       // mit Maus reicht ein kleiner Ruck

  var arm = null;        // beruehrt, aber noch nicht am Ziehen
  var zug = null;        // laeuft gerade

  function ui() { return window.LuckyLootUI; }
  function ruhig() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function symbol(kind) { return kind === "Messer" ? "⚔" : kind === "Handschuhe" ? "♧" : "⌁"; }

  // Die Karte selbst traegt keine Kennung -- die steht auf ihrem Aktionsknopf.
  // Derselbe Knopf verraet auch die Richtung: "Zur Bank" gibt es nur im
  // Inventar, "Zurueck ins Inventar" nur in der Bank. Karten im Sammelalbum
  // haben keinen von beiden und sind damit von selbst nicht ziehbar.
  function griff(karte) {
    var ein = karte.querySelector("[data-deposit]");
    if (ein) return { uid: ein.dataset.deposit, modus: "bank" };
    var aus = karte.querySelector("[data-withdraw]");
    if (aus) return { uid: aus.dataset.withdraw, modus: "inventar" };
    return null;
  }

  /* ---------------------------------------------------------------- Ablage */

  // Die Leiste wird bei jedem Zug neu gebaut, nie wiederverwendet: zwischen
  // zwei Zuegen kann sich der Bankstand geaendert haben.
  function leisteBauen(modus) {
    var u = ui(), s = u.state, el = document.createElement("div");
    el.className = "ll-leiste";

    if (modus === "bank") {
      var frei = s.slots - s.bank.length;
      el.innerHTML =
        '<p class="ll-leiste-titel">BANKPLÄTZE <span>' + s.bank.length + " / " + s.slots + "</span></p>" +
        '<div class="ll-reihe">' +
          s.bank.map(function (x) {
            return '<div class="ll-platz belegt">' + symbol(u.G.catalog[x.id].kind) + "</div>";
          }).join("") +
          Array.from({ length: frei }, function () {
            return '<div class="ll-platz frei" data-ablage="1">＋</div>';
          }).join("") +
        "</div>" +
        '<p class="ll-hinweis">' + (frei
          ? '<span class="ll-aus">Auf einen freien Platz ziehen</span>' +
            '<span class="ll-an">Loslassen — der Fund wandert in die Bank</span>'
          : "Alle Plätze belegt — erst einen Fund herausnehmen") +
        "</p>";
    } else {
      el.innerHTML =
        '<p class="ll-leiste-titel">INVENTAR <span>' + s.inventory.length + "</span></p>" +
        '<div class="ll-reihe"><div class="ll-platz weit frei" data-ablage="1">▦ Zurück ins Inventar</div></div>' +
        '<p class="ll-hinweis">' +
          '<span class="ll-aus">Der Fund hört dann auf zu verdienen</span>' +
          '<span class="ll-an">Loslassen — zurück ins Inventar</span></p>';
    }

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("offen"); });
    return el;
  }

  function ablegen(uid, modus) {
    var u = ui();
    try {
      u.G.accrue(u.state);
      if (modus === "bank") {
        u.G.deposit(u.state, uid);
        u.toast("Eingelegt! Dein Fund verdient jetzt Münzen.");
      } else {
        u.G.withdraw(u.state, uid);
        u.toast("Wieder in deinem Inventar.");
      }
      u.save();
      u.render();
    } catch (err) {
      // deposit() wirft z.B. bei voller Bank. Der Zug ist dann schlicht
      // wirkungslos -- die Karte liegt noch da, wo sie war.
      u.toast(err.message);
    }
  }

  /* ------------------------------------------------------------ Flugbahnen */

  // Von der aktuellen Lage des Klons in ein Zielrechteck. Gerechnet wird
  // analytisch statt gemessen: ein gedrehter Klon hat ein groesseres
  // Huellrechteck als die Karte selbst, gemessene Werte waeren also daneben.
  function fliegen(klon, start, ziel, dx, dy, kipp, fertig) {
    if (ruhig() || !klon.animate) { fertig(); return; }

    var s = ziel ? ziel.width / start.width : 1;
    var bis = ziel
      ? "translate(" + (ziel.left - start.left - start.width * (1 - s) / 2) + "px," +
                       (ziel.top - start.top - start.height * (1 - s) / 2) + "px) rotate(0deg) scale(" + s + ")"
      : "translate(0px,0px) rotate(0deg) scale(1)";

    var a = klon.animate(
      [
        { transform: "translate(" + dx + "px," + dy + "px) rotate(" + kipp + "deg) scale(1.04)", opacity: 1 },
        { transform: bis, opacity: ziel ? 0.15 : 1 }
      ],
      { duration: ziel ? 260 : 200, easing: "cubic-bezier(.2,.9,.25,1)", fill: "forwards" }
    );
    a.onfinish = fertig;
    a.oncancel = fertig;
  }

  /* ------------------------------------------------------------- Zugablauf */

  function armLoeschen() {
    if (!arm) return;
    clearTimeout(arm.uhr);
    arm.karte.classList.remove("ll-gehalten");
    arm = null;
  }

  function scrollSperre(e) { e.preventDefault(); }

  // Am Zeiger haengt bewusst NICHT die Karte selbst. Eine Karte ist auf dem
  // Handy fast halb so breit wie der Bildschirm und wuerde ausgerechnet die
  // Plaetze verdecken, auf die man zielt. Stattdessen ein kleiner Zettel mit
  // Zeichen und Namen -- man sieht, was man traegt, und wohin.
  function zettelBauen(uid) {
    var u = ui();
    var eintrag = u.state.inventory.concat(u.state.bank).find(function (e) { return e.uid === uid; });
    var fund = eintrag ? u.G.catalog[eintrag.id] : null;

    var el = document.createElement("div");
    el.className = "ll-zettel";
    if (fund) el.style.setProperty("--rarity", u.G.tiers[fund.tier].color);
    // Zwei Ebenen: aussen liegt die vom Zeiger gesteuerte Verschiebung,
    // innen die Anhebe-Animation. Sonst wuerden sich beide um dieselbe
    // transform-Eigenschaft streiten.
    el.innerHTML = '<div class="ll-innen"><span class="ll-zeichen">' +
      (fund ? symbol(fund.kind) : "▦") + "</span><strong>" +
      (fund ? fund.name : "Fund") + "</strong></div>";
    document.body.appendChild(el);
    return el;
  }

  function zugStarten(x, y) {
    var karte = arm.karte;
    var zettel = zettelBauen(arm.uid);
    var z = zettel.getBoundingClientRect();

    // Der Zettel schwebt ueber dem Zeiger, nicht darunter: laege er mittig
    // darauf, verdeckte er genau den Platz, den man treffen will -- am Finger
    // zusaetzlich noch die Hand. Getroffen wird weiterhin dort, wo der Zeiger
    // ist; der Zettel ist nur das Sichtbare daran. Am Finger braucht es mehr
    // Luft als unter der Maus.
    // 84 bzw. 94 sind nicht geraten: der Zettel ist 96 hoch, der Zeiger sitzt
    // in der Mitte eines 62 hohen Platzes. Ab 48 + 31 = 79 liegt seine
    // Unterkante ueber der Platzreihe, die Reihe bleibt also ganz sichtbar.
    // Am Finger etwas mehr, weil dort noch die Hand im Weg ist.
    var hoch = arm.maus ? 84 : 94;
    var start = { left: x - z.width / 2, top: y - z.height / 2 - hoch, width: z.width, height: z.height };
    zettel.style.left = start.left + "px";
    zettel.style.top = start.top + "px";

    karte.classList.add("ll-quelle");
    document.body.classList.add("ll-zieht");
    document.addEventListener("touchmove", scrollSperre, { passive: false });

    zug = {
      uid: arm.uid, modus: arm.modus, karte: karte, klon: zettel, hoch: hoch,
      start: start, vonX: x, vonY: y, dx: 0, dy: 0, kipp: 0,
      leiste: leisteBauen(arm.modus), ablage: null
    };
    armLoeschen();
    zugBewegen(x, y);
  }

  function zugBewegen(x, y) {
    zug.dx = x - zug.vonX;
    zug.dy = y - zug.vonY;
    // Leichte Schraeglage in Zugrichtung -- gedeckelt, sonst kippt die Karte
    // bei schnellen Bewegungen ueber.
    zug.kipp = Math.max(-7, Math.min(7, zug.dx * 0.05));
    zug.klon.style.transform =
      "translate(" + zug.dx + "px," + zug.dy + "px) rotate(" + zug.kipp + "deg) scale(1.04)";

    // Der Klon hat pointer-events:none, elementFromPoint sieht also durch ihn
    // hindurch auf die Ablage darunter.
    var unten = document.elementFromPoint(x, y);
    var ablage = unten && unten.closest ? unten.closest("[data-ablage]") : null;
    if (ablage !== zug.ablage) {
      if (zug.ablage) zug.ablage.classList.remove("drueber");
      if (ablage) ablage.classList.add("drueber");
      zug.ablage = ablage;
      zug.leiste.classList.toggle("trifft", !!ablage);
    }
  }

  function zugBeenden(abbruch) {
    if (!zug) return;
    var z = zug;
    zug = null;

    document.removeEventListener("touchmove", scrollSperre, { passive: false });
    document.body.classList.remove("ll-zieht");
    if (z.ablage) z.ablage.classList.remove("drueber");

    var treffer = !abbruch && z.ablage;
    var ziel = treffer ? z.ablage.getBoundingClientRect() : null;

    function aufraeumen() {
      z.klon.remove();
      z.leiste.classList.remove("offen");
      // Erst nach dem Zuklappen entfernen, sonst verschwindet die Leiste
      // schlagartig statt herunterzufahren.
      setTimeout(function () { z.leiste.remove(); }, ruhig() ? 0 : 220);
      z.karte.classList.remove("ll-quelle");
      if (treffer) ablegen(z.uid, z.modus);
    }

    if (treffer && !ruhig()) z.ablage.classList.add("einschnappen");
    fliegen(z.klon, z.start, ziel, z.dx, z.dy, z.kipp, aufraeumen);
  }

  /* -------------------------------------------------------------- Eingabe */

  document.addEventListener("pointerdown", function (e) {
    if (zug || (e.button != null && e.button !== 0)) return;
    var karte = e.target.closest && e.target.closest(".item-card");
    if (!karte) return;
    // Knoepfe bleiben Knoepfe.
    if (e.target.closest("button, a, select, input, summary")) return;

    var g = griff(karte);
    if (!g) return;

    arm = {
      karte: karte, uid: g.uid, modus: g.modus,
      x: e.clientX, y: e.clientY, maus: e.pointerType === "mouse", uhr: 0
    };
    try { karte.setPointerCapture(e.pointerId); } catch (_) {}

    if (!arm.maus) {
      karte.classList.add("ll-gehalten");
      arm.uhr = setTimeout(function () {
        if (arm) zugStarten(arm.x, arm.y);
      }, HALTEN_MS);
    }
  });

  document.addEventListener("pointermove", function (e) {
    if (zug) { zugBewegen(e.clientX, e.clientY); return; }
    if (!arm) return;
    var weit = Math.hypot(e.clientX - arm.x, e.clientY - arm.y);
    if (arm.maus) {
      // Angehoben wird am Greifpunkt, damit die Karte unter dem Zeiger
      // bleibt -- und danach sofort auf die aktuelle Position nachgezogen,
      // sonst haengt sie ein Bild lang hinterher.
      if (weit > MAUS_PX) { zugStarten(arm.x, arm.y); zugBewegen(e.clientX, e.clientY); }
    } else if (weit > WISCH_PX) {
      // Finger ist losgewischt, bevor die Haltezeit um war: das war Scrollen.
      armLoeschen();
    }
  });

  document.addEventListener("pointerup", function () {
    if (zug) zugBeenden(false); else armLoeschen();
  });

  document.addEventListener("pointercancel", function () {
    if (zug) zugBeenden(true); else armLoeschen();
  });

  // Langes Halten oeffnet auf Touch sonst das Kontextmenue mitten im Zug.
  document.addEventListener("contextmenu", function (e) {
    if (zug || arm) e.preventDefault();
  });

  // Die Escape-Taste bricht ab, wie man es von jedem Zug erwartet.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && zug) zugBeenden(true);
  });

  // Scrollt oder dreht sich die Seite mitten im Zug, stimmen die gemerkten
  // Rechtecke nicht mehr -- dann lieber sauber abbrechen.
  window.addEventListener("resize", function () { if (zug) zugBeenden(true); });
})();
