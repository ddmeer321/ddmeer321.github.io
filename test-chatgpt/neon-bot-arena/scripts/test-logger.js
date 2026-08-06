export const TEST_LOG_STORAGE_KEY = "neon-bot-arena-test-logs";
export const MAX_TEST_LOG_ENTRIES = 500;

let currentSessionId = null;

export function createTestLogEntry(type, details = {}, options = {}) {
  return {
    timestamp: new Date(options.now ?? Date.now()).toISOString(),
    sessionId: options.sessionId || getSessionId(),
    type: normalizeType(type),
    details: sanitizeDetails(details)
  };
}

export function appendTestLog(type, details = {}, storage = getStorage()) {
  if (!storage) return null;
  const entry = createTestLogEntry(type, details);
  try {
    const entries = readTestLogs(storage);
    entries.push(entry);
    storage.setItem(TEST_LOG_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_TEST_LOG_ENTRIES)));
    globalThis.window?.dispatchEvent(new CustomEvent("testlogchange"));
    return entry;
  } catch {
    return null;
  }
}

export function readTestLogs(storage = getStorage()) {
  if (!storage) return [];
  try {
    return normalizeTestLogs(JSON.parse(storage.getItem(TEST_LOG_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function clearTestLogs(storage = getStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(TEST_LOG_STORAGE_KEY);
    globalThis.window?.dispatchEvent(new CustomEvent("testlogchange"));
  } catch {
    // Lokale Logs sind eine Komfortfunktion und dürfen das Spiel nie blockieren.
  }
}

export function normalizeTestLogs(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object" && typeof entry.type === "string")
    .slice(-MAX_TEST_LOG_ENTRIES)
    .map((entry) => ({
      timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date(0).toISOString(),
      sessionId: String(entry.sessionId || "unknown").slice(0, 40),
      type: normalizeType(entry.type),
      details: sanitizeDetails(entry.details)
    }));
}

export function setupTestLoggerUI() {
  const overlay = document.querySelector("#testLogOverlay");
  const list = document.querySelector("#testLogList");
  const summary = document.querySelector("#testLogSummary");
  const status = document.querySelector("#testLogStatus");

  const render = () => {
    const entries = readTestLogs();
    if (summary) summary.textContent = `${entries.length}/${MAX_TEST_LOG_ENTRIES} lokale Ereignisse`;
    if (!list) return;
    if (entries.length === 0) {
      list.innerHTML = '<p class="test-log-empty">Noch keine Testereignisse vorhanden.</p>';
      return;
    }
    list.innerHTML = entries
      .slice(-150)
      .reverse()
      .map((entry) => {
        const time = escapeHtml(new Date(entry.timestamp).toLocaleTimeString("de-DE"));
        const type = escapeHtml(entry.type);
        const details = escapeHtml(formatDetails(entry.details));
        return `<article class="test-log-row"><time>${time}</time><strong>${type}</strong><code>${details}</code></article>`;
      })
      .join("");
  };

  const open = () => {
    render();
    overlay?.classList.remove("hidden");
  };
  const close = () => overlay?.classList.add("hidden");

  document.querySelector("#openTestLogsBtn")?.addEventListener("click", open);
  document.querySelector("#closeTestLogsBtn")?.addEventListener("click", close);
  document.querySelector("#downloadTestLogsBtn")?.addEventListener("click", () => {
    const entries = readTestLogs();
    downloadJson(entries);
    if (status) status.textContent = entries.length ? "JSON-Datei erstellt." : "Leere JSON-Datei erstellt.";
  });
  document.querySelector("#clearTestLogsBtn")?.addEventListener("click", () => {
    clearTestLogs();
    render();
    if (status) status.textContent = "Lokale Logs gelöscht.";
  });
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener("testlogchange", render);
  window.addEventListener("error", (event) => {
    appendTestLog("browser_error", {
      message: event.message,
      file: getFileName(event.filename),
      line: event.lineno
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    appendTestLog("promise_error", {
      message: event.reason instanceof Error ? event.reason.message : String(event.reason || "Unbekannt")
    });
  });
  window.addEventListener("online", () => appendTestLog("network_online"));
  window.addEventListener("offline", () => appendTestLog("network_offline"));

  appendTestLog("test_site_loaded", {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: document.documentElement.lang || "de"
  });
  render();
}

function getSessionId() {
  if (currentSessionId) return currentSessionId;
  const random = globalThis.crypto?.getRandomValues
    ? [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    : Math.random().toString(16).slice(2, 18);
  currentSessionId = `session-${Date.now().toString(36)}-${random}`;
  return currentSessionId;
}

function getStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function normalizeType(value) {
  return String(value || "event")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 50) || "event";
}

function sanitizeDetails(value, depth = 0) {
  if (depth > 2) return "[gekürzt]";
  if (value === null || value === undefined) return {};
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((entry) => sanitizeDetails(entry, depth + 1));
  if (typeof value !== "object") return String(value).slice(0, 160);
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, entry]) => [String(key).slice(0, 40), sanitizeDetails(entry, depth + 1)])
  );
}

function formatDetails(details) {
  if (!details || typeof details !== "object" || Object.keys(details).length === 0) return "–";
  return JSON.stringify(details);
}

function getFileName(value) {
  try {
    return new URL(value).pathname.split("/").pop() || "";
  } catch {
    return String(value || "").slice(-80);
  }
}

function downloadJson(entries) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Neon Bot Arena Testlabor",
    localOnly: true,
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `neon-bot-arena-testlog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
