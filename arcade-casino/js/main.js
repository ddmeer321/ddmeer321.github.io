// Einstiegspunkt: verbindet Spielstand, Wirtschaft, Progression, Audio, HUD,
// Halle und Spiele (Navigation per Hash-Route, damit „Zurück“ im Browser und
// auf Android funktioniert).

import { bus } from "./core/events.js";
import { loadState, getState, saveSoon, saveNow, setWriteGuard, setAfterSave, resetState, replaceState, sanitizeState, defaultState, gameData, SAVE_KEY } from "./core/state.js";
import { connectCloud, decideBoot, mergeControl, createUploader, summarize, makeBackup, validBackup, canRestore } from "./core/cloud.js";
import { readJSON, writeJSON } from "./core/storage.js";
import { createEconomy } from "./core/economy.js";
import { createProgression, xpForRound, levelInfo } from "./core/progression.js";
import { createTabLock } from "./core/tablock.js";
import { dailyAvailable, dailyAmount, refillAvailable, refillNeeded, refillWait, REFILL_AMOUNT } from "./core/bonus.js";
import { playStatus, startPause, startExclusion, createSessionTracker, formatUntil, formatRemaining } from "./core/control.js";
import { createChallenges } from "./core/challenges.js";
import { LIMITS } from "./core/limits.js";
import { celebrate } from "./ui/celebrate.js";
import { openControl, openHelp, openReminder, confirmPause } from "./ui/control.js";
import { initAudio, setAudioSettings, play, loop as audioLoop, startAmbience, stopAmbience, setMusicDuck } from "./audio/audio.js";
import { createMusicPlayer } from "./audio/music.js";
import { trackById } from "./audio/tracks.js";
import { createInbox } from "./core/inbox.js";
import { createLotto, DRAWS, LIVE_WINDOW_MS, formatDrawTime } from "./core/lotto.js";
import { createJukebox, JUKEBOX_PRICE } from "./core/jukebox.js";
import { openJukeboxOffer, openJukeboxPanel } from "./ui/jukebox.js";
import { openInbox } from "./ui/inbox.js";
import { setFeedbackSettings, haptic, fx as feedbackFx, uiTap } from "./audio/feedback.js";
import { h, clear } from "./ui/dom.js";
import { fmt, signed } from "./ui/format.js";
import { isModuleLoadError } from "./core/loaderror.js";
import { initToasts, toast } from "./ui/toast.js";
import { initModal, openModal, closeModal, isModalOpen } from "./ui/modal.js";
import { showBanner } from "./ui/banner.js";
import { initFx, burst, coinsToBalance, floatText, setReducedMotion } from "./ui/fx.js";
import { openSettings, openStats } from "./ui/panels.js";
import { createHub } from "./hub/hub.js";
import { ensureCss } from "./ui/css.js";
import { GAMES, MACHINES, gameById } from "./games/registry.js";

// ---------- Zustand & Systeme ----------

loadState();
const BACKUP_KEY = `${SAVE_KEY}.backup`;
// Cloud-Abgleich vor dem ersten Bild (ohne Anmeldung: sofort, ohne Netz).
const cloudBoot = await bootCloud();
const state = getState();
let hub = null;
let current = null; // { game, instance, token }
const tabLock = createTabLock({ onLost: showTabLost });
setWriteGuard(() => tabLock.isOwner());

// ---------- Cloud-Spielstand ----------
let cloudState = { state: cloudBoot.status === "ready" ? "saved" : "off", at: 0 };
const cloudSync =
  cloudBoot.status === "ready"
    ? createUploader({ api: cloudBoot.api, getState, canWrite: () => tabLock.isOwner(), onStatus: (st) => (cloudState = st) })
    : null;
setAfterSave(() => cloudSync?.schedule());
if (cloudSync) {
  saveNow(); // Ergebnis des Abgleichs (Konto-Bindung, Sperren) lokal sichern …
  cloudSync.flush(); // … und sofort in die Cloud
}

/**
 * Lädt den Cloud-Stand und entscheidet, womit gespielt wird. Läuft vor dem
 * Aufbau der Oberfläche; verspätete Antworten werden verworfen (connectCloud).
 */
async function bootCloud() {
  const res = await connectCloud();
  document.getElementById("boot-loader")?.remove();
  if (res.status !== "ready") return res;
  const local = getState();
  const cloud = res.data ? sanitizeState(res.data) : null;
  let decision = decideBoot(local, cloud, res.owner);
  if (decision.use === "ask") decision = { use: await askWhichSave(local, cloud), reason: "Auswahl" };
  let next = local;
  if (decision.use === "cloud") next = cloud;
  if (decision.use === "fresh") {
    next = defaultState();
    next.settings = local.settings;
  }
  // Ersetzten Stand sichern – nur bei echten Konflikten (Auswahl, fremdes Konto),
  // nicht beim normalen „neuerer Stand gewinnt“ zwischen eigenen Geräten.
  const conflict = decision.reason === "Auswahl" || (local.cloud.owner && local.cloud.owner !== res.owner);
  if (conflict) {
    const dropped = next === local ? cloud : local;
    const backup = makeBackup(dropped, decision.reason === "Auswahl" ? "beim Abgleich nicht gewählt" : "Stand eines anderen Kontos");
    if (backup) writeJSON(BACKUP_KEY, backup);
  }
  // Pause/Auszeit werden durch einen Abgleich nie verkürzt.
  next.control = mergeControl(local.control, cloud?.control || local.control);
  next.cloud.owner = res.owner;
  replaceState(next);
  return { ...res, decision };
}

/** Sicherung des zuletzt ersetzten Stands (eine, die jüngste). */
function readBackup() {
  return validBackup(readJSON(BACKUP_KEY));
}
function currentOwner() {
  return cloudBoot?.status === "ready" ? cloudBoot.owner : getState().cloud.owner;
}
function backupInfo() {
  const b = readBackup();
  if (!b || !canRestore(b, currentOwner())) return null;
  const x = summarize(sanitizeState(b.state));
  const when = new Date(b.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return {
    title: "Gesicherter Spielstand",
    detail: `${fmt(x.balance)} Credits · Level ${levelInfo(x.xp).level} · ${fmt(x.rounds)} Runden – gesichert am ${when} (${b.reason}).`,
    current: `${fmt(getState().balance)} Credits · Level ${levelInfo(getState().xp).level}`,
    onRestore: restoreBackup,
  };
}
/**
 * Tauscht aktuellen und gesicherten Stand. Der aktuelle Stand wird dabei selbst
 * gesichert (rückgängig machbar). Pause/Auszeit werden nie verkürzt.
 */
function restoreBackup() {
  const b = readBackup();
  if (!b || !canRestore(b, currentOwner())) return;
  const now = getState();
  const restored = sanitizeState(b.state);
  restored.control = mergeControl(now.control, restored.control);
  restored.cloud.owner = currentOwner() || null;
  const swap = makeBackup(now, "vor dem Wiederherstellen");
  if (swap) writeJSON(BACKUP_KEY, swap);
  economy.forfeitOpen();
  replaceState(restored);
  saveNow();
  const done = () => {
    location.hash = "#/";
    location.reload();
  };
  if (cloudSync) Promise.race([cloudSync.flush(), new Promise((r) => setTimeout(r, 1500))]).then(done);
  else done();
}

/** Beide Stände haben Fortschritt (vor dem Anmelden gespielt): Spieler entscheidet. */
function askWhichSave(local, cloud) {
  return new Promise((resolve) => {
    const fmtDate = (t) => (t ? new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "unbekannt");
    const line = (s) => {
      const x = summarize(s);
      return `${fmt(x.balance)} Credits · Level ${levelInfo(x.xp).level} · ${fmt(x.rounds)} Runden · zuletzt ${fmtDate(x.savedAt)}`;
    };
    const pick = (use) => {
      layer.remove();
      resolve(use);
    };
    const layer = h(
      "div.boot-choice",
      { role: "dialog", "aria-modal": "true", "aria-labelledby": "boot-choice-title" },
      h(
        "div.boot-choice-card",
        {},
        h("h2", { id: "boot-choice-title" }, "Welchen Spielstand möchtest du?"),
        h("p", {}, "In deinem Konto liegt schon ein Neonpalast-Spielstand, und in diesem Browser wurde ohne Anmeldung gespielt. Wähle einen – der andere wird als Sicherung aufbewahrt und lässt sich in den Einstellungen wiederherstellen."),
        h(
          "div.boot-choice-opts",
          {},
          h("button.btn.btn-primary.cloud-pick", { type: "button", onclick: () => pick("cloud") }, "☁️ Spielstand aus deinem Konto", h("small", {}, line(cloud))),
          h("button.btn.btn-ghost.local-pick", { type: "button", onclick: () => pick("local") }, "💾 Spielstand aus diesem Browser", h("small", {}, line(local)))
        )
      )
    );
    document.body.append(layer);
    layer.querySelector(".cloud-pick").focus();
  });
}

/** Text für die Einstellungen. */
function cloudInfo() {
  if (cloudBoot.status === "ready") {
    const t = cloudState.state === "saving" ? "wird gerade gesichert …" : cloudState.state === "error" ? "letzte Sicherung fehlgeschlagen – lokal ist alles gespeichert, neuer Versuch bei der nächsten Änderung" : cloudState.at ? `zuletzt gesichert um ${new Date(cloudState.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : "verbunden";
    return { active: true, title: "Cloud-Spielstand aktiv", detail: `Dein Fortschritt wird in deinem Konto gesichert und ist auf jedem Gerät verfügbar, auf dem du angemeldet bist – ${t}.` };
  }
  if (cloudBoot.status === "timeout" || cloudBoot.status === "error") {
    return { active: false, title: "Cloud gerade nicht erreichbar", detail: "Du spielst mit dem Stand aus diesem Browser. Beim nächsten Start wird wieder abgeglichen." };
  }
  if (cloudBoot.signedIn) {
    return { active: false, title: "Cloud-Speicherung nicht aktiv", detail: "Deine Anmeldung ist abgelaufen oder die Cloud-Speicherung ist in deinem Profil ausgeschaltet. Der Spielstand bleibt in diesem Browser.", loginHref: "../login.html" };
  }
  return { active: false, title: "Nur auf diesem Gerät", detail: "Melde dich in der Spielebibliothek an, um deinen Spielstand in deinem Konto zu sichern und auf anderen Geräten weiterzuspielen.", loginHref: "../login.html" };
}

function blockReason() {
  const st = playStatus(getState().control);
  if (st.ok) return null;
  return st.kind === "pause" ? `Spielpause bis ${formatUntil(st.until)}` : `Freiwillige Auszeit bis ${formatUntil(st.until)}`;
}

const economy = createEconomy({ getState, save: saveSoon, emit: (t, p) => bus.emit("economy:" + t, p), guard: blockReason });
const challenges = createChallenges({ getState, save: saveSoon, emit: (t, p) => bus.emit("challenge:" + t, p) });
const session = createSessionTracker();
const progression = createProgression({ getState, save: saveSoon, emit: (t, p) => bus.emit("progress:" + t, p) });
const inbox = createInbox({ getState, save: saveSoon, emit: (t, p) => bus.emit(t, p) });
const lotto = createLotto({ getState, economy, saveNow, inbox, emit: (t, p) => bus.emit(t, p) });
const playerProgress = () => {
  const s = getState();
  return { level: levelInfo(s.xp).level, gamesPlayed: MACHINES.filter((g) => s.counters[`played-${g.id}`]).length };
};
const jukebox = createJukebox({ getState, economy, saveNow, progress: playerProgress, emit: (t, p) => bus.emit(t, p) });
const music = createMusicPlayer({ onChange: (st) => bus.emit("music:change", st) });

const $ = (id) => document.getElementById(id);
const hudLeft = $("hud-left");
const balanceBtn = $("hud-balance");
const balanceVal = $("hud-balance-value");
const levelRing = $("hud-level-ring");
const levelVal = $("hud-level-value");
const viewHub = $("view-hub");
const viewGame = $("view-game");

initToasts($("toast-layer"));
if (cloudBoot.decision?.use === "cloud") toast("Spielstand aus deinem Konto geladen", { icon: "☁️", ms: 3200 });
if (cloudBoot.decision?.use === "fresh") toast("Neuer Spielstand für dieses Konto – der vorherige gehört einem anderen Konto", { icon: "☁️", ms: 5000 });
initModal($("modal-layer"));
initFx($("fx-canvas"), { balanceEl: balanceBtn });
initAudio(state.settings);
setFeedbackSettings(state.settings);
applyLook();

function reducedMotion() {
  const m = getState().settings.motion;
  if (m === "reduced") return true;
  if (m === "full") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyLook() {
  const s = getState().settings;
  document.documentElement.dataset.theme = s.theme;
  const red = reducedMotion();
  document.documentElement.classList.toggle("reduce-motion", red);
  setReducedMotion(red);
  hub?.setReduced(red);
}

function updateSettings(patch) {
  const s = getState().settings;
  Object.assign(s, patch);
  setAudioSettings(s);
  setFeedbackSettings(s);
  applyLook();
  saveSoon();
}

// ---------- HUD ----------

let shownBalance = state.balance;
let tweenRaf = 0;

function renderBalance(target, animate = true) {
  cancelAnimationFrame(tweenRaf);
  if (!animate || reducedMotion()) {
    shownBalance = target;
    balanceVal.textContent = fmt(target);
    return;
  }
  const from = shownBalance;
  const t0 = performance.now();
  const dur = Math.min(900, 250 + Math.abs(target - from) * 0.4);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    shownBalance = Math.round(from + (target - from) * e);
    balanceVal.textContent = fmt(shownBalance);
    if (k < 1) tweenRaf = requestAnimationFrame(step);
  };
  tweenRaf = requestAnimationFrame(step);
}

function renderLevel() {
  const info = levelInfo(getState().xp);
  levelVal.textContent = String(info.level);
  levelRing.style.setProperty("--p", info.progress.toFixed(3));
}

renderBalance(state.balance, false);
renderLevel();

bus.on("economy:balance", ({ balance, delta }) => {
  renderBalance(balance);
  balanceBtn.classList.remove("bump-up", "bump-down");
  void balanceBtn.offsetWidth;
  balanceBtn.classList.add(delta >= 0 ? "bump-up" : "bump-down");
  if (balance >= 10000) progression.award("rich");
  if (current === null) hub.refreshPerks();
});

bus.on("economy:settle", ({ stake, payout, net }) => {
  progression.addXp(xpForRound(stake));
  if (net > 0) progression.award("first-win");
  if (stake >= 500) progression.award("high-roller");
  void payout;
});

// Automaten ohne Runden (Münzen einwerfen): 1 XP je 40 Credits Einsatz.
let xpAcc = 0;
bus.on("economy:debit", ({ amount }) => {
  xpAcc += amount / 40;
  if (xpAcc >= 1) {
    const n = Math.floor(xpAcc);
    xpAcc -= n;
    progression.addXp(n);
  }
});

bus.on("challenge:done", ({ def, reward }) => {
  economy.credit(null, reward.credits, "challenge");
  progression.addXp(reward.xp);
  play("achievement");
  toast(`Challenge geschafft: ${def.title} · +${reward.credits} Credits`, { icon: def.icon, tone: "gold", ms: 4000 });
  if (current === null) hub.refreshPerks();
});

bus.on("challenge:all", ({ bonus }) => {
  economy.credit(null, bonus, "challenge");
  progression.award("challenges-all");
  toast(`Alle Tages-Challenges erledigt! Bonus +${bonus}`, { icon: "📅", tone: "gold", ms: 4000 });
});

bus.on("progress:xp", renderLevel);

bus.on("progress:levelup", ({ level, reward, themes }) => {
  play("levelup");
  haptic("success");
  economy.credit(null, reward, "level");
  toast(`Level ${level}! Bonus +${fmt(reward)} Credits`, { icon: "⭐", tone: "violet", ms: 3400 });
  for (const t of themes) toast(`Neues Hallen-Theme: ${t.name} (Einstellungen)`, { icon: "🎨", tone: "violet", ms: 4200 });
  burst(window.innerWidth / 2, 80, { kind: "confetti", count: 70, spread: 2, power: 1.1 });
  checkSpecialSongs();
});

bus.on("progress:achievement", (a) => {
  setTimeout(() => {
    play("achievement");
    toast(`Erfolg: ${a.title}`, { icon: a.icon, tone: "gold", ms: 3600 });
  }, 400);
});

balanceBtn.addEventListener("click", () => {
  uiTap();
  const s = getState();
  toast(`Guthaben: ${fmt(s.balance)} Credits (Spielgeld)`, { icon: "🪙" });
});
$("hud-level").addEventListener("click", () => {
  uiTap();
  showStats();
});
$("hud-settings").addEventListener("click", () => {
  uiTap();
  showSettings();
});
$("hud-control").addEventListener("click", () => {
  uiTap();
  showControl();
});
$("hud-inbox").addEventListener("click", () => {
  uiTap();
  openInbox({
    inbox,
    onAction: (m) => {
      if (m.action?.kind === "lotto:show" && m.payload?.drawId) openLottoShow(m.payload.drawId, false);
    },
  });
});

// ---------- Posteingang ----------

function renderInbox() {
  const n = inbox.unreadCount();
  const badge = $("hud-inbox-badge");
  badge.hidden = n === 0;
  badge.textContent = String(Math.min(99, n));
  $("hud-inbox").setAttribute("aria-label", n ? `Posteingang – ${n} neu` : "Posteingang");
}
bus.on("inbox:change", renderInbox);
renderInbox();

// ---------- Jukebox & Musik ----------

let previewTimer = 0;
let previewResume = null;
let pausedAt = null; // { id, bar } – „Pause“ setzt an derselben Stelle fort

function inGameMusicMode() {
  return current && current.game.kind !== "event" ? jukebox.state().inGames : null;
}

function applyMusicDuck() {
  const mode = inGameMusicMode();
  setMusicDuck(mode === "duck" ? 0.3 : mode === "off" ? 0 : 1);
}

async function musicPlay(id, fromBar = 0) {
  if (!jukebox.owned || !jukebox.select(id)) return false;
  pausedAt = null;
  clearTimeout(previewTimer);
  previewTimer = 0;
  previewResume = null;
  if (inGameMusicMode() === "off") {
    jukebox.setWasPlaying(true);
    return false;
  }
  const ok = await music.play(id, fromBar);
  if (ok) {
    jukebox.setWasPlaying(true);
    stopAmbience();
    applyMusicDuck();
  }
  return ok;
}

function musicStop(remember = false) {
  music.stop();
  if (!remember) jukebox.setWasPlaying(false);
  if (!current) startAmbience();
}

function musicToggle() {
  if (music.playing) {
    const st = music.status();
    musicStop();
    pausedAt = { id: st.id, bar: st.bar };
  } else {
    const id = jukebox.state().current;
    musicPlay(id, pausedAt && pausedAt.id === id ? pausedAt.bar : 0);
  }
}

function musicStep(dir) {
  const id = jukebox.neighbour(dir);
  if (id) musicPlay(id);
}

/** Probehören: 12 Sekunden, danach läuft wieder, was vorher lief. */
function previewSong(id, done) {
  if (!previewTimer) previewResume = music.playing ? music.current : null;
  clearTimeout(previewTimer);
  music.play(id).then((ok) => ok && stopAmbience());
  previewTimer = setTimeout(() => {
    stopPreview();
    done?.();
  }, 12000);
}

function stopPreview() {
  if (!previewTimer) return;
  clearTimeout(previewTimer);
  previewTimer = 0;
  const resume = previewResume;
  previewResume = null;
  if (resume && jukebox.owned) music.play(resume);
  else {
    music.stop();
    if (!current) startAmbience();
  }
}

function refreshJukeboxHub() {
  if (!hub) return;
  const j = jukebox.state();
  const t = trackById(music.current || j.current);
  hub.setJukebox({ owned: j.owned, playing: music.playing && jukebox.owned, title: t?.title || "", price: `${fmt(JUKEBOX_PRICE)} C` });
}
bus.on("music:change", refreshJukeboxHub);

function checkSpecialSongs() {
  for (const id of jukebox.checkSpecials()) {
    play("unlock.song");
    toast(`Besonderes Stück freigeschaltet: ${trackById(id).title}`, { icon: "🎵", tone: "gold", ms: 4200 });
  }
}

function onFixture(id, el) {
  if (id !== "jukebox") return;
  uiTap();
  if (!jukebox.owned) {
    openJukeboxOffer({
      balance: economy.balance,
      onBuy: () => buyJukebox(el),
      onPreview: (tid, done) => previewSong(tid, done),
      onStopPreview: stopPreview,
    });
    return;
  }
  openJukeboxPanel({
    jukebox,
    status: () => ({ ...music.status(), playing: music.playing && !previewTimer }),
    play: musicPlay,
    toggle: musicToggle,
    next: () => musicStep(1),
    prev: () => musicStep(-1),
    preview: previewSong,
    stopPreview,
    buySong: (sid) => {
      const r = jukebox.buySong(sid);
      if (r.ok) {
        play("unlock.song");
        haptic("success");
        toast(`Neu in deiner Bibliothek: ${trackById(sid).title}`, { icon: "🎵", tone: "gold" });
      } else {
        play("ui.error");
        toast(r.reason, { icon: "⚠️", tone: "red" });
      }
      return r;
    },
    balance: () => economy.balance,
    volume: () => getState().settings.music ?? 0.6,
    setVolume: (v) => updateSettings({ music: v }),
    progress: playerProgress,
    subscribe: (fn) => {
      const offs = [bus.on("music:change", fn), bus.on("economy:balance", fn), bus.on("jukebox:special", fn)];
      return () => offs.forEach((f) => f());
    },
  });
}

function buyJukebox(el) {
  stopPreview();
  const r = jukebox.buy();
  if (!r.ok) {
    play("ui.error");
    toast(r.reason, { icon: "⚠️", tone: "red" });
    return;
  }
  // Der Kaufmoment: Licht flackert an, kurzer Einschalt-Klang, dann läuft das erste Stück.
  el.classList.add("is-powering");
  play("jukebox.on");
  haptic("success");
  refreshJukeboxHub();
  toast("Die Jukebox gehört jetzt dir – sie bleibt in deiner Lounge.", { icon: "🎵", tone: "gold", ms: 3800 });
  setTimeout(() => {
    el.classList.remove("is-powering");
    musicPlay(jukebox.state().current);
  }, reducedMotion() ? 200 : 1400);
}

// Nach dem Neuladen: lief Musik, startet sie mit der ersten Geste wieder (Autoplay-Regeln).
function resumeMusicOnGesture() {
  const go = () => {
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
    if (jukebox.owned && jukebox.state().wasPlaying && !music.playing) setTimeout(() => musicPlay(jukebox.state().current), 60);
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}
resumeMusicOnGesture();

// ---------- Neon Lotto ----------

let pendingShow = null;

function openLottoShow(id, live) {
  if (current?.game.id === "lotto" && current.instance?.showDraw) {
    current.instance.showDraw(id, live);
    return;
  }
  pendingShow = { id, live };
  location.hash = "#/play/lotto";
}

function lottoTick() {
  const fresh = lotto.realizeDue();
  for (const d of fresh) {
    if (d.live && Date.now() - d.at < LIVE_WINDOW_MS) {
      if (current?.game.id === "lotto" && current.instance?.showDraw) current.instance.showDraw(d.id, true);
      else
        toast(`LIVE: ${DRAWS[d.type].name} – die Ziehung läuft`, {
          icon: "🔴",
          tone: "gold",
          ms: 15000,
          action: { label: "Zuschauen", onClick: () => openLottoShow(d.id, true) },
        });
    }
  }
  if (fresh.length) current?.instance?.refresh?.();
  refreshLottoHub();
}

const hhmm = (at) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function refreshLottoHub() {
  if (!hub) return;
  const nd = lotto.nextDraw("daily");
  const ng = lotto.nextDraw("grand");
  const all = lotto.archive();
  const waiting = lotto.unclaimed().length;
  const unseen = all.filter((d) => !d.seen).length;
  const liveNow = all.some((d) => d.live && !d.seen && Date.now() - d.at < LIVE_WINDOW_MS);
  const today = nd && new Date(nd.at).toDateString() === new Date().toDateString();
  const grandSameDay = ng && nd && new Date(ng.at).toDateString() === new Date(nd.at).toDateString();
  hub.setLotto({
    line1: liveNow ? "JETZT" : today ? "HEUTE" : "MORGEN",
    line2: liveNow ? "LIVE" : nd ? `${hhmm(nd.at)} UHR` : "–",
    line3: grandSameDay ? "+ GROSSES LOTTO" : "4 AUS 40",
    live: liveNow,
    attention: waiting > 0 || unseen > 0,
    blurb: waiting ? `${waiting} ${waiting === 1 ? "Gewinn wartet" : "Gewinne warten"}` : unseen ? "Auswertung wartet" : nd ? `Ziehung ${formatDrawTime(nd.at)}` : "Ziehung täglich 20 Uhr",
  });
}

bus.on("lotto:ticket", refreshLottoHub);
bus.on("lotto:claimed", refreshLottoHub);
// V1.2.1: offene Scheine nach den alten Regeln wurden einmalig erstattet
bus.on("lotto:refund", ({ amount }) => {
  toast(`Neue Lotto-Regeln – offene Scheine erstattet: +${fmt(amount)} C`, { icon: "🎟️", tone: "gold", ms: 8000 });
  current?.instance?.refresh?.();
});

// ---------- Spielkontrolle ----------

function showControl() {
  openControl({
    control: getState().control,
    sessionMin: session.minutes(),
    onPause: (m) => applyBlock(() => startPause(getState().control, m)),
    onExclude: (d) => applyBlock(() => startExclusion(getState().control, d)),
    onReminder: (m) => {
      getState().control.remindMin = m;
      saveNow();
    },
  });
}

function requestPause(m) {
  confirmPause(m, { onPause: (min) => applyBlock(() => startPause(getState().control, min)) });
}

function applyBlock(fn) {
  if (!fn()) return;
  saveNow();
  session.reset();
  play("ui.back");
  const st = playStatus(getState().control);
  toast(`${st.kind === "pause" ? "Pause" : "Auszeit"} aktiv bis ${formatUntil(st.until)}`, { icon: "⏸️", ms: 4200 });
  // Laufende Runde wird beim Schließen normal abgerechnet (finalize).
  if (current) location.hash = "#/";
  else hub.refreshPerks();
  updateLockState();
}

function updateLockState() {
  const st = playStatus(getState().control);
  document.documentElement.classList.toggle("is-play-locked", !st.ok);
  hub?.setLocked(!st.ok);
}

// Aktivität für die Session-Erinnerung (nur während eines geöffneten Spiels)
for (const ev of ["pointerdown", "keydown"]) {
  window.addEventListener(ev, () => {
    if (current) session.activity();
  }, { passive: true, capture: true });
}

setInterval(() => {
  const st = playStatus(getState().control);
  const locked = document.documentElement.classList.contains("is-play-locked");
  if (locked && st.ok) {
    updateLockState();
    if (!current) hub.refreshPerks();
  }
  if (current && st.ok && !isModalOpen() && session.due(getState().control.remindMin)) {
    current.instance?.pause?.();
    openReminder({ minutes: session.minutes(), onPause: requestPause });
  }
  if (!current && locked) hub.refreshPerks();
}, 15000);

function showSettings() {
  openSettings({
    settings: getState().settings,
    update: updateSettings,
    level: levelInfo(getState().xp).level,
    onControl: showControl,
    cloud: cloudInfo(),
    backup: backupInfo(),
    onReset: () => {
      economy.forfeitOpen();
      resetState();
      location.hash = "#/";
      location.reload();
    },
  });
}

function showStats() {
  openStats({ state: getState(), onSettings: showSettings });
}

function setHudForHub() {
  clear(hudLeft);
  hudLeft.append(
    h("a.brand", { href: "#/", "aria-label": "Neonpalast – Halle" }, h("span.brand-mark", { "aria-hidden": "true" }, "✦"), h("span.brand-text", {}, "Neonpalast"))
  );
}

function setHudForGame(g, onHelp) {
  clear(hudLeft);
  hudLeft.append(
    h("button.btn.btn-ghost.btn-sm.hud-back", { type: "button", "aria-label": "Zurück zur Halle", onclick: goHub }, "‹", h("span.hud-back-label", {}, " Halle")),
    h("span.hud-title", {}, g.title),
    h("button.btn.btn-ghost.btn-icon.btn-sm", { type: "button", "aria-label": "Spielregeln", onclick: onHelp }, "?")
  );
}

// ---------- Halle ----------

hub = createHub(viewHub, {
  onOpen: openFromHub,
  onFixture,
  renderPerks,
  onStats: () => {
    uiTap();
    showStats();
  },
  onSettings: () => {
    uiTap();
    showSettings();
  },
  onControl: () => {
    uiTap();
    showControl();
  },
  getBest: (k) => getState().bests[k] || 0,
  tickerItems,
});
applyLook();

function tickerItems() {
  const s = getState();
  const info = levelInfo(s.xp);
  const nd = lotto.nextDraw("daily");
  const items = [
    "★ WILLKOMMEN IM NEONPALAST ★",
    nd ? `NEON LOTTO · NÄCHSTE ZIEHUNG ${formatDrawTime(nd.at).toUpperCase()}` : "NEON LOTTO · TÄGLICH 20 UHR",
    `LEVEL ${info.level} · NOCH ${fmt(info.need - info.into)} XP BIS LEVEL ${info.level + 1}`,
    "NUR SPIELGELD · KEINE KÄUFE · KEINE AUSZAHLUNG",
  ];
  if (s.stats.biggestWin > 0) items.push(`GRÖSSTER GEWINN: ${fmt(s.stats.biggestWin)} CREDITS`);
  if (s.bests.hoops) items.push(`NEON HOOPS REKORD: ${fmt(s.bests.hoops)} PUNKTE`);
  if (s.bests.stacker) items.push(`TURMBAU REKORD: REIHE ${s.bests.stacker}`);
  if (s.counters["pusher-coins"]) items.push(`MÜNZKASKADE: ${fmt(s.counters["pusher-coins"])} MÜNZEN ÜBER DIE KANTE`);
  if (jukebox.owned) {
    const t = trackById(music.current || jukebox.state().current);
    if (music.playing && t) items.push(`♪ JUKEBOX: ${t.title.toUpperCase()}`);
  } else items.push("NEU IN DER LOUNGE: DIE JUKEBOX");
  items.push("TIPP: BEI NEON HOOPS ZÄHLT DAS WISCH-TEMPO AM ENDE");
  items.push("TIPP: KOSMO 5 – DREI KOMETEN BRINGEN FREISPIELE");
  return items;
}

function renderPerks() {
  const s = getState();
  const out = [];
  const st = playStatus(s.control);
  if (!st.ok) {
    out.push(
      h(
        "div.lock-banner",
        { role: "status" },
        h("span", { "aria-hidden": "true", style: { fontSize: "26px" } }, "⏸️"),
        h(
          "div",
          {},
          h("div", {}, `${st.kind === "pause" ? "Spielpause" : "Freiwillige Auszeit"} bis ${formatUntil(st.until)}`),
          h("small", { style: { color: "var(--ink-dim)", fontWeight: 600 } }, `Noch ${formatRemaining(st.until - Date.now())}. Bis dahin bleiben die Automaten aus.`)
        )
      )
    );
    return out;
  }
  out.push(challengeCard());
  if (dailyAvailable(s)) {
    const amount = dailyAmount(levelInfo(s.xp).level);
    out.push(
      h(
        "div.perk",
        {},
        h("span.perk-ico", { "aria-hidden": "true" }, "🎁"),
        h("div", {}, h("strong", {}, "Tagesbonus"), h("small", {}, `+${fmt(amount)} Credits`)),
        h("button.btn.btn-gold.btn-sm", {
          type: "button",
          onclick: (e) => {
            if (!dailyAvailable(getState())) return;
            getState().lastDaily = Date.now();
            economy.credit(null, amount, "daily");
            const r = e.currentTarget.getBoundingClientRect();
            coinsToBalance(r.left + r.width / 2, r.top, 14);
            play("coin.win");
            haptic("success");
            saveNow();
            hub.refreshPerks();
          },
        }, "Abholen")
      )
    );
  }
  if (refillNeeded(s) && !refillAvailable(s)) {
    out.push(
      h(
        "div.perk",
        {},
        h("span.perk-ico", { "aria-hidden": "true" }, "⏳"),
        h("div", {}, h("strong", {}, "Gratis-Nachschub"), h("small", {}, `wieder verfügbar in ${formatRemaining(refillWait(s))}`))
      )
    );
  }
  if (refillAvailable(s)) {
    out.push(
      h(
        "div.perk",
        {},
        h("span.perk-ico", { "aria-hidden": "true" }, "🆘"),
        h("div", {}, h("strong", {}, "Gratis-Nachschub"), h("small", {}, `Fast pleite? +${fmt(REFILL_AMOUNT)} Credits`)),
        h("button.btn.btn-gold.btn-sm", {
          type: "button",
          onclick: (e) => {
            const st = getState();
            if (!refillAvailable(st)) return;
            st.lastRefill = Date.now();
            st.refills++;
            economy.credit(null, REFILL_AMOUNT, "refill");
            const r = e.currentTarget.getBoundingClientRect();
            coinsToBalance(r.left + r.width / 2, r.top, 14);
            play("coin.win");
            saveNow();
            hub.refreshPerks();
          },
        }, "Nachfüllen")
      )
    );
  }
  return out;
}

function challengeCard() {
  const list = challenges.list();
  return h(
    "section.panel",
    { style: { width: "min(100%, 720px)", padding: "12px 14px" }, "aria-label": "Tages-Challenges" },
    h("h2.panel-title", { style: { marginBottom: "8px" } }, "Tages-Challenges"),
    h(
      "ul.challenge-list",
      {},
      list.map((c) =>
        h(
          `li.challenge${c.done ? ".is-done" : ""}`,
          {},
          h("span.ch-ico", { "aria-hidden": "true" }, c.def.icon),
          h("div", {}, h("div.ch-title", {}, c.def.title), h("div.ch-bar", {}, h("i", { style: { width: `${Math.round((Math.min(c.progress, c.goal) / c.goal) * 100)}%` } }))),
          h("span.ch-state", {}, c.done ? "✓ erledigt" : `${Math.min(c.progress, c.goal)}/${c.goal}`)
        )
      )
    )
  );
}

// ---------- Navigation ----------

let openToken = 0;
let cameFromHub = false;

function showBlocked() {
  const reason = blockReason();
  openModal({
    title: "Automaten pausiert",
    body: h("p.help-text", {}, `${reason}. Die Halle bleibt offen, Spiele lassen sich aber erst danach wieder starten.`),
    actions: [{ label: "Hilfe", cls: "btn-ghost", onClick: () => setTimeout(openHelp, 0) }, { label: "OK", cls: "btn-primary" }],
  });
}

function openFromHub(g, el) {
  if (current) return;
  if (blockReason() && g.kind !== "event") {
    play("ui.error");
    showBlocked();
    return;
  }
  play("ui.open");
  haptic("impulse");
  cameFromHub = true;
  zoomFrom(el, () => {
    location.hash = `#/play/${g.id}`;
  });
}

function zoomFrom(el, done) {
  if (reducedMotion() || !el) {
    done();
    return;
  }
  const r = el.getBoundingClientRect();
  const veil = h("div.zoom-veil", { style: { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", opacity: "0.2" } });
  document.body.append(veil);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      Object.assign(veil.style, { left: "0px", top: "0px", width: "100vw", height: "100vh", borderRadius: "0px", opacity: "1" });
    });
  });
  setTimeout(() => {
    done();
    requestAnimationFrame(() => {
      veil.style.opacity = "0";
      setTimeout(() => veil.remove(), 260);
    });
  }, 300);
}

function goHub() {
  play("ui.back");
  haptic("tap");
  if (cameFromHub && history.length > 1) history.back();
  else location.hash = "#/";
}

function closeCurrent() {
  if (!current) return;
  const c = current;
  current = null;
  try {
    c.instance?.finalize?.();
    c.instance?.destroy?.();
  } catch (err) {
    console.error("[app] Fehler beim Schließen des Spiels", err);
  }
  economy.forfeitOpen(c.game.id);
  clear(viewGame);
  saveNow();
}

function showHub() {
  closeCurrent();
  closeModal(true);
  viewGame.classList.remove("is-active");
  viewHub.classList.add("is-active", "view-enter");
  setTimeout(() => viewHub.classList.remove("view-enter"), 400);
  setHudForHub();
  hub.show();
  setMusicDuck(1);
  if (music.playing) stopAmbience();
  else if (jukebox.owned && jukebox.state().wasPlaying && !previewTimer) musicPlay(jukebox.state().current);
  else startAmbience();
  refreshJukeboxHub();
  refreshLottoHub();
  document.title = "Neonpalast – Arcade-Casino (nur Spielgeld)";
}

async function openGame(g) {
  if (blockReason() && g.kind !== "event") {
    history.replaceState(null, "", "#/");
    showHub();
    showBlocked();
    return;
  }
  closeCurrent();
  closeModal(true);
  const token = ++openToken;
  hub.hide();
  stopAmbience();
  viewHub.classList.remove("is-active");
  viewGame.classList.add("is-active", "view-enter");
  setTimeout(() => viewGame.classList.remove("view-enter"), 400);
  clear(viewGame);
  const root = h("div.game-root", { "data-game": g.id });
  const loading = h("div.game-loading", {}, h("span.spinner", { "aria-hidden": "true" }), "Automat startet …");
  viewGame.append(root, loading);
  document.title = `${g.title} – Neonpalast`;

  let help = () => {};
  setHudForGame(g, () => {
    uiTap();
    help();
  });
  current = { game: g, instance: null, token };
  if (previewTimer) stopPreview();
  if (inGameMusicMode() === "off" && music.playing) musicStop(true);
  applyMusicDuck();

  let step = "load";
  try {
    const [mod] = await Promise.all([g.load(), g.css ? ensureCss(g.css) : null]);
    if (token !== openToken || !current || current.token !== token) return;
    step = "mount";
    loading.remove();
    const ctx = makeContext(g, root, (fn) => (help = fn));
    current.instance = mod.default.mount(root, ctx);
    if (g.kind !== "event") markPlayed(g.id);
  } catch (err) {
    console.error(`[app] Spiel "${g.id}" konnte nicht gestartet werden`, err);
    if (token !== openToken) return;
    if (step === "load" && isModuleLoadError(err)) {
      // Datei kam nicht an (z. B. Server kurz 503): kein Defekt. Erneut versuchen lädt
      // die Seite einmal neu – Browser merken sich fehlgeschlagene Modul-Importe.
      toast("Automat konnte gerade nicht geladen werden. Bitte erneut versuchen.", {
        icon: "📶",
        tone: "red",
        ms: 12000,
        action: {
          label: "Erneut versuchen",
          onClick: () => {
            saveNow();
            history.replaceState(null, "", `#/play/${g.id}`);
            location.reload();
          },
        },
      });
    } else toast("Dieser Automat ist gerade außer Betrieb.", { icon: "🔧", tone: "red" });
    current = null;
    location.hash = "#/";
  }
}

function markPlayed(id) {
  progression.bump(`played-${id}`);
  challenges.report("game:open", { key: id });
  const c = getState().counters;
  if (["slots-fruit", "slots-seven", "slots-cosmo"].every((x) => c[`played-${x}`])) progression.award("slots-all");
  if (MACHINES.every((g) => c[`played-${g.id}`])) progression.award("explorer");
  checkSpecialSongs();
}

function makeContext(g, root, setHelp) {
  return {
    id: g.id,
    title: g.title,
    opts: g.opts || {},
    root,
    economy,
    progression,
    play,
    loop: audioLoop,
    haptic,
    fx: feedbackFx,
    toast,
    openModal,
    closeModal,
    isModalOpen,
    banner: (o) => showBanner(root, o),
    celebrate: (o) => celebrate({ container: root, reduced: reducedMotion(), ...o }),
    report: (event, payload) => {
      challenges.report(event, payload);
      bus.emit("game:event", { game: g.id, event, payload });
    },
    setPhase: (phase) => {
      root.dataset.phase = phase;
    },
    limits: LIMITS[g.id] || {},
    particles: { burst, coinsToBalance, floatText },
    data: gameData(g.id),
    save: saveSoon,
    saveNow,
    setHelp,
    reducedMotion,
    fmt,
    signed,
    goHub,
    blockReason,
    musicDuck: (v) => setMusicDuck(v),
    lotto: g.id === "lotto" ? lotto : undefined,
    pendingShow: g.id === "lotto" ? takePendingShow() : undefined,
  };
}

function takePendingShow() {
  const p = pendingShow;
  pendingShow = null;
  return p;
}

function route() {
  const m = location.hash.match(/^#\/play\/([a-z0-9-]+)/);
  const g = m ? gameById(m[1]) : null;
  if (g) {
    if (current?.game.id === g.id) return;
    openGame(g);
  } else {
    if (m) history.replaceState(null, "", "#/");
    cameFromHub = false;
    showHub();
  }
}

window.addEventListener("hashchange", route);
route();

// ---------- Lebenszyklus ----------

function flush() {
  try {
    current?.instance?.finalize?.();
  } catch (err) {
    console.error(err);
  }
  saveNow();
  cloudSync?.flush();
}

window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    current?.instance?.pause?.();
    saveNow();
    cloudSync?.flush();
  }
});

function showTabLost() {
  current?.instance?.pause?.();
  openModal({
    title: "Anderer Tab aktiv",
    dismissible: false,
    body: h("p.help-text", {}, "Neonpalast wurde in einem anderen Tab oder Fenster geöffnet. Damit sich die Spielstände nicht gegenseitig überschreiben, ist immer nur ein Tab aktiv."),
    actions: [{ label: "Hier weiterspielen", cls: "btn-primary", onClick: () => location.reload() }],
  });
}

// Für Tests/Debugging im Browser (keine Sicherheitsfunktion – Stand ist lokal).
window.__neonpalast = { getState, economy, progression, bus, challenges, session, saveNow, lotto, inbox, jukebox, music, lottoTick };
updateLockState();

// Verpasste Ziehungen sofort auswerten (landen im Posteingang), danach regelmäßig prüfen.
lottoTick();
setInterval(lottoTick, 5000);
refreshJukeboxHub();
