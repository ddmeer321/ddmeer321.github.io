(function () {
  var sb = window.supabaseClient;
  if (!sb) return;

  var els = {
    tabRegister: document.getElementById("tab-register"),
    tabLogin: document.getElementById("tab-login"),
    registerForm: document.getElementById("register-form"),
    loginForm: document.getElementById("login-form"),
    forgotForm: document.getElementById("forgot-form"),
    resetForm: document.getElementById("reset-form"),
  };

  var allForms = [els.registerForm, els.loginForm, els.forgotForm, els.resetForm];

  function showForm(form) {
    allForms.forEach(function (f) { f.classList.toggle("hidden", f !== form); });
  }

  function setTab(tab) {
    els.tabRegister.classList.toggle("active", tab === "register");
    els.tabLogin.classList.toggle("active", tab === "login");
    els.tabRegister.setAttribute("aria-selected", String(tab === "register"));
    els.tabLogin.setAttribute("aria-selected", String(tab === "login"));
    showForm(tab === "register" ? els.registerForm : els.loginForm);
  }

  els.tabRegister.addEventListener("click", function () { setTab("register"); });
  els.tabLogin.addEventListener("click", function () { setTab("login"); });

  document.querySelectorAll(".login-toggle-pw").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-target"));
      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁" : "🙈";
      btn.setAttribute("aria-label", showing ? "Passwort anzeigen" : "Passwort verstecken");
    });
  });

  // Die Regeln stehen in assets/js/password-rules.js - eine Quelle fuer
  // Registrierung, Zuruecksetzen und "Passwort jetzt aendern".
  var regeln = window.PasswortRegeln;
  function passwordValid(pw) { return regeln.gueltig(pw); }
  regeln.verdrahten("reg-password", "reg-password-rules");
  regeln.verdrahten("reset-password", "reset-password-rules");

  var USERNAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9!"#$%&'()*+,\-./:;<=>?[\]^_`{|}~]{4,12}$/;

  function wireUsernameCheck(inputId, hintId) {
    var input = document.getElementById(inputId);
    var hint = document.getElementById(hintId);
    if (!input || !hint) return function () { return false; };
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var value = input.value.trim();
      if (!value) { hint.textContent = ""; hint.className = "login-hint"; return; }
      if (!USERNAME_RE.test(value)) {
        hint.textContent = "4–12 Zeichen, keine Leerzeichen/Emojis.";
        hint.className = "login-hint bad";
        return;
      }
      hint.textContent = "Prüfe Verfügbarkeit …";
      hint.className = "login-hint";
      timer = setTimeout(async function () {
        var res = await sb.rpc("username_available", { p_username: value });
        if (input.value.trim() !== value) return;
        var available = res.data;
        hint.textContent = available ? "Verfügbar" : "Bereits vergeben";
        hint.className = "login-hint " + (available ? "ok" : "bad");
      }, 350);
    });
    return function () { return USERNAME_RE.test(input.value.trim()); };
  }
  var regUsernameValid = wireUsernameCheck("reg-username", "reg-username-hint");

  function setMessage(id, text, ok) {
    var el = document.getElementById(id);
    el.textContent = text || "";
    el.className = "login-message" + (ok ? " ok" : "");
  }

  async function extractErrorMessage(res, fallback) {
    if (res.data && res.data.error) return res.data.error;
    if (res.error) {
      try {
        var ctx = res.error.context;
        if (ctx && typeof ctx.json === "function") {
          var body = await ctx.json();
          if (body && body.error) return body.error;
        }
      } catch (e) {}
    }
    return fallback;
  }

  function redirectUrl() {
    return window.location.origin + "/login.html";
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Zeitlimits. Beide Pruefungen laufen gleichzeitig, das Warten ist damit
  // nach etwa 5 Sekunden in jedem Fall vorbei.
  var HIBP_TIMEOUT_MS = 5000;
  var ZXCVBN_TIMEOUT_MS = 5000;
  var ZXCVBN_URL = "https://cdn.jsdelivr.net/npm/zxcvbn@4.4.2/dist/zxcvbn.js";

  // Ab dieser zxcvbn-Bewertung gilt ein Passwort als ausreichend (0-4).
  var STAERKE_OK_AB = 3;

  // --- Freiwillige Sicherheitsprüfung nach der Registrierung ---------------
  // (ROADMAP.md: "Passwort-Leak-Prüfung ... k-Anonymität"). Laeuft NUR wenn
  // der Nutzer zustimmt. Das Klartextpasswort verlaesst dabei nie das Geraet:
  // nur die ersten 5 Zeichen des SHA-1-Hashes gehen an die HIBP-API, der Rest
  // wird lokal verglichen (https://haveibeenpwned.com/API/v3#PwnedPasswords).
  // SHA-1 wird nirgends gespeichert, nur kurzzeitig im Speicher berechnet.
  async function checkPasswordLeak(password) {
    var bytes = new TextEncoder().encode(password);
    var digest = await crypto.subtle.digest("SHA-1", bytes);
    var hex = Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join("")
      .toUpperCase();
    var prefix = hex.slice(0, 5);
    var suffix = hex.slice(5);
    // Ohne Zeitlimit bleibt eine haengende Verbindung ewig offen - und
    // weil waehrenddessen beide Knoepfe gesperrt sind, saesse der Nutzer
    // fest, ohne pruefen und ohne ueberspringen zu koennen.
    var abbruch = new AbortController();
    var uhr = setTimeout(function () { abbruch.abort(); }, HIBP_TIMEOUT_MS);
    var res;
    try {
      res = await fetch("https://api.pwnedpasswords.com/range/" + prefix, { signal: abbruch.signal });
    } finally {
      clearTimeout(uhr);
    }
    if (!res.ok) throw new Error("HIBP-Anfrage fehlgeschlagen");
    var text = await res.text();
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(":");
      if (parts[0] && parts[0].trim() === suffix) {
        return { found: true, count: parseInt(parts[1], 10) || 0 };
      }
    }
    return { found: false, count: 0 };
  }

  // zxcvbn wird erst geholt, wenn jemand der Pruefung zustimmt. Vorher lud
  // es jeder Besucher der Anmeldeseite mit - ein fremdes Skript direkt neben
  // den Passwortfeldern, fuer eine Funktion, die die meisten nie ausloesen.
  //
  // Auch hier ein Zeitlimit: Ist das CDN langsam oder blockiert, gibt es
  // eben keine Staerke-Einschaetzung, aber niemand wartet ewig.
  function ladeZxcvbn() {
    if (typeof window.zxcvbn === "function") return Promise.resolve(true);
    return new Promise(function (fertig) {
      var erledigt = false;
      function ende(ok) { if (!erledigt) { erledigt = true; fertig(ok); } }
      var uhr = setTimeout(function () { ende(false); }, ZXCVBN_TIMEOUT_MS);
      var tag = document.createElement("script");
      tag.src = ZXCVBN_URL;
      tag.async = true;
      tag.onload = function () { clearTimeout(uhr); ende(typeof window.zxcvbn === "function"); };
      tag.onerror = function () { clearTimeout(uhr); ende(false); };
      document.head.appendChild(tag);
    });
  }

  // Schaetzt lokal, wie leicht das Passwort zu erraten waere (Muster,
  // gaengige Woerter, Tastatur-Sequenzen, ...) - keine Netzwerk-Anfrage dafuer.
  function estimatePasswordStrength(password) {
    if (typeof window.zxcvbn !== "function") return { error: true };
    var result = window.zxcvbn(password);
    return {
      score: result.score,
      crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    };
  }

  // --- Ablauf der Registrierung ------------------------------------------
  //
  // Reihenfolge ist Absicht: erst fragen, dann pruefen, DANN das Konto
  // anlegen. Frueher lief die Pruefung danach - wer ein geleaktes Passwort
  // gewaehlt hatte, erfuhr es, wenn das Konto damit schon existierte. Als
  // Schutz taugte das wenig.
  //
  //   Absenden -> Einwilligung  --nein-->  registrieren
  //                     |
  //                     ja
  //                     v
  //               pruefen (max. ~5 s)
  //                     |
  //          +----------+----------+
  //          |                     |
  //    sauber -> registrieren   auffaellig -> Warnung
  //                                            |
  //                              anderes Passwort <-> trotzdem fortfahren

  var panel = {
    box: document.getElementById("security-offer"),
    frage: document.getElementById("security-offer-ask"),
    warnung: document.getElementById("security-offer-warn"),
    warnText: document.getElementById("security-warn-text"),
    ja: document.getElementById("security-offer-yes"),
    nein: document.getElementById("security-offer-no"),
    anders: document.getElementById("security-warn-change"),
    trotzdem: document.getElementById("security-warn-anyway"),
    meldung: document.getElementById("security-offer-message"),
  };

  var regSubmitBtn = els.registerForm.querySelector(".login-submit");

  // Huellen um TurnstileWidget: die Datei kann fehlen (eigene Kopien der
  // Seite, Blocker), und dann soll die Registrierung trotzdem laufen statt
  // an einem ReferenceError zu sterben.
  function turnstileAktiv() {
    return !!(window.TurnstileWidget && window.TurnstileWidget.eingeschaltet());
  }
  function turnstileToken() {
    return turnstileAktiv() ? window.TurnstileWidget.token() : "";
  }
  function turnstileZuruecksetzen() {
    if (turnstileAktiv()) window.TurnstileWidget.zuruecksetzen();
  }
  /**
   * Meldung, wenn ohne brauchbares Token abgesendet wird - oder "", wenn
   * alles in Ordnung ist. Der Fehlerfall bekommt bewusst einen eigenen Text:
   * "bitte abschliessen" waere fuer jemanden mit Blocker eine Sackgasse,
   * weil auf seinem Bildschirm gar keine Pruefung steht.
   */
  function turnstileHinderung() {
    if (!turnstileAktiv()) return "";
    var zustand = window.TurnstileWidget.status();
    if (zustand === "bereit") return "";
    if (zustand === "fehler") {
      return "Die Sicherheitsprüfung konnte nicht geladen werden. Bitte Blocker für diese Seite erlauben — oder eine E-Mail-Adresse angeben, dann geht es auch ohne.";
    }
    return "Die Sicherheitsprüfung läuft noch. Bitte einen Moment warten und dann erneut auf Konto erstellen tippen.";
  }
  if (turnstileAktiv()) window.TurnstileWidget.rendern(document.getElementById("turnstile-box"));

  function panelZu() {
    if (panel.box) panel.box.classList.add("hidden");
    if (panel.frage) panel.frage.hidden = false;
    if (panel.warnung) panel.warnung.hidden = true;
    if (panel.meldung) { panel.meldung.textContent = ""; panel.meldung.className = "login-message"; }
    [panel.ja, panel.nein, panel.anders, panel.trotzdem].forEach(function (b) {
      if (b) { b.disabled = false; b.hidden = false; }
    });
  }

  function panelMeldung(text, klasse) {
    if (!panel.meldung) return;
    panel.meldung.textContent = text || "";
    panel.meldung.className = "login-message" + (klasse ? " " + klasse : "");
  }

  /** Liest das Formular und prueft es. null, wenn etwas fehlt. */
  function registrierungsDaten() {
    var username = document.getElementById("reg-username").value.trim();
    var password = document.getElementById("reg-password").value;
    var email = document.getElementById("reg-email").value.trim();
    setMessage("register-message", "");

    if (!regUsernameValid()) {
      setMessage("register-message", "Bitte einen gültigen Benutzernamen wählen (4–12 Zeichen, keine Leerzeichen/Emojis).");
      return null;
    }
    if (!passwordValid(password)) {
      setMessage("register-message", "Bitte alle Passwort-Anforderungen erfüllen.");
      return null;
    }
    if (email && !EMAIL_RE.test(email)) {
      setMessage("register-message", "Bitte eine gültige E-Mail-Adresse eingeben oder das Feld leer lassen.");
      return null;
    }
    return { username: username, password: password, email: email };
  }

  /**
   * Beide Pruefungen gleichzeitig, jede mit eigenem Zeitlimit. Wirft nie -
   * ein Fehlschlag kommt als { error: true } zurueck, damit der Ablauf
   * weiterlaeuft, statt haengenzubleiben.
   */
  async function passwortPruefen(password) {
    var beides = await Promise.all([
      checkPasswordLeak(password).catch(function () { return { error: true }; }),
      ladeZxcvbn()
        .then(function (da) { return da ? estimatePasswordStrength(password) : { error: true }; })
        .catch(function () { return { error: true }; }),
    ]);
    return { checkedAt: new Date().toISOString(), leak: beides[0], strength: beides[1] };
  }

  function istAuffaellig(ergebnis) {
    var leak = ergebnis.leak || {};
    var st = ergebnis.strength || {};
    if (leak.found) return true;
    return typeof st.score === "number" && st.score < STAERKE_OK_AB;
  }

  /** Legt das Konto an. `ergebnis` ist null, wenn nicht geprueft wurde. */
  async function registrieren(daten, ergebnis) {
    panelZu();
    regSubmitBtn.disabled = true;
    try {
      if (daten.email) {
        var signUpRes = await sb.auth.signUp({
          email: daten.email,
          password: daten.password,
          options: { data: { username: daten.username, has_recovery_email: true }, emailRedirectTo: redirectUrl() },
        });
        if (signUpRes.error) {
          setMessage("register-message", signUpRes.error.message.indexOf("already registered") !== -1 ? "Diese E-Mail wird bereits verwendet." : "Registrierung fehlgeschlagen. Bitte erneut versuchen.");
          return;
        }
        var hinweis = "Fast fertig! Wir haben dir eine Bestätigungsmail geschickt.";
        setMessage("register-message", hinweis, true);
        els.registerForm.reset();
        regeln.zuruecksetzen("reg-password-rules");
        document.getElementById("reg-username-hint").textContent = "";
        // Der Hinweis wandert mit auf die Ergebnisseite - sonst geht er beim
        // Wechsel verloren, und die Bestaetigungsmail ist genau das, worauf
        // der Nutzer als Naechstes achten muss.
        if (ergebnis) zurErgebnisseite(ergebnis, null, hinweis);
        return;
      }

      var regRes = await sb.functions.invoke("register-with-username", {
        body: {
          username: daten.username,
          password: daten.password,
          // Leer, solange in turnstile.js kein Sitekey steht. Die Edge
          // Function verlangt das Token nur, wenn dort ein Secret hinterlegt
          // ist - beide Seiten schalten sich also selbst ab.
          turnstileToken: turnstileToken(),
        },
      });
      // Ein Token ist einmalig. Egal wie es ausging: der naechste Anlauf
      // braucht ein frisches, sonst scheitert er an einem verbrauchten.
      turnstileZuruecksetzen();
      if (regRes.error) {
        setMessage("register-message", await extractErrorMessage(regRes, "Registrierung fehlgeschlagen."));
        return;
      }
      var loginRes = await sb.functions.invoke("login-with-username", { body: { identifier: daten.username, password: daten.password } });
      if (loginRes.error || !loginRes.data || !loginRes.data.session) {
        setMessage("register-message", "Konto erstellt! Bitte jetzt anmelden.", true);
        setTab("login");
        return;
      }
      suppressAutoRedirect = true;
      await sb.auth.setSession({
        access_token: loginRes.data.session.access_token,
        refresh_token: loginRes.data.session.refresh_token,
      });
      setMessage("register-message", "Konto erstellt!", true);
      if (ergebnis) zurErgebnisseite(ergebnis, "index.html", null);
      else window.location.href = "index.html";
    } finally {
      regSubmitBtn.disabled = false;
    }
  }

  function zurErgebnisseite(ergebnis, weiter, hinweis) {
    if (hinweis) ergebnis.hinweis = hinweis;
    try {
      window.sessionStorage.setItem("security-check-result", JSON.stringify(ergebnis));
    } catch (e) {
      /* Ergebnisseite zeigt dann eben "kein Ergebnis vorhanden" */
    }
    window.location.href = "security-check.html" + (weiter ? "?weiter=" + encodeURIComponent(weiter) : "");
  }

  function warnungZeigen(daten, ergebnis) {
    var leak = ergebnis.leak || {};
    var st = ergebnis.strength || {};
    var nurFehler = !!(leak.error && st.error);

    panel.frage.hidden = true;
    panel.warnung.hidden = false;
    panelMeldung("");

    if (nurFehler) {
      // Nichts gegen das Passwort in der Hand - dann waere "waehl ein
      // anderes" ein Rat ohne Grundlage.
      panel.warnText.textContent = "Die Prüfung war gerade nicht möglich (z. B. keine Verbindung). Du kannst dein Konto trotzdem anlegen.";
      panel.warnText.className = "login-message";
      panel.anders.hidden = true;
      panel.trotzdem.textContent = "Konto jetzt anlegen";
    } else {
      var teile = [];
      if (leak.found) {
        teile.push("Dieses Passwort steht in bekannten Datenlecks (" + (leak.count || 0).toLocaleString("de-DE") + "-mal).");
      }
      if (typeof st.score === "number" && st.score < STAERKE_OK_AB) {
        teile.push("Die Einschätzung sagt: leicht zu erraten.");
      }
      panel.warnText.textContent = teile.join(" ") + " Dein Konto ist noch nicht angelegt — du kannst jetzt noch ein anderes Passwort wählen.";
      panel.warnText.className = "login-message is-bad";
      panel.anders.hidden = false;
      panel.trotzdem.textContent = "Trotzdem fortfahren";
    }

    panel.anders.onclick = function () {
      panelZu();
      regSubmitBtn.disabled = false;
      setMessage("register-message", "");
      var feld = document.getElementById("reg-password");
      feld.value = "";
      regeln.zuruecksetzen("reg-password-rules");
      feld.focus();
    };
    panel.trotzdem.onclick = function () { registrieren(daten, ergebnis); };
  }

  els.registerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var daten = registrierungsDaten();
    if (!daten) return;

    // Nur der Weg OHNE E-Mail laeuft ueber unsere Edge Function, nur dort
    // wird das Token serverseitig geprueft. Deshalb auch nur dort darauf
    // bestehen - sonst blockiert eine Pruefung, die hinterher niemand
    // auswertet. Hier und nicht erst in registrieren(), damit der Hinweis
    // kommt, bevor sich das Panel oeffnet.
    if (!daten.email) {
      var hinderung = turnstileHinderung();
      if (hinderung) {
        setMessage("register-message", hinderung);
        return;
      }
    }

    // Formular sperren, solange das Panel offen ist - sonst laesst sich
    // zweimal absenden und es entstehen zwei Anlaeufe nebeneinander.
    regSubmitBtn.disabled = true;
    panelZu();
    panel.box.classList.remove("hidden");

    panel.nein.onclick = function () { registrieren(daten, null); };

    panel.ja.onclick = async function () {
      panel.ja.disabled = true;
      panel.nein.disabled = true;
      panelMeldung("Prüfe …");
      var ergebnis;
      try {
        ergebnis = await passwortPruefen(daten.password);
      } catch (err) {
        // passwortPruefen wirft eigentlich nicht; falls doch, darf der
        // Nutzer trotzdem nicht festsitzen.
        ergebnis = { checkedAt: new Date().toISOString(), leak: { error: true }, strength: { error: true } };
      }
      panelMeldung("");
      if (istAuffaellig(ergebnis) || (ergebnis.leak.error && ergebnis.strength.error)) {
        warnungZeigen(daten, ergebnis);
      } else {
        registrieren(daten, ergebnis);
      }
    };
  });

  els.loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var identifier = document.getElementById("login-identifier").value.trim();
    var password = document.getElementById("login-password").value;
    setMessage("login-message", "");
    if (!identifier || !password) {
      setMessage("login-message", "Bitte Benutzername/E-Mail und Passwort eingeben.");
      return;
    }
    var submitBtn = els.loginForm.querySelector(".login-submit");
    submitBtn.disabled = true;
    try {
      var res = await sb.functions.invoke("login-with-username", { body: { identifier: identifier, password: password } });
      if (res.error || !res.data || !res.data.session) {
        setMessage("login-message", await extractErrorMessage(res, "Anmeldung fehlgeschlagen."));
        return;
      }
      await sb.auth.setSession({
        access_token: res.data.session.access_token,
        refresh_token: res.data.session.refresh_token,
      });
      window.location.href = "index.html";
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("forgot-link").addEventListener("click", function () { showForm(els.forgotForm); });
  document.getElementById("forgot-back").addEventListener("click", function () { showForm(els.loginForm); });

  els.forgotForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("forgot-email").value.trim();
    setMessage("forgot-message", "");
    if (!EMAIL_RE.test(email)) {
      setMessage("forgot-message", "Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    setMessage("forgot-message", "Falls zu dieser Adresse ein Konto mit hinterlegter E-Mail existiert, haben wir einen Link zum Zurücksetzen geschickt.", true);
  });

  els.resetForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var pw = document.getElementById("reset-password").value;
    setMessage("reset-message", "");
    if (!passwordValid(pw)) {
      setMessage("reset-message", "Bitte alle Passwort-Anforderungen erfüllen.");
      return;
    }
    var { error } = await sb.auth.updateUser({ password: pw });
    if (error) {
      setMessage("reset-message", "Konnte Passwort nicht speichern. Bitte Link erneut anfordern.");
      return;
    }
    setMessage("reset-message", "Passwort gespeichert! Du wirst weitergeleitet …", true);
    setTimeout(function () { window.location.href = "index.html"; }, 1500);
  });

  var recoveryMode = !!window.__recoveryFlow;
  if (recoveryMode) showForm(els.resetForm);

  // Die frische Registrierung (ohne E-Mail) ruft setSession() selbst auf, um
  // sofort eingeloggt zu sein - das loest hier unten eigentlich einen
  // automatischen Redirect aus. Den uebernimmt aber registrieren() selbst,
  // entweder zur Ergebnisseite oder zur Startseite. Ohne diese Sperre wuerde
  // der Listener dazwischenfunken und die Ergebnisseite ueberspringen.
  var suppressAutoRedirect = false;

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") {
      recoveryMode = true;
      showForm(els.resetForm);
      return;
    }
    if (recoveryMode || !session || suppressAutoRedirect) return;
    if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;
    window.location.href = "index.html";
  });
})();
