// Cloudflare Turnstile fuer das Registrierungsformular.
//
// STAND 29.08.2026: Der Sitekey ist eingetragen, das Widget erscheint also.
// Das Supabase-Secret `TURNSTILE_SECRET_KEY` fehlt aber noch, deshalb prueft
// der Server das Token bisher NICHT - er nimmt jede Registrierung an, auch
// eine ohne gueltiges Token. Erst das Secret macht die Pruefung scharf.
//
// Der Sitekey ist oeffentlich, er gehoert in den Browser. Der SECRET KEY
// gehoert NICHT hierher, sondern zur Edge Function `register-with-username`.
//
// AUSSCHALTEN: hier einen Wert eintragen, der mit "HIER_" beginnt (oder das
// Feld leeren) - dann wird kein fremdes Skript geladen, kein Widget
// gezeichnet, und die Registrierung laeuft wie vor dem Einbau.
//
// REIHENFOLGE: erst der Sitekey hier, dann das Supabase-Secret. Andersherum
// wuerde der Server ein Token verlangen, das der Browser noch nicht
// mitschickt.
//
// WAS GESCHUETZT IST: der Weg "Konto ohne E-Mail" - der laeuft ueber unsere
// eigene Edge Function, dort koennen wir das Token pruefen. Die Registrierung
// MIT E-Mail geht direkt an Supabase Auth an uns vorbei; die liesse sich nur
// ueber Supabases eigenen Captcha-Schalter schuetzen, und der wuerde auch den
// Login erfassen (siehe AUTH-ADMIN.md im Kontext-Repo).

(function () {
  var SITEKEY = "0x4AAAAAAEhNGAK51V2Z_34k";

  var SKRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var LADE_TIMEOUT_MS = 8000;
  // Breite des normalen Turnstile-Widgets laut Cloudflare.
  var NORMALE_BREITE = 300;

  // "aus"    kein Sitekey eingetragen - Turnstile spielt gar nicht mit
  // "laedt"  Skript unterwegs oder Widget noch ohne Antwort
  // "bereit" Widget steht und hat ein Token geliefert
  // "fehler" Skript nicht ladbar (Blocker, Netz, Cloudflare down)
  //
  // Der Unterschied zwischen "laedt"/"bereit" und "fehler" ist nicht Kosmetik:
  // ohne ihn bekaeme jemand mit Adblocker ewig "bitte Pruefung abschliessen"
  // fuer eine Pruefung, die es auf seinem Bildschirm gar nicht gibt.
  var zustand = "laedt";
  var widgetId = null;
  var ladePromise = null;

  function eingeschaltet() {
    return typeof SITEKEY === "string" && SITEKEY.indexOf("HIER_") !== 0 && SITEKEY.length > 0;
  }

  // Laedt das Cloudflare-Skript genau einmal. Scheitert es, bleibt das
  // Versprechen abgelehnt - haengen bleibt hier niemand, dafuer das Zeitlimit.
  function skriptLaden() {
    if (ladePromise) return ladePromise;
    ladePromise = new Promise(function (erfuellen, ablehnen) {
      var fertig = false;
      var uhr = window.setTimeout(function () {
        if (!fertig) { fertig = true; ablehnen(new Error("Turnstile-Timeout")); }
      }, LADE_TIMEOUT_MS);

      var s = document.createElement("script");
      s.src = SKRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = function () {
        if (fertig) return;
        fertig = true;
        window.clearTimeout(uhr);
        erfuellen();
      };
      s.onerror = function () {
        if (fertig) return;
        fertig = true;
        window.clearTimeout(uhr);
        ablehnen(new Error("Turnstile nicht ladbar"));
      };
      document.head.appendChild(s);
    });
    return ladePromise;
  }

  /**
   * Zeichnet das Widget in den uebergebenen Container.
   * Tut nichts, wenn kein Sitekey eingetragen ist.
   */
  function rendern(container) {
    if (!eingeschaltet() || !container) return;
    skriptLaden()
      .then(function () {
        if (!window.turnstile) throw new Error("turnstile fehlt");
        container.hidden = false;
        widgetId = window.turnstile.render(container, {
          sitekey: SITEKEY,
          // Das normale Widget ist fest 300 px breit. Das Login-Formular ist
          // auf einem 390-px-Handy aber nur 292 px breit und auf 320 px sogar
          // nur 222 px - dort wuerde es seitlich abgeschnitten. Deshalb die
          // Groesse an der TATSAECHLICHEN Containerbreite entscheiden, nicht
          // an window.innerWidth: gemessen wird der Platz, den es wirklich
          // hat. Die kompakte Variante ist 150 px breit und passt ueberall.
          size: container.clientWidth >= NORMALE_BREITE ? "normal" : "compact",
          // "auto": ein abgelaufenes Token wird von selbst erneuert. Zwischen
          // Absenden und dem eigentlichen Anlegen liegt der freiwillige
          // Passwort-Check - ohne das koennte das Token dabei veralten.
          "refresh-expired": "auto",
          theme: "light",
          language: "de",
          callback: function () { zustand = "bereit"; },
          "error-callback": function () { zustand = "fehler"; },
        });
      })
      .catch(function () {
        // Kein Widget, kein Token. Der Kasten bleibt leer, damit dort kein
        // toter Rahmen steht - die Meldung kommt aus login.js, wenn jemand
        // tatsaechlich absendet.
        zustand = "fehler";
        widgetId = null;
        container.hidden = true;
      });
  }

  /** Aktuelles Token oder "" - nie null, damit der Aufrufer nicht pruefen muss. */
  function token() {
    if (!eingeschaltet() || !window.turnstile || widgetId === null) return "";
    try {
      return window.turnstile.getResponse(widgetId) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Nach jedem Registrierungsversuch aufrufen: ein Token ist einmalig, ein
   * zweiter Anlauf braucht ein frisches.
   */
  function zuruecksetzen() {
    if (!window.turnstile || widgetId === null) return;
    zustand = "laedt";
    try {
      window.turnstile.reset(widgetId);
    } catch (e) {
      /* Widget schon weg - dann gibt es beim naechsten Versuch eben keins */
    }
  }

  /** "aus" | "laedt" | "bereit" | "fehler" */
  function status() {
    if (!eingeschaltet()) return "aus";
    if (zustand === "fehler") return "fehler";
    return token() ? "bereit" : "laedt";
  }

  window.TurnstileWidget = {
    eingeschaltet: eingeschaltet,
    status: status,
    rendern: rendern,
    token: token,
    zuruecksetzen: zuruecksetzen,
  };
})();
