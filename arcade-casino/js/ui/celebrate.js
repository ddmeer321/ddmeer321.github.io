// Einheitliches, abgestuftes Gewinn-Feedback für alle Automaten.
//
// Stufen (core/wintier.js): loss · push · small · good · big · mega · jackpot.
// Je höher die Stufe, desto stärker Licht, Ton, Partikel, Count-Up und
// Fake-Haptik. Verluste – auch Teil-Rückzahlungen wie ×0,2 – bekommen nur
// einen kleinen, ehrlichen Impuls und niemals Gewinn-Feuerwerk.
// Lange Inszenierungen (Jackpot) lassen sich per Tippen überspringen;
// reduzierte Bewegung verkürzt alles und verzichtet auf Blitze/Wackeln.

import { h } from "./dom.js";
import { fmt, signed } from "./format.js";
import { play } from "../audio/audio.js";
import { haptic } from "../audio/feedback.js";
import { burst, coinsToBalance, floatText } from "./fx.js";
import { classifyWin, TIER_LABEL } from "../core/wintier.js";

const COUNT_MS = { small: 500, good: 800, big: 1300, mega: 1900, jackpot: 2600 };

function countUp(el, target, ms, reduced, onTick) {
  if (reduced || ms <= 0) {
    el.textContent = "+" + fmt(target);
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  let lastTick = 0;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = "+" + fmt(Math.round(target * e));
    if (onTick && now - lastTick > 70 && k < 1) {
      lastTick = now;
      onTick(k);
    }
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(raf);
    el.textContent = "+" + fmt(target);
  };
}

function center(container, x, y) {
  if (typeof x === "number" && typeof y === "number") return { x, y };
  const r = container?.getBoundingClientRect?.() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
}

/**
 * @param {object} o
 * @param {number} o.stake      Einsatz der Runde (Bezugsgröße)
 * @param {number} o.payout     Gesamtrückzahlung inkl. Einsatz
 * @param {boolean} [o.jackpot] als Jackpot inszenieren (nur wenn wirklich Gewinn)
 * @param {HTMLElement} o.container  Spielbereich (für Banner/Overlay)
 * @param {number} [o.x] [o.y]  Bildschirmpunkt des Ereignisses
 * @param {string} [o.title]    eigener Banner-Titel
 * @param {string} [o.detail]   z. B. „×25“ oder „Linie 3“
 * @param {boolean} [o.banner=true] Banner zeigen (bei schnellen Mehrfach-Ereignissen aus)
 * @param {boolean} [o.quiet]   nur Partikel/Ton, kein Banner (z. B. einzelne Plinko-Kugel)
 * @param {boolean} [o.reduced] reduzierte Bewegung
 * @returns {{tier:string, done:Promise<void>}}
 */
export function celebrate(o) {
  const stake = Math.max(0, o.stake || 0);
  const payout = Math.max(0, o.payout || 0);
  const tier = o.tier || classifyWin({ stake, payout, jackpot: o.jackpot });
  const net = payout - stake;
  const reduced = Boolean(o.reduced);
  const showBanner = o.banner !== false && !o.quiet;
  const { x, y } = center(o.container, o.x, o.y);
  const count = (n) => Math.max(1, Math.round(reduced ? n * 0.35 : n));

  switch (tier) {
    case "loss": {
      if (payout > 0) {
        play("coin.land", { vol: 0.6 });
        haptic("tap", 0.5);
        if (!o.quiet) floatText(x, y, `+${fmt(payout)}`, "#b7a8d6");
      } else {
        play("lose", { vol: o.quiet ? 0.35 : 0.8 });
        haptic("tap", 0.4);
      }
      if (showBanner) bannerEl(o.container, { title: o.title || "Verloren", sub: payout > 0 ? `${o.detail ? o.detail + " · " : ""}${fmt(payout)} zurück` : signed(net), tone: "lose", ms: 1300 });
      return { tier, done: Promise.resolve() };
    }
    case "push": {
      play("push");
      haptic("tap");
      if (showBanner) bannerEl(o.container, { title: o.title || "Einsatz zurück", sub: o.detail || "±0", tone: "push", ms: 1300 });
      else floatText(x, y, `±0`, "#2de2e6");
      return { tier, done: Promise.resolve() };
    }
    case "small": {
      play("win.small");
      haptic("tap");
      floatText(x, y, `+${fmt(net)}`);
      coinsToBalance(x, y, count(4));
      if (showBanner) bannerEl(o.container, { title: o.title || TIER_LABEL.small, sub: net, detail: o.detail, ms: 1400, countMs: COUNT_MS.small, reduced });
      return { tier, done: Promise.resolve() };
    }
    case "good": {
      play("win.medium");
      haptic("success");
      burst(x, y, { kind: "sparks", count: count(16), spread: 2 });
      coinsToBalance(x, y, count(9));
      if (showBanner) bannerEl(o.container, { title: o.title || TIER_LABEL.good, sub: net, detail: o.detail, ms: 1700, countMs: COUNT_MS.good, reduced });
      else floatText(x, y, `+${fmt(net)}`);
      return { tier, done: Promise.resolve() };
    }
    case "big": {
      play("win.big");
      haptic("big");
      burst(x, y, { kind: "coins", count: count(34), spread: 1.6, power: 1.2 });
      coinsToBalance(x, y, count(14));
      flash(o.container, "gold", reduced);
      if (showBanner) bannerEl(o.container, { title: o.title || TIER_LABEL.big, sub: net, detail: o.detail, ms: 2200, countMs: COUNT_MS.big, reduced, big: true });
      else floatText(x, y, `+${fmt(net)}`);
      return { tier, done: Promise.resolve() };
    }
    case "mega":
    case "jackpot":
    default:
      return { tier, done: bigShow(o, { tier, net, payout, stake, x, y, reduced }) };
  }
}

function bannerEl(container, { title, sub, detail, tone = "win", ms = 1600, countMs = 0, reduced = false, big = false }) {
  if (!container) return;
  container.querySelector(".result-banner")?.remove();
  const subEl = h("span.rb-sub.num", {}, typeof sub === "number" ? "+0" : sub);
  const el = h(
    `div.result-banner.tone-${tone}${big ? ".is-big" : ""}`,
    { role: "status", "aria-live": "polite" },
    h("span.rb-title", {}, title),
    detail ? h("span.rb-detail", {}, detail) : null,
    subEl
  );
  container.append(el);
  if (typeof sub === "number") countUp(subEl, sub, countMs, reduced);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 280);
  }, ms + (typeof sub === "number" ? countMs * 0.5 : 0));
}

function flash(container, kind, reduced) {
  if (!container || reduced) return;
  const el = h(`div.win-flash.flash-${kind}`, { "aria-hidden": "true" });
  container.append(el);
  setTimeout(() => el.remove(), 900);
}

/** Mega-Gewinn und Jackpot: überspringbare Inszenierung mit Ruhe → Einschlag → Lichtwelle → Count-Up. */
function bigShow(o, { tier, net, x, y, reduced }) {
  const container = o.container;
  const jackpot = tier === "jackpot";
  return new Promise((resolve) => {
    if (!container) {
      play("win.big");
      resolve();
      return;
    }
    container.querySelector(".jackpot-show")?.remove();
    const amount = h("div.jp-amount.num", {}, "+0");
    const show = h(
      `div.jackpot-show${jackpot ? ".is-jackpot" : ".is-mega"}${reduced ? ".is-reduced" : ""}`,
      { role: "status", "aria-live": "assertive", tabindex: "-1" },
      h("div.jp-wave", { "aria-hidden": "true" }),
      h("div.jp-title", {}, o.title || (jackpot ? "JACKPOT" : "MEGA-GEWINN")),
      o.detail ? h("div.jp-mult", {}, o.detail) : null,
      amount,
      h("div.jp-skip", {}, "Tippen zum Überspringen")
    );
    let finished = false;
    let stopCount = () => {};
    const timers = [];
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      stopCount();
      show.classList.add("is-leaving");
      setTimeout(() => {
        show.remove();
        resolve();
      }, 300);
    };
    show.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      finish();
    });
    const pause = reduced ? 0 : jackpot ? 260 : 120;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    // 1) kurze Ruhe, 2) Einschlag
    at(pause, () => {
      container.append(show);
      play("jackpot.impact");
      haptic("heavy", 1);
      at(90, () => haptic("big"));
      if (!reduced) container.classList.add("is-shaking");
      at(450, () => container.classList.remove("is-shaking"));
      play(jackpot ? "win.jackpot" : "win.big", { delay: 0.12 });
      burst(x, y, { kind: "coins", count: reduced ? 16 : jackpot ? 70 : 44, spread: 2, power: 1.5 });
      if (!reduced) at(350, () => burst(x, y - 40, { kind: "confetti", count: jackpot ? 110 : 60, spread: 2.2, power: 1.3 }));
      if (jackpot && !reduced) at(900, () => burst(window.innerWidth / 2, 60, { kind: "confetti", count: 80, spread: 2, power: 0.9 }));
      coinsToBalance(x, y, reduced ? 6 : 18);
      stopCount = countUp(amount, net, COUNT_MS[tier], reduced, () => play("coin.clink", { vol: 0.3, pitch: 1.1 + Math.random() * 0.3 }));
      at(pause + COUNT_MS[tier] + (reduced ? 900 : jackpot ? 1700 : 1200), finish);
    });
  });
}
