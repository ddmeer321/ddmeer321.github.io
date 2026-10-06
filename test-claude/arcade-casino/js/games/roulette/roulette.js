// Europäisches Roulette: animierter Kessel mit Kugel, Tableau mit Chips.

import { h, clear } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { WHEEL_ORDER, colorOf } from "./wheel.js";
import { payoutFor, totalBet, spinNumber, LABELS, betType, isValidKey } from "./logic.js";
import { LIMITS } from "../../core/limits.js";

const CHIPS = [
  { v: 5, c: "#8a7bb0" },
  { v: 10, c: "#2de2e6" },
  { v: 25, c: "#8cff5a" },
  { v: 100, c: "#ff3d9a" },
  { v: 500, c: "#ffc53d" },
];
const MIN_TOTAL = LIMITS.roulette.min;
const MAX_TOTAL = LIMITS.roulette.max;
const MAX_STRAIGHT = LIMITS.roulette.maxStraight; // Höchsteinsatz je Einzelzahl (35 : 1)
const STEP = (Math.PI * 2) / 37;

function chipColor(amount) {
  let c = CHIPS[0].c;
  for (const ch of CHIPS) if (amount >= ch.v) c = ch.c;
  return c;
}

/** Gespeicherte „Wie zuvor“-Wetten prüfen (V1.0-Stände kennen das Einzelzahl-Limit noch nicht). */
function sanitizeBets(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  let total = 0;
  for (const [key, v] of Object.entries(raw)) {
    if (!isValidKey(key) || !Number.isSafeInteger(v) || v <= 0) continue;
    const amount = betType(key) === "n" ? Math.min(v, MAX_STRAIGHT) : v;
    if (total + amount > MAX_TOTAL) break;
    out[key] = amount;
    total += amount;
  }
  return Object.keys(out).length ? out : null;
}

function shortAmount(n) {
  return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k" : String(n);
}

export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    const data = ctx.data;
    let dead = false;
    let bets = {};
    let undo = [];
    let lastBets = sanitizeBets(data.lastBets);
    let chip = CHIPS.some((c) => c.v === data.chip) ? data.chip : 10;
    let phase = "bet"; // bet | spin | result
    ctx.setPhase(phase);
    let ticket = null;
    let result = null;
    let history = Array.isArray(data.history) ? data.history.filter((n) => Number.isInteger(n) && n >= 0 && n <= 36).slice(0, 12) : [];

    // ---------- DOM ----------
    const stage = h("div.game-stage.rl-stage");
    const wheelBox = h("div.rl-wheel");
    const histEl = h("div.rl-history", { "aria-label": "Letzte Zahlen" });
    const board = h("div.rl-board.vertical", { role: "group", "aria-label": "Tableau" });
    const side = h("div.rl-side", {}, histEl, board);
    stage.append(wheelBox, side);

    const controls = h("div.game-controls");
    const chipRow = h("div.rl-chips", { role: "radiogroup", "aria-label": "Chipwert" });
    const chipBtns = CHIPS.map((c) => {
      const b = h("button.chip-btn", { type: "button", role: "radio", "aria-label": `Chip ${c.v}`, style: { "--chip": c.c } }, h("span", {}, String(c.v)));
      b.addEventListener("click", () => {
        chip = c.v;
        data.chip = chip;
        play("chip", { pitch: 0.9 + CHIPS.indexOf(c) * 0.05 });
        haptic("tick");
        renderChips();
      });
      chipRow.append(b);
      return b;
    });
    const totalLabel = h("div.ctrl-label.gold", {}, h("small", {}, "Einsatz"), h("strong.num", {}, "0"));
    const undoBtn = h("button.btn.btn-sm", { type: "button", "aria-label": "Letzten Chip zurücknehmen" }, "↶", h("span.lbl", {}, " Zurück"));
    const clearBtn = h("button.btn.btn-sm.btn-ghost", { type: "button", "aria-label": "Alle Chips entfernen" }, "✕", h("span.lbl", {}, " Löschen"));
    const rebetBtn = h("button.btn.btn-sm.btn-cyan", { type: "button", "aria-label": "Einsätze wie zuvor" }, "↻", h("span.lbl", {}, " Wie zuvor"));
    const spinBtn = h("button.btn.btn-primary.btn-lg", { type: "button" }, "Drehen");
    controls.append(chipRow, h("div.ctrl-group.rl-ctrl", {}, totalLabel, undoBtn, clearBtn, rebetBtn, spinBtn));
    root.append(stage, controls);

    function renderChips() {
      chipBtns.forEach((b, i) => {
        const sel = CHIPS[i].v === chip;
        b.classList.toggle("is-selected", sel);
        b.setAttribute("aria-checked", String(sel));
      });
    }

    // ---------- Tableau ----------
    const cells = new Map();

    function makeCell(key, content, cls) {
      const el = h(`button.rl-cell.${cls}`, { type: "button", dataset: { key }, "aria-label": labelFor(key) }, content);
      el.addEventListener("click", () => placeChip(key, el));
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        removeChip(key);
      });
      cells.set(key, el);
      return el;
    }

    function labelFor(key) {
      const [t, v] = key.split(":");
      if (t === "n") return `Zahl ${v}`;
      if (t === "dozen") return `${v}. Dutzend`;
      if (t === "col") return `${v}. Kolonne`;
      return LABELS[t];
    }

    function buildBoard(horizontal) {
      clear(board);
      cells.clear();
      board.className = `rl-board ${horizontal ? "horizontal" : "vertical"}`;
      const place = (el, col, row, cs = 1, rs = 1) => {
        el.style.gridColumn = `${col} / span ${cs}`;
        el.style.gridRow = `${row} / span ${rs}`;
        board.append(el);
      };
      const zero = makeCell("n:0", "0", "num.c-green");
      const outs = [
        ["low", h("span", {}, "1–18")],
        ["even", h("span", {}, "Gerade")],
        ["red", h("i.diamond", { style: { background: "#c8102e" } })],
        ["black", h("i.diamond", { style: { background: "#15101f", border: "1px solid #fff" } })],
        ["odd", h("span", {}, "Ungerade")],
        ["high", h("span", {}, "19–36")],
      ];
      if (!horizontal) {
        place(zero, 3, 1, 3, 1);
        for (let n = 1; n <= 36; n++) place(makeCell(`n:${n}`, String(n), `num.c-${colorOf(n)}`), 3 + ((n - 1) % 3), 1 + Math.ceil(n / 3));
        outs.forEach(([k, c], i) => place(makeCell(k, c, "outside"), 1, 2 + i * 2, 1, 2));
        for (let d = 1; d <= 3; d++) place(makeCell(`dozen:${d}`, h("span", {}, `${d}. Dutzend`), "outside"), 2, 2 + (d - 1) * 4, 1, 4);
        for (let c = 1; c <= 3; c++) place(makeCell(`col:${c}`, "2:1", "outside"), 2 + c, 14);
      } else {
        place(zero, 1, 1, 1, 3);
        for (let n = 1; n <= 36; n++) place(makeCell(`n:${n}`, String(n), `num.c-${colorOf(n)}`), 1 + Math.ceil(n / 3), 3 - ((n - 1) % 3));
        for (let c = 1; c <= 3; c++) place(makeCell(`col:${c}`, "2:1", "outside"), 14, 4 - c);
        for (let d = 1; d <= 3; d++) place(makeCell(`dozen:${d}`, h("span", {}, `${d}. Dutzend`), "outside"), 2 + (d - 1) * 4, 4, 4, 1);
        outs.forEach(([k, c], i) => place(makeCell(k, c, "outside"), 2 + i * 2, 5, 2, 1));
      }
      renderBets();
    }

    let horizontal = null;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => checkLayout()) : null;
    ro?.observe(side);
    function checkLayout() {
      const w = side.getBoundingClientRect().width;
      const hgt = side.getBoundingClientRect().height;
      const hz = w >= 560 || w > hgt * 1.4;
      if (hz !== horizontal) {
        horizontal = hz;
        buildBoard(hz);
      }
    }

    function renderBets() {
      for (const [key, el] of cells) {
        el.querySelector(".rl-chip")?.remove();
        const amt = bets[key];
        if (amt) el.append(h("span.rl-chip.num", { style: { "--chip": chipColor(amt) } }, shortAmount(amt)));
      }
      const t = totalBet(bets);
      totalLabel.lastChild.textContent = ctx.fmt(t);
      const betting = phase !== "spin";
      undoBtn.disabled = !betting || !undo.length;
      clearBtn.disabled = !betting || !t;
      rebetBtn.disabled = !betting || (t > 0 && phase !== "result") || !lastBets || !Object.keys(lastBets).length;
      spinBtn.disabled = phase === "spin" || (phase === "bet" && t < MIN_TOTAL) || (phase === "result" && !lastBets);
      if (phase !== "spin") spinBtn.textContent = phase === "result" ? "Nochmal" : "Drehen";
    }

    function startNewRoundIfResult() {
      if (phase === "result") {
        phase = "bet";
        ctx.setPhase(phase);
        bets = {};
        undo = [];
        cells.forEach((el) => el.classList.remove("is-win"));
        wheelBox.querySelector(".rl-result")?.remove();
      }
    }

    function placeChip(key, el) {
      if (phase === "spin") return;
      startNewRoundIfResult();
      const t = totalBet(bets);
      if (t + chip > MAX_TOTAL) {
        play("ui.error");
        ctx.toast(`Tischlimit: höchstens ${ctx.fmt(MAX_TOTAL)} pro Runde`, { icon: "⚠️", tone: "red" });
        return;
      }
      if (t + chip > economy.balance) {
        play("ui.error");
        haptic("impulse");
        ctx.toast("Nicht genug Credits für diesen Chip", { icon: "⚠️", tone: "red" });
        return;
      }
      if (betType(key) === "n" && (bets[key] || 0) + chip > MAX_STRAIGHT) {
        play("ui.error");
        ctx.toast(`Limit: höchstens ${MAX_STRAIGHT} je Einzelzahl`, { icon: "⚠️", tone: "red" });
        return;
      }
      bets[key] = (bets[key] || 0) + chip;
      undo.push({ key, amount: chip });
      play("chip", { pitch: 0.95 + Math.random() * 0.1, pan: horizontal ? 0.2 : 0 });
      haptic("tap", 0.8);
      renderBets();
      void el;
    }

    function removeChip(key) {
      if (phase !== "bet" || !bets[key]) return;
      for (let i = undo.length - 1; i >= 0; i--) {
        if (undo[i].key === key) {
          bets[key] -= undo[i].amount;
          if (bets[key] <= 0) delete bets[key];
          undo.splice(i, 1);
          break;
        }
      }
      play("chip", { pitch: 0.8 });
      renderBets();
    }

    undoBtn.addEventListener("click", () => {
      startNewRoundIfResult();
      const last = undo.pop();
      if (!last) return;
      bets[last.key] -= last.amount;
      if (bets[last.key] <= 0) delete bets[last.key];
      play("chip", { pitch: 0.8 });
      haptic("tick");
      renderBets();
    });
    clearBtn.addEventListener("click", () => {
      startNewRoundIfResult();
      bets = {};
      undo = [];
      play("chip.stack");
      haptic("tap");
      renderBets();
    });
    rebetBtn.addEventListener("click", () => {
      startNewRoundIfResult();
      if (!lastBets) return;
      const t = totalBet(lastBets);
      if (t > economy.balance || t > MAX_TOTAL) {
        play("ui.error");
        ctx.toast("Nicht genug Credits für die letzten Einsätze", { icon: "⚠️", tone: "red" });
        return;
      }
      bets = { ...lastBets };
      undo = Object.entries(bets).map(([key, amount]) => ({ key, amount }));
      play("chip.stack");
      haptic("impulse");
      renderBets();
    });

    // ---------- Kessel ----------
    const st = createStage(wheelBox);
    const g = st.ctx;
    let rotorImg = null;
    let rotorSize = 0;
    let rotor = Math.random() * Math.PI * 2;
    let anim = null;
    let ball = null; // { angle, r } absolut, für Ruheanzeige

    function geo() {
      const S = Math.min(st.width, st.height);
      return { S, cx: st.width / 2, cy: st.height / 2, R: S * 0.48 };
    }

    function buildRotor(S) {
      const px = Math.round(S * 0.8 * st.dpr);
      if (rotorImg && rotorSize === px) return;
      rotorSize = px;
      const c = document.createElement("canvas");
      c.width = c.height = px;
      const x = c.getContext("2d");
      const r = px / 2;
      x.translate(r, r);
      const Ro = r * 0.98;
      const Rn = r * 0.8;
      const Rpk = r * 0.66;
      WHEEL_ORDER.forEach((n, i) => {
        const a0 = i * STEP - Math.PI / 2 - STEP / 2;
        const a1 = a0 + STEP;
        const col = n === 0 ? "#138a43" : colorOf(n) === "red" ? "#c8102e" : "#15101f";
        x.beginPath();
        x.arc(0, 0, Ro, a0, a1);
        x.arc(0, 0, Rpk, a1, a0, true);
        x.closePath();
        x.fillStyle = col;
        x.fill();
        // Taschen (dunkler, innen)
        x.beginPath();
        x.arc(0, 0, Rn, a0, a1);
        x.arc(0, 0, Rpk, a1, a0, true);
        x.closePath();
        x.fillStyle = "rgba(0,0,0,.28)";
        x.fill();
        // Stege
        x.strokeStyle = "#e9c46a";
        x.lineWidth = r * 0.012;
        x.beginPath();
        x.moveTo(Math.cos(a0) * Rpk, Math.sin(a0) * Rpk);
        x.lineTo(Math.cos(a0) * Ro, Math.sin(a0) * Ro);
        x.stroke();
        // Zahl
        const am = a0 + STEP / 2;
        x.save();
        x.rotate(am + Math.PI / 2);
        x.fillStyle = "#fff";
        x.font = `900 ${r * 0.085}px ui-rounded, system-ui, sans-serif`;
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(String(n), 0, -(Ro + Rn) / 2);
        x.restore();
      });
      x.strokeStyle = "#e9c46a";
      x.lineWidth = r * 0.015;
      for (const rr of [Ro, Rn, Rpk]) {
        x.beginPath();
        x.arc(0, 0, rr, 0, Math.PI * 2);
        x.stroke();
      }
      // Konus
      const cone = x.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, Rpk);
      cone.addColorStop(0, "#c98b5a");
      cone.addColorStop(0.7, "#6b3a22");
      cone.addColorStop(1, "#3a1d10");
      x.fillStyle = cone;
      x.beginPath();
      x.arc(0, 0, Rpk - r * 0.01, 0, Math.PI * 2);
      x.fill();
      // Drehkreuz
      x.strokeStyle = "#ffd36b";
      x.lineCap = "round";
      x.lineWidth = r * 0.05;
      x.beginPath();
      x.moveTo(-r * 0.28, 0);
      x.lineTo(r * 0.28, 0);
      x.moveTo(0, -r * 0.28);
      x.lineTo(0, r * 0.28);
      x.stroke();
      x.fillStyle = "#ffe8a3";
      x.beginPath();
      x.arc(0, 0, r * 0.08, 0, Math.PI * 2);
      x.fill();
      rotorImg = c;
    }

    function draw() {
      st.begin();
      const { S, cx, cy, R } = geo();
      g.clearRect(0, 0, st.width, st.height);
      buildRotor(S);
      // Schüssel
      const bowl = g.createRadialGradient(cx, cy, R * 0.75, cx, cy, R);
      bowl.addColorStop(0, "#2a160c");
      bowl.addColorStop(0.85, "#6b3a22");
      bowl.addColorStop(1, "#9a5a36");
      g.fillStyle = bowl;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      // Kugelbahn
      g.strokeStyle = "rgba(255,255,255,.1)";
      g.lineWidth = R * 0.08;
      g.beginPath();
      g.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
      g.stroke();
      // Rautensteine
      g.fillStyle = "#e9c46a";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.save();
        g.translate(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
        g.rotate(a);
        g.fillRect(-R * 0.025, -R * 0.012, R * 0.05, R * 0.024);
        g.restore();
      }
      // Rotor
      const rs = S * 0.8;
      g.save();
      g.translate(cx, cy);
      g.rotate(rotor);
      g.drawImage(rotorImg, -rs / 2, -rs / 2, rs, rs);
      g.restore();
      // Kugel
      if (ball) {
        const bx = cx + Math.cos(ball.angle) * ball.r * R;
        const by = cy + Math.sin(ball.angle) * ball.r * R;
        const br = R * 0.04;
        g.fillStyle = "rgba(0,0,0,.4)";
        g.beginPath();
        g.arc(bx + br * 0.3, by + br * 0.4, br, 0, Math.PI * 2);
        g.fill();
        const bg = g.createRadialGradient(bx - br * 0.4, by - br * 0.4, br * 0.1, bx, by, br);
        bg.addColorStop(0, "#fff");
        bg.addColorStop(1, "#b9b3c8");
        g.fillStyle = bg;
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fill();
      }
      // Glanz
      const gl = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      gl.addColorStop(0, "rgba(255,255,255,.12)");
      gl.addColorStop(0.5, "rgba(255,255,255,0)");
      g.fillStyle = gl;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
    }
    st.onResize = draw;

    // Radien relativ zu R
    const R_TRACK = 0.88;
    const R_POCKET = 0.58;

    const loop = createLoop((dt) => {
      if (!anim) return;
      anim.t += dt;
      const { T, td, tl } = anim;
      const t = Math.min(anim.t, T);
      // Rotor: abklingende Drehung
      rotor = anim.r0 + anim.w0 * anim.tau * (1 - Math.exp(-t / anim.tau));
      // Kugel relativ zum Rotor
      const u = 1 - t / T;
      const phi = anim.phiP + anim.D * Math.pow(u, 2.6);
      let r;
      if (t < td) r = R_TRACK;
      else if (t < tl) {
        const k = (t - td) / (tl - td);
        r = R_POCKET + (R_TRACK - R_POCKET) * Math.pow(1 - k, 2) + 0.06 * Math.abs(Math.sin(k * Math.PI * 3.5)) * (1 - k);
      } else r = R_POCKET;
      ball = { angle: rotor + phi, r };

      // Geräusche
      if (t < td) {
        anim.roll?.set({ gain: 0.05 * u + 0.01, freq: 900 + 900 * u });
      } else if (!anim.dropped) {
        anim.dropped = true;
        anim.roll?.stop(0.3);
        play("roulette.drop");
        haptic("impulse");
      }
      if (t >= td) {
        const fret = Math.floor(phi / STEP);
        if (fret !== anim.fret) {
          anim.fret = fret;
          const speed = Math.abs((anim.D * 2.6 * Math.pow(u, 1.6)) / T);
          if (t < tl + 0.6) {
            play("roulette.tick", { vol: Math.min(1, 0.3 + speed * 0.2) });
            haptic("tick", 0.5);
          }
        }
      }
      if (t >= tl && !anim.landed) {
        anim.landed = true;
        play("roulette.drop", { vol: 0.6 });
        haptic("heavy", 0.8);
      }
      draw();
      if (anim.t >= T) {
        const done = anim;
        anim = null;
        loop.stop();
        onSpinEnd(done.result);
      }
    });

    function startSpin() {
      if (phase !== "bet" && phase !== "result") return;
      if (phase === "result") {
        // „Nochmal“: dieselben Einsätze wie in der letzten Runde
        startNewRoundIfResult();
        if (lastBets) {
          const lt = totalBet(lastBets);
          if (lt > economy.balance) {
            play("ui.error");
            ctx.toast("Nicht genug Credits für die letzten Einsätze", { icon: "⚠️", tone: "red" });
            renderBets();
            return;
          }
          bets = { ...lastBets };
          undo = Object.entries(bets).map(([key, amount]) => ({ key, amount }));
        }
      }
      const t = totalBet(bets);
      const check = economy.validateBet(t, { min: MIN_TOTAL, max: MAX_TOTAL });
      if (!check.ok) {
        play("ui.error");
        ctx.toast(check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("roulette", t, { min: MIN_TOTAL, max: MAX_TOTAL });
      if (!ticket) return;
      result = spinNumber();
      lastBets = { ...bets };
      data.lastBets = lastBets;
      ctx.save();
      phase = "spin";
      ctx.setPhase(phase);
      renderBets();
      spinBtn.textContent = "Rien ne va plus";
      play("roulette.launch");
      haptic("impulse");

      const reduced = ctx.reducedMotion();
      const T = reduced ? 2.2 : 6.4;
      const idx = WHEEL_ORDER.indexOf(result);
      const phiP = idx * STEP - Math.PI / 2;
      const turns = reduced ? 3 : 9 + Math.random() * 2;
      anim = {
        t: 0,
        T,
        td: T * 0.6,
        tl: T * 0.84,
        r0: rotor,
        w0: 1.5,
        tau: 6,
        phiP,
        D: -(Math.PI * 2 * turns),
        fret: null,
        result,
        roll: ctx.loop({ filter: "bandpass", f: 1600, q: 0.8, gain: 0.05 }),
      };
      loop.start();
    }

    function onSpinEnd(n) {
      if (!ticket) return;
      const { total, winners } = payoutFor(bets, n);
      const stake = ticket.stake;
      economy.settle(ticket, total);
      ticket = null;
      phase = "result";
      ctx.setPhase(phase);
      history.unshift(n);
      history = history.slice(0, 12);
      data.history = history;
      ctx.save();
      renderHistory();

      wheelBox.append(h(`div.rl-result.c-${colorOf(n)}`, {}, String(n)));
      const winKeys = new Set(winners.map((w) => w.key));
      cells.get(`n:${n}`)?.classList.add("is-win");
      for (const [key, el] of cells) {
        const ch = el.querySelector(".rl-chip");
        if (!ch) continue;
        if (winKeys.has(key)) {
          el.classList.add("is-win");
          const r = el.getBoundingClientRect();
          particles.floatText(r.left + r.width / 2, r.top, "+" + ctx.fmt(winners.find((w) => w.key === key).pay));
        } else ch.classList.add("is-lost");
      }
      const net = total - stake;
      const r = wheelBox.getBoundingClientRect();
      if (winners.some((w) => betType(w.key) === "n")) ctx.progression.award("roulette-straight");
      if (net > 0) ctx.report("roulette:win", { number: n, types: [...new Set(winners.map((w) => betType(w.key)))] });
      ctx.celebrate({
        stake,
        payout: total,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        title: `${n} ${colorName(n)}`,
        detail: net > 0 && winners.length === 1 ? `${LABEL_FOR(winners[0].key)}` : undefined,
      });
      // Gewonnene Einsätze bleiben sichtbar; ab dem nächsten Chip beginnt eine neue Runde
      for (const k of Object.keys(bets)) if (!winKeys.has(k)) delete bets[k];
      undo = [];
      renderBets();
      for (const k of winKeys) cells.get(k)?.classList.add("is-win");
    }

    function LABEL_FOR(key) {
      const t = betType(key);
      const v = key.split(":")[1];
      if (t === "n") return `Zahl ${v} · 35 : 1`;
      if (t === "dozen") return `${v}. Dutzend · 2 : 1`;
      if (t === "col") return `${v}. Kolonne · 2 : 1`;
      return `${LABELS[t] || t} · 1 : 1`;
    }

    function colorName(n) {
      return n === 0 ? "Grün" : colorOf(n) === "red" ? "Rot" : "Schwarz";
    }

    function renderHistory() {
      clear(histEl);
      for (const n of history) histEl.append(h(`span.c-${colorOf(n)}.num`, {}, String(n)));
    }

    spinBtn.addEventListener("click", startSpin);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Roulette",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Chipwert unten wählen und auf das Tableau tippen, um zu setzen. Mehrfach tippen erhöht den Einsatz. „Zurück“ entfernt den letzten Chip (am Computer auch Rechtsklick auf ein Feld)."),
          h("h3", {}, "Auszahlungen"),
          h(
            "table",
            {},
            h("tbody", {}, [
              ["Einzelne Zahl (0–36)", "35 : 1"],
              ["Dutzend (1–12, 13–24, 25–36)", "2 : 1"],
              ["Kolonne (2:1-Feld)", "2 : 1"],
              ["Rot / Schwarz", "1 : 1"],
              ["Gerade / Ungerade", "1 : 1"],
              ["1–18 / 19–36", "1 : 1"],
            ].map(([a, b]) => h("tr", {}, h("td", {}, a), h("td", {}, b))))
          ),
          h("p", {}, `Europäisches Rad mit 37 Feldern (eine Null). Fällt die 0, verlieren alle Außenwetten. Jede Zahl hat dieselbe Wahrscheinlichkeit von 1/37. Einsatz pro Runde ${MIN_TOTAL}–${ctx.fmt(MAX_TOTAL)} Credits, höchstens ${MAX_STRAIGHT} je Einzelzahl.`)
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    renderChips();
    renderHistory();
    checkLayout();
    if (horizontal === null) buildBoard(false);
    ball = { angle: rotor + (WHEEL_ORDER.indexOf(history[0] ?? 0) * STEP - Math.PI / 2), r: R_POCKET };
    draw();

    return {
      finalize() {
        if (ticket && result !== null) {
          economy.settle(ticket, payoutFor(bets, result).total);
          ticket = null;
        }
      },
      destroy() {
        dead = true;
        anim?.roll?.stop();
        loop.destroy();
        st.destroy();
        ro?.disconnect();
        void dead;
      },
    };
  },
};
