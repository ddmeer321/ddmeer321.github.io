// Zugangspruefung der Trading-Lounge.
//
// Die Seite bleibt versteckt (siehe <style> im Kopf der index.html), bis hier
// entschieden ist, ob jemand rein darf. Ohne das blitzt die Lounge kurz auf,
// bevor die Sperre greift.
//
// GEPRUEFT WIRD SERVERSEITIG, ueber cc_darf_in_die_lounge(). Das ist dieselbe
// Funktion, an der auch die RLS-Regeln auf realtime.messages haengen -- es gibt
// also genau EINE Stelle, die entscheidet, wer Zugang hat. Wenn der Gate-
// Schalter umgelegt wird (supabase/geplant/01_...), zieht diese Seite ohne
// Aenderung mit.
//
// Wichtig: Das hier ist Bequemlichkeit, keine Sicherheit. Wer die Pruefung im
// Browser umgeht, sieht ein leeres Gehaeuse -- die Kanaele und jede Aktion
// haengen an denselben Serverregeln und antworten ihm nicht.

(function () {
  "use strict";

  function sperre(titel, text, knopf) {
    document.body.innerHTML = "";
    var kasten = document.createElement("div");
    kasten.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;" +
      "background:#080a10;color:#eef0f6;padding:24px;" +
      "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;";
    kasten.innerHTML =
      '<div style="max-width:440px;width:100%;text-align:center;padding:32px;' +
      'border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#111520;">' +
      '<h1 style="margin:0 0 12px;font-size:1.4rem;">' + titel + "</h1>" +
      '<p style="margin:0 0 22px;color:#9aa0b4;line-height:1.6;">' + text + "</p>" +
      '<a href="' + knopf.ziel + '" style="display:inline-flex;padding:11px 22px;border-radius:10px;' +
      'background:#6d8bff;color:#0b0d12;font-weight:700;text-decoration:none;">' + knopf.text + "</a>" +
      "</div>";
    document.body.appendChild(kasten);
    document.documentElement.style.visibility = "visible";
  }

  (async function pruefen() {
    var sb = window.supabaseClient;
    if (!sb) {
      sperre(
        "Nicht geladen",
        "Das Anmeldesystem konnte nicht geladen werden. Bitte lade die Seite neu.",
        { text: "Zurück zum Spiel", ziel: "../" }
      );
      return;
    }

    var sitzung = await sb.auth.getSession();
    if (!(sitzung.data && sitzung.data.session)) {
      sperre(
        "Anmeldung nötig",
        "Die Trading-Lounge zeigt dir andere Spielerinnen und Spieler — dafür musst du angemeldet sein.",
        { text: "Anmelden", ziel: "/login.html" }
      );
      return;
    }

    var antwort = await sb.rpc("cc_darf_in_die_lounge");
    if (antwort.error) {
      sperre(
        "Gerade nicht erreichbar",
        "Der Zugang konnte nicht geprüft werden. Bitte versuch es gleich nochmal.",
        { text: "Zurück zum Spiel", ziel: "../" }
      );
      return;
    }
    if (antwort.data !== true) {
      sperre(
        "Noch nicht freigeschaltet",
        "Trading ist noch nicht für alle offen. Sobald dein Inventar freigegeben ist, kommst du hier rein.",
        { text: "Zurück zum Spiel", ziel: "../" }
      );
      return;
    }

    document.documentElement.style.visibility = "visible";
  })();
})();
