import { heroes, maxUpgradeLevel, testIdKey, testPanelAccess, testSiteBuild } from "./config.js?v=testsite1";
import { saveCoins, saveProgression } from "./storage.js?v=musicvolume1";
import { cleanName } from "./utils.js";
import { renderHeroMenu, renderShop, updateCoinDisplay } from "./economy.js?v=chaos4";
import { t } from "./settings.js?v=settings9";
import { appendTestLog } from "./test-logger.js?v=testlogs1";

export function setupTestPanel({
  dom,
  state,
  startGame,
  advanceBossPhase,
  triggerBossQuake,
  triggerBossMask,
  triggerBossBats,
  toggleGodMode,
  clearThreats,
  defeatRobots,
  addScore,
  spawnPickup,
  applyBlindness
}) {
  renderStoredTestId(dom);
  updateTestPanelAccess(dom, state);
  renderSkipWaitButtons(dom, state);
  window.setInterval(() => updateTestPanelAccess(dom, state), 500);
  window.addEventListener("languagechange", () => renderStoredTestId(dom));

  dom.testIdBtn?.addEventListener("click", async () => {
    const id = getOrCreateTestId();
    renderStoredTestId(dom);
    await copyTestId(id);
    updateTestPanelAccess(dom, state);
  });

  dom.playerNameInput?.addEventListener("input", () => updateTestPanelAccess(dom, state));

  bindAll([dom.testCoinsBtn, dom.testGameCoinsBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "coins_5000");
    state.coins += 5000;
    saveCoins(state.coins);
    updateEconomyViews(state, dom);
  });

  bindAll([dom.testMaxCoinsBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "coins_50000");
    state.coins = Math.max(state.coins, 50000);
    saveCoins(state.coins);
    updateEconomyViews(state, dom);
  });

  bindAll([dom.testWave10Btn, dom.testGameWave10Btn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "wave_10");
    startGame({ startWave: 10 });
    updateTestPanelAccess(dom, state);
  });

  bindAll([dom.testWave20Btn, dom.testGameWave20Btn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "wave_20");
    startGame({ startWave: 20 });
    updateTestPanelAccess(dom, state);
  });

  bindAll([dom.testUnlockBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "unlock_heroes");
    state.unlockedHeroes = Object.keys(heroes);
    saveProgression(state);
    updateEconomyViews(state, dom);
  });

  bindAll([dom.testMaxHeroBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "max_hero");
    state.upgrades[state.selectedHero] = maxUpgradeLevel;
    saveProgression(state);
    updateEconomyViews(state, dom);
  });

  bindAll([dom.testHealBtn, dom.testGameHealBtn], () => {
    if (!hasTestPanelAccess() || !state.player) return;
    activateTestMode(state, "heal");
    state.player.hp = state.player.maxHp;
    state.player.healFlash = 0.8;
  });

  bindAll([dom.testSpecialBtn, dom.testGameSpecialBtn], () => {
    if (!hasTestPanelAccess() || !state.player) return;
    activateTestMode(state, "special_ready");
    state.player.specialTimer = 0;
  });

  bindAll([dom.testEndbossBtn, dom.testGameEndbossBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "start_endboss");
    startGame({ endboss: true, skipPrep: true, playtest: true });
    updateTestPanelAccess(dom, state);
  });

  bindAll([dom.testSkipWaitsBtn, dom.testGameSkipWaitsBtn], () => {
    if (!hasTestPanelAccess()) return;
    state.testSkipWaits = !state.testSkipWaits;
    activateTestMode(state, state.testSkipWaits ? "skip_waits_on" : "skip_waits_off");
    renderSkipWaitButtons(dom, state);
    updateDebugStatus(dom, state, `Timer-Skip ${state.testSkipWaits ? "AN" : "AUS"}`);
  });

  dom.testGameBossPhaseBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "boss_phase_next");
    advanceBossPhase?.();
  });
  dom.testGameBossQuakeBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "boss_quake");
    triggerBossQuake?.();
  });
  dom.testGameBossMaskBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "boss_mask");
    triggerBossMask?.();
  });
  dom.testGameBossBatsBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "boss_bat_swarm");
    triggerBossBats?.();
  });

  bindAll([dom.testGodModeBtn, dom.testGameGodModeBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_godmode_toggle");
    const enabled = toggleGodMode?.();
    updateDebugStatus(dom, state, `Godmode ${enabled ? "AN" : "AUS"}`);
  });

  bindAll([dom.testClearThreatsBtn, dom.testGameClearThreatsBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_clear_threats");
    const removed = clearThreats?.() || {};
    updateDebugStatus(dom, state, `Gefahren gelöscht: ${sumValues(removed)}`);
  });

  bindAll([dom.testDefeatRobotsBtn, dom.testGameDefeatRobotsBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_defeat_robots");
    const count = defeatRobots?.() ?? 0;
    updateDebugStatus(dom, state, `${count} Gegner markiert`);
  });

  bindAll([dom.testScoreBtn, dom.testGameScoreBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_score_100000");
    const score = addScore?.(100000) ?? state.score;
    updateDebugStatus(dom, state, `Score: ${score}`);
  });

  bindAll([dom.testPickupHealBtn, dom.testGamePickupHealBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_pickup_heal");
    const ok = spawnPickup?.("heal");
    updateDebugStatus(dom, state, ok ? "Heal gespawnt" : "Erst Runde starten");
  });

  dom.testPickupDamageBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_pickup_damage");
    const ok = spawnPickup?.("damage");
    updateDebugStatus(dom, state, ok ? "Damage gespawnt" : "Erst Runde starten");
  });

  dom.testPickupSpeedBtn?.addEventListener("click", () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_pickup_speed");
    const ok = spawnPickup?.("speed");
    updateDebugStatus(dom, state, ok ? "Speed gespawnt" : "Erst Runde starten");
  });

  bindAll([dom.testBlindnessBtn, dom.testGameBlindnessBtn], () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_blindness");
    const ok = applyBlindness?.(10);
    updateDebugStatus(dom, state, ok ? "Blindheit 10s" : "Erst Runde starten");
  });

  bindAll([dom.testCopyStateBtn, dom.testGameCopyStateBtn], async () => {
    if (!hasTestPanelAccess()) return;
    activateTestMode(state, "debug_copy_state");
    const copied = await copyDebugState(state);
    updateDebugStatus(dom, state, copied ? "Status kopiert" : "Kopieren fehlgeschlagen");
  });
}

export function activateTestMode(state, action = "unknown") {
  if (state && typeof state === "object") {
    state.testMode = true;
    appendTestLog("test_action", {
      action,
      wave: state.wave,
      endbossPhase: state.endbossPhase
    });
  }
}

function bindAll(elements, handler) {
  elements.forEach((element) => element?.addEventListener("click", handler));
}

function renderSkipWaitButtons(dom, state) {
  const enabled = Boolean(state.testSkipWaits);
  for (const button of [dom.testSkipWaitsBtn, dom.testGameSkipWaitsBtn]) {
    if (!button) continue;
    button.textContent = `Timer-Skip: ${enabled ? "AN" : "AUS"}`;
    button.setAttribute("aria-pressed", String(enabled));
    button.title = enabled
      ? "Vorbereitung und Boss-Wartezeiten werden übersprungen"
      : "Vorbereitung und Boss-Wartezeiten laufen normal";
  }
}

function updateEconomyViews(state, dom) {
  updateCoinDisplay(state, dom);
  renderHeroMenu(state, dom);
  renderShop(state, dom);
}

function getOrCreateTestId() {
  const existing = localStorage.getItem(testIdKey);
  if (existing) return existing;
  const generated = String(getRandomNumber(100000, 999999));
  localStorage.setItem(testIdKey, generated);
  return generated;
}

function renderStoredTestId(dom) {
  const id = localStorage.getItem(testIdKey);
  if (dom.testIdText) dom.testIdText.textContent = id ? `ID ${id}` : t("multiplayer.notCreated");
}

function updateTestPanelAccess(dom, state) {
  const active = hasTestPanelAccess();
  dom.testPanel?.classList.toggle("hidden", !active);
  dom.testPanelGame?.classList.toggle("hidden", !active || !state.running || state.over);
  if (active && dom.testPanelUser) dom.testPanelUser.textContent = cleanName(dom.playerNameInput?.value || state.playerName);
  if (active) updateDebugStatus(dom, state);
}

function updateDebugStatus(dom, state, message = "") {
  const summary = [
    message || "Bereit",
    `W${state.wave}`,
    state.endbossMode ? `Boss ${state.endbossPhase}/3` : "Normal",
    `Robots ${state.robots?.length || 0}`,
    `Bullets ${(state.bullets?.length || 0) + (state.enemyBullets?.length || 0)}`,
    state.debugGodMode ? "God AN" : "God AUS",
    state.testSkipWaits ? "Skip AN" : "Skip AUS"
  ].join(" · ");
  if (dom.testDebugStatus) dom.testDebugStatus.textContent = summary;
  if (dom.testGameDebugStatus) dom.testGameDebugStatus.textContent = summary;
  updateGodModeButtons(dom, state);
}

function updateGodModeButtons(dom, state) {
  const menuText = `Godmode: ${state.debugGodMode ? "AN" : "AUS"}`;
  const gameText = `God: ${state.debugGodMode ? "AN" : "AUS"}`;
  if (dom.testGodModeBtn) dom.testGodModeBtn.textContent = menuText;
  if (dom.testGameGodModeBtn) dom.testGameGodModeBtn.textContent = gameText;
}

async function copyDebugState(state) {
  const player = state.player;
  const boss = state.robots?.find((robot) => robot.endboss);
  const snapshot = {
    time: new Date().toISOString(),
    running: state.running,
    paused: state.paused,
    over: state.over,
    mode: state.endbossMode ? "endboss" : "normal",
    wave: state.wave,
    score: state.score,
    difficulty: state.difficulty,
    selectedHero: state.selectedHero,
    debugGodMode: Boolean(state.debugGodMode),
    player: player ? {
      hp: Math.round(player.hp),
      maxHp: player.maxHp,
      x: Math.round(player.x),
      y: Math.round(player.y),
      dead: Boolean(player.dead),
      blindness: Number((player.blindnessTimer || 0).toFixed(1))
    } : null,
    boss: boss ? {
      phase: boss.endbossPhase,
      hp: Math.round(boss.hp),
      maxHp: boss.maxHp,
      x: Math.round(boss.x),
      y: Math.round(boss.y)
    } : null,
    counts: {
      robots: state.robots?.length || 0,
      playerBullets: state.bullets?.length || 0,
      enemyBullets: state.enemyBullets?.length || 0,
      bossLasers: state.bossLasers?.length || 0,
      pickups: state.pickups?.length || 0,
      particles: state.particles?.length || 0
    },
    multiplayer: {
      active: Boolean(state.multiplayer?.active),
      role: state.multiplayer?.role || "solo",
      playerCount: state.multiplayer?.playerCount || 1,
      remotePlayers: state.remotePlayers?.length || 0
    }
  };

  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    return true;
  } catch {
    return false;
  }
}

function sumValues(values) {
  return Object.values(values || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function hasTestPanelAccess() {
  return isTestPanelAllowed(
    window.location.hostname,
    window.location.search,
    localStorage.getItem(testIdKey),
    testPanelAccess,
    testSiteBuild
  );
}

export function isTestPanelAllowed(hostname, search = "", storedId = "", allowedIds = [], isTestSite = false) {
  if (isTestSite) return true;
  const params = new URLSearchParams(search);
  if (["localhost", "127.0.0.1"].includes(hostname) && params.has("playtest")) return true;
  if (!storedId) return false;
  return allowedIds.some((entry) => String(entry) === String(storedId));
}

function getRandomNumber(min, max) {
  const range = max - min + 1;
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return min + (value[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

async function copyTestId(id) {
  try {
    await navigator.clipboard?.writeText(id);
  } catch {
    // Kopieren ist nur Komfort. Die ID bleibt trotzdem sichtbar gespeichert.
  }
}
