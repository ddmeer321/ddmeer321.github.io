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
  // Anzeigename je game-id (siehe <meta name="game-id"> auf den Spielseiten
  // + touch_last_played() in auth.js). Neue Spiele hier eintragen, sobald sie
  // die Meta-Markierung bekommen.
  var GAME_LABELS = { snake: "Snake", "cursor-clicker": "Cursor Clicker" };
  var STATUS_MAX_LENGTH = 80;
  var EMPTY_STATUS_TEXT = "Ich liebe Spiele";
  // Identisch zu USERNAME_RE in assets/js/login.js — nur fuer die sofortige
  // Client-Rueckmeldung. Die eigentliche Absicherung (Format + Eindeutigkeit)
  // passt die Datenbankfunktion set_username() serverseitig noch einmal ab.
  var USERNAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9!"#$%&'()*+,\-./:;<=>?[\]^_`{|}~]{4,12}$/;

  // TESTDATEN — Platzhalter-Katalog fuers Schaufenster, bis es echte, aus
  // den Spiel-Spielstaenden abgeleitete Items gibt (siehe game_saves: Snake
  // owned-Skins, Cursor-Clicker ownedCursors/unlockedCosmetics, Neon-Bot-Arena
  // unlockedHeroes/ownedCosmetics). Auswahl bleibt bis dahin nur lokal
  // gespeichert (kein Server-Feld) — gleiches Prinzip wie beim Beschreibungstext.
  var SHOWCASE_SLOT_COUNT = 6;

  // Echte Cursor-Silhouette + Material-Verlaeufe, 1:1 uebernommen aus
  // cursor-clicker/js/ui/cursorGlyph.js + js/data/cursorMaterials.js (nur ein
  // Ausschnitt der Materialien fuer die Testitems), statt eines Emojis.
  var CC_POINTER_PATH = "M12 6 L12 78 L30 62 L42 88 L54 82 L40 58 L64 58 Z";
  var CC_MATERIALS = {
    galaxy: { gradient: "radial", stops: ["#6a54c4", "#160b32"], accent: "dots", accentColor: "#f7f2ff", accentCount: 7, glow: "rgba(124,58,237,0.75)" },
    neon: { gradient: "linear", stops: ["#14152a", "#0b0c1c"], accent: "stroke", accentColor: "#22d3ee", accentCount: 1, glow: "rgba(34,211,238,0.85)" }
  };
  function ccRenderAccent(accent, color, count) {
    if (accent === "dots") {
      var dots = [[20, 20], [34, 16], [24, 34], [40, 30], [18, 48], [32, 52], [22, 66]].slice(0, count);
      return dots.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="' + color + '" opacity="0.85"/>'; }).join("");
    }
    return "";
  }
  function renderCursorGlyph(materialKey) {
    var mat = CC_MATERIALS[materialKey];
    if (!mat) return "";
    var isOutline = mat.accent === "stroke";
    var gradId = "ccg-" + materialKey;
    var stopA = mat.stops[0];
    var stopB = mat.stops[1];
    var gradientTag = mat.gradient === "radial"
      ? '<radialGradient id="' + gradId + '" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="' + stopA + '"/><stop offset="100%" stop-color="' + stopB + '"/></radialGradient>'
      : '<linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="60%" y2="100%"><stop offset="0%" stop-color="' + stopA + '"/><stop offset="100%" stop-color="' + stopB + '"/></linearGradient>';
    var pathStroke = isOutline ? ' stroke="' + mat.accentColor + '" stroke-width="2.6"' : "";
    var accentMarkup = isOutline ? "" : ccRenderAccent(mat.accent, mat.accentColor, mat.accentCount || 0);
    return (
      '<span class="cc-cursor-glyph" style="--glyph-color:' + stopA + ';--glyph-glow:' + mat.glow + '">' +
      '<svg viewBox="0 0 100 100" class="cc-cursor-svg" aria-hidden="true">' +
      "<defs>" + gradientTag + "</defs>" +
      '<path d="' + CC_POINTER_PATH + '" fill="url(#' + gradId + ')"' + pathStroke + "></path>" +
      "<g>" + accentMarkup + "</g>" +
      "</svg>" +
      "</span>"
    );
  }

  // TESTDATEN — Platzhalter-Katalog fuers Schaufenster, bis es echte, aus den
  // Spiel-Spielstaenden abgeleitete Items gibt (siehe game_saves: Snake
  // owned-Skins, Cursor-Clicker ownedCursors/unlockedCosmetics, Neon-Bot-Arena
  // unlockedHeroes/ownedCosmetics). Auswahl bleibt bis dahin nur lokal
  // gespeichert (kein Server-Feld) — gleiches Prinzip wie beim Beschreibungstext.
  // "visual" beschreibt, wie renderShowcaseVisual() das jeweils echte
  // Spiel-Aussehen nachbaut (kein Emoji).
  var SHOWCASE_TEST_CATALOG = [
    { id: "snake-feuer", name: "Feuer", game: "Snake", visual: { type: "snake", head: "#ff7a3d", body: "#ffcf3d" } },
    { id: "snake-ozean", name: "Ozean", game: "Snake", visual: { type: "snake", head: "#2fd6c0", body: "#4a8cff" } },
    { id: "snake-mitternacht", name: "Mitternacht", game: "Snake", visual: { type: "snake", head: "#b892ff", body: "#3d2f66" } },
    { id: "snake-gold", name: "Gold", game: "Snake", visual: { type: "snake", head: "#f4c430", body: "#fff1b8" } },
    { id: "cc-galaxy", name: "Galaxy", game: "Cursor Clicker", visual: { type: "cursor", material: "galaxy" } },
    { id: "cc-neon", name: "Neon", game: "Cursor Clicker", visual: { type: "cursor", material: "neon" } },
    { id: "nba-volt", name: "Volt Runner", game: "Neon Bot Arena", visual: { type: "portrait", heroClass: "volt" } },
    { id: "nba-titan", name: "Shield Titan", game: "Neon Bot Arena", visual: { type: "portrait", heroClass: "titan" } },
    { id: "nba-nova", name: "Nova Shade", game: "Neon Bot Arena", visual: { type: "portrait", heroClass: "nova" } },
    { id: "nba-maske", name: "Scipios Maske", game: "Neon Bot Arena", visual: { type: "companion", color: "#9ca3af", glow: "#f3f4f6" } }
  ];

  function renderShowcaseVisual(item) {
    var v = item.visual;
    if (v.type === "snake") {
      return '<span class="profil-showcase-visual-snake" style="background:linear-gradient(145deg,' + v.head + "," + v.body + ')"></span>';
    }
    if (v.type === "cursor") {
      return '<span class="profil-showcase-visual-cursor">' + renderCursorGlyph(v.material) + "</span>";
    }
    if (v.type === "portrait") {
      return '<span class="profil-showcase-visual-portrait ' + v.heroClass + '"></span>';
    }
    if (v.type === "companion") {
      return '<span class="profil-showcase-visual-companion" style="--companion-color:' + v.color + ";--companion-glow:" + v.glow + '"></span>';
    }
    return "";
  }

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

  function formatLastPlayed(gameId, iso) {
    if (!gameId || !iso) return "Noch nicht verfügbar";
    var label = GAME_LABELS[gameId] || gameId;
    try {
      var when = new Date(iso).toLocaleString("de-DE", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
      return label + " · " + when;
    } catch (e) {
      return label;
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

  // Benutzername aendern: Popover wie beim Beschreibungs-Editor. Live-Check
  // waehrend des Tippens ist reine UX (username_available()), die
  // eigentliche Aenderung + erneute Format-/Eindeutigkeitspruefung passiert
  // serverseitig in set_username() — der Client-Regex hier darf also nie die
  // einzige Absicherung sein.
  function setupUsernameEditor(currentUsername) {
    var editBtn = document.getElementById("profil-name-edit");
    var editor = document.getElementById("profil-name-editor");
    var input = document.getElementById("profil-name-input");
    var hint = document.getElementById("profil-name-hint");
    var cancelBtn = document.getElementById("profil-name-cancel");
    var saveBtn = document.getElementById("profil-name-save");
    var nameEl = document.getElementById("profil-name");
    var settingsNameEl = document.getElementById("profil-settings-name");
    if (!editBtn || !editor || !input || !hint || !cancelBtn || !saveBtn || !nameEl) return;

    var username = currentUsername || "";
    var checkTimer = null;
    var checkToken = 0;

    function setHint(text, tone) {
      hint.textContent = text || "";
      hint.classList.toggle("is-error", tone === "error");
      hint.classList.toggle("is-ok", tone === "ok");
    }

    function closeEditor(restoreValue) {
      if (restoreValue) input.value = username;
      window.clearTimeout(checkTimer);
      editor.hidden = true;
      editBtn.setAttribute("aria-expanded", "false");
      setHint("");
      saveBtn.disabled = false;
    }

    function openEditor() {
      input.value = username;
      setHint("");
      editor.hidden = false;
      editBtn.setAttribute("aria-expanded", "true");
      window.setTimeout(function () {
        input.focus();
        input.select();
      }, 0);
    }

    editBtn.addEventListener("click", function () {
      if (editor.hidden) openEditor();
      else closeEditor(true);
    });

    cancelBtn.addEventListener("click", function () {
      closeEditor(true);
      editBtn.focus();
    });

    input.addEventListener("input", function () {
      var value = input.value.trim();
      window.clearTimeout(checkTimer);
      if (value === username) {
        setHint("");
        return;
      }
      if (!USERNAME_RE.test(value)) {
        setHint("4–12 Zeichen, keine Leerzeichen.", "error");
        return;
      }
      setHint("Prüfe Verfügbarkeit …");
      var token = ++checkToken;
      checkTimer = window.setTimeout(async function () {
        try {
          var res = await sb.rpc("username_available", { p_username: value });
          if (token !== checkToken) return;
          if (res.error) {
            setHint("");
            return;
          }
          setHint(res.data ? "Verfügbar." : "Bereits vergeben.", res.data ? "ok" : "error");
        } catch (err) {
          if (token !== checkToken) return;
          setHint("");
        }
      }, 350);
    });

    editor.addEventListener("submit", async function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (value === username) {
        closeEditor(false);
        return;
      }
      if (!USERNAME_RE.test(value)) {
        setHint("4–12 Zeichen, keine Leerzeichen.", "error");
        return;
      }
      saveBtn.disabled = true;
      setHint("Speichere …");
      try {
        var res = await sb.rpc("set_username", { new_username: value });
        if (res.error) throw res.error;
        username = value;
        nameEl.textContent = username;
        if (settingsNameEl) settingsNameEl.textContent = username;
        closeEditor(false);
        editBtn.focus();
      } catch (err) {
        var message = (err && err.message) || "";
        var friendly = message.indexOf("bereits vergeben") !== -1
          ? "Bereits vergeben."
          : message.indexOf("Ungueltiger") !== -1
            ? "4–12 Zeichen, keine Leerzeichen."
            : "Konnte nicht gespeichert werden.";
        setHint(friendly, "error");
      } finally {
        saveBtn.disabled = false;
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !editor.hidden) {
        closeEditor(true);
        editBtn.focus();
      }
    });
  }

  // Schaufenster: jeder leere Platz zeigt ein "+", oeffnet einen Auswahl-
  // Dialog. Neu ausgewaehlte Items landen immer im ersten freien Platz von
  // links, unabhaengig davon welches "+" angeklickt wurde — so bleiben nie
  // Luecken zwischen befuellten Plaetzen. Ein bereits belegter Platz oeffnet
  // stattdessen einen Wechsel-Dialog mit "Kein Item" als erster, ebenfalls
  // kachelfoermiger Option.
  function setupShowcase(userId) {
    var grid = document.getElementById("profil-showcase-grid");
    var picker = document.getElementById("profil-showcase-picker");
    var pickerList = document.getElementById("profil-showcase-picker-list");
    var pickerClose = document.getElementById("profil-showcase-picker-close");
    var pickerTitle = document.getElementById("profil-showcase-picker-title");
    if (!grid || !picker || !pickerList || !pickerClose || !pickerTitle) return;

    var storageKey = "profil-showcase:" + userId;
    var slots = loadSlots();
    var pickerTargetSlot = null; // null = naechster freier Platz, Zahl = genau dieser Platz
    var lastFocusedSlot = null;

    function findItem(id) {
      for (var i = 0; i < SHOWCASE_TEST_CATALOG.length; i++) {
        if (SHOWCASE_TEST_CATALOG[i].id === id) return SHOWCASE_TEST_CATALOG[i];
      }
      return null;
    }

    function loadSlots() {
      var out = new Array(SHOWCASE_SLOT_COUNT).fill(null);
      try {
        var raw = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(raw)) {
          for (var i = 0; i < SHOWCASE_SLOT_COUNT; i++) {
            if (typeof raw[i] === "string" && findItem(raw[i])) out[i] = raw[i];
          }
        }
      } catch (e) {
        /* Start mit leeren Plaetzen, wenn localStorage nicht lesbar ist */
      }
      return out;
    }

    function saveSlots() {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(slots));
      } catch (e) {
        /* Auswahl gilt dann nur fuer diese Seitenansicht */
      }
    }

    function firstFreeSlot() {
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i]) return i;
      }
      return -1;
    }

    function renderSlots() {
      grid.querySelectorAll(".profil-showcase-slot").forEach(function (btn) {
        var index = Number(btn.dataset.slot);
        var item = slots[index] ? findItem(slots[index]) : null;
        btn.classList.toggle("has-item", Boolean(item));
        if (item) {
          btn.setAttribute("aria-label", item.name + " (" + item.game + ") — antippen zum Ändern");
          // Bild fuellt den ganzen Platz aus (kein verschachtelter kleinerer
          // Kasten), Name/Spiel liegen als Beschriftung unten drauf.
          btn.innerHTML =
            '<span class="profil-showcase-slot-art">' + renderShowcaseVisual(item) + "</span>" +
            '<span class="profil-showcase-slot-label">' +
            '<span class="profil-showcase-item-name">' + escapeHtml(item.name) + "</span>" +
            '<span class="profil-showcase-item-game">' + escapeHtml(item.game) + "</span>" +
            "</span>";
        } else {
          btn.setAttribute("aria-label", "Leerer Schaufenster-Platz — Item hinzufügen");
          btn.innerHTML = '<span class="profil-showcase-plus" aria-hidden="true">+</span>';
        }
      });
    }

    function renderPickerList(isSwap, slotIndex) {
      var usedElsewhere = slots.filter(function (id, i) { return id && i !== slotIndex; });
      var html = "";
      if (isSwap) {
        html +=
          '<button class="profil-showcase-picker-item profil-showcase-picker-item-none" type="button" data-remove="1">' +
          '<span class="profil-showcase-visual"><span class="profil-showcase-visual-none" aria-hidden="true">–</span></span>' +
          '<span class="profil-showcase-item-name">Kein Item</span>' +
          "</button>";
      }
      SHOWCASE_TEST_CATALOG.forEach(function (item) {
        var alreadyShown = usedElsewhere.indexOf(item.id) !== -1;
        var isCurrent = isSwap && slots[slotIndex] === item.id;
        html +=
          '<button class="profil-showcase-picker-item' + (isCurrent ? " is-active" : "") + '" type="button" data-item="' +
          item.id + '"' + (alreadyShown ? " disabled" : "") + ">" +
          '<span class="profil-showcase-visual">' + renderShowcaseVisual(item) + "</span>" +
          '<span class="profil-showcase-item-name">' + escapeHtml(item.name) + "</span>" +
          '<span class="profil-showcase-item-game">' + escapeHtml(item.game) + "</span>" +
          "</button>";
      });
      pickerList.innerHTML = html;
    }

    function openPicker(slotIndex) {
      var isSwap = Boolean(slots[slotIndex]);
      pickerTargetSlot = isSwap ? slotIndex : null;
      lastFocusedSlot = slotIndex;
      pickerTitle.textContent = isSwap ? "Item wechseln" : "Item hinzufügen";
      renderPickerList(isSwap, slotIndex);
      picker.hidden = false;
      window.setTimeout(function () {
        var firstTile = pickerList.querySelector("button");
        if (firstTile) firstTile.focus();
      }, 0);
    }

    function closePicker() {
      picker.hidden = true;
      pickerTargetSlot = null;
      var slotIndex = lastFocusedSlot;
      lastFocusedSlot = null;
      if (slotIndex != null) {
        var btn = grid.querySelector('[data-slot="' + slotIndex + '"]');
        if (btn) btn.focus();
      }
    }

    grid.addEventListener("click", function (event) {
      var btn = event.target.closest(".profil-showcase-slot");
      if (!btn) return;
      openPicker(Number(btn.dataset.slot));
    });

    pickerList.addEventListener("click", function (event) {
      var btn = event.target.closest("button");
      if (!btn) return;
      if (btn.dataset.remove && pickerTargetSlot != null) {
        slots[pickerTargetSlot] = null;
        saveSlots();
        renderSlots();
        closePicker();
        return;
      }
      var itemId = btn.dataset.item;
      if (!itemId || btn.disabled) return;
      if (pickerTargetSlot != null) {
        slots[pickerTargetSlot] = itemId;
      } else {
        var target = firstFreeSlot();
        if (target === -1) {
          closePicker();
          return;
        }
        slots[target] = itemId;
      }
      saveSlots();
      renderSlots();
      closePicker();
    });

    pickerClose.addEventListener("click", closePicker);
    picker.addEventListener("click", function (event) {
      if (event.target === picker) closePicker();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !picker.hidden) closePicker();
    });

    renderSlots();
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
        "username, player_id, avatar_path, avatar_updated_at, created_at, role, last_seen, last_seen_visible, cloud_save_enabled, last_played_game, last_played_at"
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
    document.getElementById("profil-last-played").textContent = formatLastPlayed(profile.last_played_game, profile.last_played_at);

    document.getElementById("profil-settings-name").textContent = profile.username || "Spieler";
    document.getElementById("profil-settings-sub").textContent = playerIdText + " · " + roleLabel;

    renderAvatar("profil-avatar-wrap", profile.avatar_path, profile.avatar_updated_at);
    renderAvatar("profil-settings-avatar-wrap", profile.avatar_path, profile.avatar_updated_at);
    setupStatusEditor(session.user.id);
    setupUsernameEditor(profile.username || "");
    setupShowcase(session.user.id);

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
