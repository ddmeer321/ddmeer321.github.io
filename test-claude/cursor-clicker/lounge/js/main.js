// Trading-Lounge — Vorschau.
//
// ATTRAPPE. Kein Realtime-Kanal, keine Datenbank, nichts wird gesendet. Die
// Leute, der Chat und der Trade sind erfunden. Es geht einzig darum, wie sich
// der Ablauf anfuehlt, BEVOR Technik daran haengt.
//
// Der Unterschied zur bisherigen Trading-Seite ist nicht der Tausch selbst -
// der ist serverseitig sauber gebaut und bleibt. Anders ist der Weg dorthin:
// Statt einen Namen zu suchen und ein Angebot ins Leere zu schicken, sieht
// man, wer gerade da ist, und redet vorher miteinander.
//
// EINE ENTSCHEIDUNG, die man im Bild sofort sieht: Es ist immer nur EIN Chat
// sichtbar - entweder die Lounge oder ein Trade. Zwei Eingabefelder
// nebeneinander waeren eine Einladung, ins falsche zu tippen, und im
// Lounge-Chat steht dann, was nur die Gegenseite lesen sollte.

(function () {
  var TAKT_NACHRICHT = 6000;   // wie oft jemand in der Lounge schreibt
  var TAKT_KOMMTGEHT = 9000;   // wie oft jemand kommt oder geht
  var TIPPDAUER = 1500;        // wie lange "tippt …" vor der Nachricht steht

  var POOL = [
    { id: "p1", name: "Theo",        pid: "P-7X2K" },
    { id: "p2", name: "Dodo_Test",   pid: "P-4M9Q" },
    { id: "p3", name: "Epkolino",    pid: "P-1B8V" },
    { id: "p4", name: "Johannes",    pid: "P-6R3T" },
    { id: "p5", name: "Dqrkedstone", pid: "P-9L5W" },
    { id: "p6", name: "epke.max",    pid: "P-2C7H" },
  ];

  var LOUNGE_SKRIPT = [
    { wer: "Theo",        was: "Suche Origin, biete Galaxy + Quantum" },
    { wer: "Johannes",    was: "hat wer nen Phoenix übrig?" },
    { wer: "Dqrkedstone", was: "ich hab zwei, was gibst du dafür?" },
    { wer: "Johannes",    was: "Storm und Fire" },
    { wer: "Dqrkedstone", was: "passt, schreib mich an" },
    { wer: "Epkolino",    was: "wer tauscht Ice gegen Steel?" },
  ];

  var TRADE_SKRIPT = [
    { wer: "Theo", was: "passt das so?" },
    { wer: "Theo", was: "kann auch noch Quantum dazulegen wenn du Ice mitgibst" },
  ];

  var INVENTAR = [
    { id: "i1", icon: "🌌", name: "Galaxy Cursor",  rar: "mythic",  gewaehlt: true },
    { id: "i2", icon: "⚛️", name: "Quantum Cursor", rar: "mythic",  gewaehlt: true },
    { id: "i3", icon: "❄️", name: "Ice Cursor",     rar: "rare",    gewaehlt: false },
    { id: "i4", icon: "⚙️", name: "Steel Cursor",   rar: "rare",    gewaehlt: false },
    { id: "i5", icon: "🔥", name: "Fire Cursor",    rar: "epic",    gewaehlt: false },
  ];
  var IHR_ANGEBOT = [{ icon: "✨", name: "Origin Cursor" }];

  var anwesend = [];           // ids aus POOL
  var beschaeftigt = ["p2"];   // steckt schon in einem Trade
  var skriptZeiger = 0;
  var tradePartner = null;
  var uhren = [];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    leute: $("leute"), zaehler: $("online-zaehler"), trades: $("trades"),
    lounge: $("ansicht-lounge"), trade: $("ansicht-trade"),
    loungeChat: $("lounge-chat"), loungeForm: $("lounge-form"), loungeEingabe: $("lounge-eingabe"),
    tippt: $("lounge-tippt"),
    tradeChat: $("trade-chat"), tradeForm: $("trade-form"), tradeEingabe: $("trade-eingabe"),
    titel: $("trade-titel"), meta: $("trade-meta"), status: $("trade-status"),
    mein: $("mein-angebot"), ihr: $("ihr-angebot"), inventar: $("inventar"),
    zurueck: $("zurueck"), bestaetigen: $("bestaetigen"),
  };

  function person(id) {
    for (var i = 0; i < POOL.length; i++) if (POOL[i].id === id) return POOL[i];
    return null;
  }
  function istBeschaeftigt(id) { return beschaeftigt.indexOf(id) !== -1; }

  function uhrzeit() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  // ---------- Wer ist da ----------

  function zeichneLeute(neuId) {
    el.leute.textContent = "";
    anwesend.forEach(function (id) {
      var p = person(id); if (!p) return;
      var busy = istBeschaeftigt(id);

      var zeile = document.createElement("div");
      zeile.className = "person" + (id === neuId ? " neu" : "");
      zeile.setAttribute("data-zustand", busy ? "beschaeftigt" : "frei");

      var punkt = document.createElement("span");
      punkt.className = "punkt";
      punkt.setAttribute("aria-hidden", "true");

      var mitte = document.createElement("div");
      var name = document.createElement("div");
      name.className = "person-name";
      name.textContent = p.name;
      var meta = document.createElement("div");
      meta.className = "person-meta";
      meta.textContent = p.pid;
      var zustand = document.createElement("div");
      zustand.className = "person-zustand";
      zustand.textContent = busy ? "im Trade" : "frei";
      mitte.appendChild(name); mitte.appendChild(meta); mitte.appendChild(zustand);

      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "btn mini" + (busy ? "" : " primary");
      knopf.textContent = busy ? "belegt" : "Trade";
      knopf.disabled = busy;
      if (!busy) knopf.addEventListener("click", function () { oeffneTrade(p); });

      zeile.appendChild(punkt); zeile.appendChild(mitte); zeile.appendChild(knopf);
      el.leute.appendChild(zeile);
    });
    el.zaehler.textContent = anwesend.length + " online";
  }

  function zeichneTrades() {
    el.trades.textContent = "";
    if (!tradePartner) {
      var leer = document.createElement("p");
      leer.className = "muted";
      leer.style.margin = "0";
      leer.textContent = "Nichts offen.";
      el.trades.appendChild(leer);
      return;
    }
    var row = document.createElement("button");
    row.type = "button";
    row.className = "trade-row";
    var links = document.createElement("span");
    links.textContent = tradePartner.name;
    var rechts = document.createElement("span");
    rechts.className = "status offered";
    rechts.textContent = "offered";
    row.appendChild(links); row.appendChild(rechts);
    row.addEventListener("click", function () { zeigeTrade(); });
    el.trades.appendChild(row);
  }

  // ---------- Chat ----------

  function schreibe(behaelter, wer, was, art) {
    var zeile = document.createElement("div");
    zeile.className = "zeile" + (art ? " " + art : "");

    if (art === "system") {
      var nur = document.createElement("div");
      nur.className = "was";
      nur.textContent = was;
      zeile.appendChild(nur);
    } else {
      var kopf = document.createElement("div");
      kopf.className = "kopf";
      var w = document.createElement("span");
      w.className = "wer";
      w.textContent = wer;
      var z = document.createElement("span");
      z.className = "zeit";
      z.textContent = uhrzeit();
      kopf.appendChild(w); kopf.appendChild(z);
      var text = document.createElement("div");
      text.className = "was";
      text.textContent = was;       // textContent, nie innerHTML
      zeile.appendChild(kopf); zeile.appendChild(text);
    }

    // Nur mitscrollen, wenn man ohnehin unten steht - sonst reisst es einen
    // beim Zurueckblaettern jedes Mal nach unten.
    var unten = behaelter.scrollHeight - behaelter.scrollTop - behaelter.clientHeight < 40;
    behaelter.appendChild(zeile);
    if (unten) behaelter.scrollTop = behaelter.scrollHeight;
  }

  function naechsteLoungeNachricht() {
    var n = LOUNGE_SKRIPT[skriptZeiger % LOUNGE_SKRIPT.length];
    skriptZeiger++;
    if (anwesend.indexOf(idVon(n.wer)) === -1) return;   // wer weg ist, schreibt nicht
    el.tippt.textContent = n.wer + " tippt …";
    uhren.push(window.setTimeout(function () {
      el.tippt.textContent = "";
      schreibe(el.loungeChat, n.wer, n.was);
    }, TIPPDAUER));
  }

  function idVon(name) {
    for (var i = 0; i < POOL.length; i++) if (POOL[i].name === name) return POOL[i].id;
    return null;
  }

  function kommtOderGeht() {
    var draussen = POOL.filter(function (p) { return anwesend.indexOf(p.id) === -1; });
    // Nie unter drei, sonst wirkt die Lounge im Screenshot tot.
    if (draussen.length && (anwesend.length <= 3 || Math.random() < 0.6)) {
      var neu = draussen[Math.floor(Math.random() * draussen.length)];
      anwesend.push(neu.id);
      zeichneLeute(neu.id);
      schreibe(el.loungeChat, null, neu.name + " ist der Lounge beigetreten", "system");
    } else {
      var weg = anwesend.filter(function (id) {
        return !istBeschaeftigt(id) && (!tradePartner || id !== tradePartner.id);
      });
      if (!weg.length) return;
      var raus = weg[Math.floor(Math.random() * weg.length)];
      anwesend = anwesend.filter(function (id) { return id !== raus; });
      zeichneLeute();
      schreibe(el.loungeChat, null, person(raus).name + " hat die Lounge verlassen", "system");
    }
  }

  // ---------- Trade ----------

  function zeichneAngebot() {
    el.mein.textContent = "";
    var gewaehlt = INVENTAR.filter(function (i) { return i.gewaehlt; });
    if (!gewaehlt.length) {
      var leer = document.createElement("span");
      leer.className = "muted";
      leer.textContent = "Noch nichts ausgewählt";
      el.mein.appendChild(leer);
    }
    gewaehlt.forEach(function (i) {
      var chip = document.createElement("span");
      chip.className = "item-chip";
      chip.textContent = i.icon + " " + i.name;
      el.mein.appendChild(chip);
    });

    el.ihr.textContent = "";
    IHR_ANGEBOT.forEach(function (i) {
      var chip = document.createElement("span");
      chip.className = "item-chip";
      chip.textContent = i.icon + " " + i.name;
      el.ihr.appendChild(chip);
    });
  }

  function zeichneInventar() {
    el.inventar.textContent = "";
    INVENTAR.forEach(function (i) {
      var label = document.createElement("label");
      label.className = "inventory-item";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = i.gewaehlt;
      box.addEventListener("change", function () {
        i.gewaehlt = box.checked;
        zeichneAngebot();
        // Jede Aenderung setzt die Bestaetigung zurueck - genau so macht es
        // auch die Datenbank ueber die Revisionsnummer.
        el.bestaetigen.disabled = false;
        el.bestaetigen.textContent = "Bestätigen";
      });
      var icon = document.createElement("span");
      icon.className = "item-icon";
      icon.textContent = i.icon;
      var text = document.createElement("span");
      var stark = document.createElement("strong");
      stark.textContent = i.name;
      var rar = document.createElement("div");
      rar.className = "person-meta";
      rar.textContent = i.rar;
      text.appendChild(stark); text.appendChild(rar);
      label.appendChild(box); label.appendChild(icon); label.appendChild(text);
      el.inventar.appendChild(label);
    });
  }

  function oeffneTrade(p) {
    tradePartner = p;
    if (beschaeftigt.indexOf(p.id) === -1) beschaeftigt.push(p.id);
    el.tradeChat.textContent = "";
    TRADE_SKRIPT.forEach(function (n) { schreibe(el.tradeChat, n.wer, n.was); });
    zeichneLeute(); zeichneTrades(); zeigeTrade();
  }

  function zeigeTrade() {
    if (!tradePartner) return;
    el.titel.textContent = "Trade mit " + tradePartner.name;
    el.meta.textContent = tradePartner.pid + " · Revision 3 · läuft noch 14 Minuten";
    el.bestaetigen.disabled = false;
    el.bestaetigen.textContent = "Bestätigen";
    zeichneAngebot(); zeichneInventar();
    el.lounge.hidden = true; el.trade.hidden = false;
    el.tippt.textContent = "";
    // Ansichtswechsel faengt oben an - sonst landet man mittendrin, wenn man
    // vorher weit im Lounge-Chat gescrollt hatte.
    window.scrollTo(0, 0);
  }

  function zeigeLounge() {
    el.trade.hidden = true; el.lounge.hidden = false;
    window.scrollTo(0, 0);
  }

  // ---------- Verdrahtung ----------

  el.zurueck.addEventListener("click", zeigeLounge);

  el.bestaetigen.addEventListener("click", function () {
    el.bestaetigen.disabled = true;
    el.bestaetigen.textContent = "Bestätigt — warte auf Gegenseite";
    schreibe(el.tradeChat, null, "Du hast bestätigt. Sobald " + tradePartner.name + " auch bestätigt, wird getauscht.", "system");
  });

  el.loungeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = el.loungeEingabe.value.trim();
    if (!text) return;
    schreibe(el.loungeChat, "Du", text, "ich");
    el.loungeEingabe.value = "";
  });

  el.tradeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = el.tradeEingabe.value.trim();
    if (!text) return;
    schreibe(el.tradeChat, "Du", text, "ich");
    el.tradeEingabe.value = "";
  });

  // ---------- Start ----------

  anwesend = ["p1", "p2", "p4", "p5"];
  zeichneLeute(); zeichneTrades();
  schreibe(el.loungeChat, null, "Willkommen in der Lounge. Sei nett zueinander.", "system");
  LOUNGE_SKRIPT.slice(0, 3).forEach(function (n) { schreibe(el.loungeChat, n.wer, n.was); });
  skriptZeiger = 3;

  uhren.push(window.setInterval(naechsteLoungeNachricht, TAKT_NACHRICHT));
  uhren.push(window.setInterval(kommtOderGeht, TAKT_KOMMTGEHT));
})();
