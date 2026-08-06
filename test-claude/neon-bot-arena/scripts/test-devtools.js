import { MAX_TEST_LOG_ENTRIES, readTestLogs } from "./test-logger.js?v=testlogs1";
import { saveCoins } from "./storage.js?v=musicvolume1";

const consoleEntries = [];
const maxConsoleEntries = 250;
const commandHistory = [];
let activeTab = "console";
let latestPayload = "";
let patched = false;
let refreshTimer = null;
let historyIndex = 0;

export function setupTestDevtools(state) {
  patchConsole();
  const dock = document.querySelector("#testDevtoolsDock");
  const output = document.querySelector("#testDevtoolsOutput");
  const title = document.querySelector("#testDevtoolsTitle");
  const status = document.querySelector("#testDevtoolsStatus");
  const tabs = [...document.querySelectorAll("[data-devtools-tab]")];
  const openButtons = [
    document.querySelector("#openTestDevtoolsBtn"),
    document.querySelector("#testGameDevtoolsBtn")
  ].filter(Boolean);
  const closeButton = document.querySelector("#testDevtoolsCloseBtn");
  const refreshButton = document.querySelector("#testDevtoolsRefreshBtn");
  const copyButton = document.querySelector("#testDevtoolsCopyBtn");
  const clearButton = document.querySelector("#testDevtoolsClearBtn");
  const commandForm = document.querySelector("#testDevtoolsCommandForm");
  const commandInput = document.querySelector("#testDevtoolsCommandInput");

  if (!dock || !output) return;

  const render = () => {
    latestPayload = buildPayload(activeTab, state);
    output.textContent = latestPayload;
    if (title) title.textContent = getTabTitle(activeTab);
    tabs.forEach((tab) => tab.classList.toggle("selected", tab.dataset.devtoolsTab === activeTab));
  };

  const open = () => {
    dock.classList.remove("hidden");
    document.body.classList.add("test-devtools-open");
    render();
    window.setTimeout(() => commandInput?.focus(), 80);
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(render, 900);
  };

  const close = () => {
    dock.classList.add("hidden");
    document.body.classList.remove("test-devtools-open");
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  closeButton?.addEventListener("click", close);
  refreshButton?.addEventListener("click", () => {
    render();
    setStatus(status, "Aktualisiert");
  });
  copyButton?.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard nicht verfügbar");
      await navigator.clipboard.writeText(latestPayload || buildPayload(activeTab, state));
      setStatus(status, "In Zwischenablage kopiert");
    } catch {
      setStatus(status, "Kopieren fehlgeschlagen");
    }
  });
  clearButton?.addEventListener("click", () => {
    consoleEntries.length = 0;
    render();
    setStatus(status, "Console geleert");
  });
  commandForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = commandInput?.value.trim() || "";
    if (!command) return;
    commandHistory.push(command);
    if (commandHistory.length > 80) commandHistory.shift();
    historyIndex = commandHistory.length;
    if (commandInput) commandInput.value = "";
    const result = runCommand(command, state);
    if (result?.tab) activeTab = result.tab;
    if (result?.clearConsole) consoleEntries.length = 0;
    if (result?.message) pushConsoleEntry(result.level || "info", [`> ${command}`, result.message]);
    render();
    setStatus(status, result?.status || "Befehl ausgeführt");
  });
  commandInput?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      commandInput.value = commandHistory[historyIndex] || "";
      commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(commandHistory.length, historyIndex + 1);
      commandInput.value = commandHistory[historyIndex] || "";
      commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
    }
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.devtoolsTab || "console";
      render();
    });
  });

  dock.addEventListener("pointerdown", (event) => event.stopPropagation());
  dock.addEventListener("touchmove", (event) => event.stopPropagation(), { passive: true });

  window.addEventListener("testlogchange", () => {
    if (!dock.classList.contains("hidden") && activeTab === "logs") render();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dock.classList.contains("hidden")) close();
  });
}

function runCommand(rawCommand, state) {
  const [commandRaw = "", ...args] = rawCommand.trim().split(/\s+/);
  const command = commandRaw.toLowerCase();
  const firstArg = args[0]?.toLowerCase();

  if (["help", "?"].includes(command)) {
    return {
      message: [
        "Befehle:",
        "help",
        "tab console|state|logs|storage|env",
        "clear oder clear console",
        "god / god on / god off",
        "heal",
        "score 100000",
        "coins 50000",
        "wave 20",
        "blind 10",
        "kill",
        "clear threats",
        "pickup heal|damage|speed",
        "pause / resume",
        "copy state"
      ].join("\n"),
      tab: "console",
      status: "Hilfe angezeigt"
    };
  }

  if (command === "tab") {
    const tab = normalizeTab(firstArg);
    return tab ? { message: `Tab gewechselt: ${tab}`, tab, status: `Tab: ${tab}` } : unknownCommand(rawCommand);
  }

  if (["state", "logs", "storage", "env", "info", "console"].includes(command)) {
    const tab = normalizeTab(command);
    return { message: `Tab gewechselt: ${tab}`, tab, status: `Tab: ${tab}` };
  }

  if (command === "clear") {
    if (!firstArg || firstArg === "console") {
      return { message: "Console geleert", clearConsole: true, tab: "console", status: "Console geleert" };
    }
    if (["threat", "threats", "gefahren"].includes(firstArg)) {
      const removed = clearThreats(state);
      return { message: `Gefahren gelöscht: ${removed}`, status: "Gefahren gelöscht" };
    }
  }

  if (command === "god") {
    const enabled = firstArg === "on" ? true : firstArg === "off" ? false : !state.debugGodMode;
    state.debugGodMode = enabled;
    if (enabled && state.player) healPlayer(state);
    return { message: `Godmode ${enabled ? "AN" : "AUS"}`, status: `Godmode ${enabled ? "AN" : "AUS"}` };
  }

  if (command === "heal") {
    const ok = healPlayer(state);
    return ok ? { message: "Spieler geheilt", status: "Geheilt" } : { message: "Kein Spieler aktiv", level: "warn", status: "Keine Runde" };
  }

  if (command === "score") {
    const amount = parseNumber(args[0], 100000);
    state.score = Math.max(0, Math.round((Number(state.score) || 0) + amount));
    return { message: `Score: ${state.score}`, status: "Score geändert" };
  }

  if (command === "coins") {
    const amount = parseNumber(args[0], 50000);
    state.coins = Math.max(0, Math.round(amount));
    saveCoins(state.coins);
    return { message: `Coins gesetzt: ${state.coins}`, status: "Coins gesetzt" };
  }

  if (command === "wave") {
    const wave = Math.max(1, Math.min(999, parseNumber(args[0], state.wave || 1)));
    state.wave = wave;
    return { message: `Welle gesetzt: ${state.wave}`, status: "Welle gesetzt" };
  }

  if (command === "blind") {
    if (!state.player) return { message: "Kein Spieler aktiv", level: "warn", status: "Keine Runde" };
    state.player.blindnessTimer = Math.max(0, Math.min(60, parseNumber(args[0], 10)));
    return { message: `Blindheit: ${state.player.blindnessTimer}s`, status: "Blindheit gesetzt" };
  }

  if (["kill", "killall"].includes(command)) {
    const count = state.robots?.length || 0;
    for (const robot of state.robots || []) robot.hp = 0;
    return { message: `${count} Gegner markiert`, status: "Gegner besiegt" };
  }

  if (command === "pickup") {
    const type = ["heal", "damage", "speed"].includes(firstArg) ? firstArg : "heal";
    const ok = spawnPickup(state, type);
    return ok ? { message: `Pickup gespawnt: ${type}`, status: "Pickup gespawnt" } : { message: "Kein Spieler aktiv", level: "warn", status: "Keine Runde" };
  }

  if (command === "pause") {
    state.paused = true;
    return { message: "Spiel pausiert", status: "Pause" };
  }

  if (command === "resume") {
    state.paused = false;
    return { message: "Spiel läuft weiter", status: "Resume" };
  }

  if (command === "copy" && firstArg === "state") {
    return { message: JSON.stringify(createStateSnapshot(state), null, 2), tab: "console", status: "State angezeigt" };
  }

  return unknownCommand(rawCommand);
}

function normalizeTab(value = "") {
  const tab = String(value).toLowerCase();
  if (["console", "state", "logs", "storage", "env"].includes(tab)) return tab;
  if (tab === "info") return "env";
  return "";
}

function unknownCommand(command) {
  return {
    message: `Unbekannter Befehl: ${command}\nTipp: help`,
    level: "warn",
    tab: "console",
    status: "Unbekannter Befehl"
  };
}

function parseNumber(value, fallback) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function healPlayer(state) {
  if (!state.player) return false;
  state.player.hp = state.player.maxHp;
  state.player.dead = false;
  state.player.respawnTimer = 0;
  state.player.healFlash = 0.8;
  return true;
}

function clearThreats(state) {
  const count = (state.enemyBullets?.length || 0) + (state.bullets?.length || 0) + (state.bossLasers?.length || 0);
  state.enemyBullets = [];
  state.bullets = [];
  state.bossLasers = [];
  state.shake = 0;
  for (const robot of state.robots || []) {
    robot.quakeCharge = 0;
    robot.quakeBlast = 0;
  }
  return count;
}

function spawnPickup(state, type) {
  if (!state.player) return false;
  const colors = { heal: "#b7ff4a", damage: "#ff7a3d", speed: "#38d8ff" };
  state.pickups.push({
    id: `devtools-pickup-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    x: Math.min(1230, Math.max(50, state.player.x + 44)),
    y: Math.min(662, Math.max(92, state.player.y)),
    type,
    color: colors[type] || colors.heal,
    radius: 12,
    life: 9
  });
  return true;
}

function patchConsole() {
  if (patched) return;
  patched = true;

  ["log", "warn", "error", "info"].forEach((method) => {
    const original = console[method]?.bind(console);
    console[method] = (...args) => {
      pushConsoleEntry(method, args);
      original?.(...args);
    };
  });

  window.addEventListener("error", (event) => {
    pushConsoleEntry("error", [
      event.message,
      `${getShortFile(event.filename)}:${event.lineno || 0}:${event.colno || 0}`
    ]);
  });
  window.addEventListener("unhandledrejection", (event) => {
    pushConsoleEntry("error", ["Unhandled promise", event.reason instanceof Error ? event.reason.message : event.reason]);
  });
}

function pushConsoleEntry(method, args) {
  consoleEntries.push({
    time: new Date().toLocaleTimeString("de-DE"),
    method,
    message: args.map(formatConsoleValue).join(" ")
  });
  if (consoleEntries.length > maxConsoleEntries) consoleEntries.splice(0, consoleEntries.length - maxConsoleEntries);
}

function buildPayload(tab, state) {
  if (tab === "state") return JSON.stringify(createStateSnapshot(state), null, 2);
  if (tab === "logs") return formatLogs();
  if (tab === "storage") return JSON.stringify(getStorageSnapshot(), null, 2);
  if (tab === "env") return JSON.stringify(getEnvironmentSnapshot(), null, 2);
  return formatConsole();
}

function formatConsole() {
  if (consoleEntries.length === 0) return "Noch keine Console-Einträge.";
  return consoleEntries
    .slice(-120)
    .map((entry) => `[${entry.time}] ${entry.method.toUpperCase()}  ${entry.message}`)
    .join("\n");
}

function formatLogs() {
  const logs = readTestLogs();
  if (logs.length === 0) return "Noch keine lokalen Testlogs.";
  return logs
    .slice(-120)
    .reverse()
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString("de-DE");
      return `[${time}] ${entry.type}\n${JSON.stringify(entry.details, null, 2)}`;
    })
    .join("\n\n");
}

function createStateSnapshot(state) {
  const player = state.player;
  const boss = state.robots?.find((robot) => robot.endboss);
  return {
    running: state.running,
    paused: state.paused,
    over: state.over,
    mode: state.endbossMode ? "endboss" : "normal",
    difficulty: state.difficulty,
    wave: state.wave,
    score: state.score,
    selectedHero: state.selectedHero,
    debugGodMode: Boolean(state.debugGodMode),
    player: player ? {
      hp: round(player.hp),
      maxHp: player.maxHp,
      x: round(player.x),
      y: round(player.y),
      dead: Boolean(player.dead),
      invincible: round(player.invincible || 0),
      blindness: round(player.blindnessTimer || 0),
      specialTimer: round(player.specialTimer || 0)
    } : null,
    boss: boss ? {
      phase: boss.endbossPhase,
      hp: round(boss.hp),
      maxHp: boss.maxHp,
      x: round(boss.x),
      y: round(boss.y),
      attackTimer: round(boss.bossAttackTimer || 0)
    } : null,
    counts: {
      robots: state.robots?.length || 0,
      bullets: state.bullets?.length || 0,
      enemyBullets: state.enemyBullets?.length || 0,
      bossLasers: state.bossLasers?.length || 0,
      pickups: state.pickups?.length || 0,
      particles: state.particles?.length || 0,
      localLogs: readTestLogs().length
    },
    multiplayer: {
      active: Boolean(state.multiplayer?.active),
      role: state.multiplayer?.role || "solo",
      playerCount: state.multiplayer?.playerCount || 1,
      remotePlayers: state.remotePlayers?.length || 0,
      roundId: state.multiplayer?.roundId || 0
    }
  };
}

function getStorageSnapshot() {
  const result = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("neon-bot-arena")) continue;
      const value = localStorage.getItem(key);
      result[key] = value && value.length > 900 ? `${value.slice(0, 900)}… (${value.length} Zeichen)` : value;
    }
  } catch {
    result.error = "localStorage nicht lesbar";
  }
  return result;
}

function getEnvironmentSnapshot() {
  return {
    url: location.href,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    language: navigator.language,
    platform: navigator.platform,
    touchPoints: navigator.maxTouchPoints,
    localLogs: `${readTestLogs().length}/${MAX_TEST_LOG_ENTRIES}`,
    memory: performance?.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : "nicht verfügbar"
  };
}

function getTabTitle(tab) {
  return {
    console: "Console",
    state: "State",
    logs: "Logs",
    storage: "Storage",
    env: "Info"
  }[tab] || "Console";
}

function formatConsoleValue(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function setStatus(element, text) {
  if (!element) return;
  element.textContent = text;
  window.clearTimeout(element._statusTimer);
  element._statusTimer = window.setTimeout(() => {
    element.textContent = "Bereit";
  }, 2200);
}

function getShortFile(value) {
  try {
    return new URL(value).pathname.split("/").pop() || "";
  } catch {
    return String(value || "");
  }
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
