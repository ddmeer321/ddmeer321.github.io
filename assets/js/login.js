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

  function checkPassword(pw) {
    return {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      digit: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
  }
  function passwordValid(pw) {
    var r = checkPassword(pw);
    return r.length && r.upper && r.lower && r.digit && r.special;
  }
  function wirePasswordRules(inputId, listId) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId);
    if (!input || !list) return;
    input.addEventListener("input", function () {
      var result = checkPassword(input.value);
      Object.keys(result).forEach(function (rule) {
        var li = list.querySelector('[data-rule="' + rule + '"]');
        if (li) li.classList.toggle("ok", result[rule]);
      });
    });
  }
  wirePasswordRules("reg-password", "reg-password-rules");
  wirePasswordRules("reset-password", "reset-password-rules");

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
    var res = await fetch("https://api.pwnedpasswords.com/range/" + prefix);
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

  // zxcvbn schaetzt lokal, wie leicht das Passwort zu erraten waere (Muster,
  // gaengige Woerter, Tastatur-Sequenzen, ...) - keine Netzwerk-Anfrage dafuer.
  function estimatePasswordStrength(password) {
    if (typeof window.zxcvbn !== "function") return { error: true };
    var result = window.zxcvbn(password);
    return {
      score: result.score,
      crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
    };
  }

  // pendingRedirect: wohin nach der Pruefung (oder beim Ueberspringen)
  // weitergeleitet wird. null bei der E-Mail-Registrierung, weil da noch
  // keine Sitzung besteht (erst nach Bestaetigung per Mail) - die Seite
  // bleibt einfach stehen.
  function offerSecurityCheck(password, pendingRedirect) {
    var offer = document.getElementById("security-offer");
    var yesBtn = document.getElementById("security-offer-yes");
    var noBtn = document.getElementById("security-offer-no");
    var msg = document.getElementById("security-offer-message");
    if (!offer || !yesBtn || !noBtn) {
      if (pendingRedirect) window.location.href = pendingRedirect;
      return;
    }

    offer.classList.remove("hidden");
    msg.textContent = "";
    msg.className = "login-message";
    yesBtn.disabled = false;
    noBtn.disabled = false;

    function finish() {
      if (pendingRedirect) window.location.href = pendingRedirect;
    }

    noBtn.onclick = finish;

    yesBtn.onclick = async function () {
      yesBtn.disabled = true;
      noBtn.disabled = true;
      msg.textContent = "Prüfe …";
      msg.className = "login-message";

      var result = { checkedAt: new Date().toISOString() };
      try {
        result.leak = await checkPasswordLeak(password);
      } catch (e) {
        result.leak = { error: true };
      }
      try {
        result.strength = estimatePasswordStrength(password);
      } catch (e) {
        result.strength = { error: true };
      }

      try {
        window.sessionStorage.setItem("security-check-result", JSON.stringify(result));
      } catch (e) {
        /* Ergebnisseite zeigt dann eben "kein Ergebnis vorhanden" */
      }
      window.location.href = "security-check.html" + (pendingRedirect ? "?weiter=" + encodeURIComponent(pendingRedirect) : "");
    };
  }

  els.registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var username = document.getElementById("reg-username").value.trim();
    var password = document.getElementById("reg-password").value;
    var email = document.getElementById("reg-email").value.trim();
    setMessage("register-message", "");

    if (!regUsernameValid()) {
      setMessage("register-message", "Bitte einen gültigen Benutzernamen wählen (4–12 Zeichen, keine Leerzeichen/Emojis).");
      return;
    }
    if (!passwordValid(password)) {
      setMessage("register-message", "Bitte alle Passwort-Anforderungen erfüllen.");
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      setMessage("register-message", "Bitte eine gültige E-Mail-Adresse eingeben oder das Feld leer lassen.");
      return;
    }

    var submitBtn = els.registerForm.querySelector(".login-submit");
    submitBtn.disabled = true;
    try {
      if (email) {
        var signUpRes = await sb.auth.signUp({
          email: email,
          password: password,
          options: { data: { username: username, has_recovery_email: true }, emailRedirectTo: redirectUrl() },
        });
        if (signUpRes.error) {
          setMessage("register-message", signUpRes.error.message.indexOf("already registered") !== -1 ? "Diese E-Mail wird bereits verwendet." : "Registrierung fehlgeschlagen. Bitte erneut versuchen.");
          return;
        }
        setMessage("register-message", "Fast fertig! Wir haben dir eine Bestätigungsmail geschickt.", true);
        offerSecurityCheck(password, null);
        els.registerForm.reset();
        document.querySelectorAll("#reg-password-rules li").forEach(function (li) { li.classList.remove("ok"); });
        document.getElementById("reg-username-hint").textContent = "";
      } else {
        var regRes = await sb.functions.invoke("register-with-username", { body: { username: username, password: password } });
        if (regRes.error) {
          setMessage("register-message", await extractErrorMessage(regRes, "Registrierung fehlgeschlagen."));
          return;
        }
        var loginRes = await sb.functions.invoke("login-with-username", { body: { identifier: username, password: password } });
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
        offerSecurityCheck(password, "index.html");
      }
    } finally {
      submitBtn.disabled = false;
    }
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
  // automatischen Redirect aus. Der soll aber erst passieren, nachdem der
  // Nutzer die Sicherheitspruefung gesehen/beantwortet hat (offerSecurityCheck
  // uebernimmt den Redirect dann selbst), nicht sofort und ungefragt.
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
