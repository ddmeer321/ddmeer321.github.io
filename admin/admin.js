(function () {
  var sb = window.supabaseClient;
  if (!sb) return;

  var els = {
    loading: document.getElementById("admin-loading"),
    noAccess: document.getElementById("admin-no-access"),
    noAccessText: document.getElementById("admin-no-access-text"),
    noAccessLink: document.getElementById("admin-no-access-link"),
    app: document.getElementById("admin-app"),
    whoami: document.getElementById("admin-whoami"),
    logoutBtn: document.getElementById("admin-logout-btn"),
    search: document.getElementById("admin-search"),
    count: document.getElementById("admin-count"),
    message: document.getElementById("admin-message"),
    tableBody: document.getElementById("admin-table-body"),
    tradeSearch: document.getElementById("trade-search"),
    tradeCount: document.getElementById("trade-count"),
    tradeMessage: document.getElementById("trade-message"),
    tradeBody: document.getElementById("trade-table-body"),
    tradeRefresh: document.getElementById("trade-refresh"),
    migrationBody: document.getElementById("migration-table-body"),
    migrationMessage: document.getElementById("migration-message"),
    migrationRefresh: document.getElementById("migration-refresh"),
  };

  var ROLES = ["user", "tester", "admin", "owner"];
  var ROLE_LABELS = { user: "User", tester: "Tester", admin: "Admin", owner: "Owner" };

  var users = [];
  var trades = [];
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

  async function invokeAuthenticated(functionName, options) {
    return window.invokeAuthenticatedFunction(functionName, options);
  }

  async function init() {
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      els.noAccessText.textContent = "Du bist nicht angemeldet.";
      els.noAccessLink.href = "../login.html";
      els.noAccessLink.textContent = "Zum Login";
      showState("no-access");
      return;
    }

    var userRes = await sb.auth.getUser();
    var authenticatedUser = userRes.data && userRes.data.user;
    if (userRes.error || !authenticatedUser) {
      els.noAccessText.textContent = "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
      els.noAccessLink.href = "../login.html";
      els.noAccessLink.textContent = "Erneut anmelden";
      showState("no-access");
      return;
    }

    currentUserId = authenticatedUser.id;

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
    await loadMigrationQueue();
    await loadTradeHistory();
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
    var res = await invokeAuthenticated("admin-update-role", { body: { targetId: id, newRole: newRole } });
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
      var res = await invokeAuthenticated("admin-set-ban", { body: { targetId: id, banned: willBan } });
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
      var res2 = await invokeAuthenticated("admin-delete-user", { body: { targetId: id } });
      btn.disabled = false;

      if (res2.error) {
        setMessage(await extractErrorMessage(res2, "Benutzer konnte nicht gelöscht werden."), true);
        return;
      }
      users = users.filter(function (u) { return u.id !== id; });
      // Die Funktion loescht erst das Konto, dann das Profilbild ueber die
      // Storage-API. Klappt der zweite Schritt nicht, ist das Konto trotzdem
      // weg - aber ein Profilbild ist ein personenbezogenes Datum und soll
      // nicht stillschweigend liegenbleiben. Deshalb den Hinweis zeigen,
      // wenn die Funktion einen mitschickt.
      var hinweis = res2.data && res2.data.hinweis;
      setMessage(hinweis || user.username + " wurde gelöscht.", !!hinweis);
      render();
    }
  });


  function formatDateTime(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); }
    catch (e) { return iso; }
  }

  async function loadTradeHistory() {
    els.tradeRefresh.disabled = true;
    els.tradeMessage.textContent = "Trading-Verlauf wird geladen …";
    var res = await invokeAuthenticated("cursor-clicker-security", {
      body: { action: "owner_trade_history", clientActionId: crypto.randomUUID(), limit: 100 }
    });
    els.tradeRefresh.disabled = false;
    if (res.error || !res.data) {
      els.tradeMessage.textContent = await extractErrorMessage(res, "Trading-Verlauf konnte nicht geladen werden.");
      els.tradeMessage.className = "admin-message error";
      return;
    }
    trades = Array.isArray(res.data.trades) ? res.data.trades : [];
    els.tradeMessage.textContent = "";
    els.tradeMessage.className = "admin-message";
    renderTrades();
  }

  function renderTrades() {
    var query = els.tradeSearch.value.trim().toLowerCase();
    var filtered = trades.filter(function (trade) {
      if (!query) return true;
      return [trade.id, trade.initiator_username, trade.initiator_player_id,
        trade.recipient_username, trade.recipient_player_id, trade.status]
        .some(function (value) { return String(value || "").toLowerCase().indexOf(query) !== -1; });
    });
    els.tradeCount.textContent = filtered.length + " von " + trades.length + " Trades";
    if (!filtered.length) {
      els.tradeBody.innerHTML = '<tr><td colspan="6" class="admin-empty">' +
        (trades.length ? "Keine passenden Trades." : "Noch keine Trades vorhanden.") + "</td></tr>";
      return;
    }
    els.tradeBody.innerHTML = filtered.map(function (trade) {
      var items = Array.isArray(trade.items) ? trade.items : [];
      var events = Array.isArray(trade.events) ? trade.events : [];
      var itemHtml = items.length ? items.map(function (item) {
        var snapshot = item.snapshot || {};
        return "<li>" + escapeHtml(snapshot.name || snapshot.catalogId || snapshot.catalog_id || "Gegenstand") +
          " · " + escapeHtml(snapshot.rarity || snapshot.itemType || snapshot.item_type || "unbekannt") + "</li>";
      }).join("") : "<li>Keine Gegenstände protokolliert</li>";
      var eventHtml = events.length ? events.map(function (event) {
        return "<li>" + escapeHtml(formatDateTime(event.createdAt)) + " · " + escapeHtml(event.type) + "</li>";
      }).join("") : "<li>Noch keine Ereignisse</li>";
      return "<tr>" +
        "<td>" + escapeHtml(formatDateTime(trade.created_at)) + "</td>" +
        '<td class="admin-mono">' + escapeHtml(trade.id) + "</td>" +
        "<td><strong>" + escapeHtml(trade.initiator_username) + "</strong><br><span class=\"admin-mono\">" + escapeHtml(trade.initiator_player_id) + "</span></td>" +
        "<td><strong>" + escapeHtml(trade.recipient_username) + "</strong><br><span class=\"admin-mono\">" + escapeHtml(trade.recipient_player_id) + "</span></td>" +
        '<td><span class="admin-trade-status status-' + escapeHtml(trade.status) + '">' + escapeHtml(trade.status) + "</span></td>" +
        '<td><details class="admin-trade-details"><summary>Anzeigen</summary><strong>Gegenstände</strong><ul>' + itemHtml +
        "</ul><strong>Ereignisse</strong><ul>" + eventHtml + "</ul></details></td></tr>";
    }).join("");
  }

  els.tradeSearch.addEventListener("input", renderTrades);
  els.tradeRefresh.addEventListener("click", loadTradeHistory);

  async function loadMigrationQueue() {
    els.migrationRefresh.disabled = true;
    var res = await invokeAuthenticated("cursor-clicker-security", { body: { action: "owner_migration_queue" } });
    els.migrationRefresh.disabled = false;
    if (res.error || !Array.isArray(res.data)) {
      els.migrationMessage.textContent = await extractErrorMessage(res, "Importanträge konnten nicht geladen werden.");
      els.migrationMessage.className = "admin-message error";
      return;
    }
    els.migrationMessage.textContent = "";
    els.migrationBody.innerHTML = res.data.length ? res.data.map(function (r) {
      var s = r.summary || {};
      var flags = Array.isArray(r.risk_flags) && r.risk_flags.length ? r.risk_flags.join(", ") : "Keine";
      return "<tr><td><strong>" + escapeHtml(r.username) + "</strong><br><span class=\"admin-mono\">" + escapeHtml(r.player_id) + "</span></td>" +
        "<td>" + escapeHtml(String(s.cursorCopies || 0)) + " Cursor · " + escapeHtml(String(s.employeeCopies || 0)) + " Mitarbeiter<br>" + escapeHtml(String(s.coins || 0)) + " Coins</td>" +
        "<td>" + escapeHtml(flags) + "</td><td class=\"admin-actions\"><button class=\"admin-btn admin-btn-small\" data-migration=\"approved\" data-id=\"" + r.user_id + "\">Freigeben</button><button class=\"admin-btn admin-btn-small admin-btn-danger\" data-migration=\"rejected\" data-id=\"" + r.user_id + "\">Ablehnen</button></td></tr>";
    }).join("") : '<tr><td colspan="4" class="admin-empty">Keine offenen Importanträge.</td></tr>';
  }
  els.migrationRefresh.addEventListener("click", loadMigrationQueue);
  els.migrationBody.addEventListener("click", async function (e) {
    var btn = e.target.closest("button[data-migration]"); if (!btn) return;
    var decision = btn.dataset.migration;
    if (decision === "approved" && !confirm("Diesen unveränderten Spielstand für den einmaligen Trading-Import freigeben?")) return;
    btn.disabled = true;
    var res = await invokeAuthenticated("cursor-clicker-security", { body: { action: "owner_review_migration", clientActionId: crypto.randomUUID(), targetId: btn.dataset.id, decision: decision } });
    if (res.error) els.migrationMessage.textContent = await extractErrorMessage(res, "Entscheidung konnte nicht gespeichert werden.");
    await loadMigrationQueue();
  });

  els.logoutBtn.addEventListener("click", async function () {
    await sb.auth.signOut();
    window.location.href = "../index.html";
  });

  init();
})();
