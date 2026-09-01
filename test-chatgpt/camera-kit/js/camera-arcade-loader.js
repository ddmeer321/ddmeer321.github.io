(function () {
  var startButton = document.getElementById("ca-start");
  var configState = document.getElementById("ca-config-state");
  if (!startButton || !configState) return;

  var scriptBase = new URL(".", document.currentScript.src);
  var runtimeConfig = null;
  var bundlePromise = null;

  function setConfigState(text, tone) {
    configState.textContent = text || "";
    configState.dataset.tone = tone || "info";
  }

  function validConfig(value) {
    return Boolean(
      value &&
      typeof value.apiToken === "string" && value.apiToken.trim() &&
      typeof value.lensGroupId === "string" && value.lensGroupId.trim()
    );
  }

  async function loadLocalConfig() {
    if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return null;
    try {
      var response = await fetch("/__camera-kit/config", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return null;
      var value = await response.json();
      return validConfig(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  async function loadProtectedConfig() {
    var sb = window.supabaseClient;
    if (!sb) throw new Error("Das Anmeldesystem konnte nicht geladen werden.");

    var sessionResult = await sb.auth.getSession();
    var session = sessionResult && sessionResult.data && sessionResult.data.session;
    if (!session) throw new Error("Bitte melde dich zuerst mit einem Testkonto an.");

    var functionResult = await sb.functions.invoke("camera-kit-config", {
      method: "POST",
      body: {},
    });

    if (functionResult.error) {
      throw new Error("Camera Kit ist online noch nicht konfiguriert oder dein Rang reicht nicht aus.");
    }
    if (!validConfig(functionResult.data)) {
      throw new Error("Die Camera-Kit-Konfiguration ist unvollständig.");
    }
    return functionResult.data;
  }

  async function prepareConfig() {
    setConfigState("Sichere Testkonfiguration wird geladen …");
    var local = await loadLocalConfig();
    runtimeConfig = local || await loadProtectedConfig();

    startButton.disabled = false;
    startButton.textContent = "Camera Arcade starten";
    setConfigState(
      local ? "Lokale Staging-Konfiguration bereit." : "Geschützte Staging-Konfiguration bereit.",
      "success"
    );
  }

  function loadBundle() {
    if (window.CameraArcade && typeof window.CameraArcade.start === "function") {
      return Promise.resolve(window.CameraArcade);
    }
    if (bundlePromise) return bundlePromise;

    bundlePromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = new URL("camera-arcade.bundle.js?v=1", scriptBase).href;
      script.async = true;
      script.onload = function () {
        if (window.CameraArcade && typeof window.CameraArcade.start === "function") {
          resolve(window.CameraArcade);
        } else {
          reject(new Error("Camera-Arcade-Modul wurde nicht gefunden."));
        }
      };
      script.onerror = function () {
        reject(new Error("Camera-Arcade-Modul konnte nicht geladen werden."));
      };
      document.head.appendChild(script);
    });

    return bundlePromise;
  }

  startButton.addEventListener("click", async function () {
    if (!runtimeConfig) return;
    startButton.disabled = true;
    startButton.textContent = "Camera Kit wird geladen …";
    setConfigState("Beim ersten Start kann das Laden einen Moment dauern.");

    try {
      var arcade = await loadBundle();
      await arcade.start(runtimeConfig);
    } catch (error) {
      startButton.disabled = false;
      startButton.textContent = "Erneut versuchen";
      setConfigState(error && error.message ? error.message : "Camera Kit konnte nicht gestartet werden.", "error");
    }
  });

  window.addEventListener("beforeunload", function () {
    if (window.CameraArcade && typeof window.CameraArcade.destroy === "function") {
      window.CameraArcade.destroy();
    }
  });

  prepareConfig().catch(function (error) {
    startButton.disabled = true;
    startButton.textContent = "Camera Kit nicht verfügbar";
    setConfigState(error && error.message ? error.message : "Konfiguration konnte nicht geladen werden.", "error");
  });
})();
