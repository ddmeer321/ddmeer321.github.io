// Trading-Lounge.
//
// Statt einen Namen zu suchen und ein Angebot ins Leere zu schicken, sieht
// man, wer gerade da ist, redet miteinander, und handelt dann.
//
// DIE KANAELE SIND PRIVAT. Der Anon-Key steht im Quelltext jeder Seite - ein
// offener Realtime-Kanal waere damit fuer jeden im Internet offen, der den
// Quelltext liest. js/zugang.js sperrt die SEITE, nicht den KANAL. Die Regeln
// liegen als RLS-Policies auf realtime.messages (siehe
// supabase/migrations/..._realtime_lounge_authorization).
//   cc-lounge       -> tester/admin/owner
//   cc-trade-<id>   -> nur die beiden Beteiligten
//
// DER TAUSCH SELBST wird nicht hier entschieden. Jede Aenderung geht durch
// die Edge Function cursor-clicker-security und dort durch SQL-Funktionen mit
// Sperren, Revisionsnummern und einem atomaren Besitzerwechsel. Diese Datei
// zeigt an und schickt ab - sie rechnet nichts aus, dem man glauben muesste.
//
// EINE ENTSCHEIDUNG, die man im Bild sofort sieht: Es ist immer nur EIN Chat
// sichtbar - entweder die Lounge oder ein Trade. Zwei Eingabefelder
// nebeneinander waeren eine Einladung, ins falsche zu tippen, und im
// Lounge-Chat steht dann, was nur die Gegenseite lesen sollte.

(function () {
  var sb = window.supabaseClient;
  if (!sb) return;

  // js/zugang.js prueft den Zugang asynchron und ersetzt die Seite dabei durch
  // eine Sperrmeldung. Ist das schon passiert, gibt es hier nichts mehr zu
  // verdrahten -- ohne diese Zeile laeuft der ganze Rest gegen leere Elemente
  // und wirft. Gleiches Vorgehen wie in cursor-clicker/js/main.js.
  if (!document.getElementById("lounge-chat")) return;

  var TOPIC = "cc-lounge";
  var MAX_ZEICHEN = 200;
  var MIN_ABSTAND_MS = 400;   // gegen versehentliches Dauerfeuer

  var STATUS_TEXT = {
    draft: "Entwurf", offered: "Angeboten", completed: "Getauscht",
    cancelled: "Abgebrochen", declined: "Abgelehnt", expired: "Abgelaufen",
  };

  var ich = null;              // { id, name, pid, rolle }
  var anwesend = [];           // aus der Presence des Kanals
  var beschaeftigt = [];       // wer laut eigener Meldung in einem Trade ist
  var kanal = null;            // Lounge
  var tradeKanal = null;       // der Chat zum offenen Trade
  var verbunden = false;
  var zuletztGesendet = 0;
  var schnappschuss = null;    // { accountState, inventory, trades }
  var aktiveTradeId = null;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    leute: $("leute"), zaehler: $("online-zaehler"), trades: $("trades"),
    lounge: $("ansicht-lounge"), trade: $("ansicht-trade"),
    loungeChat: $("lounge-chat"), loungeForm: $("lounge-form"), loungeEingabe: $("lounge-eingabe"),
    tippt: $("lounge-tippt"), hinweis: $("kanal-hinweis"),
    tradeChat: $("trade-chat"), tradeForm: $("trade-form"), tradeEingabe: $("trade-eingabe"),
    titel: $("trade-titel"), meta: $("trade-meta"), status: $("trade-status"),
    importPanel: $("import-panel"), loungeInhalt: $("lounge-inhalt"),
    importBeantragen: $("import-beantragen"), importAktivieren: $("import-aktivieren"),
    importStand: $("import-stand"), loungeIntro: $("lounge-intro"),
    mein: $("mein-angebot"), ihr: $("ihr-angebot"), inventar: $("inventar"),
    zurueck: $("zurueck"), bestaetigen: $("bestaetigen"),
    speichern: $("speichern"), senden: $("senden"), abbrechen: $("abbrechen"),
  };

  // ---------- Kleinkram ----------

  function uhrzeit() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function fehler(text) {
    el.hinweis.textContent = text;
    el.hinweis.hidden = !text;
  }

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
      var w = document.createElement("span"); w.className = "wer"; w.textContent = wer;
      var z = document.createElement("span"); z.className = "zeit"; z.textContent = uhrzeit();
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

  /** Jede Aenderung geht hier durch. Wirft mit der Meldung, die der Server
      geschickt hat - die ist fuer Menschen geschrieben. */
  async function ruf(aktion, koerper, veraendernd) {
    var nutzlast = Object.assign({ action: aktion }, koerper || {});
    if (veraendernd) nutzlast.clientActionId = crypto.randomUUID();
    var r = await window.invokeAuthenticatedFunction("cursor-clicker-security", { body: nutzlast });
    if (r.error || (r.data && r.data.error)) {
      throw new Error((r.data && r.data.error) || "Die Anfrage kam nicht durch.");
    }
    return r.data;
  }

  function trade(id) {
    var liste = (schnappschuss && schnappschuss.trades) || [];
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }
  function gegenueber(t) {
    return t.initiator_id === ich.id
      ? { id: t.recipient_id, name: t.recipient_username, pid: t.recipient_player_id }
      : { id: t.initiator_id, name: t.initiator_username, pid: t.initiator_player_id };
  }
  function meineBestaetigung(t) {
    return t.initiator_id === ich.id ? t.initiator_confirmed_revision : t.recipient_confirmed_revision;
  }
  function offen(t) { return t.status === "draft" || t.status === "offered"; }

  // ---------- Wer ist da ----------

  function istBeschaeftigt(id) { return beschaeftigt.indexOf(id) !== -1; }

  function zeichneLeute() {
    el.leute.textContent = "";
    var andere = anwesend.filter(function (p) { return !ich || p.id !== ich.id; });

    if (!andere.length) {
      var allein = document.createElement("p");
      allein.className = "leer-hinweis";
      allein.textContent = verbunden
        ? "Gerade ist sonst niemand hier. Sobald jemand die Lounge öffnet, steht er hier."
        : "Verbinde …";
      el.leute.appendChild(allein);
      el.zaehler.textContent = verbunden ? anwesend.length + " online" : "verbinde …";
      return;
    }

    andere.forEach(function (p) {
      var busy = istBeschaeftigt(p.id);
      var zeile = document.createElement("div");
      zeile.className = "person";
      zeile.setAttribute("data-zustand", busy ? "beschaeftigt" : "frei");

      var punkt = document.createElement("span");
      punkt.className = "punkt";
      punkt.setAttribute("aria-hidden", "true");

      var mitte = document.createElement("div");
      var name = document.createElement("div"); name.className = "person-name"; name.textContent = p.name;
      var meta = document.createElement("div"); meta.className = "person-meta"; meta.textContent = p.pid;
      var zustand = document.createElement("div");
      zustand.className = "person-zustand";
      zustand.textContent = busy ? "im Trade" : "frei";
      mitte.appendChild(name); mitte.appendChild(meta); mitte.appendChild(zustand);

      var knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "btn mini" + (busy ? "" : " primary");
      knopf.textContent = busy ? "belegt" : "Trade";
      knopf.disabled = busy;
      if (!busy) knopf.addEventListener("click", function () { starteTrade(p, knopf); });

      zeile.appendChild(punkt); zeile.appendChild(mitte); zeile.appendChild(knopf);
      el.leute.appendChild(zeile);
    });
    el.zaehler.textContent = verbunden ? anwesend.length + " online" : "verbinde …";
  }

  // ---------- Deine Trades ----------

  function zeichneTrades() {
    el.trades.textContent = "";
    var liste = (schnappschuss && schnappschuss.trades) || [];
    if (!liste.length) {
      var leer = document.createElement("p");
      leer.className = "leer-hinweis";
      leer.textContent = "Noch keine Trades.";
      el.trades.appendChild(leer);
      return;
    }
    liste.slice(0, 12).forEach(function (t) {
      var g = gegenueber(t);
      var row = document.createElement("button");
      row.type = "button";
      row.className = "trade-row";
      var links = document.createElement("span"); links.textContent = g.name || "Unbekannt";
      var rechts = document.createElement("span");
      rechts.className = "status " + t.status;
      rechts.textContent = STATUS_TEXT[t.status] || t.status;
      row.appendChild(links); row.appendChild(rechts);
      row.addEventListener("click", function () { oeffneTrade(t.id); });
      el.trades.appendChild(row);
    });
  }

  // ---------- Ein Trade ----------

  function chip(behaelter, icon, text) {
    var c = document.createElement("span");
    c.className = "item-chip";
    c.textContent = (icon || "🖱️") + " " + text;
    behaelter.appendChild(c);
  }

  function zeichneTrade() {
    var t = trade(aktiveTradeId);
    if (!t) { zeigeLounge(); return; }
    var g = gegenueber(t);
    var meine = (t.items || []).filter(function (x) { return x.offeredBy === ich.id; });
    var ihre  = (t.items || []).filter(function (x) { return x.offeredBy !== ich.id; });

    el.titel.textContent = "Trade mit " + (g.name || "Unbekannt");
    el.status.className = "status " + t.status;
    el.status.textContent = STATUS_TEXT[t.status] || t.status;

    var teile = [g.pid, "Revision " + t.revision];
    if (t.status === "completed" && t.completed_at) {
      teile.push("abgeschlossen um " + new Date(t.completed_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } else if (offen(t) && t.expires_at) {
      var min = Math.max(0, Math.round((new Date(t.expires_at) - Date.now()) / 60000));
      teile.push("läuft noch " + min + " Minuten");
    }
    if (offen(t) && meineBestaetigung(t) === t.revision) teile.push("du hast bestätigt");
    el.meta.textContent = teile.join(" · ");

    el.mein.textContent = "";
    if (!meine.length) {
      var l1 = document.createElement("span"); l1.className = "muted";
      l1.textContent = "Noch nichts ausgewählt"; el.mein.appendChild(l1);
    }
    meine.forEach(function (x) { chip(el.mein, x.snapshot && x.snapshot.icon, (x.snapshot && x.snapshot.name) || "Cursor"); });

    el.ihr.textContent = "";
    if (!ihre.length) {
      var l2 = document.createElement("span"); l2.className = "muted";
      l2.textContent = "Noch nichts ausgewählt"; el.ihr.appendChild(l2);
    }
    ihre.forEach(function (x) { chip(el.ihr, x.snapshot && x.snapshot.icon, (x.snapshot && x.snapshot.name) || "Cursor"); });

    zeichneInventar(t, meine);

    var bearbeitbar = offen(t);
    el.speichern.disabled = !bearbeitbar;
    el.senden.disabled = t.status !== "draft";
    el.bestaetigen.disabled = t.status !== "offered" || meineBestaetigung(t) === t.revision;
    el.bestaetigen.textContent = meineBestaetigung(t) === t.revision
      ? "Bestätigt — warte auf Gegenseite" : "Bestätigen";
    el.abbrechen.disabled = !bearbeitbar;
    el.abbrechen.textContent = t.initiator_id === ich.id ? "Trade abbrechen" : "Trade ablehnen";
  }

  function zeichneInventar(t, meine) {
    el.inventar.textContent = "";
    var bestand = (schnappschuss && schnappschuss.inventory) || [];
    if (!bestand.length) {
      var leer = document.createElement("p");
      leer.className = "leer-hinweis";
      leer.textContent = "Du hast keine handelbaren Duplikate. Dafür muss dein alter Spielstand einmal importiert werden — das läuft über die Trading-Seite und eine Freigabe vom Owner.";
      el.inventar.appendChild(leer);
      return;
    }
    var gewaehlt = {};
    meine.forEach(function (x) { gewaehlt[x.itemId] = true; });

    bestand.forEach(function (i) {
      var d = i.item_data || {};
      // Gesperrt heisst: liegt in einem ANDEREN Trade. Im eigenen ist die
      // Sperre normal und darf abgewaehlt werden.
      var fremdGesperrt = i.trade_lock_id && i.trade_lock_id !== t.id;
      var label = document.createElement("label");
      label.className = "inventory-item" + (fremdGesperrt ? " locked" : "");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.value = i.id;
      box.checked = !!gewaehlt[i.id];
      box.disabled = fremdGesperrt || !offen(t);
      var icon = document.createElement("span"); icon.className = "item-icon"; icon.textContent = d.icon || "🖱️";
      var text = document.createElement("span");
      var stark = document.createElement("strong"); stark.textContent = d.name || i.catalog_id;
      var rar = document.createElement("div"); rar.className = "person-meta";
      rar.textContent = fremdGesperrt ? (d.rarity || "") + " · in einem anderen Trade" : (d.rarity || "");
      text.appendChild(stark); text.appendChild(rar);
      label.appendChild(box); label.appendChild(icon); label.appendChild(text);
      el.inventar.appendChild(label);
    });
  }

  // ---------- Laden und Ansichten ----------

  async function laden() {
    try {
      schnappschuss = await ruf("trading_snapshot");
      if (!(await zeigeImportWennNoetig())) return;
      zeichneTrades();
      if (aktiveTradeId) zeichneTrade();
    } catch (e) {
      fehler(e.message);
    }
  }

  // ---------- Import ----------
  //
  // Ohne aktives Trading-Inventar gibt es nichts anzubieten. Statt eine leere
  // Lounge zu zeigen, uebernimmt hier der Antrag. Rueckgabe: true, wenn das
  // Konto aktiv ist und die Lounge normal weiterlaufen darf.
  async function zeigeImportWennNoetig() {
    var aktiv = schnappschuss && schnappschuss.accountState === "active";
    el.importPanel.hidden = aktiv;
    el.loungeInhalt.hidden = !aktiv;
    // Der Einleitungstext beschreibt die Lounge. Solange die nicht zu sehen
    // ist, redet er ueber etwas, das gar nicht da ist.
    el.loungeIntro.hidden = !aktiv;
    if (aktiv) return true;

    var stand = null;
    try {
      var st = await ruf("status");
      stand = st && st.migration;
    } catch (e) {
      el.importStand.textContent = "Der Stand konnte gerade nicht geladen werden.";
      return false;
    }

    if (!stand) {
      el.importStand.textContent = "Noch kein Import beantragt.";
      el.importBeantragen.hidden = false;
      el.importAktivieren.hidden = true;
      return false;
    }

    var text = { pending: "Beantragt. Ein Owner schaut ihn sich an.",
                 approved: "Freigegeben. Du kannst den Import jetzt aktivieren.",
                 rejected: "Abgelehnt.",
                 imported: "Bereits importiert." }[stand.status] || ("Status: " + stand.status);
    if (stand.riskFlags && stand.riskFlags.length) {
      text += " · Prüfpunkte: " + stand.riskFlags.join(", ");
    }
    el.importStand.textContent = text;
    // Nach dem Antrag hilft ein zweiter Antrag niemandem.
    el.importBeantragen.hidden = stand.status === "pending" || stand.status === "approved";
    el.importAktivieren.hidden = stand.status !== "approved";
    return false;
  }

  async function starteTrade(p, knopf) {
    knopf.disabled = true;
    knopf.textContent = "…";
    try {
      var t = await ruf("create_trade", { targetId: p.id }, true);
      await laden();
      oeffneTrade(t.id);
      // Die Gegenseite ist diesem Trade-Kanal noch gar nicht beigetreten -
      // sie weiss ja nicht, dass es ihn gibt. Der Anstupser muss deshalb
      // ueber die Lounge laufen, sonst passiert bei ihr sichtbar nichts.
      if (kanal) {
        try {
          kanal.send({ type: "broadcast", event: "trade-neu",
                       payload: { fuer: p.id, von: ich.id, name: ich.name } });
        } catch (e) {}
      }
    } catch (e) {
      fehler(e.message);
      knopf.disabled = false;
      knopf.textContent = "Trade";
    }
  }

  function oeffneTrade(id) {
    aktiveTradeId = id;
    el.tradeChat.textContent = "";
    oeffneTradeKanal(id);
    zeichneTrade();
    el.lounge.hidden = true; el.trade.hidden = false;
    window.scrollTo(0, 0);
  }

  function zeigeLounge() {
    schliesseTradeKanal();
    aktiveTradeId = null;
    el.trade.hidden = true; el.lounge.hidden = false;
    window.scrollTo(0, 0);
  }

  /** Nach jeder Aenderung: neu laden und die Gegenseite anstupsen, damit sie
      es auch sieht, ohne auf einen Knopf zu druecken. */
  async function aendere(name, arbeit) {
    try {
      fehler("");
      await arbeit();
      await laden();
      melde(true);
    } catch (e) {
      fehler(e.message);
      await laden();
    }
  }

  function melde(auchGegenseite) {
    if (auchGegenseite && tradeKanal) {
      try { tradeKanal.send({ type: "broadcast", event: "trade", payload: { von: ich.id } }); } catch (e) {}
    }
  }

  // ---------- Chat zu einem Trade ----------

  function oeffneTradeKanal(id) {
    schliesseTradeKanal();
    tradeKanal = sb.channel("cc-trade-" + id, {
      config: { private: true, broadcast: { self: true } },
    });
    tradeKanal.on("broadcast", { event: "chat" }, function (n) {
      var p = n.payload || {};
      if (!p.text) return;
      var vonMir = p.id === ich.id;
      schreibe(el.tradeChat, vonMir ? "Du" : (p.name || "Unbekannt"),
               String(p.text).slice(0, MAX_ZEICHEN), vonMir ? "ich" : null);
    });
    // Die Gegenseite hat etwas geaendert - neu laden statt raten.
    tradeKanal.on("broadcast", { event: "trade" }, function (n) {
      if (n.payload && n.payload.von === ich.id) return;
      laden();
    });
    tradeKanal.subscribe(function (status, err) {
      if (status === "CHANNEL_ERROR") {
        schreibe(el.tradeChat, null,
          "Der Chat zu diesem Trade konnte nicht geöffnet werden" +
          (err && err.message ? " (" + err.message + ")" : "") + ".", "system");
      }
    });
  }

  function schliesseTradeKanal() {
    if (!tradeKanal) return;
    try { sb.removeChannel(tradeKanal); } catch (e) {}
    tradeKanal = null;
  }

  // ---------- Lounge-Kanal ----------

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
    beschaeftigt = busy;
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

    laden();

    kanal = sb.channel(TOPIC, {
      config: { private: true, presence: { key: ich.id }, broadcast: { self: true } },
    });
    kanal.on("presence", { event: "sync" }, ausPresence);
    kanal.on("broadcast", { event: "chat" }, function (n) {
      var p = n.payload || {};
      if (!p.text) return;
      var vonMir = p.id === ich.id;
      schreibe(el.loungeChat, vonMir ? "Du" : (p.name || "Unbekannt"),
               String(p.text).slice(0, MAX_ZEICHEN), vonMir ? "ich" : null);
    });

    // Jemand hat mir gerade einen Trade aufgemacht.
    kanal.on("broadcast", { event: "trade-neu" }, function (n) {
      var p = n.payload || {};
      if (!ich || p.fuer !== ich.id) return;
      laden();
      schreibe(el.loungeChat, null,
        (p.name || "Jemand") + " hat dir einen Trade aufgemacht — er steht links unter „Deine Trades\".",
        "system");
    });

    kanal.subscribe(async function (status, err) {
      if (status === "SUBSCRIBED") {
        verbunden = true;
        fehler("");
        await kanal.track({ id: ich.id, name: ich.name, pid: ich.pid, imTrade: false });
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
      try { kanal.untrack(); sb.removeChannel(kanal); schliesseTradeKanal(); } catch (e) {}
    });
  }

  // ---------- Verdrahtung ----------

  el.zurueck.addEventListener("click", zeigeLounge);

  el.speichern.addEventListener("click", function () {
    var ids = Array.prototype.slice.call(el.inventar.querySelectorAll("input:checked"))
      .map(function (i) { return i.value; });
    aendere("set_offer", function () { return ruf("set_offer", { tradeId: aktiveTradeId, itemIds: ids }, true); });
  });
  el.senden.addEventListener("click", function () {
    aendere("send_offer", function () { return ruf("send_offer", { tradeId: aktiveTradeId }, true); });
  });
  el.bestaetigen.addEventListener("click", function () {
    var t = trade(aktiveTradeId); if (!t) return;
    aendere("confirm_trade", function () {
      return ruf("confirm_trade", { tradeId: aktiveTradeId, revision: t.revision }, true);
    });
  });
  el.abbrechen.addEventListener("click", function () {
    var t = trade(aktiveTradeId); if (!t) return;
    if (!window.confirm("Diesen Trade wirklich beenden?")) return;
    aendere("close_trade", function () {
      return ruf("close_trade", { tradeId: aktiveTradeId, mode: t.initiator_id === ich.id ? "cancel" : "decline" }, true);
    });
  });

  function chatAbsenden(e, eingabe, behaelter, welcherKanal) {
    e.preventDefault();
    var text = eingabe.value.trim().slice(0, MAX_ZEICHEN);
    var k = welcherKanal();
    if (!text || !k || !ich) return;
    if (Date.now() - zuletztGesendet < MIN_ABSTAND_MS) return;
    zuletztGesendet = Date.now();
    eingabe.value = "";
    // Kein oertliches Anzeigen: Die Nachricht kommt ueber den Kanal zurueck
    // (broadcast.self). Erscheint sie, ist sie wirklich draussen gewesen.
    k.send({ type: "broadcast", event: "chat", payload: { text: text, name: ich.name, id: ich.id } })
      .then(function (antwort) { if (antwort !== "ok") throw new Error(String(antwort)); })
      .catch(function () {
        schreibe(behaelter, null,
          "Deine Nachricht kam nicht an. Steht oben ein roter Hinweis? Sonst hilft neu laden.", "system");
        eingabe.value = text;   // nicht wegwerfen, was jemand getippt hat
      });
  }
  el.loungeForm.addEventListener("submit", function (e) {
    chatAbsenden(e, el.loungeEingabe, el.loungeChat, function () { return kanal; });
  });
  el.tradeForm.addEventListener("submit", function (e) {
    chatAbsenden(e, el.tradeEingabe, el.tradeChat, function () { return tradeKanal; });
  });

  el.importBeantragen.addEventListener("click", async function () {
    el.importBeantragen.disabled = true;
    try {
      await ruf("request_legacy_migration", {}, true);
      // Bewusst KEINE Selbstfreigabe fuer Owner. Im Testbereich gab es die,
      // damit man schnell durchkam -- sie umgeht aber genau die Pruefung, in
      // der der Owner die Items sieht, bevor sie entstehen.
      el.importStand.textContent = "Beantragt. Ein Owner schaut ihn sich an.";
      await laden();
    } catch (e) {
      fehler(e.message);
    } finally {
      el.importBeantragen.disabled = false;
    }
  });

  el.importAktivieren.addEventListener("click", async function () {
    el.importAktivieren.disabled = true;
    try {
      await ruf("activate_trading", {}, true);
      await laden();
    } catch (e) {
      fehler(e.message);
    } finally {
      el.importAktivieren.disabled = false;
    }
  });

  zeichneLeute();
  start();
})();
