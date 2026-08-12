(function () {
  var ALLOWED_ROLES = { tester: true, admin: true, owner: true };

  function denyAccess(message) {
    document.body.innerHTML = "";
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;" +
      "background:#11141c;color:#eef0f6;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;padding:24px;";
    overlay.innerHTML =
      '<div style="max-width:420px;width:100%;text-align:center;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:#181c26;">' +
      '<h1 style="margin:0 0 12px;font-size:1.5rem;">Kein Zugriff</h1>' +
      '<p style="margin:0 0 20px;color:#9aa0b4;line-height:1.5;">' + message + "</p>" +
      '<a href="/index.html" style="display:inline-flex;padding:10px 20px;border-radius:8px;background:#6d8bff;color:#0b0d12;font-weight:700;text-decoration:none;">Zur Spielebibliothek</a>' +
      "</div>";
    document.body.appendChild(overlay);
    document.documentElement.style.visibility = "visible";
  }

  function reveal(role) {
    document.documentElement.style.visibility = "visible";
    var badge = document.createElement("div");
    badge.style.cssText =
      "position:fixed;bottom:12px;left:12px;z-index:9998;padding:5px 11px;border-radius:999px;" +
      "background:rgba(17,20,28,.9);color:#8fe3a3;font:700 0.72rem ui-monospace,monospace;" +
      "border:1px solid rgba(143,227,163,.35);pointer-events:none;";
    badge.textContent = "Testzugriff: " + role;
    document.body.appendChild(badge);
  }

  (async function check() {
    var sb = window.supabaseClient;
    if (!sb) {
      denyAccess("Anmeldesystem konnte nicht geladen werden. Bitte Seite neu laden.");
      return;
    }
    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      denyAccess("Dieser Testbereich ist nur für Tester, Admins und Owner der Spielebibliothek zugänglich. Bitte melde dich zuerst an.");
      return;
    }
    var profileRes = await sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    var role = profileRes.data && profileRes.data.role;
    if (ALLOWED_ROLES[role]) {
      reveal(role);
      return;
    }
    denyAccess("Dieser Testbereich ist nur für Tester, Admins und Owner der Spielebibliothek zugänglich.");
  })();
})();
