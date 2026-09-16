// Trading-Lounge.
//
// ECHT: Anwesenheitsliste und Lounge-Chat laufen ueber Supabase Realtime.
// ATTRAPPE: Der Trade-Bereich (Angebote, Inventar, Tausch) ist noch erfunden.
//
// DER KANAL IST PRIVAT. Der Anon-Key steht im Quelltext jeder Seite - ein
// offener Realtime-Kanal waere damit fuer jeden im Internet offen, der den
// Quelltext liest. test-gate.js sperrt die SEITE, nicht den KANAL. Die
// Regeln dazu liegen in supabase/migrations/..._realtime_lounge_authorization
// als RLS-Policies auf realtime.messages.
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
  var sb = window.supabaseClient;
  if (!sb) return;

  var TOPIC = "cc-lounge";
  var MAX_ZEICHEN = 200;
  var MIN_ABSTAND_MS = 400;   // gegen versehentliches Dauerfeuer

  // Als Funktion, nicht als feste Liste: Sonst redet im Trade mit Epkolino
  // ploetzlich Theo. (Genau das ist passiert.)
  function tradeSkript(p) {
    return [
      { wer: p.name, was: "passt das so?" },
      { wer: p.name, was: "kann auch noch was dazulegen wenn du Ice mitgibst" },
    ];
  }

  var INVENTAR = [
    { id: "i1", icon: "🌌", name: "Galaxy Cursor",  rar: "mythic",  gewaehlt: true },
    { id: "i2", icon: "⚛️", name: "Quantum Cursor", rar: "mythic",  gewaehlt: true },
    { id: "i3", icon: "❄️", name: "Ice Cursor",     rar: "rare",    gewaehlt: false },
    { id: "i4", icon: "⚙️", name: "Steel Cursor",   rar: "rare",    gewaehlt: false },
    { id: "i5", icon: "🔥", name: "Fire Cursor",    rar: "epic",    gewaehlt: false },
  ];
  var IHR_ANGEBOT = [{ icon: "✨", name: "Origin Cursor", rar: "secret" }];

  var ich = null;              // { id, name, pid, rolle }
  var anwesend = [];           // aus der Presence des Kanals
  var beschaeftigt = [];       // wer laut eigener Meldung in einem Trade ist
  var lokalBeschaeftigt = [];  // nur die Attrappe: mit wem ICH gerade "handle"
  var kanal = null;
  var verbunden = false;
  var zuletztGesendet = 0;
  var tradePartner = null;
  var abgeschlossen = false;
  var eingefroren = [];        // was beim Abschluss auf dem Tisch lag
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
    speichern: $("speichern"), abbrechen: $("abbrechen"),
    hinweis: $("kanal-hinweis"),
  };

  function istBeschaeftigt(id) { return beschaeftigt.indexOf(id) !== -1; }

  function uhrzeit() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  // ---------- Wer ist da ----------

  function zeichneLeute(neuId) {
    el.leute.textContent = "";

    var andere = anwesend.filter(function (p) { return !ich || p.id !== ich.id; });
    if (!andere.length) {
      var allein = document.createElement("p");
      allein.className = "leer-hinweis";
      allein.textContent = anwesend.length
        ? "Gerade ist sonst niemand hier. Sobald jemand die Lounge öffnet, steht er hier."
        : "Verbinde …";
      el.leute.appendChild(allein);
      el.zaehler.textContent = verbunden ? anwesend.length + " online" : "verbinde …";
      return;
    }

    andere.forEach(function (p) {
      var id = p.id;
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
    el.zaehler.textContent = verbunden ? anwesend.length + " online" : "verbinde …";
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
    rechts.className = "status " + (abgeschlossen ? "completed" : "offered");
    rechts.textContent = abgeschlossen ? "completed" : "offered";
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

  // ---------- Trade ----------

  function zeichneAngebot() {
    el.mein.textContent = "";
    var gewaehlt = abgeschlossen ? eingefroren : INVENTAR.filter(function (i) { return i.gewaehlt; });
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
      box.disabled = abgeschlossen;
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
    abgeschlossen = false; eingefroren = [];
    el.status.textContent = "offered"; el.status.className = "status offered";
    el.speichern.disabled = false; el.abbrechen.disabled = false;
    if (lokalBeschaeftigt.indexOf(p.id) === -1) lokalBeschaeftigt.push(p.id);
    if (beschaeftigt.indexOf(p.id) === -1) beschaeftigt.push(p.id);
    el.tradeChat.textContent = "";
    tradeSkript(p).forEach(function (n) { schreibe(el.tradeChat, n.wer, n.was); });
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
    var partner = tradePartner;
    el.bestaetigen.disabled = true;
    el.bestaetigen.textContent = "Bestätigt — warte auf Gegenseite";
    schreibe(el.tradeChat, null, "Du hast bestätigt. Sobald " + partner.name + " auch bestätigt, wird getauscht.", "system");
    // Ein Bildschirm, auf dem nie etwas passiert, wirkt kaputt. In der
    // Attrappe zieht die Gegenseite deshalb nach - im Echten kommt an
    // dieser Stelle ihre Bestaetigung ueber den Kanal.
    uhren.push(window.setTimeout(function () { schliesseAb(partner); }, 2600));
  });

  el.loungeForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var text = el.loungeEingabe.value.trim().slice(0, MAX_ZEICHEN);
    if (!text || !kanal || !ich) return;
    if (Date.now() - zuletztGesendet < MIN_ABSTAND_MS) return;
    zuletztGesendet = Date.now();
    el.loungeEingabe.value = "";
    // Kein oertliches Anzeigen: Die Nachricht kommt ueber den Kanal zurueck
    // (broadcast.self). Erscheint sie, ist sie wirklich draussen gewesen.
    try {
      var antwort = await kanal.send({ type: "broadcast", event: "chat",
                         payload: { text: text, name: ich.name, id: ich.id } });
      if (antwort !== "ok") throw new Error(String(antwort));
    } catch (err) {
      schreibe(el.loungeChat, null,
        "Deine Nachricht kam nicht an. Steht oben ein roter Hinweis? Sonst hilft neu laden.", "system");
      el.loungeEingabe.value = text;   // nicht wegwerfen, was jemand getippt hat
    }
  });

  el.tradeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = el.tradeEingabe.value.trim();
    if (!text) return;
    schreibe(el.tradeChat, "Du", text, "ich");
    el.tradeEingabe.value = "";
  });

  /** Beide haben bestaetigt: Die Items wechseln den Besitzer. In der
      Datenbank ist das ein einziges UPDATE - entweder alles oder nichts. */
  function schliesseAb(partner) {
    if (abgeschlossen || tradePartner !== partner) return;
    abgeschlossen = true;

    eingefroren = INVENTAR.filter(function (i) { return i.gewaehlt; });
    INVENTAR = INVENTAR.filter(function (i) { return !i.gewaehlt; });
    IHR_ANGEBOT.forEach(function (i) {
      INVENTAR.push({ id: "neu-" + i.name, icon: i.icon, name: i.name, rar: i.rar, gewaehlt: false });
    });

    lokalBeschaeftigt = lokalBeschaeftigt.filter(function (id) { return id !== partner.id; });
    beschaeftigt = beschaeftigt.filter(function (id) { return id !== partner.id; });

    el.status.textContent = "completed";
    el.status.className = "status completed";
    el.meta.textContent = partner.pid + " · abgeschlossen um " + uhrzeit();
    el.bestaetigen.textContent = "Getauscht";
    el.speichern.disabled = true;
    el.abbrechen.disabled = true;

    schreibe(el.tradeChat, null, partner.name + " hat bestätigt.", "system");
    schreibe(el.tradeChat, null,
      "Getauscht. " + IHR_ANGEBOT.map(function (i) { return i.name; }).join(", ") +
      " liegt jetzt bei deinen Duplikaten.", "system");

    zeichneAngebot(); zeichneInventar(); zeichneLeute(); zeichneTrades();
  }

  // ---------- Start: echter Kanal ----------

  function fehler(text) {
    el.hinweis.textContent = text;
    el.hinweis.hidden = false;
  }

  function ausPresence() {
    var zustand = kanal.presenceState();
    var liste = [], busy = [];
    Object.keys(zustand).forEach(function (schluessel) {
      var eintraege = zustand[schluessel];
      if (!eintraege || !eintraege.length) return;
      var m = eintraege[0];                       // ein Geraet reicht
      if (!m || !m.id) return;
      liste.push({ id: m.id, name: m.name || "Unbekannt", pid: m.pid || "" });
      if (m.imTrade) busy.push(m.id);
    });
    liste.sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
    anwesend = liste;
    beschaeftigt = busy.concat(lokalBeschaeftigt);
    zeichneLeute();
  }

  async function start() {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) { fehler("Du bist nicht angemeldet."); return; }

    var profil = (await sb.from("profiles").select("username, player_id, role")
      .eq("id", s.user.id).maybeSingle()).data;
    if (!profil) { fehler("Dein Profil konnte nicht geladen werden."); return; }
    ich = { id: s.user.id, name: profil.username, pid: profil.player_id, rolle: profil.role };

    // Ohne das kennt die Realtime-Verbindung die Anmeldung nicht und die
    // Policies auf realtime.messages lehnen sie ab.
    try { sb.realtime.setAuth(s.access_token); } catch (e) { /* aeltere SDKs */ }

    kanal = sb.channel(TOPIC, {
      // broadcast.self: Die eigene Nachricht geht zum Server und kommt von
      // dort zurueck, statt nur oertlich angezeigt zu werden. Kostet ein paar
      // Millisekunden und ist dafuer ehrlich: Was dasteht, ist wirklich
      // rausgegangen. Vorher haette eine gescheiterte Nachricht trotzdem im
      // eigenen Verlauf gestanden - man haette gedacht, man redet, waehrend
      // niemand zuhoert.
      config: { private: true, presence: { key: ich.id }, broadcast: { self: true } },
    });

    kanal.on("presence", { event: "sync" }, ausPresence);
    kanal.on("broadcast", { event: "chat" }, function (n) {
      var p = n.payload || {};
      if (!p.text) return;
      var vonMir = ich && p.id === ich.id;
      schreibe(el.loungeChat, vonMir ? "Du" : (p.name || "Unbekannt"),
               String(p.text).slice(0, MAX_ZEICHEN), vonMir ? "ich" : null);
    });

    kanal.subscribe(async function (status, err) {
      if (status === "SUBSCRIBED") {
        verbunden = true;
        el.hinweis.hidden = true;
        await kanal.track({ id: ich.id, name: ich.name, pid: ich.pid, imTrade: false });
        // Ohne das haengt der Zaehler auf "verbinde ..." bis zum ersten
        // Anwesenheits-Abgleich - verbunden ist man aber schon jetzt.
        if (!anwesend.length) anwesend = [{ id: ich.id, name: ich.name, pid: ich.pid }];
        zeichneLeute();
        schreibe(el.loungeChat, null, "Du bist in der Lounge. Sei nett zueinander.", "system");
        return;
      }
      if (status === "CHANNEL_ERROR") {
        fehler("Die Lounge konnte nicht geöffnet werden" +
          (err && err.message ? " (" + err.message + ")" : "") +
          ". Der Chat braucht die Rolle Tester, Admin oder Owner.");
      }
      if (status === "TIMED_OUT") fehler("Die Verbindung zur Lounge ist abgelaufen. Bitte neu laden.");
      if (status === "CLOSED") { verbunden = false; zeichneLeute(); }
    });

    // Sauber abmelden, sonst haengt man fuer die anderen noch in der Liste.
    window.addEventListener("pagehide", function () {
      try { kanal.untrack(); sb.removeChannel(kanal); } catch (e) {}
    });
  }

  zeichneLeute(); zeichneTrades();
  start();
})();
