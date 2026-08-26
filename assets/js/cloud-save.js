// Gemeinsame Cloud-Speicher-Schicht fuer Spielstaende (Tabelle game_saves,
// ein Zeilentyp pro Nutzer+Spiel). Einzelne Spiele reden nie direkt mit
// Supabase, sondern nur ueber window.CloudSave. Login-Status und der
// Datenschutz-Schalter (profiles.cloud_save_enabled) werden hier zentral
// geprueft, nicht in jedem Spiel einzeln.
(function () {
  if (window.CloudSave) return;

  var sessionPromise = null;
  var enabledPromise = null;

  function getSession() {
    if (!window.supabaseClient) return Promise.resolve(null);
    if (!sessionPromise) {
      sessionPromise = window.supabaseClient.auth
        .getSession()
        .then(function (res) {
          return res && res.data && res.data.session ? res.data.session : null;
        })
        .catch(function () {
          return null;
        });
    }
    return sessionPromise;
  }

  function isCloudEnabled(userId) {
    if (!enabledPromise) {
      enabledPromise = window.supabaseClient
        .from("profiles")
        .select("cloud_save_enabled")
        .eq("id", userId)
        .maybeSingle()
        .then(function (res) {
          // Default an: fehlt die Spalte/Zeile aus irgendeinem Grund, lieber
          // synchronisieren als stillschweigend Fortschritt verlieren.
          return !(res && res.data && res.data.cloud_save_enabled === false);
        })
        .catch(function () {
          return false;
        });
    }
    return enabledPromise;
  }

  // Liefert die user_id, wenn Cloud-Sync gerade erlaubt ist (angemeldet UND
  // nicht in den Datenschutz-Einstellungen ausgeschaltet), sonst null.
  async function ready() {
    var session = await getSession();
    if (!session) return null;
    var enabled = await isCloudEnabled(session.user.id);
    if (!enabled) return null;
    return session.user.id;
  }

  async function load(gameId) {
    var userId = await ready();
    if (!userId) return null;
    try {
      var res = await window.supabaseClient
        .from("game_saves")
        .select("save_data")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .maybeSingle();
      if (res.error || !res.data) return null;
      return res.data.save_data;
    } catch (err) {
      console.warn("CloudSave: Laden fehlgeschlagen.", err);
      return null;
    }
  }

  async function save(gameId, data) {
    var userId = await ready();
    if (!userId) return false;
    try {
      var res = await window.supabaseClient.from("game_saves").upsert(
        {
          user_id: userId,
          game_id: gameId,
          save_data: data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,game_id" }
      );
      return !res.error;
    } catch (err) {
      console.warn("CloudSave: Speichern fehlgeschlagen.", err);
      return false;
    }
  }

  // Einmaliger Upload eines bestehenden lokalen Spielstands bei der ersten
  // Cloud-Sync-Gelegenheit eines Accounts fuer dieses Spiel. Laeuft nur, wenn
  // noch KEIN Cloud-Spielstand existiert - sonst wuerde ein alter lokaler
  // Stand (z.B. auf einem zweiten Geraet) einen neueren Cloud-Stand ueberschreiben.
  // getLocalData wird erst aufgerufen, wenn feststeht, dass migriert werden muss.
  async function migrateLocalOnce(gameId, getLocalData) {
    var userId = await ready();
    if (!userId) return;
    var flagKey = "cloud-save-migrated:" + gameId + ":" + userId;
    try {
      if (localStorage.getItem(flagKey)) return;
    } catch (err) {
      /* localStorage blockiert -> einfach ohne Merker weitermachen */
    }
    try {
      var res = await window.supabaseClient
        .from("game_saves")
        .select("user_id")
        .eq("user_id", userId)
        .eq("game_id", gameId)
        .maybeSingle();
      if (res.error) return;
      if (!res.data) {
        var localData = getLocalData();
        if (localData) await save(gameId, localData);
      }
      try {
        localStorage.setItem(flagKey, "1");
      } catch (err) {
        /* kein Merker moeglich -> naechstes Mal wird einfach erneut geprueft */
      }
    } catch (err) {
      console.warn("CloudSave: Migration fehlgeschlagen.", err);
    }
  }

  window.CloudSave = { load: load, save: save, migrateLocalOnce: migrateLocalOnce, ready: ready };
})();
