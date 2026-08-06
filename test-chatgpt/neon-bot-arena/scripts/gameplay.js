import { clamp, cleanName, distance } from "./utils.js";
import { saveHighScore, saveLeaderboardEntry, saveProgression } from "./storage.js?v=chaos4";
import { addCoins, calculateCoinReward, getSelectedHeroStats } from "./economy.js?v=chaos4";
import { loadOnlineScores, submitOnlineScore } from "./online-leaderboard.js?v=testids1";
import { playShoot, setMusicPaused, startMusic, stopMusic } from "./audio.js?v=musicvolume1";
import { sendMultiplayerAction, sendMultiplayerEndbossResult, sendMultiplayerGameOver, sendMultiplayerPlayerState, updateMultiplayerInterpolation } from "./multiplayer-test.js?v=chaos4";
import { t, tf } from "./settings.js?v=settings9";
import { appendTestLog } from "./test-logger.js?v=testlogs1";
import { calculatePlayerDamage, getGameMode } from "./game-modes.js?v=chaos4";
import { CHAOS_METEOR_DAMAGE, CHAOS_METEOR_GROUND_TIME, CHAOS_METEOR_MAX_RADIUS, CHAOS_METEOR_MIN_RADIUS, CHAOS_RESPAWN_PROTECTION, createSeededRandom, formatChaosTime, getChaosEnemyFireInterval, getChaosEnemyShotAngles, getChaosEnemySpeed, getChaosEvent, getChaosRespawnHealth, isChaosEventActive, isPointOnActiveBrokenTile, startChaosRun, updateChaosRun } from "./chaos-mode.js?v=chaos4";

export function getMultiplayerScaling(value = 1) {
  const playerCount = Math.max(1, Math.min(3, Math.round(Number(value) || 1)));
  return {
    playerCount,
    enemyCount: 1 + (playerCount - 1) * 0.22,
    enemyHp: 1 + (playerCount - 1) * 0.28,
    bossHp: 1 + (playerCount - 1) * 0.42,
    damage: 1 + (playerCount - 1) * 0.08
  };
}

export function createGameplay({ dom, state, renderLeaderboard }) {
  let chaosRandom = Math.random;
  const difficultySettings = {
    easy: {
      labelKey: "menu.easy",
      enemyCount: 0.72,
      enemyHp: 0.78,
      enemySpeed: 0.84,
      enemyDamage: 0.75,
      shooterWave: 3,
      shooterChance: 0.16,
      bruiserWave: 4,
      bruiserChance: 0.12,
      bossEvery: 10,
      pickupDrop: 0.18,
      bossHp: 0.62,
      bossSpeed: 0.78,
      bossDamage: 0.7,
      bossFireRate: 1.12,
      bossBulletSpeed: 300
    },
    normal: {
      labelKey: "menu.normal",
      enemyCount: 1,
      enemyHp: 1,
      enemySpeed: 1,
      enemyDamage: 1,
      shooterWave: 2,
      shooterChance: 0.28,
      bruiserWave: 3,
      bruiserChance: 0.22,
      bossEvery: 10,
      pickupDrop: 0.14,
      bossHp: 1,
      bossSpeed: 1,
      bossDamage: 1,
      bossFireRate: 0.78,
      bossBulletSpeed: 360
    },
    hard: {
      labelKey: "menu.hard",
      enemyCount: 1.18,
      enemyHp: 1.15,
      enemySpeed: 1.1,
      enemyDamage: 1.2,
      shooterWave: 2,
      shooterChance: 0.35,
      bruiserWave: 3,
      bruiserChance: 0.28,
      bossEvery: 10,
      pickupDrop: 0.12,
      bossHp: 1.42,
      bossSpeed: 1.16,
      bossDamage: 1.35,
      bossFireRate: 0.55,
      bossBulletSpeed: 430
    }
  };

  function getEndbossHeroStats(hero, endbossMode) {
    if (!endbossMode || state.selectedHero !== "warden") return hero;
    return {
      ...hero,
      hp: Math.round(hero.hp * 1.25),
      speed: Math.round(hero.speed * 1.12),
      bulletDamage: Math.round(hero.bulletDamage * 1.3),
      fireRate: Math.max(0.18, hero.fireRate * 0.86),
      specialCooldown: Math.max(1, hero.specialCooldown * 0.85)
    };
  }

  function getDifficultySettings() {
    return difficultySettings[state.difficulty] || difficultySettings.normal;
  }

  function getActivePlayerCount() {
    if (!state.multiplayer?.active || state.multiplayer.role === "solo") return 1;
    return Math.max(1, Math.min(3, Math.round(Number(state.multiplayer.playerCount) || 1)));
  }

  function getPlayerScaling() {
    return getMultiplayerScaling(getActivePlayerCount());
  }

  function nextEntityId(prefix) {
    state.networkEntitySequence = (Number(state.networkEntitySequence) || 0) + 1;
    const rawOwner = state.multiplayer?.clientId || state.multiplayer?.role || "local";
    const owner = String(rawOwner).replace(/[^a-z0-9]/gi, "").slice(-6) || "local";
    return `${prefix}-${owner}-${state.networkEntitySequence}`;
  }

  state.handleMultiplayerGameOver = () => {
    if (!state.running || state.over || !isCoopMode()) return;
    endGame({ broadcast: false });
  };
  state.handleMultiplayerEndbossResult = (victory) => {
    if (!state.running || state.over || !state.endbossMode || !isCoopGuest()) return;
    finishEndbossRun(Boolean(victory), { broadcast: false });
  };

  function startGame(options = {}) {
    const endbossMode = Boolean(options.endboss);
    const hero = getEndbossHeroStats(getSelectedHeroStats(state), endbossMode);
    state.playerName = cleanName(dom.playerNameInput?.value || state.playerName);
    if (dom.playerNameInput) dom.playerNameInput.value = state.playerName;
    if (!options.coop && state.multiplayer) {
      state.multiplayer.active = false;
      state.multiplayer.role = "solo";
      state.multiplayer.hostId = null;
      state.multiplayer.playerCount = 1;
      state.multiplayer.lastWorldAt = 0;
    } else if (options.coop && state.multiplayer) {
      state.multiplayer.playerCount = Math.max(1, Math.min(3, Number(options.playerCount) || state.multiplayer.playerCount || 1));
    }
    Object.assign(state, {
      running: true,
      paused: false,
      over: false,
      wave: endbossMode ? 1 : options.startWave || 1,
      score: endbossMode ? 0 : options.startWave ? Math.max(0, (options.startWave - 1) * 100) : 0,
      startHighScore: state.highScore,
      bossCoinBonus: 0,
      bossesDefeated: 0,
      endbossMode,
      endbossPhase: endbossMode ? 1 : 0,
      endbossTransition: 0,
      prepTimer: endbossMode || options.skipPrep || state.testSkipWaits ? 0 : 5,
      waveDelay: 0,
      nextWavePulse: 0,
      chaosEventId: null,
      chaosEventTimer: 0,
      chaosBrokenTiles: [],
      chaosMeteors: [],
      chaosMeteorTimer: 0,
      time: 0,
      networkEntitySequence: 0,
      bullets: [],
      enemyBullets: [],
      robots: [],
      bossLasers: [],
      particles: [],
      pickups: [],
      meleeSwings: [],
      wardenRing: null
    });
    state.player = {
      x: dom.canvas.width / 2,
      y: dom.canvas.height / 2,
      radius: 19,
      hp: hero.hp,
      maxHp: hero.hp,
      fireTimer: 0,
      specialTimer: 0,
      shield: 0,
      invincible: 0,
      dead: false,
      respawnTimer: 0,
      healFlash: 0,
      damageBoostTimer: 0,
      speedBoostTimer: 0,
      companionAbilityTimer: 0,
      blindnessTimer: 0,
      lastBossQuakeHit: 0,
      hitMaskIds: new Set(),
      hitBatIds: new Set(),
      hitMeteorIds: new Set(),
      pickupFlash: null,
      hero
    };
    chaosRandom = options.chaosSeed == null ? Math.random : createSeededRandom(options.chaosSeed);
    const startingChaosEvent = startChaosRun(state, chaosRandom);
    enterChaosEvent(startingChaosEvent);
    appendTestLog("game_start", {
      mode: endbossMode ? "endboss" : state.gameMode,
      chaosEvent: startingChaosEvent?.id || null,
      hero: state.selectedHero,
      difficulty: state.difficulty,
      wave: state.wave,
      playerCount: getActivePlayerCount(),
      coop: Boolean(options.coop)
    });
    dom.heroName.textContent = hero.name;
    if (dom.difficultyText) dom.difficultyText.textContent = getDifficultyHudText();
    applyDeviceMode();
    document.body.classList.add("playing");
    window.scrollTo(0, 0);
    dom.menu.classList.add("hidden");
    dom.gamePanel.classList.remove("hidden");
    dom.message.classList.add("hidden");
    startMusic();
    if (endbossMode) {
      spawnEndbossPhase(1);
    } else if (state.prepTimer <= 0) {
      spawnWave();
    }
  }

  function applyDeviceMode() {
    const mobile = state.device === "mobile";
    dom.gamePanel.classList.toggle("mobile-mode", mobile);
    dom.touchControls?.classList.toggle("hidden", !mobile);
    if (dom.moveHint) dom.moveHint.textContent = mobile ? "Stick" : "WASD";
    if (dom.aimHint) dom.aimHint.textContent = mobile ? t("controls.autoAim") : t("controls.mouse");
    if (dom.fireHint) dom.fireHint.textContent = mobile ? t("controls.fire") : t("controls.click");
    if (dom.specialHint) dom.specialHint.textContent = mobile ? t("hud.special") : t("controls.space");
    state.mouse.down = false;
    state.touch.fire = false;
    state.touch.moveX = 0;
    state.touch.moveY = 0;
  }

  function togglePause() {
    if (!state.running || state.over) return;
    state.paused = !state.paused;
    dom.pauseBtn.textContent = state.paused ? ">" : "II";
    if (state.paused) {
      state.touch.fire = false;
      setMusicPaused(true);
      dom.touchControls?.classList.add("hidden");
      showPauseMenu();
    } else {
      dom.message.classList.add("hidden");
      setMusicPaused(false);
      applyDeviceMode();
    }
  }

  function showMessage(html) {
    dom.message.innerHTML = html;
    dom.message.classList.remove("hidden");
  }

  function bindOverlayButton(selector, handler) {
    const button = document.querySelector(selector);
    if (!button) return;
    let lastRun = 0;
    const run = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = performance.now();
      if (now - lastRun < 350) return;
      lastRun = now;
      handler();
    };
    button.addEventListener("click", run);
    button.addEventListener("pointerdown", run);
    button.addEventListener("touchend", run, { passive: false });
  }

  function showPauseMenu() {
    showMessage(`<strong>${t("game.pause")}</strong>${tf("game.pauseStatus", { name: state.playerName, wave: state.wave })}<div class="message-actions"><button id="resumeBtn">${t("game.resume")}</button><button id="menuBtn" class="secondary-btn">${t("game.mainMenu")}</button></div>`);
    bindOverlayButton("#resumeBtn", togglePause);
    bindOverlayButton("#menuBtn", returnToMenu);
  }

  function update(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 14);
    state.nextWavePulse = Math.max(0, state.nextWavePulse - dt);
    updateMultiplayerInterpolation(state, dt);
    if (isCoopGuest()) {
      updateGuestFrame(dt);
      return;
    }
    updatePlayer(dt);
    updateChaosMode(dt);
    if (state.over) {
      updateHud();
      return;
    }
    updateBullets(dt, state.bullets, true);
    updateBullets(dt, state.enemyBullets, false);
    updateBossLasers(dt);
    updateRobots(dt);
    updateParticles(dt);
    updatePickups(dt);

    if (state.endbossMode) {
      updateEndbossTransition(dt);
      updateHud();
      return;
    }

    if (state.prepTimer > 0) {
      state.prepTimer = state.testSkipWaits ? 0 : Math.max(0, state.prepTimer - dt);
      if (state.prepTimer <= 0) {
        spawnWave();
        pulse(dom.canvas.width / 2, dom.canvas.height / 2, "#38d8ff", 36);
      }
      updateHud();
      return;
    }

    if (state.waveDelay > 0) {
      state.waveDelay = state.testSkipWaits ? 0 : Math.max(0, state.waveDelay - dt);
      if (state.waveDelay <= 0) {
        state.wave += 1;
        state.score += 100;
        spawnWave();
        pulse(dom.canvas.width / 2, dom.canvas.height / 2, "#b7ff4a", 42);
      }
      updateHud();
      return;
    }

    if (state.robots.length === 0) {
      state.wave += 1;
      state.score += 100;
      spawnWave();
      pulse(dom.canvas.width / 2, dom.canvas.height / 2, "#b7ff4a", 42);
    }
    updateHud();
  }

  function updateGuestFrame(dt) {
    updatePlayer(dt);
    updateChaosMode(dt);
    if (state.over) {
      updateHud();
      return;
    }
    advanceGuestProjectiles(dt);
    updateGuestDamage(dt);
    updateGuestPickups();
    updateBossLasers(dt);
    updateParticles(dt);
    updateHud();
  }

  function advanceGuestProjectiles(dt) {
    for (const bullet of [...state.bullets, ...state.enemyBullets]) {
      bullet.x += (Number(bullet.vx) || 0) * dt;
      bullet.y += (Number(bullet.vy) || 0) * dt;
      bullet.life = (Number(bullet.life) || 0) - dt;
    }
    state.bullets = state.bullets.filter((bullet) => (
      bullet.life > 0
      && bullet.x > -40
      && bullet.x < dom.canvas.width + 40
      && bullet.y > -40
      && bullet.y < dom.canvas.height + 40
    ));
  }

  function spawnWave() {
    const settings = getDifficultySettings();
    const playerScaling = getPlayerScaling();
    const bossWave = state.wave % settings.bossEvery === 0;
    if (bossWave) {
      state.robots.push(makeRobot(dom.canvas.width / 2, 92, true, true, true));
      state.nextWavePulse = 1.2;
      appendTestLog("wave_spawn", { wave: state.wave, boss: true, enemies: 1, playerCount: playerScaling.playerCount });
      return;
    }

    const count = Math.max(3, Math.round((4 + state.wave * 2) * settings.enemyCount * playerScaling.enemyCount));
    appendTestLog("wave_spawn", { wave: state.wave, boss: false, enemies: count, playerCount: playerScaling.playerCount });
    for (let i = 0; i < count; i++) {
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? 42 : side === 1 ? dom.canvas.width - 42 : 42 + Math.random() * (dom.canvas.width - 84);
      const y = side === 2 ? 94 : side === 3 ? dom.canvas.height - 50 : 94 + Math.random() * (dom.canvas.height - 144);
      const shooter = state.wave >= settings.shooterWave && Math.random() < settings.shooterChance;
      const bruiser = state.wave >= settings.bruiserWave && Math.random() < settings.bruiserChance;
      state.robots.push(makeRobot(x, y, shooter, bruiser));
    }
  }

  function spawnEndbossPhase(phase) {
    state.endbossPhase = phase;
    state.endbossTransition = 0;
    state.robots = [makeEndboss(phase)];
    state.enemyBullets = [];
    state.bossLasers = [];
    state.nextWavePulse = 1.2;
    pulse(dom.canvas.width / 2, 92, "#d1d5db", 52);
  }

  function updateEndbossTransition(dt) {
    if (state.over || state.endbossTransition <= 0) return;
    state.endbossTransition = state.testSkipWaits ? 0 : Math.max(0, state.endbossTransition - dt);
    if (state.endbossTransition <= 0) spawnEndbossPhase(state.endbossPhase);
  }

  function makeEndboss(phase) {
    const settings = getDifficultySettings();
    const playerScaling = getPlayerScaling();
    const stages = {
      1: { hp: 1200, speed: 78, damage: 28, bulletDamage: 17, bulletSpeed: 340, fireRate: 1.1, attackRate: 2.5 },
      2: { hp: 2200, speed: 94, damage: 38, bulletDamage: 24, bulletSpeed: 395, fireRate: 0.92, attackRate: 2.05 },
      3: { hp: 3600, speed: 112, damage: 50, bulletDamage: 32, bulletSpeed: 455, fireRate: 0.74, attackRate: 1.65 }
    };
    const stage = stages[phase] || stages[3];
    const hp = Math.round(stage.hp * settings.enemyHp * playerScaling.bossHp);
    const speed = Math.round(stage.speed * settings.enemySpeed);
    const robot = {
      id: nextEntityId("eb"),
      x: dom.canvas.width / 2,
      y: 92,
      radius: 38 + phase * 2,
      hp,
      maxHp: hp,
      speed,
      baseSpeed: speed,
      damage: Math.round(stage.damage * settings.enemyDamage * playerScaling.damage),
      bulletDamage: Math.round(stage.bulletDamage * settings.enemyDamage * playerScaling.damage),
      bulletSpeed: stage.bulletSpeed,
      fireTimer: 0.7,
      fireRate: stage.fireRate,
      shooter: true,
      bruiser: true,
      boss: true,
      endboss: true,
      endbossPhase: phase,
      bossAttackTimer: 1.3,
      bossAttackRate: stage.attackRate,
      bossAttackIndex: 0,
      wardenQuakeEnabled: hasIronWardenPlayer(),
      quakeId: 0,
      quakeWarning: 0,
      quakeWarningMax: 0,
      quakeBlast: 0,
      quakeBlastMax: 0,
      quakeRadius: 0,
      quakeDamage: 0,
      hit: 0,
      stunTimer: 0,
      frozenTimer: 0,
      burnTimer: 0,
      chaosRespawned: false,
      respawnProtection: 0
    };
    return robot;
  }

  function hasIronWardenPlayer() {
    if (state.selectedHero === "warden") return true;
    return (state.remotePlayers || []).some((player) => {
      const hero = String(player.hero || "").toLowerCase();
      return hero === "warden" || hero.includes("iron warden");
    });
  }

  function makeRobot(x, y, shooter, bruiser, boss = false) {
    const settings = getDifficultySettings();
    const playerScaling = getPlayerScaling();
    const baseSpeed = boss ? 82 : bruiser ? 96 : 135 + state.wave * 4;
    const baseHp = boss ? 720 + state.wave * 52 : bruiser ? 92 + state.wave * 11 : 48 + state.wave * 8;
    const speed = Math.round(baseSpeed * settings.enemySpeed * (boss ? settings.bossSpeed : 1));
    const hp = Math.round(baseHp * settings.enemyHp * (boss ? settings.bossHp * playerScaling.bossHp : playerScaling.enemyHp));
    return {
      id: nextEntityId(boss ? "bo" : "r"),
      x,
      y,
      radius: boss ? 34 : bruiser ? 25 : 18,
      hp,
      maxHp: hp,
      speed,
      baseSpeed: speed,
      damage: Math.round((boss ? 28 : bruiser ? 20 : 13) * settings.enemyDamage * (boss ? settings.bossDamage : 1) * playerScaling.damage),
      bulletDamage: Math.round((boss ? 18 : 12) * settings.enemyDamage * (boss ? settings.bossDamage : 1) * playerScaling.damage),
      fireTimer: Math.random() * 2,
      shooter,
      bruiser,
      boss,
      bossAttackTimer: boss ? 1.5 : 0,
      bossAttackType: "burst",
      hit: 0,
      stunTimer: 0,
      frozenTimer: 0,
      burnTimer: 0,
      chaosRespawned: false,
      respawnProtection: 0
    };
  }

  function updatePlayer(dt) {
    const player = state.player;
    if (player.dead) {
      updateRespawn(dt);
      return;
    }
    const hero = player.hero;
    let dx = 0;
    let dy = 0;
    if (state.keys.has("KeyW")) dy -= 1;
    if (state.keys.has("KeyS")) dy += 1;
    if (state.keys.has("KeyA")) dx -= 1;
    if (state.keys.has("KeyD")) dx += 1;
    if (state.device === "mobile") {
      dx += state.touch.moveX;
      dy += state.touch.moveY;
    }
    const len = Math.hypot(dx, dy) || 1;
    const speedMultiplier = player.speedBoostTimer > 0 ? 1.35 : 1;
    player.x = clamp(player.x + (dx / len) * hero.speed * speedMultiplier * dt, 26, dom.canvas.width - 26);
    player.y = clamp(player.y + (dy / len) * hero.speed * speedMultiplier * dt, 72, dom.canvas.height - 40);
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    player.specialTimer = Math.max(0, player.specialTimer - dt);
    player.shield = Math.max(0, player.shield - dt);
    player.invincible = Math.max(0, player.invincible - dt);
    player.healFlash = Math.max(0, player.healFlash - dt);
    player.damageBoostTimer = Math.max(0, player.damageBoostTimer - dt);
    player.speedBoostTimer = Math.max(0, player.speedBoostTimer - dt);
    player.blindnessTimer = Math.max(0, (player.blindnessTimer || 0) - dt);
    if (player.pickupFlash) {
      player.pickupFlash.timer -= dt;
      if (player.pickupFlash.timer <= 0) player.pickupFlash = null;
    }
    if ((state.mouse.down || state.touch.fire) && player.fireTimer <= 0) shoot();
  }

  function shoot() {
    const player = state.player;
    const hero = player.hero;
    player.fireTimer = hero.fireRate;
    playShoot();
    const angle = getAimAngle();
    const damage = Math.round(hero.bulletDamage * (player.damageBoostTimer > 0 ? 1.5 : 1));
    if (state.selectedHero === "warden") {
      meleeAttack(angle, damage);
      sendGuestAction({ kind: "melee", angle, damage });
      return;
    }
    const firedBullets = [];
    if (state.selectedHero === "titan") {
      [-0.18, 0, 0.18].forEach((spread) => firedBullets.push(addBullet(player.x, player.y, angle + spread, hero.bulletSpeed, damage, hero.color, false)));
    } else {
      firedBullets.push(addBullet(player.x, player.y, angle, hero.bulletSpeed, damage, hero.color, state.selectedHero === "nova"));
    }
    sendGuestAction({ kind: "shot", bullets: firedBullets.map(cloneBullet) });
  }

  function meleeAttack(angle, damage) {
    const player = state.player;
    const range = 92;
    const arc = 1.28;
    state.meleeSwings.push({ x: player.x, y: player.y, angle, timer: 0.2, range, color: player.hero.color });
    for (const robot of state.robots) {
      if (!canDamageRobot(robot)) continue;
      const dx = robot.x - player.x;
      const dy = robot.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range + robot.radius) continue;
      const robotAngle = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(robotAngle, angle)) > arc / 2) continue;
      damageRobot(robot, damage, player.hero.color);
      const push = robot.boss ? 8 : 18;
      robot.x += Math.cos(robotAngle) * push;
      robot.y += Math.sin(robotAngle) * push;
    }
    for (let i = 0; i < 10; i++) {
      const spread = angle + (Math.random() - 0.5) * arc;
      addParticle(player.x + Math.cos(spread) * 44, player.y + Math.sin(spread) * 44, player.hero.color, 1.4);
    }
  }

  function addBullet(x, y, angle, speed, damage, color, pierce) {
    const bullet = {
      id: nextEntityId("b"),
      x: x + Math.cos(angle) * 24,
      y: y + Math.sin(angle) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: pierce ? 5 : 4,
      life: 1.05,
      damage,
      color,
      pierce
    };
    state.bullets.push(bullet);
    return bullet;
  }

  function useSpecial() {
    if (!state.running || state.paused || state.over) return;
    const player = state.player;
    if (!player || player.dead) return;
    if (player.specialTimer > 0) return;
    const specialAngle = getAimAngle();
    player.specialTimer = player.hero.specialCooldown;
    state.shake = 0.7;

    if (state.selectedHero === "volt") {
      const targets = state.robots
        .filter(canDamageRobot)
        .slice()
        .sort((a, b) => distance(player, a) - distance(player, b))
        .slice(0, 5);
      targets.forEach((robot) => {
        damageRobot(robot, 70, "#38d8ff");
        robot.stunTimer = 0.45;
      });
      state.lightningChain = { targets: targets.map(r => ({ x: r.x, y: r.y })), timer: 0.4 };
      pulse(player.x, player.y, "#38d8ff", 60);
    }

    if (state.selectedHero === "titan") {
      player.shield = 3.0;
      player.invincible = 0.7;
      pulse(player.x, player.y, "#ffc857", 54);
    }

    if (state.selectedHero === "nova") {
      const angle = getAimAngle();
      state.novaGhost = { x: player.x, y: player.y, timer: 0.45, color: player.hero.color };
      player.x = clamp(player.x + Math.cos(angle) * 190, 28, dom.canvas.width - 28);
      player.y = clamp(player.y + Math.sin(angle) * 190, 78, dom.canvas.height - 42);
      state.robots.filter((robot) => canDamageRobot(robot) && distance(player, robot) < 150).forEach((robot) => damageRobot(robot, 84, "#ff4f92"));
      player.invincible = 1.2;
      pulse(player.x, player.y, "#ff4f92", 90);
    }

    if (state.selectedHero === "ember") {
      state.robots.filter((robot) => canDamageRobot(robot) && distance(player, robot) < 210).forEach((robot) => {
        robot.burnTimer = 3.0;
        robot.burnFlash = 0.55;
        robot.burnSparkTimer = 0;
        damageRobot(robot, 95, "#ff7a3d");
        for (let i = 0; i < 10; i++) addParticle(robot.x, robot.y - robot.radius * 0.5, "#ff7a3d", 2.3);
      });
      state.emberRing = { x: player.x, y: player.y, timer: 0.58 };
      state.emberBurst = { x: player.x, y: player.y, timer: 0.5 };
      pulse(player.x, player.y, "#ff7a3d", 72);
    }

    if (state.selectedHero === "frost") {
      state.robots.filter((robot) => canDamageRobot(robot) && distance(player, robot) < 230).forEach((robot) => {
        robot.speed = robot.baseSpeed * 0.3;
        robot.frozenTimer = 3.0;
        damageRobot(robot, 55, "#8ee7ff");
      });
      state.frostRing = { x: player.x, y: player.y, timer: 0.45 };
      pulse(player.x, player.y, "#8ee7ff", 64);
    }

    if (state.selectedHero === "pulse") {
      const healed = Math.min(player.maxHp - player.hp, Math.round(player.maxHp * 0.35));
      player.hp += healed;
      player.healFlash = 1.0;
      player.invincible = Math.max(player.invincible, 0.35);
      state.robots.filter((robot) => canDamageRobot(robot) && distance(player, robot) < 150).forEach((robot) => damageRobot(robot, 48, "#b7ff4a"));
      state.pulseRing = { x: player.x, y: player.y, timer: 0.62 };
      state.healWave = { x: player.x, y: player.y, timer: 0.9, amount: healed };
      pulse(player.x, player.y, "#b7ff4a", 96);
    }

    if (state.selectedHero === "warden") {
      player.shield = Math.max(player.shield, 1.8);
      player.invincible = Math.max(player.invincible, 0.75);
      state.robots.filter((robot) => canDamageRobot(robot) && distance(player, robot) < 175).forEach((robot) => {
        damageRobot(robot, 118, "#d8dde8");
        const angle = Math.atan2(robot.y - player.y, robot.x - player.x);
        const push = robot.boss ? 18 : 38;
        robot.x += Math.cos(angle) * push;
        robot.y += Math.sin(angle) * push;
      });
      state.wardenRing = { x: player.x, y: player.y, timer: 0.56 };
      pulse(player.x, player.y, "#d8dde8", 86);
    }

    sendGuestAction({ kind: "special", hero: state.selectedHero, angle: specialAngle, damage: 0 });
  }

  function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function getAimAngle() {
    const player = state.player;
    if (state.device === "mobile") {
      const nearest = state.robots.reduce((closest, robot) => (!closest || distance(player, robot) < distance(player, closest) ? robot : closest), null);
      if (nearest) return Math.atan2(nearest.y - player.y, nearest.x - player.x);
      if (Math.hypot(state.touch.moveX, state.touch.moveY) > 0.2) return Math.atan2(state.touch.moveY, state.touch.moveX);
    }
    const pointerX = isChaosEventActive(state, "mirror") ? dom.canvas.width - state.mouse.x : state.mouse.x;
    return Math.atan2(state.mouse.y - player.y, pointerX - player.x);
  }

  function updateBullets(dt, bullets, playerOwned) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.age = (Number(bullet.age) || 0) + dt;
      if (!playerOwned && bullet.batSwarm && bullet.batWarning > 0) {
        bullet.batWarning = Math.max(0, bullet.batWarning - dt);
        bullet.life -= dt;
        if (bullet.batWarning <= 0 && !bullet.batLaunched) {
          bullet.batLaunched = true;
          bullet.vx = bullet.batVx;
          bullet.vy = bullet.batVy;
        }
        continue;
      }
      const returnedToBoss = !playerOwned && bullet.maskBoomerang
        ? updateMaskBoomerang(bullet, dt)
        : false;
      if (!bullet.maskBoomerang || playerOwned) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
      }
      bullet.life -= dt;
      addParticle(bullet.x, bullet.y, bullet.color, 1);
      if (returnedToBoss || bullet.life <= 0 || bullet.x < -30 || bullet.x > dom.canvas.width + 30 || bullet.y < -30 || bullet.y > dom.canvas.height + 30) {
        bullets.splice(i, 1);
        continue;
      }
      if (playerOwned) {
        for (const robot of state.robots) {
          if (distance(bullet, robot) < bullet.radius + robot.radius) {
            damageRobot(robot, bullet.damage, bullet.color);
            if (!bullet.pierce) {
              bullets.splice(i, 1);
              break;
            }
          }
        }
      } else if (!state.player.dead && distance(bullet, state.player) < bullet.radius + state.player.radius) {
        if (bullet.batSwarm) {
          applyBatBlindness(state.player, bullet);
          hurtPlayer(bullet.damage || 8);
          bullets.splice(i, 1);
        } else if (bullet.maskBoomerang) {
          if (!bullet.hitPlayer) {
            bullet.hitPlayer = true;
            bullet.returning = true;
            hurtPlayer(bullet.damage || 12 + state.wave * 2);
          }
        } else {
          hurtPlayer(bullet.damage || 12 + state.wave * 2);
          bullets.splice(i, 1);
        }
      }
    }
  }

  function updateRobots(dt) {
    const player = state.player;
    const settings = getDifficultySettings();
    for (let i = state.robots.length - 1; i >= 0; i--) {
      const robot = state.robots[i];
      robot.hit = Math.max(0, robot.hit - dt);

      if (robot.hp <= 0) {
        handleRobotDefeat(robot, i);
        continue;
      }

      if (robot.respawnProtection > 0) {
        robot.respawnProtection = Math.max(0, robot.respawnProtection - dt);
        continue;
      }

      if (robot.endboss && !robot.wardenQuakeEnabled && hasIronWardenPlayer()) robot.wardenQuakeEnabled = true;
      if (robot.endboss) updateEndbossQuake(robot, dt);
      const target = getRobotTarget(robot);
      const angle = Math.atan2(target.y - robot.y, target.x - robot.x);
      const close = distance(robot, target) < robot.radius + (target.radius || 19) + 5;

      // Stun (Volt)
      if (robot.stunTimer > 0) {
        robot.stunTimer -= dt;
        continue;
      }

      // Frost-Verlangsamung
      if (robot.frozenTimer > 0) {
        robot.frozenTimer -= dt;
        if (robot.frozenTimer <= 0) robot.speed = robot.baseSpeed;
      }

      // Burn-Tick (Ember)
      if (robot.burnTimer > 0) {
        robot.burnTimer -= dt;
        robot.burnFlash = Math.max(0, (robot.burnFlash || 0) - dt);
        robot.burnSparkTimer = Math.max(0, (robot.burnSparkTimer || 0) - dt);
        robot.hp -= 8 * dt;
        if (robot.burnSparkTimer <= 0) {
          robot.burnSparkTimer = 0.12 + Math.random() * 0.08;
          addParticle(robot.x + (Math.random() - 0.5) * robot.radius, robot.y - robot.radius * 0.75, "#ff7a3d", 0.9);
          if (Math.random() < 0.45) addParticle(robot.x, robot.y, "#ffc857", 0.6);
        }
      }

      if (robot.hp <= 0) {
        handleRobotDefeat(robot, i);
        continue;
      }

      if (!close) {
        const movementSpeed = getChaosEnemySpeed(robot.speed, state);
        robot.x += Math.cos(angle) * movementSpeed * dt;
        robot.y += Math.sin(angle) * movementSpeed * dt;
      } else if (target.local) {
        hurtPlayer(robot.damage * dt);
      }
      robot.x = clamp(robot.x, robot.radius + 24, dom.canvas.width - robot.radius - 24);
      robot.y = clamp(robot.y, robot.radius + 70, dom.canvas.height - robot.radius - 28);
      if (robot.boss && !target.dead) updateBossAttack(robot, target, dt);
      const bulletStormActive = isChaosEventActive(state, "bullet-storm");
      if (robot.shooter || robot.boss || bulletStormActive) {
        robot.fireTimer -= dt;
        if (robot.fireTimer <= 0 && !target.dead && distance(robot, target) < 620) {
          const shotSpeed = robot.endboss ? robot.bulletSpeed : robot.boss ? settings.bossBulletSpeed : 360;
          const baseFireInterval = robot.endboss ? robot.fireRate : robot.boss ? settings.bossFireRate : 1.5;
          robot.fireTimer = getChaosEnemyFireInterval(baseFireInterval, state);
          for (const shotAngle of getChaosEnemyShotAngles(angle, state)) {
            state.enemyBullets.push({
              id: nextEntityId("e"),
              x: robot.x,
              y: robot.y,
              vx: Math.cos(shotAngle) * shotSpeed,
              vy: Math.sin(shotAngle) * shotSpeed,
              radius: robot.boss ? 7 : 5,
              life: 2,
              damage: robot.bulletDamage,
              color: bulletStormActive ? "#ff2d55" : robot.endboss ? "#d1d5db" : robot.boss ? "#b11226" : "#ff4f92"
            });
          }
        }
      }
      if (robot.hp <= 0) {
        handleRobotDefeat(robot, i);
      }
    }
  }

  function handleRobotDefeat(robot, index) {
    if (isChaosEventActive(state, "respawn") && !robot.chaosRespawned) {
      robot.hp = getChaosRespawnHealth(robot.maxHp);
      robot.chaosRespawned = true;
      robot.respawnProtection = CHAOS_RESPAWN_PROTECTION;
      robot.fireTimer = Math.max(1, Number(robot.fireTimer) || 0);
      robot.bossAttackTimer = Math.max(1, Number(robot.bossAttackTimer) || 0);
      robot.stunTimer = 0;
      robot.frozenTimer = 0;
      robot.burnTimer = 0;
      robot.quakeWarning = 0;
      robot.quakeBlast = 0;
      pulse(robot.x, robot.y, "#a855f7", robot.boss ? 70 : 30);
      return;
    }

    state.robots.splice(index, 1);
    state.score += robot.endboss ? robot.endbossPhase * 1000 : robot.boss ? 700 : robot.bruiser ? 90 : 45;
    pulse(robot.x, robot.y, robot.endboss ? "#d1d5db" : robot.boss ? "#b11226" : "#38d8ff", robot.boss ? 80 : 24);
    if (robot.endboss) {
      finishEndbossPhase(robot);
    } else if (robot.boss) {
      state.bossesDefeated += 1;
      state.waveDelay = 3;
      state.nextWavePulse = 3;
      spawnBossReward(robot.x, robot.y);
    } else if (Math.random() < getDifficultySettings().pickupDrop) {
      state.pickups.push(makePickup(robot.x, robot.y));
    }
  }

  function updateMaskBoomerang(bullet, dt) {
    if (!bullet.returning && bullet.age >= (bullet.returnAfter || 1.25)) bullet.returning = true;
    if (bullet.returning) {
      const boss = state.robots.find((robot) => robot.id === bullet.bossId);
      const targetX = boss?.x ?? bullet.originX;
      const targetY = boss?.y ?? bullet.originY;
      const angle = Math.atan2(targetY - bullet.y, targetX - bullet.x);
      const speed = bullet.boomerangSpeed || Math.hypot(bullet.vx, bullet.vy) || 330;
      const turn = 1 - Math.exp(-9 * dt);
      bullet.vx += (Math.cos(angle) * speed - bullet.vx) * turn;
      bullet.vy += (Math.sin(angle) * speed - bullet.vy) * turn;
      if (bullet.age > (bullet.returnAfter || 1.25) + 0.16 && Math.hypot(targetX - bullet.x, targetY - bullet.y) < (boss?.radius || 36) + 12) {
        return true;
      }
    }
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    return false;
  }

  function finishEndbossPhase(robot) {
    state.bossesDefeated += 1;
    state.enemyBullets = [];
    state.bossLasers = [];
    if (robot.endbossPhase < 3) {
      const healX = clamp(robot.x + (robot.x < dom.canvas.width / 2 ? 72 : -72), 50, dom.canvas.width - 50);
      const healY = clamp(robot.y + 58, 92, dom.canvas.height - 58);
      state.pickups.push(makePickup(healX, healY, "heal"));
      state.endbossPhase = robot.endbossPhase + 1;
      state.endbossTransition = 3;
      state.nextWavePulse = 3;
      state.player.invincible = Math.max(state.player.invincible, 1.2);
      return;
    }
    finishEndbossRun(true);
  }

  function hurtPlayer(amount) {
    const player = state.player;
    if (player.dead) return;
    if (state.debugGodMode) return;
    if (player.invincible > 0) return;
    const reduced = calculatePlayerDamage({
      mode: state.gameMode,
      currentHp: player.hp,
      amount,
      shielded: player.shield > 0,
      enemyDamageMultiplier: 1
    });
    player.hp -= reduced;
    appendTestLog("player_damage", {
      amount: reduced,
      hpAfter: Math.max(0, player.hp),
      shielded: player.shield > 0,
      wave: state.wave
    });
    state.shake = Math.max(state.shake, 0.28);
    if (player.hp <= 0) {
      if (state.gameMode === "hardcore" || state.gameMode === "one-heart") {
        if (isCoopMode() && getActivePlayerCount() > 1) knockOutPlayer({ permanent: true });
        else endGame();
      } else if (isCoopMode() && getActivePlayerCount() > 1) {
        knockOutPlayer();
      } else {
        endGame();
      }
    }
  }

  function updateBossAttack(robot, target, dt) {
    robot.bossAttackTimer = Math.max(0, (robot.bossAttackTimer || 0) - dt);
    if (robot.bossAttackTimer > 0) return;

    if (robot.endboss) {
      updateEndbossAttack(robot, target);
      return;
    }

    const difficulty = getDifficultySettings();
    const level = Math.max(1, Math.floor(state.wave / 10));
    robot.bossAttackTimer = Math.max(1.2, 3.6 - level * 0.18);
    if (robot.bossAttackType === "laser") {
      startBossLaser(robot, target, difficulty, level);
      robot.bossAttackType = "burst";
    } else {
      fireBossBurst(robot, target, difficulty, level);
      robot.bossAttackType = "laser";
    }
  }

  function updateEndbossAttack(robot, target) {
    const phase = robot.endbossPhase || 1;
    const hasQuake = robot.wardenQuakeEnabled && phase >= 2;
    const attacks = phase === 1
      ? ["fan", "boomerang"]
      : phase === 2
        ? ["fan", "ring", "boomerang", "bats", ...(hasQuake ? ["quake"] : [])]
        : ["fan", "ring", "boomerang", "bats", "laser", ...(hasQuake ? ["quake"] : [])];
    let attack = attacks[robot.bossAttackIndex % attacks.length];
    robot.bossAttackIndex += 1;
    robot.bossAttackTimer = robot.bossAttackRate;
    if (attack === "bats" && state.time - (robot.lastBatAttackAt ?? -99) < 14) attack = "fan";

    if (attack === "fan") {
      fireEndbossFan(robot, target, phase);
    } else if (attack === "ring") {
      fireEndbossRing(robot, phase);
    } else if (attack === "boomerang") {
      throwMaskBoomerangs(robot, target, phase);
    } else if (attack === "laser") {
      startBossLaser(robot, target, getDifficultySettings(), phase + 3, "#d1d5db");
    } else if (attack === "bats") {
      launchBatSwarm(robot, target, phase);
    } else {
      startEndbossQuake(robot, phase);
    }
  }

  function launchBatSwarm(robot, target, phase) {
    const columns = phase >= 3 ? 7 : 5;
    const rows = 3;
    const count = columns * rows;
    const columnSpacing = phase >= 3 ? 34 : 36;
    const rowSpacing = 29;
    const angle = Math.atan2(target.y - robot.y, target.x - robot.x);
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const sideX = -Math.sin(angle);
    const sideY = Math.cos(angle);
    const speed = robot.bulletSpeed * (phase >= 3 ? 0.72 : 0.66);
    const warning = phase >= 3 ? 0.78 : 0.92;
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const stagger = row % 2 ? columnSpacing * 0.5 : 0;
      const sideOffset = (column - (columns - 1) / 2) * columnSpacing + stagger;
      const forwardOffset = (row - 1) * rowSpacing;
      state.enemyBullets.push({
        id: nextEntityId("bat"),
        x: robot.x + sideX * sideOffset + forwardX * forwardOffset,
        y: robot.y + sideY * sideOffset + forwardY * forwardOffset,
        vx: 0,
        vy: 0,
        batVx: forwardX * speed,
        batVy: forwardY * speed,
        batAngle: angle,
        batVariant: index % 3,
        batScale: 0.9 + (index % 4) * 0.06,
        radius: 14,
        life: 4.4,
        age: 0,
        batWarning: warning,
        batWarningMax: warning,
        batLaunched: false,
        batSwarm: true,
        damage: Math.round(robot.bulletDamage * 0.42),
        color: index % 3 === 0 ? "#08090c" : index % 3 === 1 ? "#24272d" : "#4b5058"
      });
    }
    robot.lastBatAttackAt = state.time;
    robot.bossAttackTimer = Math.max(robot.bossAttackTimer, 3.4);
    state.shake = Math.max(state.shake, 0.3);
    pulse(robot.x, robot.y, "#6b7280", 54);
    appendTestLog("boss_bat_swarm", { phase, bats: count, warning });
  }

  function applyBatBlindness(player, bullet) {
    if (!player.hitBatIds) player.hitBatIds = new Set();
    if (player.hitBatIds.has(bullet.id)) return;
    player.hitBatIds.add(bullet.id);
    if (player.hitBatIds.size > 100) player.hitBatIds.clear();
    player.blindnessTimer = Math.max(Number(player.blindnessTimer) || 0, 10);
    appendTestLog("blindness_applied", { duration: 10, phase: state.endbossPhase });
  }

  function throwMaskBoomerangs(robot, target, phase) {
    const count = Math.max(1, Math.min(3, phase));
    const center = Math.atan2(target.y - robot.y, target.x - robot.x);
    const spread = phase >= 3 ? 0.22 : 0.18;
    for (let i = 0; i < count; i++) {
      const angle = center + (i - (count - 1) / 2) * spread;
      const speed = robot.bulletSpeed * (phase >= 3 ? 0.9 : 0.84);
      state.enemyBullets.push({
        id: nextEntityId("em"),
        bossId: robot.id,
        x: robot.x + Math.cos(angle) * (robot.radius + 10),
        y: robot.y + Math.sin(angle) * (robot.radius + 10),
        originX: robot.x,
        originY: robot.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 12,
        life: 4.2,
        age: 0,
        returnAfter: 1.25 + i * 0.1,
        returning: false,
        boomerangSpeed: speed * 1.08,
        maskBoomerang: true,
        damage: Math.round(robot.bulletDamage * 0.88),
        color: "#d1d5db"
      });
    }
    state.shake = Math.max(state.shake, 0.24);
    pulse(robot.x, robot.y, "#111318", 28 + phase * 4);
  }

  function triggerMaskBoomerangForPlaytest() {
    if (!state.endbossMode) return false;
    state.running = true;
    state.over = false;
    state.paused = false;
    dom.message.classList.add("hidden");
    let boss = state.robots.find((robot) => robot.endboss);
    if (!boss) {
      spawnEndbossPhase(Math.max(1, state.endbossPhase || 1));
      boss = state.robots.find((robot) => robot.endboss);
    }
    if (!boss) return false;
    state.player.dead = false;
    state.player.respawnTimer = 0;
    state.player.hp = state.player.maxHp;
    state.player.invincible = 3;
    state.player.x = dom.canvas.width / 2;
    state.player.y = dom.canvas.height * 0.62;
    boss.stunTimer = Math.max(boss.stunTimer || 0, 3);
    boss.fireTimer = Math.max(boss.fireTimer || 0, 3);
    boss.bossAttackTimer = Math.max(boss.bossAttackTimer || 0, 3);
    throwMaskBoomerangs(boss, state.player, boss.endbossPhase || 1);
    updateHud();
    return true;
  }

  function triggerBatSwarmForPlaytest() {
    if (!state.endbossMode) {
      startGame({ endboss: true, skipPrep: true, playtest: true });
    }
    const boss = state.robots.find((robot) => robot.endboss);
    if (!boss || !state.player) return false;
    state.running = true;
    state.over = false;
    state.paused = false;
    state.player.dead = false;
    state.player.invincible = 3.2;
    state.player.blindnessTimer = 0;
    state.player.x = dom.canvas.width / 2;
    state.player.y = dom.canvas.height * 0.62;
    boss.stunTimer = Math.max(boss.stunTimer || 0, 4);
    boss.fireTimer = Math.max(boss.fireTimer || 0, 4);
    boss.bossAttackTimer = Math.max(boss.bossAttackTimer || 0, 4);
    launchBatSwarm(boss, state.player, Math.max(2, boss.endbossPhase || 2));
    updateHud();
    return true;
  }

  function advanceEndbossPhaseForPlaytest() {
    if (!state.endbossMode) {
      startGame({ endboss: true, skipPrep: true, playtest: true });
      return true;
    }
    const phase = Math.max(1, Number(state.endbossPhase) || 1);
    if (phase < 3) {
      spawnEndbossPhase(phase + 1);
      updateHud();
      return true;
    }
    const boss = state.robots.find((robot) => robot.endboss);
    if (boss) boss.hp = 0;
    return Boolean(boss);
  }

  function startEndbossQuake(robot, phase) {
    const warning = phase >= 3 ? 0.82 : 1.05;
    robot.quakeId = (Number(robot.quakeId) || 0) + 1;
    robot.quakeWarning = warning;
    robot.quakeWarningMax = warning;
    robot.quakeBlast = 0;
    robot.quakeBlastMax = 0.38;
    robot.quakeRadius = phase >= 3 ? 220 : 175;
    robot.quakeDamage = Math.round(robot.damage * (phase >= 3 ? 1.08 : 0.95));
    state.shake = Math.max(state.shake, 0.2);
    pulse(robot.x, robot.y, "#ffc857", 34);
  }

  function triggerEndbossQuakeForPlaytest() {
    if (!state.endbossMode || state.selectedHero !== "warden") return false;
    state.running = true;
    state.over = false;
    state.paused = false;
    dom.message.classList.add("hidden");
    let boss = state.robots.find((robot) => robot.endboss && robot.endbossPhase >= 2);
    if (!boss) {
      spawnEndbossPhase(Math.max(2, state.endbossPhase || 2));
      boss = state.robots.find((robot) => robot.endboss);
    }
    if (!boss) return false;
    state.player.dead = false;
    state.player.respawnTimer = 0;
    state.player.hp = state.player.maxHp;
    state.player.invincible = 0;
    state.player.x = boss.x;
    state.player.y = clamp(boss.y + Math.min(110, (boss.quakeRadius || 175) * 0.56), 82, dom.canvas.height - 42);
    boss.wardenQuakeEnabled = true;
    boss.stunTimer = Math.max(boss.stunTimer || 0, 2.2);
    boss.fireTimer = Math.max(boss.fireTimer || 0, 2.2);
    boss.bossAttackTimer = Math.max(boss.bossAttackTimer || 0, 2.2);
    startEndbossQuake(boss, boss.endbossPhase);
    updateHud();
    return true;
  }

  function toggleGodModeForPlaytest() {
    state.debugGodMode = !state.debugGodMode;
    if (state.debugGodMode && state.player) {
      state.player.hp = state.player.maxHp;
      state.player.dead = false;
      state.player.respawnTimer = 0;
      state.player.invincible = Math.max(state.player.invincible || 0, 1);
    }
    appendTestLog("debug_godmode", { enabled: state.debugGodMode });
    return state.debugGodMode;
  }

  function clearThreatsForPlaytest() {
    const removed = {
      enemyBullets: state.enemyBullets.length,
      playerBullets: state.bullets.length,
      bossLasers: state.bossLasers.length
    };
    state.enemyBullets = [];
    state.bullets = [];
    state.bossLasers = [];
    for (const robot of state.robots) {
      robot.quakeCharge = 0;
      robot.quakeBlast = 0;
      robot.quakeCooldown = Math.max(robot.quakeCooldown || 0, 1.4);
    }
    state.shake = 0;
    appendTestLog("debug_clear_threats", removed);
    return removed;
  }

  function defeatRobotsForPlaytest() {
    const count = state.robots.length;
    for (const robot of state.robots) {
      robot.hp = 0;
      robot.hit = Math.max(robot.hit || 0, 0.2);
    }
    appendTestLog("debug_defeat_robots", { count, endboss: state.endbossMode, phase: state.endbossPhase });
    return count;
  }

  function addScoreForPlaytest(amount = 100000) {
    state.score += Math.max(0, Math.round(Number(amount) || 0));
    updateHud();
    appendTestLog("debug_add_score", { amount, score: state.score });
    return state.score;
  }

  function spawnPickupForPlaytest(type = "heal") {
    if (!state.player) return false;
    const safeType = ["heal", "damage", "speed"].includes(type) ? type : "heal";
    state.pickups.push(makePickup(
      clamp(state.player.x + 46, 50, dom.canvas.width - 50),
      clamp(state.player.y, 92, dom.canvas.height - 58),
      safeType
    ));
    appendTestLog("debug_spawn_pickup", { type: safeType });
    return true;
  }

  function applyBlindnessForPlaytest(duration = 10) {
    if (!state.player) return false;
    state.player.blindnessTimer = Math.max(state.player.blindnessTimer || 0, Number(duration) || 10);
    appendTestLog("debug_blindness", { duration: state.player.blindnessTimer });
    return true;
  }

  function updateEndbossQuake(robot, dt) {
    if (robot.quakeWarning > 0) {
      robot.quakeWarning = Math.max(0, robot.quakeWarning - dt);
      if (robot.quakeWarning <= 0) {
        robot.quakeBlast = robot.quakeBlastMax || 0.38;
        state.shake = Math.max(state.shake, 0.8);
        pulse(robot.x, robot.y, "#ff9f43", robot.quakeRadius || 175);
      }
      return;
    }
    if (robot.quakeBlast <= 0) return;
    robot.quakeBlast = Math.max(0, robot.quakeBlast - dt);
    damageLocalPlayerFromQuake(robot);
  }

  function damageLocalPlayerFromQuake(robot) {
    const player = state.player;
    if (!player || player.dead || player.lastBossQuakeHit === robot.quakeId) return;
    if (distance(robot, player) > (robot.quakeRadius || 0) + player.radius) return;
    player.lastBossQuakeHit = robot.quakeId;
    hurtPlayer(robot.quakeDamage || robot.damage || 30);
  }

  function fireEndbossFan(robot, target, phase) {
    const count = 3 + phase * 2;
    const center = Math.atan2(target.y - robot.y, target.x - robot.x);
    const spread = 0.16;
    for (let i = 0; i < count; i++) {
      const angle = center + (i - (count - 1) / 2) * spread;
      state.enemyBullets.push({
        id: nextEntityId("ef"),
        x: robot.x,
        y: robot.y,
        vx: Math.cos(angle) * robot.bulletSpeed,
        vy: Math.sin(angle) * robot.bulletSpeed,
        radius: 7,
        life: 2.4,
        damage: Math.round(robot.bulletDamage * 0.9),
        color: "#d1d5db"
      });
    }
    state.shake = Math.max(state.shake, 0.22);
  }

  function fireEndbossRing(robot, phase) {
    const count = 8 + phase * 4;
    const offset = state.time * (0.4 + phase * 0.15);
    for (let i = 0; i < count; i++) {
      const angle = offset + (Math.PI * 2 * i) / count;
      const speed = robot.bulletSpeed * (0.72 + (i % 2) * 0.16);
      state.enemyBullets.push({
        id: nextEntityId("er"),
        x: robot.x,
        y: robot.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: phase >= 3 ? 7 : 6,
        life: 2.8,
        damage: Math.round(robot.bulletDamage * 0.72),
        color: i % 2 ? "#9ca3af" : "#f3f4f6"
      });
    }
    state.shake = Math.max(state.shake, 0.32);
    pulse(robot.x, robot.y, "#9ca3af", 32);
  }

  function startBossLaser(robot, target, difficulty, level, color = "#ff2d55") {
    const angle = Math.atan2(target.y - robot.y, target.x - robot.x);
    const laserCount = Math.min(3, Math.max(1, Math.ceil(level / 2)));
    const spread = laserCount === 1 ? 0 : 0.18;
    const damage = Math.round((22 + level * 3) * difficulty.enemyDamage * difficulty.bossDamage * getPlayerScaling().damage);
    for (let i = 0; i < laserCount; i++) {
      const offset = (i - (laserCount - 1) / 2) * spread;
      state.bossLasers.push({
        id: nextEntityId("l"),
        x: robot.x,
        y: robot.y,
        angle: angle + offset,
        warning: Math.max(0.62, 0.9 - level * 0.035),
        blast: 0,
        width: Math.min(30, 16 + level * 1.4),
        length: 900,
        damage,
        hit: false,
        color
      });
    }
    state.shake = Math.max(state.shake, 0.22);
    for (let i = 0; i < 14 + laserCount * 6; i++) addParticle(robot.x, robot.y, color, 1.7);
  }

  function fireBossBurst(robot, target, difficulty, level) {
    const count = Math.min(20, 8 + level * 2);
    const speed = difficulty.bossBulletSpeed * Math.min(1.08, 0.72 + level * 0.045);
    const damage = Math.round(robot.bulletDamage * (0.68 + Math.min(0.22, level * 0.035)));
    const start = Math.atan2(target.y - robot.y, target.x - robot.x);
    for (let i = 0; i < count; i++) {
      const angle = start + (Math.PI * 2 * i) / count;
      state.enemyBullets.push({
        id: nextEntityId("bb"),
        x: robot.x,
        y: robot.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        life: 2.6,
        damage,
        color: "#ff2d55"
      });
    }
    state.shake = Math.max(state.shake, 0.28);
    pulse(robot.x, robot.y, "#ff2d55", 34);
  }

  function updateBossLasers(dt) {
    for (let i = state.bossLasers.length - 1; i >= 0; i--) {
      const laser = state.bossLasers[i];
      if (laser.warning > 0) {
        laser.warning -= dt;
        if (laser.warning <= 0) {
          laser.blast = 0.28;
          state.shake = Math.max(state.shake, 0.45);
          pulse(laser.x, laser.y, laser.color || "#ff2d55", 22);
        }
      } else {
        laser.blast -= dt;
        if (!laser.hit && laser.blast > 0 && !state.player.dead && isPointNearLaser(state.player, laser)) {
          laser.hit = true;
          hurtPlayer(laser.damage);
        }
        if (laser.blast <= 0) state.bossLasers.splice(i, 1);
      }
    }
  }

  function isPointNearLaser(point, laser) {
    const dx = point.x - laser.x;
    const dy = point.y - laser.y;
    const along = dx * Math.cos(laser.angle) + dy * Math.sin(laser.angle);
    if (along < 0 || along > laser.length) return false;
    const side = Math.abs(-Math.sin(laser.angle) * dx + Math.cos(laser.angle) * dy);
    return side < (laser.width || 18) + (point.radius || 0);
  }

  function knockOutPlayer({ permanent = false } = {}) {
    const player = state.player;
    player.hp = 0;
    player.dead = true;
    player.respawnTimer = permanent ? Number.MAX_SAFE_INTEGER : 20;
    player.shield = 0;
    player.invincible = 0;
    player.fireTimer = 0;
    player.companionAbilityTimer = 0;
    state.touch.fire = false;
    state.touch.moveX = 0;
    state.touch.moveY = 0;
    state.mouse.down = false;
    state.shake = Math.max(state.shake, 0.45);
    pulse(player.x, player.y, "#ff4f92", 46);
    sendMultiplayerPlayerState();
    if (areAllCoopPlayersDown()) endGame();
  }

  function updateRespawn(dt) {
    const player = state.player;
    if (areAllCoopPlayersDown()) {
      endGame();
      return;
    }
    player.respawnTimer = Math.max(0, (player.respawnTimer || 0) - dt);
    if (player.respawnTimer > 0) return;
    const teammate = getLivingTeammate();
    player.x = teammate ? clamp(teammate.x + 46, 34, dom.canvas.width - 34) : dom.canvas.width / 2;
    player.y = teammate ? clamp(teammate.y + 24, 82, dom.canvas.height - 42) : dom.canvas.height / 2;
    player.hp = Math.max(1, Math.round(player.maxHp * 0.55));
    player.dead = false;
    player.invincible = 2.2;
    player.healFlash = 1.0;
    pulse(player.x, player.y, "#b7ff4a", 58);
  }

  function getLivingTeammate() {
    const now = performance.now();
    return (state.remotePlayers || []).find((player) => !player.dead && now - (player.seenAt || 0) < 2500);
  }

  function areAllCoopPlayersDown() {
    if (!isCoopMode() || !state.player?.dead) return false;
    const now = performance.now();
    const teammates = (state.remotePlayers || []).filter((player) => now - (player.seenAt || 0) < 2500);
    return teammates.length > 0 && teammates.every((player) => player.dead || player.respawnTimer > 0);
  }

  function damageRobot(robot, amount, color) {
    if (!canDamageRobot(robot)) return false;
    robot.hp -= amount;
    robot.hit = 0.12;
    for (let i = 0; i < 8; i++) addParticle(robot.x, robot.y, color, 3);
    return true;
  }

  function canDamageRobot(robot) {
    return Boolean(robot) && (Number(robot.respawnProtection) || 0) <= 0;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function makePickup(x, y, forcedType = null) {
    const roll = Math.random();
    const type = forcedType || (roll < 0.45 ? "heal" : roll < 0.72 ? "damage" : "speed");
    const colors = { heal: "#b7ff4a", damage: "#ff7a3d", speed: "#38d8ff" };
    return { id: nextEntityId("p"), x, y, type, color: colors[type], radius: 12, life: 9 };
  }

  function getRobotTarget(robot) {
    const targets = state.player?.dead ? [] : [{ ...state.player, local: true }];
    const now = performance.now();
    for (const player of state.remotePlayers || []) {
      if (now - (player.seenAt || 0) > 1200) continue;
      if (player.dead || player.respawnTimer > 0) continue;
      targets.push({ ...player, radius: 19, local: false });
    }
    if (targets.length === 0) return { x: robot.x, y: robot.y, radius: 19, local: false, dead: true };
    return targets.reduce((closest, target) => (distance(robot, target) < distance(robot, closest) ? target : closest), targets[0]);
  }

  function updateGuestDamage(dt) {
    const player = state.player;
    if (!player || player.dead) return;
    for (const robot of state.robots || []) {
      if (distance(robot, player) < robot.radius + player.radius + 5) hurtPlayer((robot.damage || 12) * dt);
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = state.enemyBullets[i];
      if (distance(bullet, player) < (bullet.radius || 5) + player.radius) {
        if (bullet.batSwarm) {
          applyBatBlindness(player, bullet);
          hurtPlayer(bullet.damage || 8);
          state.enemyBullets.splice(i, 1);
        } else if (bullet.maskBoomerang) {
          if (!player.hitMaskIds) player.hitMaskIds = new Set();
          if (!player.hitMaskIds.has(bullet.id)) {
            player.hitMaskIds.add(bullet.id);
            hurtPlayer(bullet.damage || 12 + state.wave * 2);
            if (player.hitMaskIds.size > 80) player.hitMaskIds.clear();
          }
        } else {
          hurtPlayer(bullet.damage || 12 + state.wave * 2);
          state.enemyBullets.splice(i, 1);
        }
      } else if (bullet.life <= 0) {
        state.enemyBullets.splice(i, 1);
      }
    }
    for (const robot of state.robots || []) {
      if (robot.endboss && robot.quakeBlast > 0) damageLocalPlayerFromQuake(robot);
    }
  }

  function spawnBossReward(x, y) {
    [-44, 0, 44].forEach((offset, index) => {
      state.pickups.push(makePickup(clamp(x + offset, 50, dom.canvas.width - 50), clamp(y + 28 + index * 8, 92, dom.canvas.height - 58), "heal"));
    });
  }

  function updatePickups(dt) {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const item = state.pickups[i];
      item.life -= dt;
      if (!state.player.dead && distance(item, state.player) < item.radius + state.player.radius) {
        applyPickup(item);
        state.pickups.splice(i, 1);
      } else if (item.life <= 0) {
        state.pickups.splice(i, 1);
      }
    }
  }

  function applyPickup(item) {
    const player = state.player;
    if (item.type === "damage") {
      player.damageBoostTimer = 7;
      player.pickupFlash = { color: item.color, timer: 0.8 };
      pulse(item.x, item.y, item.color, 30);
      return;
    }
    if (item.type === "speed") {
      player.speedBoostTimer = 7;
      player.pickupFlash = { color: item.color, timer: 0.8 };
      pulse(item.x, item.y, item.color, 30);
      return;
    }
    player.hp = Math.min(player.maxHp, player.hp + 24);
    player.healFlash = 0.75;
    pulse(item.x, item.y, item.color || "#b7ff4a", 24);
  }

  function endGame({ broadcast = true } = {}) {
    if (state.endbossMode) {
      finishEndbossRun(false);
      return;
    }
    if (state.over) return;
    state.over = true;
    appendTestLog("game_over", {
      wave: state.wave,
      score: state.score,
      bosses: state.bossesDefeated,
      difficulty: state.difficulty,
      playerCount: getActivePlayerCount(),
      gameMode: state.gameMode
    });
    if (broadcast && isCoopMode()) sendMultiplayerGameOver();
    state.touch.fire = false;
    state.touch.moveX = 0;
    state.touch.moveY = 0;
    dom.touchControls?.classList.add("hidden");
    stopMusic();
    const isRecord = state.score > state.startHighScore;
    const reward = calculateCoinReward(state);
    state.lastCoinReward = reward;
    addCoins(state, reward, dom);
    saveHighScore(state, dom);
    saveLeaderboardEntry(state);
    submitOnlineScore(state)
      .then(() => loadOnlineScores(10, state.leaderboardFilter || "all"))
      .then((onlineScores) => {
        if (onlineScores) state.onlineLeaderboard = onlineScores;
        renderLeaderboard();
      });
    renderLeaderboard();
    showMessage(`<strong>${isRecord ? t("game.newHighScore") : t("game.over")}</strong>${tf("game.summary", { name: state.playerName, wave: state.wave, score: state.score })}<br>${t("game.defeatedBosses")}: ${state.bossesDefeated}<br>${t("game.bossBonus")}: +${state.bossCoinBonus} ${t("shop.coins")}<br>${t("mode.label")}: ${t(getGameMode(state.gameMode).labelKey)}<br>${t("game.difficulty")}: ${t(getDifficultySettings().labelKey)}<br>${t("game.reward")}: +${reward} ${t("shop.coins")}<br>${t("game.highScore")}: ${state.highScore}<div class="message-actions"><button id="againBtn">${t("game.again")}</button><button id="gameOverMenuBtn" class="secondary-btn">${t("game.mainMenu")}</button></div>`);
    bindOverlayButton("#againBtn", startGame);
    bindOverlayButton("#gameOverMenuBtn", returnToMenu);
  }

  function finishEndbossRun(victory, { broadcast = true } = {}) {
    if (state.over) return;
    state.over = true;
    appendTestLog("endboss_result", {
      victory: Boolean(victory),
      phase: state.endbossPhase,
      hero: state.selectedHero,
      playerCount: getActivePlayerCount()
    });
    if (victory && broadcast && isCoopHost()) sendMultiplayerEndbossResult(true);
    state.touch.fire = false;
    state.touch.moveX = 0;
    state.touch.moveY = 0;
    dom.touchControls?.classList.add("hidden");
    stopMusic();

    let rewardUnlocked = false;
    if (victory && !state.ownedCosmetics.includes("scipios-mask")) {
      state.ownedCosmetics.push("scipios-mask");
      state.pendingCompanionReward = true;
      rewardUnlocked = true;
      saveProgression(state);
    }

    if (victory) {
      showMessage(`<strong>${t("game.maskThiefDefeated")}</strong>${t("game.endbossVictory")}${rewardUnlocked ? `<br>${t("game.newReward")}` : ""}<div class="message-actions"><button id="endbossAgainBtn">${t("game.fightAgain")}</button><button id="endbossMenuBtn" class="secondary-btn">${t("game.mainMenu")}</button></div>`);
    } else {
      showMessage(`<strong>${t("game.maskThiefNotDefeated")}</strong>${tf("game.endbossProgress", { stage: Math.max(1, state.endbossPhase) })}<div class="message-actions"><button id="endbossAgainBtn">${t("game.tryAgain")}</button><button id="endbossMenuBtn" class="secondary-btn">${t("game.mainMenu")}</button></div>`);
    }
    bindOverlayButton("#endbossAgainBtn", () => startGame({ endboss: true, skipPrep: true }));
    bindOverlayButton("#endbossMenuBtn", returnToMenu);
  }

  function returnToMenu() {
    Object.assign(state, { running: false, paused: false, over: false, player: null, endbossMode: false, endbossPhase: 0, endbossTransition: 0, prepTimer: 0, waveDelay: 0, nextWavePulse: 0, chaosEventId: null, chaosEventTimer: 0, chaosBrokenTiles: [], chaosMeteors: [], chaosMeteorTimer: 0, bullets: [], enemyBullets: [], robots: [], bossLasers: [], particles: [], pickups: [], meleeSwings: [], wardenRing: null });
    stopMusic();
    dom.pauseBtn.textContent = "II";
    dom.message.classList.add("hidden");
    dom.gamePanel.classList.add("hidden");
    dom.touchControls?.classList.add("hidden");
    dom.chaosEventHud?.classList.add("hidden");
    document.body.classList.remove("playing");
    dom.menu.classList.remove("hidden");
    dom.companionReward?.classList.toggle("hidden", !state.pendingCompanionReward);
    renderLeaderboard();
  }

  function updateHud() {
    if (!state.player) return;
    if (!state.endbossMode && state.score > state.highScore) saveHighScore(state, dom);
    dom.waveText.textContent = state.endbossMode ? `${state.endbossPhase}/3` : state.wave;
    dom.scoreText.textContent = state.score;
    if (dom.highScoreText) dom.highScoreText.textContent = state.highScore;
    if (dom.difficultyText) {
      const mode = getDifficultyHudText();
      dom.difficultyText.textContent = getActivePlayerCount() > 1 ? `${mode} · ${getActivePlayerCount()} ${t("multiplayer.players")}` : mode;
    }
    renderChaosHud();
    dom.healthBar.style.width = `${clamp((state.player.hp / state.player.maxHp) * 100, 0, 100)}%`;
    dom.specialBar.style.width = `${clamp(100 - (state.player.specialTimer / state.player.hero.specialCooldown) * 100, 0, 100)}%`;
  }

  function getDifficultyHudText() {
    const difficulty = state.endbossMode ? "Endboss" : t(getDifficultySettings().labelKey);
    if (state.gameMode === "normal") return difficulty;
    return `${difficulty} · ${t(getGameMode(state.gameMode).labelKey)}`;
  }

  function updateChaosMode(dt) {
    const { event, changed } = updateChaosRun(state, dt, chaosRandom);
    if (state.gameMode !== "chaos") {
      clearChaosHazards();
      return;
    }
    if (changed && event) {
      enterChaosEvent(event);
      appendTestLog("chaos_event", { event: event.id, wave: state.wave, score: state.score });
      if (state.player) pulse(state.player.x, state.player.y, "#ff4f92", 34);
    }

    if (isChaosEventActive(state, "broken-map")) {
      updateBrokenMap(dt);
    } else if (isChaosEventActive(state, "meteor")) {
      updateMeteorEvent(dt);
    }
  }

  function enterChaosEvent(event) {
    clearChaosHazards();
    if (!event) return;
    if (event.id === "broken-map" && !isCoopGuest()) {
      state.chaosBrokenTiles = createBrokenMapTiles(7);
    }
    if (event.id === "meteor") state.chaosMeteorTimer = 0.2;
  }

  function clearChaosHazards() {
    if (!isChaosEventActive(state, "broken-map")) state.chaosBrokenTiles = [];
    if (!isChaosEventActive(state, "meteor")) {
      state.chaosMeteors = [];
      state.chaosMeteorTimer = 0;
    }
  }

  function createBrokenMapTiles(count) {
    const tiles = [];
    const avoid = [state.player, ...(state.remotePlayers || [])].filter(Boolean);
    for (let attempt = 0; attempt < 120 && tiles.length < count; attempt++) {
      const width = Math.round(92 + Math.random() * 92);
      const height = Math.round(66 + Math.random() * 68);
      const x = Math.round(30 + Math.random() * (dom.canvas.width - width - 60));
      const y = Math.round(72 + Math.random() * (dom.canvas.height - height - 106));
      const candidate = { x, y, width, height };
      const nearPlayer = avoid.some((point) => (
        point.x > x - 80 && point.x < x + width + 80
        && point.y > y - 80 && point.y < y + height + 80
      ));
      const overlaps = tiles.some((tile) => (
        x < tile.x + tile.width + 24 && x + width + 24 > tile.x
        && y < tile.y + tile.height + 24 && y + height + 24 > tile.y
      ));
      if (nearPlayer || overlaps) continue;
      tiles.push({
        id: nextEntityId("hole"),
        ...candidate,
        activationDelay: 0.65 + tiles.length * 0.16
      });
    }
    return tiles;
  }

  function updateBrokenMap(dt) {
    if (!isCoopGuest()) {
      for (const tile of state.chaosBrokenTiles || []) {
        tile.activationDelay = Math.max(0, (Number(tile.activationDelay) || 0) - dt);
      }
    }
    const player = state.player;
    if (!player || player.dead) return;
    const onBrokenTile = (state.chaosBrokenTiles || []).some((tile) => isPointOnActiveBrokenTile(player, tile));
    if (onBrokenTile) defeatPlayerByChaos("broken-map");
  }

  function updateMeteorEvent(dt) {
    if (!isCoopGuest()) {
      state.chaosMeteorTimer = Math.max(0, (Number(state.chaosMeteorTimer) || 0) - dt);
      if (state.chaosMeteorTimer <= 0) {
        spawnChaosMeteor();
        state.chaosMeteorTimer = 0.62 + Math.random() * 0.32;
      }
      for (let i = state.chaosMeteors.length - 1; i >= 0; i--) {
        const meteor = state.chaosMeteors[i];
        if (!meteor.landed) {
          meteor.fallTimer = Math.max(0, meteor.fallTimer - dt);
          const progress = 1 - meteor.fallTimer / meteor.fallDuration;
          meteor.y = meteor.startY + (meteor.targetY - meteor.startY) * Math.max(0, Math.min(1, progress));
          if (meteor.fallTimer <= 0) {
            meteor.landed = true;
            meteor.y = meteor.targetY;
            meteor.groundTimer = CHAOS_METEOR_GROUND_TIME;
            state.shake = Math.max(state.shake, 0.32);
            pulse(meteor.x, meteor.y, "#ff7a3d", 22);
          }
        } else {
          meteor.groundTimer = Math.max(0, meteor.groundTimer - dt);
          if (meteor.groundTimer <= 0) state.chaosMeteors.splice(i, 1);
        }
      }
    }
    damagePlayerFromMeteors();
  }

  function spawnChaosMeteor() {
    const targets = [state.player, ...(state.remotePlayers || [])].filter((player) => player && !player.dead);
    if (targets.length === 0) return;
    const target = targets[Math.floor(Math.random() * targets.length)] || targets[0];
    const angle = Math.random() * Math.PI * 2;
    const targetDistance = 30 + Math.random() * 270;
    const meteorMargin = CHAOS_METEOR_MAX_RADIUS + 16;
    const targetX = clamp(target.x + Math.cos(angle) * targetDistance, meteorMargin, dom.canvas.width - meteorMargin);
    const targetY = clamp(target.y + Math.sin(angle) * targetDistance, 70 + meteorMargin, dom.canvas.height - meteorMargin);
    const fallDuration = 0.78 + Math.random() * 0.34;
    state.chaosMeteors.push({
      id: nextEntityId("meteor"),
      x: targetX,
      y: targetY - 290,
      startY: targetY - 290,
      targetY,
      radius: Math.round(CHAOS_METEOR_MIN_RADIUS + Math.random() * (CHAOS_METEOR_MAX_RADIUS - CHAOS_METEOR_MIN_RADIUS)),
      damage: CHAOS_METEOR_DAMAGE,
      fallDuration,
      fallTimer: fallDuration,
      groundTimer: 0,
      landed: false
    });
  }

  function damagePlayerFromMeteors() {
    const player = state.player;
    if (!player || player.dead) return;
    if (!(player.hitMeteorIds instanceof Set)) player.hitMeteorIds = new Set();
    for (const meteor of state.chaosMeteors || []) {
      if (!meteor.landed || meteor.groundTimer < 1.55 || player.hitMeteorIds.has(meteor.id)) continue;
      if (Math.hypot(player.x - meteor.x, player.y - meteor.y) > player.radius + meteor.radius + 8) continue;
      player.hitMeteorIds.add(meteor.id);
      hurtPlayer(meteor.damage || CHAOS_METEOR_DAMAGE);
      if (player.hitMeteorIds.size > 80) player.hitMeteorIds.clear();
      if (player.dead || state.over) return;
    }
  }

  function defeatPlayerByChaos(source) {
    const player = state.player;
    if (!player || player.dead || state.debugGodMode) return;
    player.hp = 0;
    appendTestLog("chaos_player_defeat", { source, wave: state.wave, score: state.score });
    if (isCoopMode() && getActivePlayerCount() > 1) knockOutPlayer();
    else endGame();
  }

  function renderChaosHud() {
    const active = state.gameMode === "chaos" && state.running;
    dom.chaosEventHud?.classList.toggle("hidden", !active);
    if (!active) return;
    const event = getChaosEvent(state.chaosEventId);
    if (dom.chaosEventText) dom.chaosEventText.textContent = event ? t(event.labelKey) : "–";
    if (dom.chaosEventTimer) dom.chaosEventTimer.textContent = formatChaosTime(state.chaosEventTimer);
  }

  function addParticle(x, y, color, power) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 90 * power;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 2 + Math.random() * 3, life: 0.25 + Math.random() * 0.35, color });
  }

  function pulse(x, y, color, amount) {
    for (let i = 0; i < amount; i++) addParticle(x, y, color, 4);
  }

  function isCoopGuest() {
    return state.multiplayer?.active && state.multiplayer.role === "guest";
  }

  function isCoopHost() {
    return state.multiplayer?.active && state.multiplayer.role === "host";
  }

  function isCoopMode() {
    return state.multiplayer?.active && state.multiplayer.role !== "solo";
  }

  function sendGuestAction(action) {
    if (!isCoopGuest() || !state.player || state.player.dead) return;
    sendMultiplayerAction({
      ...action,
      hero: action.hero || state.selectedHero,
      x: Math.round(action.x ?? state.player.x),
      y: Math.round(action.y ?? state.player.y),
      color: state.player.hero?.color || "#38d8ff"
    });
  }

  function cloneBullet(bullet) {
    return {
      id: bullet.id,
      x: Math.round(bullet.x),
      y: Math.round(bullet.y),
      vx: bullet.vx,
      vy: bullet.vy,
      radius: bullet.radius,
      life: bullet.life,
      damage: bullet.damage,
      color: bullet.color,
      pierce: bullet.pierce
    };
  }

  function handleMultiplayerAction(message) {
    if (!isCoopHost()) return;
    const action = message?.action || {};
    const actor = state.remotePlayers.find((player) => player.id === message.clientId) || action;
    const color = action.color || actor.color || "#38d8ff";
    const x = Number(action.x || actor.x || 0);
    const y = Number(action.y || actor.y || 0);
    const angle = Number(action.angle || 0);
    if (action.kind === "shot") {
      for (const bullet of action.bullets || []) {
        state.bullets.push({
          id: String(bullet.id || nextEntityId("rb")),
          x: Number(bullet.x) || x,
          y: Number(bullet.y) || y,
          vx: Number(bullet.vx) || Math.cos(angle) * 520,
          vy: Number(bullet.vy) || Math.sin(angle) * 520,
          radius: Number(bullet.radius) || 4,
          life: Number(bullet.life) || 1.05,
          damage: Number(bullet.damage) || 20,
          color: bullet.color || color,
          pierce: Boolean(bullet.pierce)
        });
      }
    }
    if (action.kind === "melee") {
      applyRemoteMelee(x, y, angle, Number(action.damage) || 40, color);
    }
    if (action.kind === "pickup") {
      removeRemotePickup(x, y, action.pickupType);
    }
    if (action.kind === "special") {
      applyRemoteSpecial(action.hero, x, y, angle, color);
    }
  }

  function updateGuestPickups() {
    const player = state.player;
    if (!player || player.dead) return;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const item = state.pickups[i];
      if (distance(item, player) >= item.radius + player.radius) continue;
      applyPickup(item);
      sendGuestAction({ kind: "pickup", pickupType: item.type, x: item.x, y: item.y });
      state.pickups.splice(i, 1);
    }
  }

  function removeRemotePickup(x, y, type) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < state.pickups.length; i++) {
      const item = state.pickups[i];
      if (type && item.type !== type) continue;
      const d = Math.hypot(item.x - x, item.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0 && bestDistance < 44) state.pickups.splice(bestIndex, 1);
  }

  function applyRemoteMelee(x, y, angle, damage, color) {
    state.meleeSwings.push({ x, y, angle, timer: 0.2, range: 92, color });
    for (const robot of state.robots) {
      if (!canDamageRobot(robot)) continue;
      const dx = robot.x - x;
      const dy = robot.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > 92 + robot.radius) continue;
      const robotAngle = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(robotAngle, angle)) > 0.64) continue;
      damageRobot(robot, damage, color);
    }
  }

  function applyRemoteSpecial(hero, x, y, angle, color) {
    if (hero === "volt") {
      const targets = state.robots
        .filter(canDamageRobot)
        .slice()
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
        .slice(0, 5);
      targets.forEach((robot) => {
        damageRobot(robot, 70, "#38d8ff");
        robot.stunTimer = 0.45;
      });
      state.lightningChain = { targets: targets.map((robot) => ({ x: robot.x, y: robot.y })), timer: 0.4 };
      pulse(x, y, "#38d8ff", 42);
      return;
    }
    if (hero === "ember") {
      state.robots.filter((robot) => canDamageRobot(robot) && Math.hypot(robot.x - x, robot.y - y) < 210).forEach((robot) => {
        robot.burnTimer = 3.0;
        robot.burnFlash = 0.55;
        damageRobot(robot, 95, "#ff7a3d");
      });
      state.emberRing = { x, y, timer: 0.58 };
      pulse(x, y, "#ff7a3d", 52);
      return;
    }
    if (hero === "frost") {
      state.robots.filter((robot) => canDamageRobot(robot) && Math.hypot(robot.x - x, robot.y - y) < 230).forEach((robot) => {
        robot.speed = robot.baseSpeed * 0.3;
        robot.frozenTimer = 3.0;
        damageRobot(robot, 55, "#8ee7ff");
      });
      state.frostRing = { x, y, timer: 0.45 };
      pulse(x, y, "#8ee7ff", 44);
      return;
    }
    if (hero === "pulse") {
      state.robots.filter((robot) => canDamageRobot(robot) && Math.hypot(robot.x - x, robot.y - y) < 150).forEach((robot) => damageRobot(robot, 48, "#b7ff4a"));
      state.pulseRing = { x, y, timer: 0.62 };
      pulse(x, y, "#b7ff4a", 58);
      return;
    }
    if (hero === "warden") {
      state.robots.filter((robot) => canDamageRobot(robot) && Math.hypot(robot.x - x, robot.y - y) < 175).forEach((robot) => damageRobot(robot, 118, "#d8dde8"));
      state.wardenRing = { x, y, timer: 0.56 };
      pulse(x, y, "#d8dde8", 52);
      return;
    }
    state.robots.filter((robot) => canDamageRobot(robot) && Math.hypot(robot.x - x, robot.y - y) < 150).forEach((robot) => damageRobot(robot, 84, color || "#ff4f92"));
    pulse(x + Math.cos(angle) * 90, y + Math.sin(angle) * 90, color || "#ff4f92", 52);
  }

  state.handleMultiplayerAction = handleMultiplayerAction;

  return {
    startGame,
    togglePause,
    useSpecial,
    update,
    handleMultiplayerAction,
    triggerEndbossQuakeForPlaytest,
    triggerMaskBoomerangForPlaytest,
    triggerBatSwarmForPlaytest,
    advanceEndbossPhaseForPlaytest,
    toggleGodModeForPlaytest,
    clearThreatsForPlaytest,
    defeatRobotsForPlaytest,
    addScoreForPlaytest,
    spawnPickupForPlaytest,
    applyBlindnessForPlaytest
  };
}
