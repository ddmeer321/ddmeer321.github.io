// Die Passwort-Anforderungen — an EINER Stelle.
//
// Vorher standen dieselben fünf Regeln zweimal im Code: in login.js für
// Registrierung und Zurücksetzen, und noch einmal in security-check.js für
// „Passwort jetzt ändern". Sie waren zeichengleich, aber nichts hielt sie
// zusammen: Wer eine davon ändert, bekommt zwei Formulare, die
// unterschiedliche Passwörter akzeptieren — und merkt es nicht, weil beide
// für sich funktionieren.
//
// Die Liste im HTML gehört dazu: Jedes <li> trägt ein data-rule, das genau
// einem Schlüssel hier unten entspricht. Eine neue Regel braucht deshalb
// beides — den Eintrag hier und ein <li data-rule="..."> in jedem Formular.
//
// Einfaches Skript, kein Modul: login.html und security-check.html laden es
// als normales <script> vor den Dateien, die es benutzen.

(function () {
  var REGELN = {
    length:  function (pw) { return pw.length >= 8; },
    upper:   function (pw) { return /[A-Z]/.test(pw); },
    lower:   function (pw) { return /[a-z]/.test(pw); },
    digit:   function (pw) { return /[0-9]/.test(pw); },
    special: function (pw) { return /[^A-Za-z0-9]/.test(pw); },
  };

  /** Welche Regeln erfüllt dieses Passwort? -> { length: true, upper: false, … } */
  function pruefen(pw) {
    var s = pw == null ? "" : String(pw);
    var ergebnis = {};
    Object.keys(REGELN).forEach(function (name) { ergebnis[name] = REGELN[name](s); });
    return ergebnis;
  }

  /** Erfüllt es ALLE? */
  function gueltig(pw) {
    var e = pruefen(pw);
    return Object.keys(e).every(function (name) { return e[name]; });
  }

  /**
   * Hängt die Live-Anzeige an ein Passwortfeld: Beim Tippen bekommt jedes
   * <li data-rule="..."> in der Liste die Klasse "ok", sobald seine Regel
   * erfüllt ist.
   */
  function verdrahten(inputId, listId) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId);
    if (!input || !list) return;
    input.addEventListener("input", function () {
      var ergebnis = pruefen(input.value);
      Object.keys(ergebnis).forEach(function (name) {
        var li = list.querySelector('[data-rule="' + name + '"]');
        if (li) li.classList.toggle("ok", ergebnis[name]);
      });
    });
  }

  /** Setzt die Häkchen zurück, z.B. nachdem ein Formular geleert wurde. */
  function zuruecksetzen(listId) {
    var list = document.getElementById(listId);
    if (!list) return;
    list.querySelectorAll("li").forEach(function (li) { li.classList.remove("ok"); });
  }

  window.PasswortRegeln = {
    pruefen: pruefen,
    gueltig: gueltig,
    verdrahten: verdrahten,
    zuruecksetzen: zuruecksetzen,
  };
})();
