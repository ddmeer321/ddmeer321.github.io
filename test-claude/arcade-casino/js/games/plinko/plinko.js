// Plinko – Darstellung und Bedienung. Physik: physics.js, Multiplikatoren: tables.js.
// Jede Kugel ist eine eigene Runde (eigenes Ticket); viele Kugeln dürfen
// gleichzeitig fallen. Die gezeichnete Bewegung ist exakt die Simulation.

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { createBetControl } from "../../ui/betControl.js";
import { random } from "../../core/rng.js";
import { classifyWin } from "../../core/wintier.js";
import * as P from "./physics.js";
import { RISKS, payoutFor, fmtMult, rtpOf } from "./tables.js";

const MAX_BALLS = 40;
const PLAYBACK = 1.35; // Wiedergabe-Tempo der Simulation (ändert keine Ergebnisse)
const MULTI_COUNT = 10;
const MULTI_GAP_MS = 140;

function slotColor(m, maxM) {
  if (m < 1) return ["#2a2350", "#7d6f9c"];
  const k = Math.min(1, Math.log(m) / Math.log(maxM));
  if (k > 0.85) return ["#ff3d9a", "#ffd1ea"];
  if (k > 0.55) return ["#ff8a3d", "#ffe0c4"];
  if (k > 0.25) return ["#ffc53d", "#fff3c4"];
  return ["#2de2e6", "#c8ffff"];
}

export default {
  mount(root, ctx) {
    const { economy, play, haptic } = ctx;
    const data = ctx.data;
    const L = ctx.limits;
    let dead = false;
    let risk = RISKS[data.risk] ? data.risk : "mid";

    // ---------- DOM ----------
    const stage = h("div.game-stage.arcade-stage.plinko-stage", { style: { "--ac": "var(--pink)" } });
    const lastVal = h("strong.num", {}, "–");
    const ballsVal = h("strong.num", {}, "0");
    const hud = h("div.arcade-hud", {}, h("div.slot-display", {}, h("small", {}, "Letzter"), lastVal), h("div.slot-display", {}, h("small", {}, "Kugeln"), ballsVal));
    const historyEl = h("div.plinko-history", { "aria-label": "Letzte Treffer" });
    stage.append(hud, historyEl);
    const controls = h("div.game-controls");
    const riskSeg = h("div.segmented", { role: "group", "aria-label": "Risiko" });
    for (const [id, r] of Object.entries(RISKS)) {
      const b = h("button", { type: "button", "aria-pressed": String(id === risk), dataset: { risk: id } }, r.name);
      b.addEventListener("click", () => {
        risk = id;
        data.risk = id;
        ctx.save();
        riskSeg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        play("ui.toggle");
        haptic("tick");
        draw(performance.now());
      });
      riskSeg.append(b);
    }
    const betCtl = createBetControl({
      steps: L.steps,
      value: Number(data.bet) || 10,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
      },
    });
    const dropBtn = h("button.btn.btn-primary.btn-lg", { type: "button", "aria-keyshortcuts": "Space" }, "Kugel");
    const multiBtn = h("button.btn.btn-gold", { type: "button" }, `×${MULTI_COUNT}`);
    controls.append(h("div.ctrl-group", {}, riskSeg), h("div.ctrl-group", {}, betCtl.el, dropBtn, multiBtn));
    root.append(stage, controls);

    const st = createStage(stage);
    const g = st.ctx;

    // ---------- Zustand ----------
    const balls = []; // { sim, ticket, bet, risk, trail: [], landed:false, slot }
    const pinFlash = P.PINS.map((row) => row.map(() => 0));
    const slotPulse = new Array(P.SLOTS).fill(0);
    let boardGlow = 0;
    let wave = null; // { slot, t }
    let acc = 0;
    let multiTimer = 0;
    let multiLeft = 0;
    let lastHaptic = 0;
    let history = [];
    let holdTimer = 0;

    function setPhase() {
      ctx.setPhase(balls.length ? "dropping" : "idle");
      stage.dataset.balls = String(balls.length);
      ballsVal.textContent = String(balls.length);
    }

    // ---------- Geometrie ----------
    let G0 = null;
    function geom() {
      const W = st.width;
      const H = st.height;
      const topPad = 64;
      const slotH = 34;
      const boardW = P.SLOTS * P.DX + 0.5;
      const boardH = P.FLOOR_Y - P.TOP + 0.4;
      const s = Math.min((W * 0.96) / boardW, (H - topPad - slotH - 18) / boardH);
      const x0 = W / 2;
      const free = Math.max(0, H - topPad - slotH - 18 - boardH * s);
      const y0 = topPad + free * 0.45 + (-P.TOP + 0.2) * s;
      return (G0 = { W, H, s, x0, y0, slotH, slotY: y0 + P.FLOOR_Y * s + 4 });
    }
    const sx = (x) => G0.x0 + x * G0.s;
    const sy = (y) => G0.y0 + y * G0.s;

    // ---------- Einwurf ----------
    function drop() {
      if (dead) return false;
      if (balls.length >= MAX_BALLS) {
        ctx.toast("Kurz warten – das Brett ist voll", { icon: "⏳" });
        return false;
      }
      const bet = betCtl.value;
      const check = economy.validateBet(bet, { min: L.min, max: L.max });
      if (!check.ok) {
        play("ui.error");
        haptic("impulse");
        ctx.toast(check.reason === "Nicht genug Credits" ? "Nicht genug Credits für diese Kugel" : check.reason, { icon: "⚠️", tone: "red" });
        stopMulti();
        return false;
      }
      const ticket = economy.placeBet("plinko", bet, { min: L.min, max: L.max });
      if (!ticket) return false;
      const sim = P.createBall(random(), random());
      balls.push({ sim, ticket, bet, risk, trail: [], landed: false });
      play("plinko.drop", { pan: sim.x / 6 });
      haptic("tick", 0.6);
      setPhase();
      if (!loop.running) loop.start();
      return true;
    }

    function startMulti() {
      if (multiLeft > 0) return;
      multiLeft = MULTI_COUNT;
      const next = () => {
        if (dead || multiLeft <= 0) return;
        multiLeft--;
        if (!drop()) {
          multiLeft = 0;
          return;
        }
        if (multiLeft > 0) multiTimer = setTimeout(next, MULTI_GAP_MS);
      };
      next();
    }

    function stopMulti() {
      multiLeft = 0;
      clearTimeout(multiTimer);
    }

    // ---------- Landung & Auszahlung ----------
    function land(ball) {
      ball.landed = true;
      const slot = ball.sim.slot;
      const mult = RISKS[ball.risk].mult[slot];
      const payout = payoutFor(ball.bet, mult);
      economy.settle(ball.ticket, payout);
      ball.ticket = null;
      slotPulse[slot] = 1;
      const tier = classifyWin({ stake: ball.bet, payout, jackpot: ball.risk === "high" && (slot === 0 || slot === P.SLOTS - 1) });
      history.unshift({ mult, tier });
      history = history.slice(0, 8);
      renderHistory();
      lastVal.textContent = fmtMult(mult);
      ctx.report("plinko:ball", { mult, risk: ball.risk });
      if (mult >= 10) ctx.progression.award("plinko-big");
      const r = st.canvas.getBoundingClientRect();
      const x = r.left + sx(P.slotCenterX(slot));
      const y = r.top + G0.slotY;
      play("plinko.slot", { pan: P.slotCenterX(slot) / 6, pitch: mult >= 1 ? 1.2 : 0.8 });
      if (tier === "jackpot") {
        ctx.progression.award("plinko-jackpot");
        wave = { slot, t: 0 };
        boardGlow = 1;
        ctx.celebrate({ stake: ball.bet, payout, jackpot: true, x, y, detail: fmtMult(mult) });
      } else if (tier === "mega" || tier === "big") {
        boardGlow = tier === "mega" ? 1 : 0.6;
        wave = { slot, t: 0 };
        ctx.celebrate({ stake: ball.bet, payout, x, y, detail: fmtMult(mult) });
      } else {
        // kleine Ergebnisse: ehrlich und ohne Banner (viele Kugeln hintereinander)
        ctx.celebrate({ stake: ball.bet, payout, x, y: y - 10, banner: false, quiet: tier === "loss" || tier === "push" });
      }
    }

    function renderHistory() {
      historyEl.replaceChildren(...history.map((hh) => h(`span.ph-chip.tier-${hh.tier}`, {}, fmtMult(hh.mult))));
    }

    // ---------- Simulation ----------
    function onPin(ball) {
      return (r, i, speed) => {
        pinFlash[r][i] = Math.min(1, pinFlash[r][i] + 0.6);
        play("plinko.pin", { pitch: 0.85 + (r / P.ROWS) * 0.5 + Math.random() * 0.06, vol: Math.min(1, speed / 3), pan: ball.sim.x / 6 });
        const now = performance.now();
        if (now - lastHaptic > 70) {
          lastHaptic = now;
          haptic("tick", Math.min(0.8, speed / 4));
        }
      };
    }

    const loop = createLoop((dt) => {
      acc += dt * PLAYBACK;
      let steps = 0;
      while (acc >= P.DT && steps < 40) {
        acc -= P.DT;
        steps++;
        for (const b of balls) {
          if (b.sim.done) continue;
          P.stepBall(b.sim, onPin(b));
          if (b.sim.done && !b.landed) land(b);
        }
      }
      if (steps === 40) acc = 0;
      for (const b of balls) {
        b.trail.push([b.sim.x, b.sim.y]);
        if (b.trail.length > 7) b.trail.shift();
      }
      // gelandete Kugeln nach kurzer Zeit entfernen
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.landed) {
          b.fade = (b.fade || 0) + dt;
          if (b.fade > 0.35) balls.splice(i, 1);
        }
      }
      for (const row of pinFlash) for (let i = 0; i < row.length; i++) row[i] = Math.max(0, row[i] - dt * 3);
      for (let i = 0; i < slotPulse.length; i++) slotPulse[i] = Math.max(0, slotPulse[i] - dt * 2.2);
      boardGlow = Math.max(0, boardGlow - dt * 0.8);
      if (wave) {
        wave.t += dt;
        const radius = wave.t * 14;
        const cx = P.slotCenterX(wave.slot);
        P.PINS.forEach((row, r) =>
          row.forEach((p, i) => {
            const d = Math.hypot(p.x - cx, p.y - P.FLOOR_Y);
            if (Math.abs(d - radius) < 0.6) pinFlash[r][i] = 1;
          })
        );
        if (wave.t > 1.4) wave = null;
      }
      setPhase();
      draw();
      const idle = !balls.length && !wave && boardGlow <= 0 && slotPulse.every((x) => x <= 0);
      if (idle) loop.stop();
    });

    // ---------- Zeichnen ----------
    function draw() {
      st.begin();
      const G = geom();
      g.clearRect(0, 0, G.W, G.H);
      const table = RISKS[risk].mult;
      const maxM = Math.max(...table);

      // Brett-Hintergrund
      const top = sy(P.TOP);
      const bottom = G.slotY + G.slotH;
      const half = (P.SLOTS / 2) * P.DX * G.s + 10;
      const bg = g.createLinearGradient(0, top, 0, bottom);
      bg.addColorStop(0, "rgba(255,61,154,0.05)");
      bg.addColorStop(1, `rgba(255,61,154,${0.12 + boardGlow * 0.3})`);
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(G.x0 - 1.5 * G.s, top);
      g.lineTo(G.x0 + 1.5 * G.s, top);
      g.lineTo(G.x0 + half, bottom);
      g.lineTo(G.x0 - half, bottom);
      g.closePath();
      g.fill();

      // Pins
      const pr = Math.max(2.2, P.PIN_R * G.s * 1.4);
      P.PINS.forEach((row, r) =>
        row.forEach((p, i) => {
          const f = pinFlash[r][i];
          const x = sx(p.x);
          const y = sy(p.y);
          if (f > 0.05) {
            g.fillStyle = `rgba(255,209,234,${f * 0.45})`;
            g.beginPath();
            g.arc(x, y, pr * (2.2 + f * 1.5), 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = f > 0.05 ? "#fff" : "#cfc2ee";
          g.beginPath();
          g.arc(x, y, pr, 0, Math.PI * 2);
          g.fill();
        })
      );

      // Fächer
      const sw = P.DX * G.s;
      table.forEach((m, i) => {
        const cx = sx(P.slotCenterX(i));
        const pulse = slotPulse[i];
        const [c1, c2] = slotColor(m, maxM);
        const y = G.slotY + pulse * 6;
        g.fillStyle = c1;
        g.globalAlpha = 0.75 + pulse * 0.25;
        if (pulse > 0) {
          g.shadowColor = c1;
          g.shadowBlur = 18 * pulse;
        }
        g.beginPath();
        g.roundRect ? g.roundRect(cx - sw / 2 + 1.5, y, sw - 3, G.slotH, 6) : g.rect(cx - sw / 2 + 1.5, y, sw - 3, G.slotH);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
        g.fillStyle = m < 1 ? c2 : "#1b1530";
        g.font = `900 ${Math.max(9, Math.min(13, sw * 0.32))}px ui-rounded, system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(fmtMult(m).replace("×", ""), cx, y + G.slotH / 2 + 1);
      });

      // Kugeln
      const br = P.BALL_R * G.s;
      for (const b of balls) {
        const alpha = b.landed ? Math.max(0, 1 - (b.fade || 0) / 0.35) : 1;
        b.trail.forEach(([x, y], k) => {
          g.fillStyle = `rgba(255,61,154,${(k / b.trail.length) * 0.25 * alpha})`;
          g.beginPath();
          g.arc(sx(x), sy(y), br * (0.5 + (k / b.trail.length) * 0.5), 0, Math.PI * 2);
          g.fill();
        });
        const x = sx(b.sim.x);
        const y = sy(b.sim.y);
        const grad = g.createRadialGradient(x - br * 0.35, y - br * 0.35, br * 0.1, x, y, br);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.5, "#ff9be0");
        grad.addColorStop(1, "#ff3d9a");
        g.globalAlpha = alpha;
        g.fillStyle = grad;
        g.shadowColor = "#ff3d9a";
        g.shadowBlur = 10;
        g.beginPath();
        g.arc(x, y, br, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      }
    }
    st.onResize = () => draw();

    // ---------- Eingaben ----------
    dropBtn.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      drop();
      clearTimeout(holdTimer);
      const repeat = () => {
        holdTimer = setTimeout(() => {
          if (drop()) repeat();
        }, 220);
      };
      holdTimer = setTimeout(repeat, 380);
    });
    const endHold = () => clearTimeout(holdTimer);
    dropBtn.addEventListener("pointerup", endHold);
    dropBtn.addEventListener("pointerleave", endHold);
    dropBtn.addEventListener("pointercancel", endHold);
    dropBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        drop();
      }
    });
    multiBtn.addEventListener("click", startMulti);
    function onKey(e) {
      if (ctx.isModalOpen()) return;
      if (e.code === "Space") {
        if (document.activeElement?.tagName === "BUTTON" && document.activeElement !== dropBtn) return;
        e.preventDefault();
        drop();
      }
    }
    window.addEventListener("keydown", onKey);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Plinko",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Jede Kugel kostet den gewählten Einsatz. Sie fällt durch 12 Reihen Pins und landet in einem der 13 Fächer; der Multiplikator des Fachs bestimmt die Auszahlung. Viele Kugeln dürfen gleichzeitig fallen (×10 oder Taste gedrückt halten)."),
          h("p", {}, "Ehrlich simuliert: Zufällig ist nur der Einwurf – eine kleine Abweichung der Startposition und des seitlichen Schwungs. Danach berechnet eine echte Kollisionssimulation (Kugel gegen Pins, Schwerkraft, Rückprall) den Weg. Genau diese Bewegung siehst du, und daraus ergibt sich das Fach."),
          h("h3", {}, "Risikostufen"),
          h(
            "table",
            {},
            h("thead", {}, h("tr", {}, h("th", {}, "Stufe"), h("th", {}, "Fächer (Rand → Mitte)"), h("th", {}, "Quote"))),
            h(
              "tbody",
              {},
              Object.values(RISKS).map((r) => h("tr", {}, h("td", {}, r.name), h("td", {}, r.mult.slice(0, 7).map(fmtMult).join(" · ")), h("td", {}, `${(rtpOf(r.mult) * 100).toFixed(1).replace(".", ",")} %`)))
            )
          ),
          h("p", {}, "Quote = langfristige Rückzahlung, gemessen mit 400.000 simulierten Würfen. Ein Fach am Rand trifft nur etwa jede 1.300. Kugel (je Seite). Multiplikatoren unter 1 sind ein Verlust, auch wenn ein Teil des Einsatzes zurückkommt.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    setPhase();
    geom();
    draw();

    return {
      finalize() {
        // Kugeln im Flug: dieselbe Simulation zu Ende rechnen und abrechnen.
        for (const b of balls) {
          if (!b.ticket) continue;
          while (!b.sim.done) P.stepBall(b.sim);
          economy.settle(b.ticket, payoutFor(b.bet, RISKS[b.risk].mult[b.sim.slot]));
          b.ticket = null;
        }
      },
      pause() {
        stopMulti();
        clearTimeout(holdTimer);
      },
      destroy() {
        dead = true;
        stopMulti();
        clearTimeout(holdTimer);
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
