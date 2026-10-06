// test-claude-Kopie von assets/js/profil.js (Original unveraendert) - einzige
// Ergaenzung ist die Biti-Karte (setupBitiViewToggle + setupBitiCard), am
// Ende dieser Datei, aufgerufen aus render(). Alles andere 1:1 wie im echten
// Profil.
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
  var GAME_LABELS = { snake: "Snake", "cursor-clicker": "Cursor Clicker" };
  var STATUS_MAX_LENGTH = 80;
  var EMPTY_STATUS_TEXT = "Ich liebe Spiele";
  var USERNAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9!"#$%&'()*+,\-./:;<=>?[\]^_`{|}~]{4,12}$/;

  var SHOWCASE_SLOT_COUNT = 6;

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
      var when = new Date(iso).toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
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

  function renderAvatar(wrapId, path, updatedAt) {
    var wrap = document.getElementById(wrapId);
    if (!wrap) return;
    var url = avatarUrl(path, updatedAt);
    wrap.innerHTML = url
      ? '<img class="profil-avatar" src="' + escapeHtml(url) + '" alt="" width="88" height="88" />'
      : '<span class="profil-avatar is-empty" aria-hidden="true"></span>';
  }

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

  function setupShowcase(userId) {
    var grid = document.getElementById("profil-showcase-grid");
    var picker = document.getElementById("profil-showcase-picker");
    var pickerList = document.getElementById("profil-showcase-picker-list");
    var pickerClose = document.getElementById("profil-showcase-picker-close");
    var pickerTitle = document.getElementById("profil-showcase-picker-title");
    if (!grid || !picker || !pickerList || !pickerClose || !pickerTitle) return;

    var storageKey = "profil-showcase:" + userId;
    var slots = loadSlots();
    var pickerTargetSlot = null;
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
      btn.setAttribute("aria-checked", String(current));
      btn.classList.toggle("is-on", current);
    } finally {
      btn.disabled = false;
    }
  }

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

  // ---------- Biti-Karte (neu) ----------
  //
  // Runder Umschalter 2D/3D: sowohl Klick als auch Ziehen bedienbar. Waehrend
  // des Ziehens wird der Kopf per Inline-Transform direkt der Maus
  // nachgefuehrt (CSS-Transition ueber .is-dragging abgeschaltet); beim
  // Loslassen entscheidet die naehere Seite (oder, bei kaum Bewegung, ein
  // einfacher Wechsel wie bei einem Klick).
  function setupBitiViewToggle(onChange) {
    var toggle = document.getElementById("profil-biti-view-toggle");
    var knob = document.getElementById("profil-biti-view-knob");
    if (!toggle || !knob) return { get: function () { return "2d"; }, set: function () {} };

    var KNOB_MIN = 3, KNOB_MAX = 47; // 3 + 44px Hub, siehe .profil-biti-view-knob/-toggle[aria-checked] in profil.css
    var view = "2d";
    var dragging = false;
    var moved = false;
    var startX = 0;
    var knobStartLeft = KNOB_MIN;

    function clamp(x) {
      return Math.max(KNOB_MIN, Math.min(KNOB_MAX, x));
    }

    function setView(next) {
      view = next;
      toggle.setAttribute("aria-checked", String(next === "3d"));
      onChange(view);
    }

    toggle.addEventListener("pointerdown", function (e) {
      dragging = true;
      moved = false;
      startX = e.clientX;
      knobStartLeft = view === "3d" ? KNOB_MAX : KNOB_MIN;
      toggle.classList.add("is-dragging");
      try { toggle.setPointerCapture(e.pointerId); } catch (err) {}
    });
    toggle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      var x = clamp(knobStartLeft + dx);
      knob.style.transform = "translateX(" + (x - KNOB_MIN) + "px)";
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      toggle.classList.remove("is-dragging");
      knob.style.transform = "";
      if (!moved) {
        setView(view === "2d" ? "3d" : "2d");
        return;
      }
      var dx = e.clientX - startX;
      var x = clamp(knobStartLeft + dx);
      setView(x >= (KNOB_MIN + KNOB_MAX) / 2 ? "3d" : "2d");
    }
    toggle.addEventListener("pointerup", endDrag);
    toggle.addEventListener("pointercancel", endDrag);

    return {
      get: function () { return view; },
      set: setView,
    };
  }

  // Laedt die gespeicherte Figur (oder den Standard-Jungen-Biti, wenn noch
  // keine gespeichert ist - siehe BitiFigureData.DEFAULT_CHAR) und zeigt sie
  // 2D oder 3D an, je nach Umschalter. Beide Ansichten werden erst beim
  // ersten Gebrauch gemountet (lazy), damit niemand fuer eine WebGL-Szene
  // bezahlt, die er nie ansieht.
  function setupBitiCard() {
    var stage = document.getElementById("profil-biti-stage");
    if (!stage || !window.BitiFigureData || !window.BitiFigure2d || !window.BitiFigure3d || !window.CloudSave) return;

    var SAVE_GAME_ID = "biti-charakter";
    var character = null;
    var view2d = null; // { el, api }
    var view3d = null; // { el, api }

    function ensure2d() {
      if (view2d) return view2d;
      var el = document.createElement("div");
      el.className = "profil-biti-view profil-biti-view-2d";
      el.hidden = true;
      stage.appendChild(el);
      view2d = { el: el, api: window.BitiFigure2d.mount(el) };
      return view2d;
    }
    function ensure3d() {
      if (view3d) return view3d;
      var el = document.createElement("div");
      el.className = "profil-biti-view profil-biti-view-3d";
      el.hidden = true;
      stage.appendChild(el);
      // Kein Auto-Drehen in der Profilkarte (anders als im Creator) - auf
      // Wunsch eine ruhige, nur per Ziehen drehbare Ansicht statt staendiger
      // Bewegung auf der eigenen Profilseite.
      view3d = { el: el, api: window.BitiFigure3d.mount(el, { autoRotate: false }) };
      return view3d;
    }

    function showView(mode) {
      if (!character) return;
      stage.setAttribute("data-view", mode);
      if (mode === "3d") {
        var v3 = ensure3d();
        if (view2d) view2d.el.hidden = true;
        v3.el.hidden = false;
        v3.api.applyCharacter(character);
      } else {
        var v2 = ensure2d();
        if (view3d) view3d.el.hidden = true;
        v2.el.hidden = false;
        v2.api.applyCharacter(character);
      }
    }

    var toggleApi = setupBitiViewToggle(function (mode) {
      showView(mode);
    });

    window.CloudSave.load(SAVE_GAME_ID).then(function (saved) {
      character = window.BitiFigureData.withDefaults(saved);
      showView(toggleApi.get());
    });
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
    setupBitiCard();

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
