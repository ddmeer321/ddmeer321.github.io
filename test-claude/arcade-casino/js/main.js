// Einstiegspunkt: verbindet Spielstand, Wirtschaft, Progression, Audio, HUD,
// Halle und Spiele (Navigation per Hash-Route, damit „Zurück“ im Browser und
// auf Android funktioniert).

import { bus } from "./core/events.js";
import { loadState, getState, saveSoon, saveNow, setWriteGuard, resetState, gameData } from "./core/state.js";
import { createEconomy } from "./core/economy.js";
import { createProgression, xpForRound, levelInfo } from "./core/progression.js";
import { createTabLock } from "./core/tablock.js";
import { dailyAvailable, dailyAmount, refillAvailable, REFILL_AMOUNT } from "./core/bonus.js";
import { initAudio, setAudioSettings, play, loop as audioLoop, startAmbience, stopAmbience } from "./audio/audio.js";
import { setFeedbackSettings, haptic, fx as feedbackFx, uiTap } from "./audio/feedback.js";
import { h, clear } from "./ui/dom.js";
import { fmt, signed } from "./ui/format.js";
import { initToasts, toast } from "./ui/toast.js";
import { initModal, openModal, closeModal, isModalOpen } from "./ui/modal.js";
import { showBanner } from "./ui/banner.js";
import { initFx, burst, coinsToBalance, floatText, setReducedMotion } from "./ui/fx.js";
import { openSettings, openStats } from "./ui/panels.js";
import { createHub } from "./hub/hub.js";
import { ensureCss } from "./ui/css.js";
import { GAMES, gameById } from "./games/registry.js";

// ---------- Zustand & Systeme ----------

const state = loadState();
let hub = null;
let current = null; // { game, instance, token }
const tabLock = createTabLock({ onLost: showTabLost });
setWriteGuard(() => tabLock.isOwner());

const economy = createEconomy({ getState, save: saveSoon, emit: (t, p) => bus.emit("economy:" + t, p) });
const progression = createProgression({ getState, save: saveSoon, emit: (t, p) => bus.emit("progress:" + t, p) });

const $ = (id) => document.getElementById(id);
const hudLeft = $("hud-left");
const balanceBtn = $("hud-balance");
const balanceVal = $("hud-balance-value");
const levelRing = $("hud-level-ring");
const levelVal = $("hud-level-value");
const viewHub = $("view-hub");
const viewGame = $("view-game");

initToasts($("toast-layer"));
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

bus.on("economy:debit", ({ amount }) => {
  progression.addXp(Math.max(1, Math.floor(amount / 20)));
});

bus.on("progress:xp", renderLevel);

bus.on("progress:levelup", ({ level, reward, themes }) => {
  play("levelup");
  haptic("success");
  economy.credit(null, reward, "level");
  toast(`Level ${level}! Bonus +${fmt(reward)} Credits`, { icon: "⭐", tone: "violet", ms: 3400 });
  for (const t of themes) toast(`Neues Hallen-Theme: ${t.name} (Einstellungen)`, { icon: "🎨", tone: "violet", ms: 4200 });
  burst(window.innerWidth / 2, 80, { kind: "confetti", count: 70, spread: 2, power: 1.1 });
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

function showSettings() {
  openSettings({
    settings: getState().settings,
    update: updateSettings,
    level: levelInfo(getState().xp).level,
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
    h("button.btn.btn-ghost.btn-sm", { type: "button", "aria-label": "Zurück zur Halle", onclick: goHub }, "‹ Halle"),
    h("span.hud-title", {}, g.title),
    h("button.btn.btn-ghost.btn-icon.btn-sm", { type: "button", "aria-label": "Spielregeln", onclick: onHelp }, "?")
  );
}

// ---------- Halle ----------

hub = createHub(viewHub, {
  onOpen: openFromHub,
  renderPerks,
  onStats: () => {
    uiTap();
    showStats();
  },
  onSettings: () => {
    uiTap();
    showSettings();
  },
  getBest: (k) => getState().bests[k] || 0,
  tickerItems,
});
applyLook();

function tickerItems() {
  const s = getState();
  const info = levelInfo(s.xp);
  const items = [
    "★ WILLKOMMEN IM NEONPALAST ★",
    `LEVEL ${info.level} · NOCH ${fmt(info.need - info.into)} XP BIS LEVEL ${info.level + 1}`,
    "NUR SPIELGELD · KEINE KÄUFE · KEINE AUSZAHLUNG",
  ];
  if (s.stats.biggestWin > 0) items.push(`GRÖSSTER GEWINN: ${fmt(s.stats.biggestWin)} CREDITS`);
  if (s.bests.hoops) items.push(`NEON HOOPS REKORD: ${fmt(s.bests.hoops)} PUNKTE`);
  if (s.bests.stacker) items.push(`TURMBAU REKORD: REIHE ${s.bests.stacker}`);
  if (s.counters["pusher-coins"]) items.push(`MÜNZKASKADE: ${fmt(s.counters["pusher-coins"])} MÜNZEN ÜBER DIE KANTE`);
  items.push("TIPP: BEI NEON HOOPS ZÄHLT DAS WISCH-TEMPO AM ENDE");
  items.push("TIPP: KOSMO 5 – DREI KOMETEN BRINGEN FREISPIELE");
  return items;
}

function renderPerks() {
  const s = getState();
  const out = [];
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

// ---------- Navigation ----------

let openToken = 0;
let cameFromHub = false;

function openFromHub(g, el) {
  if (current) return;
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
  startAmbience();
  document.title = "Neonpalast – Arcade-Casino (nur Spielgeld)";
}

async function openGame(g) {
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

  try {
    const [mod] = await Promise.all([g.load(), g.css ? ensureCss(g.css) : null]);
    if (token !== openToken || !current || current.token !== token) return;
    loading.remove();
    const ctx = makeContext(g, root, (fn) => (help = fn));
    current.instance = mod.default.mount(root, ctx);
    markPlayed(g.id);
  } catch (err) {
    console.error(`[app] Spiel "${g.id}" konnte nicht gestartet werden`, err);
    if (token !== openToken) return;
    toast("Dieser Automat ist gerade außer Betrieb.", { icon: "🔧", tone: "red" });
    current = null;
    location.hash = "#/";
  }
}

function markPlayed(id) {
  progression.bump(`played-${id}`);
  const c = getState().counters;
  if (["slots-fruit", "slots-seven", "slots-cosmo"].every((x) => c[`played-${x}`])) progression.award("slots-all");
  if (GAMES.every((g) => c[`played-${g.id}`])) progression.award("explorer");
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
    particles: { burst, coinsToBalance, floatText },
    data: gameData(g.id),
    save: saveSoon,
    saveNow,
    setHelp,
    reducedMotion,
    fmt,
    signed,
    goHub,
  };
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
}

window.addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    current?.instance?.pause?.();
    saveNow();
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
window.__neonpalast = { getState, economy, progression, bus };
