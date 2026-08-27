// Eigene Profilseite (ROADMAP.md Punkt 2, "Biti"). v1 zeigt ausschliesslich
// das eigene Profil — es gibt aktuell keine RLS-Policy, die fremde Profile
// lesbar macht, das ist bewusst ein spaeterer, separat geplanter Schritt
// (siehe HISTORY.md). Deshalb reicht hier "eigene Session oder Login-Hinweis",
// keine Nutzer-ID aus der URL.
//
// Läuft nach auth.js: auth.js baut die Kopfleiste, hier geht es nur um den
// Hauptbereich der Seite.

(function () {
  if (!window.supabaseClient) return;
  var sb = window.supabaseClient;

  var loadingEl = document.getElementById("profil-loading");
  var noSessionEl = document.getElementById("profil-no-session");
  var appEl = document.getElementById("profil-app");
  if (!loadingEl || !noSessionEl || !appEl) return;

  var ROLE_LABELS = { user: "Nutzer", tester: "Tester", admin: "Admin", owner: "Owner" };
  var STATUS_MAX_LENGTH = 80;
  var EMPTY_STATUS_TEXT = "Ich liebe Spiele";

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return "—";
    }
  }

  function formatLastSeen(iso) {
    if (!iso) return "noch nicht erfasst";
    try {
      return new Date(iso).toLocaleString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "—";
    }
  }

  function avatarUrl(path, updatedAt) {
    if (!path) return null;
    var res = sb.storage.from("avatars").getPublicUrl(path);
    var url = res && res.data && res.data.publicUrl;
    if (!url) return null;
    return url + "?v=" + encodeURIComponent(updatedAt || "1");
  }

  // Das Bild steht zweimal auf der Seite: groß in der Identitätskarte, klein
  // oben in der Seitenleiste. Beide bekommen dieselbe Quelle.
  function renderAvatar(wrapId, path, updatedAt) {
    var wrap = document.getElementById(wrapId);
    if (!wrap) return;
    var url = avatarUrl(path, updatedAt);
    wrap.innerHTML = url
      ? '<img class="profil-avatar" src="' + escapeHtml(url) + '" alt="" width="88" height="88" />'
      : '<span class="profil-avatar is-empty" aria-hidden="true"></span>';
  }

  // Seitenleiste schaltet komplette Bereiche um (wie Chats in einer
  // Chat-App) — kein Sprung innerhalb einer langen Seite, sondern jeweils
  // nur ein Bereich gleichzeitig sichtbar.
  function setupPanelSwitching() {
    var links = document.querySelectorAll(".profil-sidenav-link");
    var panels = document.querySelectorAll(".profil-panel");
    if (!links.length || !panels.length) return;

    links.forEach(function (link) {
      link.addEventListener("click", function () {
        var target = link.dataset.panel;

        links.forEach(function (l) {
          var active = l === link;
          l.classList.toggle("is-active", active);
          l.setAttribute("aria-selected", String(active));
        });

        panels.forEach(function (panel) {
          panel.hidden = panel.dataset.panel !== target;
        });
      });
    });
  }

  function setupLogout() {
    var logoutBtn = document.getElementById("profil-settings-logout");
    if (!logoutBtn) return;
    logoutBtn.addEventListener("click", async function () {
      logoutBtn.disabled = true;
      await sb.auth.signOut();
      window.location.href = "index.html";
    });
  }

  // Lokaler UI-Prototyp: Bis es ein serverseitiges status_text-Feld gibt,
  // bleibt der Status pro Account in diesem Browser gespeichert.
  function setupStatusEditor(userId) {
    var editBtn = document.getElementById("profil-status-edit");
    var editor = document.getElementById("profil-status-editor");
    var input = document.getElementById("profil-status-input");
    var counter = document.getElementById("profil-status-counter");
    var cancelBtn = document.getElementById("profil-status-cancel");
    var statusText = document.getElementById("profil-status-text");
    if (!editBtn || !editor || !input || !counter || !cancelBtn || !statusText) return;

    var storageKey = "profil-status:" + userId;
    var currentStatus = "";

    try {
      currentStatus = (window.localStorage.getItem(storageKey) || "").slice(0, STATUS_MAX_LENGTH);
    } catch (e) {
      currentStatus = "";
    }

    function renderStatus() {
      statusText.textContent = currentStatus || EMPTY_STATUS_TEXT;
    }

    function updateCounter() {
      counter.textContent = input.value.length + "/" + STATUS_MAX_LENGTH;
    }

    function closeEditor(restoreValue) {
      if (restoreValue) input.value = currentStatus;
      editor.hidden = true;
      editBtn.setAttribute("aria-expanded", "false");
      updateCounter();
    }

    function openEditor() {
      input.value = currentStatus;
      updateCounter();
      editor.hidden = false;
      editBtn.setAttribute("aria-expanded", "true");
      window.setTimeout(function () {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 0);
    }

    editBtn.addEventListener("click", function () {
      if (editor.hidden) openEditor();
      else closeEditor(true);
    });

    input.addEventListener("input", function () {
      // maxlength schützt normale Eingaben; das zusätzliche Kürzen deckt
      // auch programmatisch eingefügten oder ungewöhnlich eingefügten Text ab.
      if (input.value.length > STATUS_MAX_LENGTH) {
        input.value = input.value.slice(0, STATUS_MAX_LENGTH);
      }
      updateCounter();
    });
    cancelBtn.addEventListener("click", function () {
      closeEditor(true);
      editBtn.focus();
    });

    editor.addEventListener("submit", function (event) {
      event.preventDefault();
      currentStatus = input.value.trim().slice(0, STATUS_MAX_LENGTH);
      try {
        if (currentStatus) window.localStorage.setItem(storageKey, currentStatus);
        else window.localStorage.removeItem(storageKey);
      } catch (e) {
        // Die Anzeige funktioniert auch dann weiter, wenn Speicher blockiert ist.
      }
      renderStatus();
      closeEditor(false);
      editBtn.focus();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !editor.hidden) {
        closeEditor(true);
        editBtn.focus();
      }
    });

    renderStatus();
    updateCounter();
  }

  async function toggleLastSeen(btn, current) {
    var next = !current;
    btn.setAttribute("aria-checked", String(next));
    btn.classList.toggle("is-on", next);
    btn.disabled = true;
    try {
      var res = await sb.rpc("set_last_seen_visible", { visible: next });
      if (res.error) throw res.error;
    } catch (err) {
      // Zurückrollen, falls der Server-Aufruf scheitert — sonst zeigt der
      // Schalter einen Zustand, der nie gespeichert wurde.
      btn.setAttribute("aria-checked", String(current));
      btn.classList.toggle("is-on", current);
    } finally {
      btn.disabled = false;
    }
  }

  // Ausschalten wirkt nur nach vorn: bereits hochgeladene Spielstände bleiben
  // in der Cloud liegen (siehe cloud-save.js), es wird nur nichts Neues mehr
  // synchronisiert. Kein Löschen hier — das wäre ein eigener, separater Schritt.
  async function toggleCloudSave(btn, current) {
    var next = !current;
    btn.setAttribute("aria-checked", String(next));
    btn.classList.toggle("is-on", next);
    btn.disabled = true;
    try {
      var res = await sb.rpc("set_cloud_save_enabled", { enabled: next });
      if (res.error) throw res.error;
    } catch (err) {
      btn.setAttribute("aria-checked", String(current));
      btn.classList.toggle("is-on", current);
    } finally {
      btn.disabled = false;
    }
  }

  async function render() {
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;

    loadingEl.hidden = true;

    if (!session) {
      noSessionEl.hidden = false;
      return;
    }

    var pr = await sb
      .from("profiles")
      .select(
        "username, player_id, avatar_path, avatar_updated_at, created_at, role, last_seen, last_seen_visible, cloud_save_enabled"
      )
      .eq("id", session.user.id)
      .maybeSingle();

    if (pr.error || !pr.data) {
      noSessionEl.hidden = false;
      noSessionEl.querySelector("p").textContent = "Dein Profil konnte nicht geladen werden.";
      return;
    }

    var profile = pr.data;
    appEl.hidden = false;

    var roleLabel = ROLE_LABELS[profile.role] || profile.role || "—";

    var playerIdText = "#" + (profile.player_id || "—");

    document.getElementById("profil-name").textContent = profile.username || "Spieler";
    document.getElementById("profil-player-id").textContent = playerIdText;
    document.getElementById("profil-player-id-2").textContent = playerIdText;
    document.getElementById("profil-created-at").textContent = formatDate(profile.created_at);
    document.getElementById("profil-role").textContent = roleLabel;
    document.getElementById("profil-last-seen").textContent = formatLastSeen(profile.last_seen);

    document.getElementById("profil-settings-name").textContent = profile.username || "Spieler";
    document.getElementById("profil-settings-sub").textContent = playerIdText + " · " + roleLabel;

    renderAvatar("profil-avatar-wrap", profile.avatar_path, profile.avatar_updated_at);
    renderAvatar("profil-settings-avatar-wrap", profile.avatar_path, profile.avatar_updated_at);
    setupStatusEditor(session.user.id);

    var toggle = document.getElementById("profil-last-seen-toggle");
    if (toggle) {
      var visible = profile.last_seen_visible !== false;
      toggle.setAttribute("aria-checked", String(visible));
      toggle.classList.toggle("is-on", visible);
      toggle.addEventListener("click", function () {
        var isOn = toggle.getAttribute("aria-checked") === "true";
        toggleLastSeen(toggle, isOn);
      });
    }

    var cloudToggle = document.getElementById("profil-cloud-save-toggle");
    if (cloudToggle) {
      var cloudOn = profile.cloud_save_enabled !== false;
      cloudToggle.setAttribute("aria-checked", String(cloudOn));
      cloudToggle.classList.toggle("is-on", cloudOn);
      cloudToggle.addEventListener("click", function () {
        var isOn = cloudToggle.getAttribute("aria-checked") === "true";
        toggleCloudSave(cloudToggle, isOn);
      });
    }

    setupPanelSwitching();
    setupLogout();
  }

  render();
})();
