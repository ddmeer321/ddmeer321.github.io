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

  function renderAvatar(path, updatedAt) {
    var wrap = document.getElementById("profil-avatar-wrap");
    if (!wrap) return;
    var url = avatarUrl(path, updatedAt);
    wrap.innerHTML = url
      ? '<img class="profil-avatar" src="' + escapeHtml(url) + '" alt="" width="88" height="88" />'
      : '<span class="profil-avatar is-empty" aria-hidden="true"></span>';
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
      .select("username, player_id, avatar_path, avatar_updated_at, created_at, role, last_seen, last_seen_visible")
      .eq("id", session.user.id)
      .maybeSingle();

    if (pr.error || !pr.data) {
      noSessionEl.hidden = false;
      noSessionEl.querySelector("p").textContent = "Dein Profil konnte nicht geladen werden.";
      return;
    }

    var profile = pr.data;
    appEl.hidden = false;

    document.getElementById("profil-name").textContent = profile.username || "Spieler";
    document.getElementById("profil-player-id").textContent = "#" + (profile.player_id || "—");
    document.getElementById("profil-created-at").textContent = formatDate(profile.created_at);
    document.getElementById("profil-role").textContent = ROLE_LABELS[profile.role] || profile.role || "—";
    document.getElementById("profil-last-seen").textContent = formatLastSeen(profile.last_seen);

    renderAvatar(profile.avatar_path, profile.avatar_updated_at);

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
  }

  render();
})();
