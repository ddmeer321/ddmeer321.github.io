const multiplayerUrl = "wss://neon-bot-arena.onrender.com";

import { t } from "./settings.js?v=settings9";
import { appendTestLog } from "./test-logger.js?v=testlogs1";

let socket = null;
let connecting = false;
let clientId = null;
let multiplayerState = null;
let currentLobbyCount = 0;
let pendingCoopStart = null;
let coopStartTimer = null;
let startHandlerReady = false;
let lastWorldSend = 0;
let endbossUnlocked = false;
let currentRoomCode = null;
let activeRoundId = 0;
let currentLobbyPlayers = [];
let currentLobbyMaxPlayers = 2;

export function setupMultiplayerTest(dom, state, startGame) {
  multiplayerState = state;
  const updateEndbossAccess = () => {
    const code = String(dom.lobbyCodeInput?.value || "").replace(/\D/g, "").slice(0, 4);
    if (code === "7770") endbossUnlocked = true;
    dom.endbossBtn?.classList.toggle("hidden", !endbossUnlocked);
  };
  dom.lobbyCodeInput?.addEventListener("input", updateEndbossAccess);
  updateEndbossAccess();

  dom.multiplayerTestBtn?.addEventListener("click", () => {
    appendTestLog("multiplayer_connect");
    connect(dom, true);
  });

  dom.createLobbyBtn?.addEventListener("click", () => {
    sendWhenConnected(dom, { type: "create-room", name: getPlayerName(dom) });
  });

  dom.joinLobbyBtn?.addEventListener("click", () => {
    const code = String(dom.lobbyCodeInput?.value || "").replace(/\D/g, "").slice(0, 4);
    if (code === "7770") {
      endbossUnlocked = true;
      updateEndbossAccess();
      setStatus(dom, t("multiplayer.endbossLobby"), "loading");
      sendWhenConnected(dom, { type: "create-room", name: getPlayerName(dom) });
      return;
    }
    if (code.length !== 4) {
      setStatus(dom, t("multiplayer.codeMissing"), "error");
      return;
    }
    sendWhenConnected(dom, { type: "join-room", code, name: getPlayerName(dom) });
  });

  dom.leaveLobbyBtn?.addEventListener("click", () => {
    if (socket?.readyState === 1) socket.send(JSON.stringify({ type: "leave-room" }));
    setLobby(dom, null, 0, 3, []);
    resetMultiplayerState();
  });

  dom.coopStartBtn?.addEventListener("click", () => {
    if (currentLobbyCount !== 2) {
      setStatus(dom, t("multiplayer.needsTwo"), "error");
      return;
    }
    sendWhenConnected(dom, { type: "start-room", gameMode: state.gameMode });
  });

  dom.endbossBtn?.addEventListener("click", () => {
    if (!endbossUnlocked) return;
    const playtest = ["localhost", "127.0.0.1"].includes(window.location?.hostname)
      && new URLSearchParams(window.location?.search || "").has("playtest");
    if (state.multiplayer?.active && socket?.readyState === WebSocket.OPEN) {
      if (state.multiplayer.role !== "host") {
        setStatus(dom, t("multiplayer.hostOnly"), "error");
        return;
      }
      setStatus(dom, t("multiplayer.endbossStarting"), "ok");
      socket.send(JSON.stringify({ type: "start-room", mode: "endboss" }));
      return;
    }
    if (playtest) {
      setStatus(dom, t("multiplayer.endbossStarting"), "ok");
      startGame({ endboss: true, skipPrep: true, playtest: true });
      return;
    }
    setStatus(dom, t("multiplayer.endbossLobby"), "loading");
    sendWhenConnected(dom, { type: "create-room", name: getPlayerName(dom) });
  });

  window.setInterval(() => {
    sendLocalPlayerState(state);
  }, 110);

  window.setInterval(() => {
    updateRemotePlayerAges(state);
  }, 250);

  window.addEventListener("beforeunload", () => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave-room" }));
  });

  setupStartHandler(dom, state, startGame);
  window.addEventListener("languagechange", () => {
    setLobby(dom, currentRoomCode, currentLobbyCount, currentLobbyMaxPlayers, currentLobbyPlayers);
  });
}

function sendWhenConnected(dom, message) {
  const active = connect(dom, false);
  if (!active) return;

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return;
  }

  socket.addEventListener("open", () => socket.send(JSON.stringify(message)), { once: true });
}

function connect(dom, pingOnly) {
  if (socket?.readyState === WebSocket.OPEN) {
    if (pingOnly) socket.send(JSON.stringify({ type: "ping" }));
    return true;
  }
  if (connecting) return true;

  connecting = true;
  setStatus(dom, t("multiplayer.connecting"), "loading");
  socket = new WebSocket(multiplayerUrl);

  socket.addEventListener("open", () => {
    connecting = false;
    setStatus(dom, t("multiplayer.connected"), "ok");
    appendTestLog("multiplayer_connected");
    if (pingOnly) socket.send(JSON.stringify({ type: "ping" }));
  });

  socket.addEventListener("message", (event) => {
    const data = parseMessage(event.data);
    if (!data) return;
    if (data.type === "pong") {
      setStatus(dom, t("multiplayer.connected"), "ok");
      appendTestLog("multiplayer_pong");
      return;
    }
    if (data.type === "welcome") {
      clientId = data.clientId || clientId;
      if (multiplayerState?.multiplayer) multiplayerState.multiplayer.clientId = clientId;
      return;
    }
    if (data.type === "room-state") {
      setStatus(dom, t("multiplayer.lobbyConnected"), "ok");
      setLobby(dom, data.code, data.count, data.maxPlayers, data.players);
      setMultiplayerRole(data.hostId);
      pruneRemotePlayers(data.players || [], multiplayerState);
      appendTestLog("lobby_state", {
        playerCount: Number(data.count) || 0,
        maxPlayers: Number(data.maxPlayers) || 2,
        role: multiplayerState?.multiplayer?.role || "solo"
      });
      return;
    }
    if (data.type === "start-game") {
      appendTestLog("multiplayer_game_start", {
        mode: data.mode === "endboss" ? "endboss" : "normal",
        playerCount: Number(data.playerCount) || 1
      });
      startCoopGame(data);
      return;
    }
    if (data.type === "player-states") {
      if (activeRoundId && Number(data.roundId) && Number(data.roundId) !== activeRoundId) return;
      updateRemotePlayers(data.players || [], multiplayerState);
      return;
    }
    if (data.type === "world-state") {
      applyWorldSnapshot(data.snapshot, multiplayerState);
      return;
    }
    if (data.type === "player-action") {
      multiplayerState?.handleMultiplayerAction?.(data);
      return;
    }
    if (data.type === "game-over") {
      if (multiplayerState?.running && !multiplayerState.over && multiplayerState.player) {
        multiplayerState.player.hp = 0;
        multiplayerState.player.dead = true;
        multiplayerState.player.respawnTimer = Math.max(1, Number(multiplayerState.player.respawnTimer) || 20);
        multiplayerState.remotePlayers = (multiplayerState.remotePlayers || []).map((player) => ({
          ...player,
          hp: 0,
          dead: true,
          respawnTimer: Math.max(1, Number(player.respawnTimer) || 20)
        }));
      }
      multiplayerState?.handleMultiplayerGameOver?.();
      return;
    }
    if (data.type === "endboss-result") {
      multiplayerState?.handleMultiplayerEndbossResult?.(Boolean(data.victory));
      return;
    }
    if (data.type === "room-left") {
      setStatus(dom, t("multiplayer.connected"), "ok");
      setLobby(dom, null, 0, 3, []);
      resetMultiplayerState();
      return;
    }
    if (data.type === "room-error" || data.type === "error") {
      setStatus(dom, data.message || t("multiplayer.error"), "error");
      appendTestLog("multiplayer_error", { message: data.message || "unknown" });
    }
  });

  socket.addEventListener("error", () => {
    connecting = false;
    setStatus(dom, t("multiplayer.error"), "error");
    appendTestLog("multiplayer_socket_error");
  });

  socket.addEventListener("close", () => {
    connecting = false;
    socket = null;
    setStatus(dom, t("multiplayer.disconnected"), "error");
    setLobby(dom, null, 0, 3, []);
    resetMultiplayerState();
    appendTestLog("multiplayer_disconnected");
  });

  return true;
}

function parseMessage(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function setStatus(dom, text, state) {
  if (!dom.multiplayerStatus) return;
  dom.multiplayerStatus.textContent = text;
  dom.multiplayerStatus.dataset.state = state;
}

function setLobby(dom, code, count, maxPlayers, players = []) {
  currentRoomCode = code || null;
  currentLobbyCount = count;
  currentLobbyPlayers = players;
  currentLobbyMaxPlayers = maxPlayers;
  if (multiplayerState?.multiplayer) {
    multiplayerState.multiplayer.playerCount = Math.max(1, Math.min(3, Number(count) || 1));
  }
  if (dom.lobbyCodeText) dom.lobbyCodeText.textContent = code ? `Lobby ${code}` : t("multiplayer.noLobby");
  if (dom.lobbyPlayersText) {
    dom.lobbyPlayersText.textContent = count > 2 ? `${count} ${t("multiplayer.players")}` : `${count}/2 ${t("multiplayer.players")}`;
  }
  if (dom.coopStartText) {
    dom.coopStartText.textContent = count === 2
      ? `2/2 ${t("multiplayer.ready")}`
      : count === 1
        ? `1/2 · ${t("multiplayer.secondMissing")}`
        : t("multiplayer.coopPlayers");
  }
  if (dom.lobbyNames) {
    dom.lobbyNames.textContent = players.length
      ? players.map((player) => `${player.slot}. ${player.name || t("multiplayer.player")}${player.host ? " (Host)" : ""}`).join(" | ")
      : t("multiplayer.emptyLobby");
  }
  if (code && dom.lobbyCodeInput) dom.lobbyCodeInput.value = code;
}

function getPlayerName(dom) {
  const value = String(dom.playerNameInput?.value || "").trim().replace(/\s+/g, " ").slice(0, 16);
  return value || t("multiplayer.player");
}

function sendLocalPlayerState(state) {
  if (socket?.readyState !== WebSocket.OPEN || !state.running || state.over || !state.player) return;
  if (socket.bufferedAmount > 50000) return;
  socket.send(JSON.stringify({
    type: "player-state",
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    hero: state.player.hero?.name || state.selectedHero || "Held",
    color: state.player.hero?.color || "#38d8ff",
    hp: Math.round(state.player.hp),
    maxHp: Math.round(state.player.maxHp),
    dead: Boolean(state.player.dead),
    respawnTimer: Math.max(0, Number(state.player.respawnTimer) || 0)
  }));
  sendWorldSnapshot(state);
}

function updateRemotePlayers(players, state) {
  if (!state) return;
  const now = performance.now();
  const previousById = new Map((state.remotePlayers || []).map((player) => [player.id, player]));
  state.remotePlayers = players
    .filter((player) => player.id !== clientId)
    .map((player) => {
      const existing = previousById.get(player.id);
      const targetX = Number(player.x) || 0;
      const targetY = Number(player.y) || 0;
      const elapsed = Math.max(0.05, (now - (existing?._networkAt || now - 100)) / 1000);
      if (!existing) {
        return {
          id: player.id,
          name: player.name || "Spieler",
          hero: player.hero || "Held",
          x: targetX,
          y: targetY,
          _networkX: targetX,
          _networkY: targetY,
          _networkVx: 0,
          _networkVy: 0,
          _networkAt: now,
          color: player.color || "#38d8ff",
          hp: Number(player.hp) || 0,
          maxHp: Number(player.maxHp) || 1,
          dead: Boolean(player.dead),
          respawnTimer: Math.max(0, Number(player.respawnTimer) || 0),
          seenAt: now
        };
      }
      existing._networkVx = clampVelocity((targetX - (existing._networkX ?? existing.x)) / elapsed);
      existing._networkVy = clampVelocity((targetY - (existing._networkY ?? existing.y)) / elapsed);
      existing._networkX = targetX;
      existing._networkY = targetY;
      existing._networkAt = now;
      existing.name = player.name || "Spieler";
      existing.hero = player.hero || "Held";
      existing.color = player.color || "#38d8ff";
      existing.hp = Number(player.hp) || 0;
      existing.maxHp = Number(player.maxHp) || 1;
      existing.dead = Boolean(player.dead);
      existing.respawnTimer = Math.max(0, Number(player.respawnTimer) || 0);
      existing.seenAt = now;
      return existing;
    });
}

function updateRemotePlayerAges(state) {
  if (!state?.remotePlayers) return;
  const now = performance.now();
  state.remotePlayers = state.remotePlayers.filter((player) => now - (player.seenAt || 0) < 3000);
}

function pruneRemotePlayers(players, state) {
  if (!state?.remotePlayers) return;
  const activeIds = new Set(players.map((player) => player.id));
  state.remotePlayers = state.remotePlayers.filter((player) => activeIds.has(player.id));
}

function setupStartHandler(dom, state, startGame) {
  const runPendingStart = () => {
    if (!pendingCoopStart) return;
    const payload = pendingCoopStart;
    pendingCoopStart = null;
    if (coopStartTimer) {
      window.clearTimeout(coopStartTimer);
      coopStartTimer = null;
    }
    if (payload.roomCode && payload.roomCode !== currentRoomCode) return;
    state.remotePlayers = [];
    state.multiplayer.active = true;
    state.multiplayer.hostId = payload.hostId || state.multiplayer.hostId;
    state.multiplayer.playerCount = Math.max(1, Math.min(3, Number(payload.playerCount) || state.multiplayer.playerCount || 1));
    state.multiplayer.role = payload.hostId && payload.hostId === clientId ? "host" : "guest";
    activeRoundId = Math.max(0, Number(payload.roundId) || 0);
    state.multiplayer.roundId = activeRoundId;
    const endboss = payload.mode === "endboss";
    const gameMode = payload.gameMode === "one-heart" ? "hardcore" : payload.gameMode;
    state.gameMode = ["normal", "chaos", "hardcore"].includes(gameMode) ? gameMode : "normal";
    window.dispatchEvent(new CustomEvent("gamemodechange", { detail: { mode: state.gameMode } }));
    startGame({
      startWave: Number(payload.wave) || 1,
      coop: true,
      playerCount: state.multiplayer.playerCount,
      endboss,
      skipPrep: endboss,
      chaosSeed: payload.seed
    });
  };

  window.__neonStartCoopGame = (payload) => {
    if (dom.coopStartText) dom.coopStartText.textContent = t("multiplayer.starting");
    setStatus(dom, t("multiplayer.coopStarting"), "ok");
    const delay = Math.max(0, Math.min(5000, Number(payload.delayMs) || 1200));
    pendingCoopStart = {
      ...payload,
      localStartAt: performance.now() + delay
    };
    if (coopStartTimer) window.clearTimeout(coopStartTimer);
    coopStartTimer = window.setTimeout(runPendingStart, delay);
  };

  if (startHandlerReady) return;
  startHandlerReady = true;
  const resumePendingStart = () => {
    if (!pendingCoopStart) return;
    if (performance.now() >= pendingCoopStart.localStartAt - 50) runPendingStart();
  };
  window.addEventListener("focus", resumePendingStart);
  document.addEventListener("visibilitychange", resumePendingStart);
}

function startCoopGame(payload) {
  if (typeof window.__neonStartCoopGame === "function") window.__neonStartCoopGame(payload);
}

function setMultiplayerRole(hostId) {
  if (!multiplayerState?.multiplayer) return;
  multiplayerState.multiplayer.active = Boolean(hostId);
  multiplayerState.multiplayer.hostId = hostId || null;
  multiplayerState.multiplayer.clientId = clientId;
  multiplayerState.multiplayer.role = hostId && hostId === clientId ? "host" : hostId ? "guest" : "solo";
}

function resetMultiplayerState() {
  pendingCoopStart = null;
  if (coopStartTimer) {
    window.clearTimeout(coopStartTimer);
    coopStartTimer = null;
  }
  activeRoundId = 0;
  currentRoomCode = null;
  if (!multiplayerState) return;
  multiplayerState.remotePlayers = [];
  if (multiplayerState.multiplayer) {
    multiplayerState.multiplayer.active = false;
    multiplayerState.multiplayer.role = "solo";
    multiplayerState.multiplayer.hostId = null;
    multiplayerState.multiplayer.playerCount = 1;
    multiplayerState.multiplayer.lastWorldAt = 0;
    multiplayerState.multiplayer.roundId = 0;
  }
}

function sendWorldSnapshot(state) {
  if (state.multiplayer?.role !== "host" || socket?.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastWorldSend < 180 || socket.bufferedAmount > 50000) return;
  lastWorldSend = now;
  socket.send(JSON.stringify({
    type: "world-state",
    snapshot: createWorldSnapshot(state)
  }));
}

function createWorldSnapshot(state) {
  return {
    wave: state.wave,
    score: state.score,
    playerCount: Math.max(1, Math.min(3, Number(state.multiplayer?.playerCount) || 1)),
    prepTimer: state.prepTimer,
    waveDelay: state.waveDelay,
    endbossMode: Boolean(state.endbossMode),
    endbossPhase: state.endbossPhase,
    endbossTransition: state.endbossTransition,
    bossesDefeated: state.bossesDefeated,
    bossCoinBonus: state.bossCoinBonus,
    chaosEventId: state.chaosEventId,
    chaosEventTimer: state.chaosEventTimer,
    chaosBrokenTiles: cloneEntities(state.chaosBrokenTiles, 10),
    chaosMeteors: cloneEntities(state.chaosMeteors, 24),
    robots: cloneEntities(state.robots, 50),
    bullets: cloneEntities(state.bullets, 60),
    enemyBullets: cloneEntities(state.enemyBullets, 60),
    bossLasers: cloneEntities(state.bossLasers, 8),
    pickups: cloneEntities(state.pickups, 20)
  };
}

function cloneEntities(items, limit) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((item) => {
    const clone = {};
    for (const [key, value] of Object.entries(item || {})) {
      if (!key.startsWith("_")) clone[key] = value;
    }
    return clone;
  });
}

function applyWorldSnapshot(snapshot, state) {
  if (!snapshot || state?.multiplayer?.role !== "guest") return;
  const snapshotAt = performance.now();
  const previousAt = Number(state.multiplayer.lastWorldAt) || snapshotAt - 180;
  state.wave = Number(snapshot.wave) || state.wave;
  state.score = Number(snapshot.score) || 0;
  state.multiplayer.playerCount = Math.max(1, Math.min(3, Number(snapshot.playerCount) || state.multiplayer.playerCount || 1));
  state.prepTimer = Number(snapshot.prepTimer) || 0;
  state.waveDelay = Number(snapshot.waveDelay) || 0;
  state.endbossMode = Boolean(snapshot.endbossMode);
  state.endbossPhase = Number(snapshot.endbossPhase) || 0;
  state.endbossTransition = Number(snapshot.endbossTransition) || 0;
  state.bossesDefeated = Number(snapshot.bossesDefeated) || 0;
  state.bossCoinBonus = Number(snapshot.bossCoinBonus) || 0;
  state.chaosEventId = typeof snapshot.chaosEventId === "string" ? snapshot.chaosEventId : state.chaosEventId;
  state.chaosEventTimer = Math.max(0, Number(snapshot.chaosEventTimer) || 0);
  state.chaosBrokenTiles = reconcileNetworkEntities(state.chaosBrokenTiles, snapshot.chaosBrokenTiles, "broken-tile", snapshotAt, previousAt, 10);
  state.chaosMeteors = reconcileNetworkEntities(state.chaosMeteors, snapshot.chaosMeteors, "meteor", snapshotAt, previousAt, 24);
  state.robots = reconcileNetworkEntities(state.robots, snapshot.robots, "robot", snapshotAt, previousAt, 50);
  state.bullets = reconcileNetworkEntities(state.bullets, snapshot.bullets, "bullet", snapshotAt, previousAt, 60);
  state.enemyBullets = reconcileNetworkEntities(state.enemyBullets, snapshot.enemyBullets, "enemy-bullet", snapshotAt, previousAt, 60);
  state.bossLasers = reconcileNetworkEntities(state.bossLasers, snapshot.bossLasers, "boss-laser", snapshotAt, previousAt, 8);
  state.pickups = reconcileNetworkEntities(state.pickups, snapshot.pickups, "pickup", snapshotAt, previousAt, 20);
  state.multiplayer.lastWorldAt = snapshotAt;
}

function reconcileNetworkEntities(currentItems, incomingItems, prefix, snapshotAt, previousAt, limit) {
  const currentById = new Map((Array.isArray(currentItems) ? currentItems : []).map((item) => [item.id, item]));
  const snapshotDelta = Math.max(0.05, Math.min(0.5, (snapshotAt - previousAt) / 1000));
  return (Array.isArray(incomingItems) ? incomingItems : []).slice(0, limit).map((incoming, index) => {
    const id = String(incoming?.id || `${prefix}-${index}`);
    const targetX = Number(incoming?.x) || 0;
    const targetY = Number(incoming?.y) || 0;
    const existing = currentById.get(id);
    if (!existing) {
      return {
        ...incoming,
        id,
        x: targetX,
        y: targetY,
        _networkX: targetX,
        _networkY: targetY,
        _networkVx: Number(incoming?.vx) || 0,
        _networkVy: Number(incoming?.vy) || 0,
        _networkAt: snapshotAt
      };
    }

    const currentX = Number(existing.x) || 0;
    const currentY = Number(existing.y) || 0;
    const previousTargetX = Number(existing._networkX ?? currentX);
    const previousTargetY = Number(existing._networkY ?? currentY);
    for (const [key, value] of Object.entries(incoming || {})) {
      if (key !== "x" && key !== "y" && !key.startsWith("_")) existing[key] = value;
    }
    existing.id = id;
    existing.x = currentX;
    existing.y = currentY;
    existing._networkX = targetX;
    existing._networkY = targetY;
    existing._networkAt = snapshotAt;
    existing._networkVx = Number.isFinite(Number(incoming?.vx))
      ? Number(incoming.vx)
      : clampVelocity((targetX - previousTargetX) / snapshotDelta);
    existing._networkVy = Number.isFinite(Number(incoming?.vy))
      ? Number(incoming.vy)
      : clampVelocity((targetY - previousTargetY) / snapshotDelta);
    return existing;
  });
}

export function updateMultiplayerInterpolation(state, dt) {
  if (!state?.multiplayer?.active) return;
  const now = performance.now();
  smoothNetworkEntities(state.remotePlayers, dt, now, 13, 0.12);
  if (state.multiplayer.role !== "guest") return;
  smoothNetworkEntities(state.robots, dt, now, 12, 0.16);
  smoothNetworkEntities(state.bullets, dt, now, 9, 0.2);
  smoothNetworkEntities(state.enemyBullets, dt, now, 9, 0.2);
  smoothNetworkEntities(state.bossLasers, dt, now, 14, 0.08);
  smoothNetworkEntities(state.pickups, dt, now, 14, 0);
  smoothNetworkEntities(state.chaosMeteors, dt, now, 14, 0.06);
}

function smoothNetworkEntities(items, dt, now, strength, maxExtrapolation) {
  const alpha = 1 - Math.exp(-strength * Math.max(0, Math.min(0.05, Number(dt) || 0)));
  for (const entity of Array.isArray(items) ? items : []) {
    if (!Number.isFinite(entity._networkX) || !Number.isFinite(entity._networkY)) continue;
    const elapsed = Math.min(maxExtrapolation, Math.max(0, (now - (entity._networkAt || stateSnapshotTime(entity))) / 1000));
    const targetX = entity._networkX + (Number(entity._networkVx) || 0) * elapsed;
    const targetY = entity._networkY + (Number(entity._networkVy) || 0) * elapsed;
    entity.x += (targetX - entity.x) * alpha;
    entity.y += (targetY - entity.y) * alpha;
  }
}

function stateSnapshotTime(entity) {
  return Number(entity._networkAt) || performance.now();
}

function clampVelocity(value) {
  return Math.max(-1200, Math.min(1200, Number(value) || 0));
}

export function sendMultiplayerAction(action) {
  if (multiplayerState?.multiplayer?.role !== "guest" || socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 50000) return;
  socket.send(JSON.stringify({ type: "player-action", action }));
}

export function sendMultiplayerGameOver() {
  if (!multiplayerState?.multiplayer?.active || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "game-over" }));
}

export function sendMultiplayerEndbossResult(victory) {
  if (multiplayerState?.multiplayer?.role !== "host" || socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "endboss-result", victory: Boolean(victory) }));
}

export function sendMultiplayerPlayerState() {
  if (multiplayerState) sendLocalPlayerState(multiplayerState);
}
