(function () {
  var sb = window.supabaseClient;
  if (!sb) return;

  var els = {
    loading: document.getElementById("admin-loading"),
    noAccess: document.getElementById("admin-no-access"),
    noAccessText: document.getElementById("admin-no-access-text"),
    app: document.getElementById("admin-app"),
    whoami: document.getElementById("admin-whoami"),
    logoutBtn: document.getElementById("admin-logout-btn"),
    search: document.getElementById("admin-search"),
    count: document.getElementById("admin-count"),
    message: document.getElementById("admin-message"),
    tableBody: document.getElementById("admin-table-body"),
  };

  var ROLES = ["user", "tester", "admin", "owner"];
  var ROLE_LABELS = { user: "User", tester: "Tester", admin: "Admin", owner: "Owner" };

  var users = [];
  var currentUserId = null;

  function showState(state) {
    els.loading.classList.toggle("hidden", state !== "loading");
    els.noAccess.classList.toggle("hidden", state !== "no-access");
    els.app.classList.toggle("hidden", state !== "app");
  }

  function setMessage(text, isError) {
    els.message.textContent = text || "";
    els.message.className = "admin-message" + (isError ? " error" : text ? " ok" : "");
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : s;
    return div.innerHTML;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
    } catch (e) {
      return iso;
    }
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

  async function init() {
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      els.noAccessText.textContent = "Du bist nicht angemeldet.";
      showState("no-access");
      return;
    }

    currentUserId = session.user.id;

    var profileRes = await sb.from("profiles").select("role, username").eq("id", currentUserId).maybeSingle();
    var myProfile = profileRes.data;

    if (!myProfile || myProfile.role !== "owner") {
      els.noAccessText.textContent = "Diese Seite ist nur für Owner der Spielebibliothek zugänglich.";
      showState("no-access");
      return;
    }

    els.whoami.textContent = "Angemeldet als " + myProfile.username;
    showState("app");
    await loadUsers();
  }

  async function loadUsers() {
    setMessage("");
    var res = await sb
      .from("profiles")
      .select("id, username, player_id, role, banned, banned_at, created_at")
      .order("created_at", { ascending: false });

    if (res.error) {
      setMessage("Benutzer konnten nicht geladen werden.", true);
      return;
    }
    users = res.data || [];
    render();
  }

  function render() {
    var query = els.search.value.trim().toLowerCase();
    var filtered = users.filter(function (u) {
      if (!query) return true;
      return (
        (u.username || "").toLowerCase().indexOf(query) !== -1 ||
        (u.player_id || "").toLowerCase().indexOf(query) !== -1
      );
    });

    els.count.textContent = filtered.length + " von " + users.length + " Benutzer" + (users.length === 1 ? "" : "n");
    els.tableBody.innerHTML = "";

    filtered.forEach(function (u) {
      var isSelf = u.id === currentUserId;
      var row = document.createElement("tr");
      if (u.banned) row.classList.add("admin-row-banned");

      var roleOptions = ROLES.map(function (r) {
        return '<option value="' + r + '"' + (r === u.role ? " selected" : "") + ">" + ROLE_LABELS[r] + "</option>";
      }).join("");

      row.innerHTML =
        "<td>" + escapeHtml(u.username) + (isSelf ? ' <span class="admin-tag-you">Du</span>' : "") + "</td>" +
        '<td class="admin-mono">' + escapeHtml(u.player_id) + "</td>" +
        "<td>" +
          '<select class="admin-role-select" data-id="' + u.id + '"' + (isSelf ? " disabled" : "") + " aria-label=\"Rang von " + escapeHtml(u.username) + "\">" + roleOptions + "</select>" +
        "</td>" +
        "<td>" +
          '<span class="admin-status ' + (u.banned ? "banned" : "active") + '">' + (u.banned ? "Gesperrt" : "Aktiv") + "</span>" +
        "</td>" +
        "<td>" + formatDate(u.created_at) + "</td>" +
        '<td class="admin-actions">' +
          '<button class="admin-btn admin-btn-small' + (u.banned ? "" : " admin-btn-warn") + '" data-action="ban" data-id="' + u.id + '"' + (isSelf ? " disabled" : "") + ">" + (u.banned ? "Entbannen" : "Bannen") + "</button>" +
          '<button class="admin-btn admin-btn-small admin-btn-danger" data-action="delete" data-id="' + u.id + '"' + (isSelf ? " disabled" : "") + ">Löschen</button>" +
        "</td>";

      els.tableBody.appendChild(row);
    });
  }

  els.search.addEventListener("input", render);

  els.tableBody.addEventListener("change", async function (e) {
    var select = e.target.closest(".admin-role-select");
    if (!select) return;
    var id = select.getAttribute("data-id");
    var newRole = select.value;
    var user = users.find(function (u) { return u.id === id; });
    if (!user) return;
    var previousRole = user.role;

    if (newRole === "owner" && !confirm('"' + user.username + '" wirklich zum Owner machen? Owner haben vollen Zugriff auf diese Verwaltung.')) {
      select.value = previousRole;
      return;
    }

    select.disabled = true;
    var res = await sb.functions.invoke("admin-update-role", { body: { targetId: id, newRole: newRole } });
    select.disabled = false;

    if (res.error) {
      setMessage(await extractErrorMessage(res, "Rolle konnte nicht geändert werden."), true);
      select.value = previousRole;
      return;
    }
    user.role = newRole;
    setMessage(user.username + " ist jetzt " + ROLE_LABELS[newRole] + ".", false);
  });

  els.tableBody.addEventListener("click", async function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var action = btn.getAttribute("data-action");
    var user = users.find(function (u) { return u.id === id; });
    if (!user) return;

    if (action === "ban") {
      var willBan = !user.banned;
      if (willBan && !confirm('"' + user.username + '" wirklich sperren?')) return;

      btn.disabled = true;
      var res = await sb.functions.invoke("admin-set-ban", { body: { targetId: id, banned: willBan } });
      btn.disabled = false;

      if (res.error) {
        setMessage(await extractErrorMessage(res, "Status konnte nicht geändert werden."), true);
        return;
      }
      user.banned = willBan;
      setMessage(user.username + (willBan ? " wurde gesperrt." : " wurde entsperrt."), false);
      render();
      return;
    }

    if (action === "delete") {
      if (!confirm('"' + user.username + '" wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;

      btn.disabled = true;
      var res2 = await sb.functions.invoke("admin-delete-user", { body: { targetId: id } });
      btn.disabled = false;

      if (res2.error) {
        setMessage(await extractErrorMessage(res2, "Benutzer konnte nicht gelöscht werden."), true);
        return;
      }
      users = users.filter(function (u) { return u.id !== id; });
      setMessage(user.username + " wurde gelöscht.", false);
      render();
    }
  });

  els.logoutBtn.addEventListener("click", async function () {
    await sb.auth.signOut();
    window.location.href = "../index.html";
  });

  init();
})();
