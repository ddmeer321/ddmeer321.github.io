// Zeigt das Ergebnis der freiwilligen Sicherheitsprüfung nach der
// Registrierung (siehe assets/js/login.js). Das Ergebnis kommt ausschließlich
// über sessionStorage an und wird sofort nach dem Lesen wieder entfernt —
// diese Seite ist bewusst nur "einmal ansehbar", kein dauerhaftes Archiv.
(function () {
  var sb = window.supabaseClient;

  var raw = null;
  try {
    raw = window.sessionStorage.getItem("security-check-result");
    window.sessionStorage.removeItem("security-check-result");
  } catch (e) {
    /* kein sessionStorage verfuegbar -> unten "kein Ergebnis" zeigen */
  }

  var emptyEl = document.getElementById("security-empty");
  var resultEl = document.getElementById("security-result");

  // "weiter" ist nur ein Dateiname (index.html), keine sensiblen Daten -
  // unbedenklich als Query-Parameter, anders als das Pruefergebnis selbst.
  var params = new URLSearchParams(window.location.search);
  var continueTarget = params.get("weiter");
  var continueLinks = document.querySelectorAll(".security-continue-link");
  if (continueTarget && /^[a-zA-Z0-9_-]+\.html$/.test(continueTarget)) {
    continueLinks.forEach(function (a) { a.href = continueTarget; });
  }

  var data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
  }

  if (!data) {
    emptyEl.hidden = false;
    return;
  }

  resultEl.hidden = false;

  // Bei der Registrierung mit E-Mail steht auf der Login-Seite noch der
  // Hinweis auf die Bestaetigungsmail. Wer von dort hierher wechselt, wuerde
  // ihn sonst nie sehen - deshalb wandert er mit.
  if (data.hinweis) {
    var hinweisEl = document.getElementById("security-hinweis");
    if (hinweisEl) {
      hinweisEl.textContent = data.hinweis;
      hinweisEl.hidden = false;
    }
  }

  var leakText = document.getElementById("security-leak-text");
  var strengthText = document.getElementById("security-strength-text");
  var strengthFill = document.getElementById("security-strength-fill");
  var summary = document.getElementById("security-summary");

  var leak = data.leak || {};
  var leakOk = !leak.error && !leak.found;
  var leakBad = !leak.error && leak.found;

  if (leak.error) {
    leakText.textContent = "Die Prüfung konnte gerade nicht durchgeführt werden (z. B. keine Verbindung).";
  } else if (leakBad) {
    leakText.textContent =
      "Dieses Passwort wurde in bekannten Datenlecks gefunden (" +
      (leak.count || 0).toLocaleString("de-DE") +
      "-mal). Bitte wähle ein anderes Passwort.";
    leakText.classList.add("is-bad");
  } else if (leakOk) {
    leakText.textContent = "Nicht in bekannten Datenlecks gefunden.";
    leakText.classList.add("is-ok");
  }

  var scoreLabels = ["sehr schwach", "schwach", "okay", "stark", "sehr stark"];
  var strength = data.strength || {};
  var strengthGood = false;
  var strengthLow = false;
  if (strength.error) {
    strengthText.textContent = "Die Einschätzung konnte gerade nicht berechnet werden.";
  } else if (typeof strength.score === "number") {
    strengthText.textContent =
      "Einschätzung: " +
      (scoreLabels[strength.score] || "—") +
      " (geschätzte Zeit zum Erraten: " +
      strength.crackTime +
      ")";
    strengthFill.style.width = ((strength.score + 1) / 5) * 100 + "%";
    strengthFill.dataset.score = String(strength.score);
    strengthGood = strength.score >= 3;
    strengthLow = strength.score < 3;
  }

  if (leakOk && strengthGood) {
    summary.textContent = "Gute Nachricht! Dein Passwort wird in naher Zeit wahrscheinlich nicht so einfach geknackt. 😏🤩";
    summary.classList.add("is-ok");
  } else if (leakBad) {
    summary.textContent = "Dieses Passwort solltest du besser bald ändern.";
    summary.classList.add("is-bad");
  } else {
    summary.textContent = "Hier ist dein Ergebnis:";
  }

  // Bei einem geleakten oder schwachen Passwort bekommt der Nutzer zusaetzlich
  // zum blossen "Weiter" auch eine direkte Moeglichkeit, das Passwort jetzt zu
  // aendern - inklusive einer expliziten, jederzeit erreichbaren Ablehnen-
  // Option ("Trotzdem fortfahren"), statt nur einem einzelnen Weiter-Link.
  var showFix = leakBad || strengthLow;
  if (showFix) {
    var defaultActions = document.getElementById("security-actions-default");
    var fixBlock = document.getElementById("security-actions-fix");
    if (defaultActions) defaultActions.hidden = true;
    if (fixBlock) fixBlock.hidden = false;
    setupFix();
  }

  function setupFix() {
    var fixStartBtn = document.getElementById("security-fix-start");
    var fixHint = document.getElementById("security-fix-hint");
    var fixForm = document.getElementById("security-fix-form");
    var fixPasswordInput = document.getElementById("security-fix-password");
    var fixMessage = document.getElementById("security-fix-message");
    if (!fixStartBtn || !fixForm || !fixPasswordInput) return;

    document.querySelectorAll("#security-actions-fix .login-toggle-pw").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-target"));
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.textContent = showing ? "👁" : "🙈";
        btn.setAttribute("aria-label", showing ? "Passwort anzeigen" : "Passwort verstecken");
      });
    });

    // Dieselben Regeln wie bei Registrierung und Zuruecksetzen, aus
    // assets/js/password-rules.js. Vorher standen sie hier ein zweites Mal.
    var regeln = window.PasswortRegeln;
    function passwordValid(pw) { return regeln.gueltig(pw); }
    regeln.verdrahten("security-fix-password", "security-fix-rules");

    fixStartBtn.addEventListener("click", async function () {
      fixHint.className = "login-message";
      if (!sb) {
        fixHint.textContent = "Passwortänderung ist gerade nicht verfügbar. Bitte versuche es später über \"Passwort vergessen?\" auf der Login-Seite.";
        return;
      }
      fixStartBtn.disabled = true;
      var hasSession = false;
      try {
        var sessionRes = await sb.auth.getSession();
        hasSession = !!(sessionRes && sessionRes.data && sessionRes.data.session);
      } catch (e) {
        hasSession = false;
      }
      if (!hasSession) {
        fixHint.className = "login-message info";
        fixHint.textContent =
          "Du bist noch nicht eingeloggt — das ist erst nach Bestätigung deiner Registrierung möglich. " +
          "Melde dich danach an und nutze \"Passwort vergessen?\" auf der Login-Seite, um ein neues Passwort zu setzen.";
        fixStartBtn.disabled = false;
        return;
      }
      fixStartBtn.hidden = true;
      fixHint.textContent = "";
      fixForm.hidden = false;
      fixPasswordInput.focus();
    });

    fixForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var pw = fixPasswordInput.value;
      fixMessage.textContent = "";
      fixMessage.className = "login-message";
      if (!passwordValid(pw)) {
        fixMessage.textContent = "Bitte alle Passwort-Anforderungen erfüllen.";
        return;
      }
      var submitBtn = fixForm.querySelector(".login-submit");
      submitBtn.disabled = true;
      try {
        var res = await sb.auth.updateUser({ password: pw });
        if (res.error) {
          fixMessage.textContent = "Konnte Passwort nicht speichern. Bitte versuche es erneut.";
          return;
        }
        fixMessage.textContent = "Neues Passwort gespeichert!";
        fixMessage.className = "login-message ok";
        fixForm.reset();
        regeln.zuruecksetzen("security-fix-rules");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();
