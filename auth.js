(function () {
  var el = document.getElementById("auth-status");
  if (!el || !window.supabaseClient) return;

  function renderLoggedOut() {
    el.innerHTML = '<a class="mini-btn auth-login-btn" href="login.html">Login</a>';
  }

  function renderLoggedIn(username) {
    el.innerHTML =
      '<span class="auth-user">Hallo, <strong>' + escapeHtml(username) + "</strong></span>" +
      '<button class="auth-logout-btn" id="auth-logout-btn">Abmelden</button>';
    document.getElementById("auth-logout-btn").addEventListener("click", async function () {
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
    var { data: profile } = await window.supabaseClient.from("profiles").select("username").maybeSingle();
    renderLoggedIn(profile && profile.username ? profile.username : "Spieler");
  }

  render();
})();
