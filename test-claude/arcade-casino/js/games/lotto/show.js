// Neon Lotto – Ziehungs-Show (V1.2.1). Zeigt ein BEREITS FESTSTEHENDES Ergebnis
// wie eine kurze Lotto-Sendung: Studio-Intro → Kugelmaschine → Zahlen einzeln
// (4 bzw. 6) → beim Großen Neon Lotto kurze Spannungspause und separat die
// Neonzahl → Zusammenfassung → Auswertung der eigenen Scheine → Einfordern bzw.
// „Leider kein Gewinn“. Überspringen, Neuladen oder Zurückgehen ändern nichts
// am Ergebnis – die Show liest es nur aus dem gespeicherten Datensatz.

import { h } from "../../ui/dom.js";
import { DRAWS, formatDrawDate, rulesFor, rulesVersionOf, rulesLabel } from "../../core/lotto.js";

const ORD = ["erste", "zweite", "dritte", "vierte", "fünfte", "sechste"];
const NEON_COLOR = "#ff4fd8";
const BALL_COLORS = ["#ff3d9a", "#ffc53d", "#2de2e6", "#8cff5a", "#b98cff", "#ff8a3d"];
export const ballColor = (n) => BALL_COLORS[(n - 1) % BALL_COLORS.length];

export function ballEl(n, { hit = false, small = false } = {}) {
  return h(`span.lt-ballchip${hit ? ".is-hit" : ""}${small ? ".is-small" : ""}`, { style: { "--ball": ballColor(n) }, "aria-label": hit ? `${n} (Treffer)` : String(n) }, String(n), hit ? h("i", { "aria-hidden": "true" }, "✓") : null);
}

/** Neonzahl als eigener, klar abgesetzter Chip (Ring statt Kugelfarbe). */
export function neonEl(n, { hit = false, small = false } = {}) {
  return h(
    `span.lt-ballchip.is-neon${hit ? ".is-hit" : ""}${small ? ".is-small" : ""}`,
    { style: { "--ball": NEON_COLOR }, "aria-label": hit ? `Neonzahl ${n} (Treffer)` : `Neonzahl ${n}` },
    String(n),
    hit ? h("i", { "aria-hidden": "true" }, "✓") : null
  );
}

/** Text für das Ergebnis eines Scheins („3 Richtige + Neonzahl“, „1 Richtige“, „–“). */
export function resultText(r) {
  if (r.label) return r.label;
  const base = r.k ? `${r.k} Richtige` : "";
  if (r.neonHit) return base ? `${base} + Neonzahl` : "Neonzahl";
  return base || "–";
}

/**
 * @param {object} o
 * @param {HTMLElement} o.container
 * @param {object} o.draw          gespeicherte Ziehung (core/lotto.js)
 * @param {boolean} o.live
 * @param {boolean} o.reduced
 * @param {(name:string, opts?:object)=>void} o.play
 * @param {(id:string)=>number} o.claim       zahlt genau einmal aus
 * @param {(payout:number, draw:object, el:HTMLElement)=>void} o.onClaimed  Feedback
 * @param {(o:{claimed:boolean})=>void} o.onDone
 * @param {(phase:string)=>void} [o.setPhase]
 * @param {(fmt:number)=>string} o.fmt
 */
export function playShow(o) {
  const { container, draw, live, reduced, play, fmt } = o;
  const def = DRAWS[draw.type];
  const rules = rulesFor(draw.type, rulesVersionOf(draw));
  const pick = rules.pick;
  const hasNeon = Boolean(rules.neon) && Number.isInteger(draw.neon);
  const grand = draw.type === "grand";
  const timers = [];
  let raf = 0;
  let done = false;
  let skipped = false;
  const at = (ms, fn) => timers.push(setTimeout(() => !done && fn(), ms));
  const setPhase = o.setPhase || (() => {});

  const caption = h("div.lt-caption", { "aria-live": "polite" });
  const slots = Array.from({ length: pick }, () => h("span.lt-slot"));
  const neonSlot = hasNeon ? h("span.lt-slot.is-neon", { title: "Neonzahl" }) : null;
  const rack = h(`div.lt-rack${pick > 4 ? ".is-wide" : ""}`, { "aria-label": "Gezogene Zahlen" }, slots, hasNeon ? h("span.lt-rack-plus", { "aria-hidden": "true" }, "+") : null, neonSlot);
  const big = h("div.lt-big", { "aria-hidden": "true" });
  const drum = h("canvas.lt-drum", { "aria-hidden": "true", width: 280, height: 280 });
  const skipBtn = h("button.btn.btn-ghost.btn-sm.lt-skip", { type: "button" }, "Überspringen");
  const stage = h("div.lt-stage", {}, drum, big);
  const result = h("div.lt-result");
  const show = h(
    `div.lt-show${grand ? ".is-grand" : ""}${reduced ? ".is-reduced" : ""}`,
    { role: "dialog", "aria-modal": "true", "aria-label": `${def.name} – Ziehung vom ${formatDrawDate(draw.at)}` },
    h(
      "header.lt-show-head",
      {},
      h("span.lt-onair", {}, live ? h("i.lt-rec", { "aria-hidden": "true" }) : null, live ? "LIVE" : "AUFZEICHNUNG"),
      h("strong", {}, def.name.toUpperCase()),
      h("small", {}, `Ziehung vom ${formatDrawDate(draw.at)} · ${rulesLabel(rules)}`)
    ),
    stage,
    caption,
    rack,
    skipBtn,
    result
  );
  container.append(show);
  setPhase("show");

  // ---------- Kugelmaschine (nur Darstellung) ----------
  const g = drum.getContext("2d");
  const R = 120;
  const BR = rules.pool > 30 ? 10 : 11; // Kugelradius in der Trommel
  const makeBall = (n, neon = false) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (R - 20);
    return { n, neon, x: 140 + Math.cos(a) * r, y: 140 + Math.sin(a) * r, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, gone: false };
  };
  let balls = Array.from({ length: rules.pool }, (_, i) => makeBall(i + 1));
  /** Zweite Phase: Die Trommel wird geleert und mit den zehn Neonkugeln 0–9 gefüllt. */
  function loadNeonBalls() {
    balls = Array.from({ length: rules.neon }, (_, i) => makeBall(i, true));
  }
  let mixing = reduced ? 0 : 1;
  let neonPhase = false;
  function drawDrum() {
    g.clearRect(0, 0, 280, 280);
    g.fillStyle = "rgba(20,10,42,.9)";
    g.beginPath();
    g.arc(140, 140, R + 8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = neonPhase ? NEON_COLOR : grand ? "#ffc53d" : "#9bd8ff";
    g.lineWidth = 3;
    g.stroke();
    for (const b of balls) {
      if (b.gone) continue;
      if (mixing > 0) {
        // Wirbel: tangentiale Kraft + leichte Unruhe
        const dx = b.x - 140;
        const dy = b.y - 140;
        b.vx += (-dy * 0.004 + (Math.random() - 0.5) * 0.9) * mixing;
        b.vy += (dx * 0.004 + (Math.random() - 0.5) * 0.9 + 0.12) * mixing;
      } else {
        b.vy += 0.25;
      }
      b.vx *= 0.97;
      b.vy *= 0.97;
      b.x += b.vx;
      b.y += b.vy;
      const dx = b.x - 140;
      const dy = b.y - 140;
      const d = Math.hypot(dx, dy);
      const rad = b.neon ? 13 : BR;
      if (d > R - rad) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = 140 + nx * (R - rad);
        b.y = 140 + ny * (R - rad);
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 1.8 * dot * nx;
        b.vy -= 1.8 * dot * ny;
      }
      g.fillStyle = b.neon ? NEON_COLOR : ballColor(b.n);
      g.beginPath();
      g.arc(b.x, b.y, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(b.x, b.y, b.neon ? 8 : BR * 0.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#14072a";
      g.font = `800 ${b.neon ? 10 : 8}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(b.n), b.x, b.y + 0.5);
    }
    g.fillStyle = "rgba(255,255,255,.12)";
    g.beginPath();
    g.ellipse(110, 90, 50, 26, -0.5, 0, Math.PI * 2);
    g.fill();
  }
  function loop() {
    drawDrum();
    if (!done && !reduced) raf = requestAnimationFrame(loop);
  }
  if (reduced) drawDrum();
  else raf = requestAnimationFrame(loop);
  const mixLoop = reduced ? { stop() {} } : o.loop?.({ filter: "bandpass", f: 900, q: 0.8, gain: 0.04 }) || { stop() {} };

  // ---------- Ablauf ----------
  const T = reduced
    ? { intro: 400, caption: 350, reveal: 0, hold: 450, sum: 500, suspense: 500 }
    : pick > 4
      ? { intro: 2300, caption: 950, reveal: 700, hold: 800, sum: 1300, suspense: 2200 }
      : { intro: 2300, caption: 1100, reveal: 750, hold: 900, sum: 1300, suspense: 2200 };
  const summary = () => `Die Gewinnzahlen: ${draw.nums.join(" · ")}${hasNeon ? ` · Neonzahl ${draw.neon}` : ""}`;

  function fillNeonSlot() {
    neonSlot.replaceChildren(neonEl(draw.neon, { small: true }));
    neonSlot.classList.add("is-filled");
  }
  function revealNeon() {
    const b = balls.find((x) => x.neon && x.n === draw.neon);
    if (b) b.gone = true;
    big.replaceChildren(neonEl(draw.neon));
    big.classList.remove("is-in");
    void big.offsetWidth;
    big.classList.add("is-in");
    fillNeonSlot();
    play("lotto.reveal", { pitch: 1.5 });
  }

  function revealNumber(i) {
    const n = draw.nums[i];
    const b = balls.find((x) => x.n === n);
    if (b) b.gone = true;
    big.replaceChildren(ballEl(n));
    big.classList.remove("is-in");
    void big.offsetWidth;
    big.classList.add("is-in");
    slots[i].replaceChildren(ballEl(n, { small: true }));
    slots[i].classList.add("is-filled");
    play("lotto.reveal", { pitch: 1 + i * 0.06 });
  }

  let t = 0;
  play(grand ? "lotto.intro" : "lotto.intro", { vol: grand ? 1 : 0.8 });
  caption.textContent = grand ? "Willkommen zum Großen Neon Lotto!" : "Willkommen zur Ziehung!";
  t += T.intro;
  at(t, () => {
    caption.textContent = "Die Kugelmaschine läuft …";
  });
  t += reduced ? 200 : 900;
  for (let i = 0; i < pick; i++) {
    at(t, () => {
      caption.textContent = `Die ${ORD[i]} Zahl lautet …`;
      if (!reduced) {
        mixing = 0.4;
        play("lotto.ball");
      }
    });
    t += T.caption + T.reveal;
    at(t, () => {
      mixing = 1;
      revealNumber(i);
      caption.textContent = `${draw.nums[i]}`;
    });
    t += T.hold;
  }
  if (hasNeon) {
    // Spannungspause: Trommel wird geleert, die zehn Neonkugeln laufen ein
    at(t, () => {
      big.replaceChildren();
      caption.textContent = "Und jetzt … die Neonzahl!";
      neonPhase = true;
      loadNeonBalls();
      mixing = 1;
      if (reduced) drawDrum();
      setPhase("neon");
    });
    t += T.suspense;
    at(t, () => {
      caption.textContent = "Die Neonzahl lautet …";
      if (!reduced) {
        mixing = 0.4;
        play("lotto.ball");
      }
    });
    t += T.caption + T.reveal;
    at(t, () => {
      mixing = 1;
      revealNeon();
      caption.textContent = `Neonzahl ${draw.neon}`;
    });
    t += T.hold + (reduced ? 0 : 400);
  }
  at(t, () => {
    caption.textContent = summary();
    big.replaceChildren();
  });
  t += T.sum;
  at(t, evaluate);

  function stopMachine() {
    mixLoop.stop();
    cancelAnimationFrame(raf);
  }

  skipBtn.addEventListener("click", () => {
    if (skipped || done) return;
    skipped = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    for (const b of balls) if (b.neon ? b.n === draw.neon : draw.nums.includes(b.n)) b.gone = true;
    for (let i = 0; i < pick; i++) if (!slots[i].classList.contains("is-filled")) {
      slots[i].replaceChildren(ballEl(draw.nums[i], { small: true }));
      slots[i].classList.add("is-filled");
    }
    if (hasNeon && !neonSlot.classList.contains("is-filled")) fillNeonSlot();
    big.replaceChildren();
    caption.textContent = summary();
    evaluate();
  });

  // ---------- Auswertung ----------
  function evaluate() {
    if (done) return;
    stopMachine();
    skipBtn.remove();
    drawDrum();
    stage.classList.add("is-done");
    show.classList.add("is-evaluated");
    setPhase("evaluate");
    const set = new Set(draw.nums);
    const list = h(
      "ul.lt-tickets",
      { "aria-label": "Deine Scheine" },
      draw.results.map((r, i) =>
        h(
          `li.lt-ticket${r.prize ? ".is-win" : ""}`,
          { style: { "--d": `${i * (reduced ? 0 : 90)}ms` } },
          h("span.lt-ticket-no", {}, `Schein ${i + 1}`),
          h("span.lt-ticket-nums", {}, r.nums.map((n) => ballEl(n, { hit: set.has(n), small: true })), hasNeon && Number.isInteger(r.neon) ? neonEl(r.neon, { hit: r.neonHit, small: true }) : null),
          h("span.lt-ticket-res", {}, resultText(r), r.prize ? h("b.num", {}, ` · ${fmt(r.prize)} C`) : null)
        )
      )
    );
    const hits = draw.results.reduce((s, r) => s + r.k + (r.neonHit ? 1 : 0), 0);
    if (!reduced) for (let i = 0; i < Math.min(hits, 12); i++) at(120 + i * 70, () => play("lotto.hit", { semi: i % 5 }));
    result.replaceChildren(list, finale());
    setPhase(draw.payout > 0 ? (draw.claimed ? "claimed" : "win") : "lose");
  }

  function finale() {
    const box = h("div.lt-finale");
    const net = draw.payout - draw.stake;
    if (draw.payout > 0) {
      const head = net > 0 ? "GEWONNEN" : "TREFFER";
      const amount = h("div.lt-amount.num", {}, `${fmt(draw.payout)} C`);
      const note = net > 0 ? null : h("small.lt-note", {}, `Einsatz dieser Ziehung: ${fmt(draw.stake)} C · Bilanz ${fmt(net)} C`);
      const claimBtn = h("button.btn.btn-gold.btn-lg.lt-claim", { type: "button" }, net > 0 ? "Belohnung einfordern" : "Auszahlung einfordern");
      const doneBtn = h("button.btn.btn-ghost.lt-continue", { type: "button" }, "Weiter");
      const markClaimed = () => {
        claimBtn.disabled = true;
        claimBtn.textContent = "Eingefordert ✓";
        claimBtn.classList.add("is-claimed");
        box.append(doneBtn);
        doneBtn.focus();
      };
      claimBtn.addEventListener("click", () => {
        if (claimBtn.disabled) return;
        claimBtn.disabled = true; // Doppelklick: zweiter Klick findet einen gesperrten Knopf
        const paid = o.claim(draw.id);
        if (paid > 0) o.onClaimed(paid, draw, claimBtn);
        markClaimed();
        setPhase("claimed");
      });
      doneBtn.addEventListener("click", () => finish(true));
      box.append(...[h("div.lt-head.is-win", {}, head), amount, note, claimBtn].filter(Boolean));
      if (draw.claimed) markClaimed();
      else play(net > 0 ? "win.medium" : "coin.land");
    } else {
      play("lotto.end");
      const back = h("button.btn.btn-danger.btn-lg.lt-back", { type: "button" }, "Zurück");
      back.addEventListener("click", () => finish(false));
      box.append(h("div.lt-head.is-lose", {}, "LEIDER KEIN GEWINN"), h("small.lt-note", {}, "Die Zahlen dieser Ziehung stehen im Archiv."), back);
      setTimeout(() => back.focus(), 50);
    }
    return box;
  }

  function finish(claimed) {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    stopMachine();
    show.classList.add("is-leaving");
    setTimeout(() => show.remove(), 260);
    o.onDone({ claimed });
  }

  return {
    /** Abbrechen (z. B. Spiel verlassen) – das Ergebnis bleibt unverändert gespeichert. */
    abort() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      stopMachine();
      show.remove();
    },
  };
}
