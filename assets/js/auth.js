// Konto-Anzeige in der Kopfleiste.
//
// Abgemeldet: ein Login-Link.
// Angemeldet: NUR das Profilbild. Ein Klick darauf öffnet ein kleines Menü mit
// Bild, Name, Abmelden und dem Weg zum ganzen Profil — mehr steht bewusst
// nicht in der Leiste.
//
// Die Datei läuft auf jeder Seite als einfaches Skript (kein Modul), deshalb
// hier absichtlich kein import und keine neue Syntax, die ältere Browser
// stolpern lässt.
//
// WARUM ES ZWEI DARSTELLUNGEN GIBT
//
// Dieses eine Skript bedient alle Seiten, aber jede Umgebung bringt ihr
// eigenes Stylesheet für #auth-status mit — hell (auth.css), Neon Bot Arena
// (auth-nba.css), Cursor Clicker (auth-badge.css) und je eine Kopie in den
// beiden Testbereichen. Neues Markup auszuliefern, bevor das passende CSS
// überall liegt, würde das Menü dort unformatiert zeigen: das Bild in voller
// Größe, der leere Kreis unsichtbar und damit nicht anklickbar.
//
// Deshalb fragt das Skript beim Stylesheet nach, ob es das Menü kennt
// (--auth-menu: ready). Wo das fehlt, bleibt die bisherige Zeile stehen.
// So lässt sich das Menü Seite für Seite einführen, statt alles auf einmal
// umstellen zu müssen.

(function () {
  var el = document.getElementById("auth-status");
  if (!el || !window.supabaseClient) return;

  var sb = window.supabaseClient;
  var BUCKET = "avatars";

  // Kantenlänge des gespeicherten Bildes. 256 px reichen für einen Kreis von
  // 40 px auch auf Bildschirmen mit dreifacher Pixeldichte.
  var AVATAR_SIZE = 256;

  // Grenze für die Datei, die der Nutzer auswählt. Nicht für die, die
  // hochgeladen wird — die entsteht erst durch das Umzeichnen unten und ist
  // immer klein. Diese Grenze verhindert nur, dass ein 60-MB-Rohfoto erst
  // vollständig eingelesen wird.
  var MAX_PICK_BYTES = 25 * 1024 * 1024;

  var state = { userId: null, username: "", avatar: null, open: false };

  // --- Hilfsmittel ---------------------------------------------------------

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  // Der Dateiname bleibt beim Ersetzen gleich, damit keine verwaisten Dateien
  // liegenbleiben. Ohne den Zeitstempel zeigt der Browser deshalb weiter das
  // alte Bild.
  function avatarUrl(path, updatedAt) {
    if (!path) return null;
    var res = sb.storage.from(BUCKET).getPublicUrl(path);
    var url = res && res.data && res.data.publicUrl;
    if (!url) return null;
    return url + "?v=" + encodeURIComponent(updatedAt || "1");
  }

  // --- Aufbau --------------------------------------------------------------

  // Setzt das Stylesheet dieser Seite "--auth-menu: ready"? Nur dann gibt es
  // das Menü. Siehe die Erklärung oben.
  function menuStylesReady() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue("--auth-menu");
      return String(v).trim() === "ready";
    } catch (e) {
      return false;
    }
  }

  function renderLoggedOut() {
    if (!document.body.contains(el)) return;
    state.open = false;
    el.innerHTML = '<a class="mini-btn auth-login-btn" href="/login.html">Login</a>';
  }

  // Die Anzeige von vorher, für Seiten ohne das neue Stylesheet.
  function renderLoggedInLegacy() {
    if (!document.body.contains(el)) return;
    el.innerHTML =
      '<span class="auth-user">Hallo, <strong>' + escapeHtml(state.username) + "</strong></span>" +
      '<button class="auth-logout-btn" id="auth-logout-btn">Abmelden</button>';
    var logoutBtn = document.getElementById("auth-logout-btn");
    if (!logoutBtn) return;
    logoutBtn.addEventListener("click", async function () {
      await sb.auth.signOut();
      renderLoggedOut();
    });
  }

  function avatarMarkup(cls, url) {
    // Ohne Bild bleibt der Kreis leer. Die Auswahl aus fertigen Bildern kommt
    // später; bis dahin ist "leer" ein ehrlicherer Zustand als ein Platzhalter,
    // den man für ein Bild halten könnte.
    // width/height stehen als Attribute mit im Markup: Sie reservieren den
    // Platz schon vor dem Laden, sodass die Kopfleiste nicht springt, wenn
    // das Bild ankommt.
    if (!url) return '<span class="' + cls + ' is-empty" aria-hidden="true"></span>';
    return '<img class="' + cls + '" src="' + escapeHtml(url) + '" alt="" width="64" height="64" />';
  }

  function renderLoggedIn() {
    if (!document.body.contains(el)) return;
    if (!menuStylesReady()) {
      renderLoggedInLegacy();
      return;
    }

    var url = avatarUrl(state.avatar && state.avatar.path, state.avatar && state.avatar.updatedAt);
    var name = state.username || "Spieler";

    el.innerHTML =
      '<div class="auth-menu-wrap">' +
        '<button class="auth-avatar-btn" id="auth-avatar-btn" type="button" ' +
                'aria-haspopup="menu" aria-expanded="false" aria-controls="auth-menu" ' +
                'aria-label="Konto von ' + escapeHtml(name) + '">' +
          avatarMarkup("auth-avatar", url) +
        '</button>' +

        '<div class="auth-menu" id="auth-menu" role="menu" hidden>' +
          '<div class="auth-menu-head">' +
            // Das Bild im Menü ist zugleich der Weg, es zu ändern. Bewusst
            // keine eigene Zeile dafür: das Menü soll die vier Dinge zeigen,
            // um die es geht, und sonst nichts.
            '<button class="auth-avatar-edit" id="auth-avatar-edit" type="button" ' +
                    'aria-label="Profilbild ändern">' +
              avatarMarkup("auth-avatar auth-avatar-lg", url) +
              '<span class="auth-avatar-edit-hint" aria-hidden="true">Ändern</span>' +
            '</button>' +
            '<p class="auth-menu-name">' + escapeHtml(name) + '</p>' +
          '</div>' +

          '<p class="auth-menu-msg" id="auth-menu-msg" role="status" aria-live="polite" hidden></p>' +

          '<div class="auth-menu-actions">' +
            '<button class="auth-menu-btn" id="auth-profile-btn" type="button" role="menuitem">' +
              'Profil ansehen' +
            '</button>' +
            '<button class="auth-menu-btn auth-menu-btn-quiet" id="auth-logout-btn" type="button" role="menuitem">' +
              'Abmelden' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<input class="auth-file-input" id="auth-file-input" type="file" ' +
               'accept="image/*" hidden />' +
      '</div>';

    wireUp();
  }

  // --- Menü auf und zu -----------------------------------------------------

  function setOpen(open) {
    var btn = document.getElementById("auth-avatar-btn");
    var menu = document.getElementById("auth-menu");
    if (!btn || !menu) return;
    state.open = open;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      var first = document.getElementById("auth-profile-btn");
      if (first) first.focus();
    }
  }

  function onDocumentClick(e) {
    if (!state.open) return;
    var wrap = e.target.closest && e.target.closest(".auth-menu-wrap");
    if (!wrap) setOpen(false);
  }

  function onKeyDown(e) {
    if (!state.open || e.key !== "Escape") return;
    setOpen(false);
    var btn = document.getElementById("auth-avatar-btn");
    if (btn) btn.focus(); // Fokus zurück, sonst landet man am Seitenanfang
  }

  function showMessage(text, isError) {
    var msg = document.getElementById("auth-menu-msg");
    if (!msg) return;
    msg.textContent = text || "";
    msg.hidden = !text;
    msg.dataset.tone = isError ? "error" : "info";
  }

  // --- Bild wählen und hochladen -------------------------------------------

  // Zeichnet das gewählte Bild mittig beschnitten auf eine quadratische
  // Fläche und gibt es als WebP zurück.
  //
  // Das Umzeichnen ist nicht nur Kosmetik: Es entfernt sämtliche
  // Metadaten der Originaldatei. Handyfotos tragen darin oft die
  // GPS-Koordinaten des Aufnahmeorts — die würden sonst in einer öffentlich
  // abrufbaren Datei landen. Nebenbei wird aus jedem Format eine kleine,
  // einheitliche Datei.
  function toSquareImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(url);
        var side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) return reject(new Error("Das Bild konnte nicht gelesen werden."));

        var canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
          0, 0, AVATAR_SIZE, AVATAR_SIZE
        );

        canvas.toBlob(function (blob) {
          if (blob) return resolve({ blob: blob, ext: "webp", type: "image/webp" });
          // Sehr alte Browser können kein WebP schreiben. PNG ist im Bucket
          // ebenfalls erlaubt.
          canvas.toBlob(function (png) {
            if (png) resolve({ blob: png, ext: "png", type: "image/png" });
            else reject(new Error("Das Bild konnte nicht umgewandelt werden."));
          }, "image/png");
        }, "image/webp", 0.85);
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Das ist keine lesbare Bilddatei."));
      };

      img.src = url;
    });
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (file.size > MAX_PICK_BYTES) {
      showMessage("Das Bild ist zu groß (über 25 MB).", true);
      return;
    }

    showMessage("Bild wird hochgeladen …");
    try {
      var out = await toSquareImage(file);
      var path = state.userId + "/avatar." + out.ext;

      var up = await sb.storage.from(BUCKET).upload(path, out.blob, {
        contentType: out.type,
        upsert: true,
      });
      if (up.error) throw up.error;

      // Erst jetzt den Pfad im Profil eintragen — sonst zeigt das Profil auf
      // eine Datei, die es nach einem fehlgeschlagenen Upload gar nicht gibt.
      var rpc = await sb.rpc("set_avatar", { new_path: path });
      if (rpc.error) throw rpc.error;

      state.avatar = { path: path, updatedAt: new Date().toISOString() };
      renderLoggedIn();
      setOpen(true);
      showMessage("Profilbild aktualisiert.");
    } catch (err) {
      showMessage(err && err.message ? err.message : "Das hat nicht geklappt.", true);
    }
  }

  // --- Verdrahtung ---------------------------------------------------------

  function wireUp() {
    var btn = document.getElementById("auth-avatar-btn");
    var edit = document.getElementById("auth-avatar-edit");
    var input = document.getElementById("auth-file-input");
    var logout = document.getElementById("auth-logout-btn");
    var profile = document.getElementById("auth-profile-btn");

    if (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setOpen(!state.open);
      });
    }

    if (edit && input) {
      edit.addEventListener("click", function () { input.click(); });
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        input.value = ""; // damit dieselbe Datei erneut gewählt werden kann
        uploadAvatar(file);
      });
    }

    if (profile) {
      profile.addEventListener("click", function () {
        showMessage("Die Profilseite kommt bald.");
      });
    }

    if (logout) {
      logout.addEventListener("click", async function () {
        await sb.auth.signOut();
        renderLoggedOut();
      });
    }
  }

  // --- Start ---------------------------------------------------------------

  async function render() {
    var res = await sb.auth.getSession();
    var session = res && res.data && res.data.session;
    if (!session) {
      renderLoggedOut();
      return;
    }

    state.userId = session.user.id;

    var pr = await sb
      .from("profiles")
      .select("username, avatar_path, avatar_updated_at")
      .eq("id", session.user.id)
      .maybeSingle();

    var profile = pr && pr.data;
    state.username = (profile && profile.username) || "Spieler";
    state.avatar = profile && profile.avatar_path
      ? { path: profile.avatar_path, updatedAt: profile.avatar_updated_at }
      : null;

    renderLoggedIn();
  }

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);

  render();
})();
