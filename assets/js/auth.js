(function () {
  var el = document.getElementById("auth-status");
  if (!el || !window.supabaseClient) return;

  function renderLoggedOut() {
    if (!document.body.contains(el)) return;
    el.innerHTML = '<a class="mini-btn auth-login-btn" href="/login.html">Login</a>';
  }

  function renderLoggedIn(username) {
    if (!document.body.contains(el)) return;
    el.innerHTML =
      '<span class="auth-user">Hallo, <strong>' + escapeHtml(username) + "</strong></span>" +
      '<button class="auth-logout-btn" id="auth-logout-btn">Abmelden</button>';
    var logoutBtn = document.getElementById("auth-logout-btn");
    if (!logoutBtn) return;
    logoutBtn.addEventListener("click", async function () {
      await window.supabaseClient.auth.signOut();
      renderLoggedOut();
    });
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function render() {
    var { data } = await window.supabaseClient.auth.getSession();
    var session = data && data.session;
    if (!session) {
      renderLoggedOut();
      return;
    }
    var { data: profile } = await window.supabaseClient.from("profiles").select("username").eq("id", session.user.id).maybeSingle();
    renderLoggedIn(profile && profile.username ? profile.username : "Spieler");
  }

  render();
})();
