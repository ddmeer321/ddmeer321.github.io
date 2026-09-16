(function () {
  var SUPABASE_URL = "https://hnknmdxxkmbtqluiovoe.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhua25tZHh4a21idHFsdWlvdm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTc4NDAsImV4cCI6MjEwMTMzMzg0MH0.4G2QHsnTYiMnHO5bE80rGF2RgMMXmPle-fAh78eCFrw";

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.invokeAuthenticatedFunction = async function (functionName, options) {
    var sessionResult = await window.supabaseClient.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (sessionResult.error || !session) {
      return {
        data: { error: "Nicht angemeldet." },
        error: sessionResult.error || new Error("Keine aktive Sitzung."),
      };
    }

    async function send(activeSession) {
      return fetch(SUPABASE_URL + "/functions/v1/" + encodeURIComponent(functionName), {
        method: (options && options.method) || "POST",
        headers: Object.assign(
          {
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer " + activeSession.access_token,
            "Content-Type": "application/json",
          },
          (options && options.headers) || {}
        ),
        body: options && options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    }

    try {
      var response = await send(session);
      if (response.status === 401) {
        var refreshResult = await window.supabaseClient.auth.refreshSession();
        var refreshedSession = refreshResult.data && refreshResult.data.session;
        if (!refreshResult.error && refreshedSession) {
          response = await send(refreshedSession);
        }
      }
      var data = await response.json().catch(function () { return null; });
      if (!response.ok) {
        return {
          data: data,
          error: new Error(data && data.error ? data.error : "Serveranfrage fehlgeschlagen."),
        };
      }
      return { data: data, error: null };
    } catch (error) {
      return { data: null, error: error };
    }
  };
})();
