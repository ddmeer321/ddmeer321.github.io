// Neon Hoops – Basketball-Skillgame. Physik in physics.js (deterministisch).

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import * as B from "./physics.js";

import { ENTRY, ROUND_TIME, FINAL_SPURT, MOVING_FROM, READY_TIME, STREAK_FOR_X2, PRIZES, multiplier as streakMult, pointsFor, prizeFor } from "./scoring.js";

export { prizeFor };

const FIXED_DT = 1 / 240;
const CAM = { x: 0, y: 1.6, z: -2.0 };



export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    let dead = false;

    // ---------- DOM ----------
    const stage = h("div.game-stage.arcade-stage", { style: { "--ac": "var(--orange)" } });
    const timeVal = h("strong.num", {}, String(ROUND_TIME));
    const scoreVal = h("strong.num", {}, "0");
    const multVal = h("strong.num", {}, "×1");
    stage.append(
      h(
        "div.arcade-hud",
        {},
        h("div.slot-display", {}, h("small", {}, "Zeit"), timeVal),
        h("div.slot-display", {}, h("small", {}, "Punkte"), scoreVal),
        h("div.slot-display", {}, h("small", {}, "Serie"), multVal)
      )
    );
    const hint = h("div.arcade-hint", {}, "Ball nach oben Richtung Korb wischen");
    stage.append(hint);
    const controls = h("div.game-controls");
    const status = h("div.status-line", {}, `Startgebühr ${ENTRY} Credits · ${ROUND_TIME} Sekunden`);
    controls.append(status);
    root.append(stage, controls);

    const st = createStage(stage);
    const g = st.ctx;

    // ---------- Zustand ----------
    let phase = "menu"; // menu | countdown | play | over
    ctx.setPhase(phase);
    let ticket = null;
    let timeLeft = ROUND_TIME;
    let clock = 0; // Spielzeit (für Ringbewegung)
    let score = 0;
    let baskets = 0;
    let streak = 0;
    let bestStreak = 0;
    let swishes = 0;
    let balls = [];
    let ready = true; // Ball liegt bereit
    let readyIn = 0;
    let acc = 0;
    let countdown = 0;
    let netPulse = 0;
    let trail = [];
    let drag = null;
    let flashes = [];
    let overlay = null;

    // ---------- Projektion ----------
    function f() {
      return Math.min(st.height * 0.95, st.width * 1.6);
    }
    function horizon() {
      return st.height * 0.6;
    }
    function proj(x, y, z) {
      const d = Math.max(0.05, z - CAM.z);
      const F = f();
      return { x: st.width / 2 + (F * (x - CAM.x)) / d, y: horizon() - (F * (y - CAM.y)) / d, s: F / d };
    }

    // ---------- Overlays ----------
    function showOverlay(kind, info = {}) {
      overlay?.remove();
      let body;
      if (kind === "menu") {
        body = [
          h("h3.neon-title", {}, "Neon Hoops"),
          h("p", {}, `Wische den Ball nach oben Richtung Korb. Tempo = Wurfkraft, Richtung = Ziel. ${ROUND_TIME} Sekunden, Serien geben Multiplikatoren, ab ${MOVING_FROM} Punkten bewegt sich der Korb.`),
          h("div.prize-table", {}, PRIZES.slice().reverse().map(([min, prize]) => [h("span", {}, `ab ${min} Punkten`), h("b.num", {}, `${prize} Credits`)])),
          h("button.btn.btn-primary.btn-lg", { type: "button", onclick: start }, `Start · ${ENTRY} Credits`),
          h("p", { style: { fontSize: "12px" } }, `Bestwert: ${ctx.fmt(ctx.progression.best("hoops"))} Punkte`),
        ];
      } else {
        const prize = prizeFor(info.score);
        body = [
          h("h3.neon-title", {}, info.newBest ? "Neuer Rekord!" : "Zeit!"),
          h("div.big-num.num", {}, ctx.fmt(info.score)),
          h("p", {}, `${info.baskets} Körbe · beste Serie ${info.bestStreak} · Bestwert ${ctx.fmt(ctx.progression.best("hoops"))}`),
          h("p", { style: { color: prize ? "var(--gold)" : "var(--ink-dim)", fontWeight: 900, fontSize: "1.2rem" } }, prize ? `Gewinn: ${prize} Credits` : "Diesmal kein Preis"),
          h("button.btn.btn-primary.btn-lg", { type: "button", onclick: start }, `Nochmal · ${ENTRY} Credits`),
        ];
      }
      overlay = h("div.arcade-overlay", {}, body);
      stage.append(overlay);
    }

    function start() {
      if (phase === "play" || phase === "countdown") return;
      const check = economy.validateBet(ENTRY, { min: ENTRY, max: ENTRY });
      if (!check.ok) {
        play("ui.error");
        ctx.toast("Nicht genug Credits für die Startgebühr", { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("hoops", ENTRY, { min: ENTRY, max: ENTRY });
      if (!ticket) return;
      play("coin.insert");
      haptic("impulse");
      overlay?.remove();
      overlay = null;
      score = 0;
      baskets = 0;
      streak = 0;
      bestStreak = 0;
      swishes = 0;
      timeLeft = ROUND_TIME;
      clock = 0;
      balls = [];
      ready = true;
      flashes = [];
      updateHud();
      phase = "countdown";
      ctx.setPhase(phase);
      countdown = 3;
      play("count");
      status.textContent = "Bereit machen …";
      loop.start();
    }

    function multiplier() {
      return streakMult(streak);
    }

    function updateHud() {
      timeVal.textContent = String(Math.max(0, Math.ceil(timeLeft)));
      timeVal.style.color = timeLeft <= FINAL_SPURT && phase === "play" ? "var(--red)" : "";
      scoreVal.textContent = ctx.fmt(score);
      multVal.textContent = `×${multiplier()}${timeLeft <= FINAL_SPURT && phase === "play" ? "×2" : ""}`;
    }

    function flash(text) {
      const el = h("div.combo-flash", {}, text);
      stage.append(el);
      setTimeout(() => el.remove(), 900);
    }

    function endRound() {
      phase = "over";
      ctx.setPhase(phase);
      play("buzzer");
      haptic("heavy");
      const prize = prizeFor(score);
      if (ticket) {
        economy.settle(ticket, prize);
        ticket = null;
      }
      const newBest = ctx.progression.setBest("hoops", score);
      ctx.progression.setBest("hoops-streak", bestStreak);
      ctx.progression.addXp(Math.floor(score / 3));
      if (baskets >= 10) ctx.progression.award("hoops-10");
      ctx.report("hoops:round", { score, baskets, swishes, streak: bestStreak });
      setTimeout(() => {
        if (dead) return;
        ctx.celebrate({ stake: ENTRY, payout: prize, detail: `${score} Punkte`, banner: false });
      }, 450);
      status.textContent = `Ergebnis: ${score} Punkte${prize ? ` · +${prize} Credits` : ""}`;
      showOverlay("over", { score, baskets, bestStreak, newBest });
    }

    // ---------- Wurf-Eingabe ----------
    stage.addEventListener("pointerdown", (e) => {
      if (phase !== "play" || overlay) return;
      const p = st.toLocal(e.clientX, e.clientY);
      if (p.y < st.height * 0.35) return;
      stage.setPointerCapture?.(e.pointerId);
      drag = { id: e.pointerId, pts: [{ x: p.x, y: p.y, t: performance.now() }] };
      trail = [{ x: p.x, y: p.y, a: 1 }];
      e.preventDefault();
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = st.toLocal(e.clientX, e.clientY);
      drag.pts.push({ x: p.x, y: p.y, t: performance.now() });
      if (drag.pts.length > 60) drag.pts.shift();
      trail.push({ x: p.x, y: p.y, a: 1 });
      if (trail.length > 24) trail.shift();
    });
    const release = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const pts = drag.pts;
      drag = null;
      if (pts.length < 2) return;
      const end = pts[pts.length - 1];
      // Tempo über die letzten ~140 ms der Bewegung
      let i = pts.length - 1;
      while (i > 0 && end.t - pts[i - 1].t < 140) i--;
      const s0 = pts[i];
      const dt = Math.max(16, end.t - s0.t) / 1000;
      const Hs = st.height;
      const up = (s0.y - end.y) / Hs / dt;
      const side = (end.x - s0.x) / Hs / dt;
      window.__hoopsLastSwipe = { up, side };
      throwBall(up, side);
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", () => (drag = null));

    function throwBall(up, side) {
      if (!ready || phase !== "play") return;
      const vel = B.swipeToVelocity(up, side);
      if (!vel) return;
      const ball = B.createBall(vel);
      balls.push(ball);
      ready = false;
      readyIn = READY_TIME;
      hint.style.opacity = "0";
      play("ball.throw");
      haptic("tap");
    }

    // ---------- Simulation ----------
    function onEvent(ev, ball) {
      const pan = Math.max(-1, Math.min(1, ball.x * 2));
      if (ev.kind === "rim") {
        play("ball.rim", { vol: Math.min(1, 0.3 + ev.strength * 0.2), pan });
        haptic("impulse", Math.min(1, ev.strength * 0.3));
      } else if (ev.kind === "board") {
        play("ball.board", { vol: Math.min(1, 0.3 + ev.strength * 0.15), pan });
        haptic("tap");
      } else if (ev.kind === "floor") {
        play("ball.bounce", { vol: Math.min(1, ev.strength * 0.2), pan, pitch: 0.9 + Math.random() * 0.1 });
      } else if (ev.kind === "score") {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        baskets++;
        const pts = pointsFor({ swish: ball.swish, streak, spurt: timeLeft <= FINAL_SPURT });
        if (ball.swish) swishes++;
        score += pts;
        netPulse = 1;
        play("ball.swish", { vol: ball.swish ? 1 : 0.8 });
        haptic(ball.swish ? "success" : "impulse");
        const p = proj(B.rimXAt(clock, score >= MOVING_FROM), B.RIM.y, B.RIM.z);
        const r = stage.getBoundingClientRect();
        particles.floatText(r.left + p.x, r.top + p.y - 20, `+${pts}`, ball.swish ? "#2de2e6" : "#ffc53d");
        particles.burst(r.left + p.x, r.top + p.y, { kind: "sparks", count: ball.swish ? 18 : 10, color: "#ff8a3d" });
        if (ball.swish) flash("SWISH!");
        if (streak === STREAK_FOR_X2) flash("Serie ×2");
        if (streak >= 5) ctx.progression.award("hoops-combo");
        if (score >= MOVING_FROM && score - pts < MOVING_FROM) flash("Korb in Bewegung!");
        updateHud();
      }
    }

    const loop = createLoop((dt) => {
      if (phase === "countdown") {
        const before = Math.ceil(countdown);
        countdown -= dt;
        const now = Math.ceil(countdown);
        if (now !== before && now > 0) {
          play("count");
          haptic("tick");
        }
        if (countdown <= 0) {
          phase = "play";
          ctx.setPhase(phase);
          play("go");
          haptic("impulse");
          status.textContent = "Wirf!";
          flash("LOS!");
        }
      } else if (phase === "play") {
        const before = Math.ceil(timeLeft);
        timeLeft -= dt;
        clock += dt;
        if (Math.ceil(timeLeft) !== before) {
          if (timeLeft <= 5 && timeLeft > 0) play("count", { vol: 0.6 });
          if (Math.ceil(timeLeft) === FINAL_SPURT) flash("Endspurt ×2");
          updateHud();
        }
        if (timeLeft <= 0) {
          timeLeft = 0;
          updateHud();
          endRound();
        }
      }
      if (!ready) {
        readyIn -= dt;
        if (readyIn <= 0) ready = true;
      }
      // feste Physikschritte
      acc += dt;
      let n = 0;
      const moving = score >= MOVING_FROM;
      while (acc >= FIXED_DT && n < 16) {
        acc -= FIXED_DT;
        n++;
        const rx = B.rimXAt(clock, moving);
        for (const b of balls) {
          const wasScored = b.scored;
          for (const ev of B.stepBall(b, FIXED_DT, rx)) onEvent(ev, b);
          if (b.done && !wasScored && !b.scored && !b.counted) {
            b.counted = true;
            if (phase === "play") {
              if (streak >= STREAK_FOR_X2) flash("Serie gerissen");
              streak = 0;
              updateHud();
            }
          }
        }
      }
      if (n === 16) acc = 0;
      balls = balls.filter((b) => !b.done || b.t < 0);
      netPulse = Math.max(0, netPulse - dt * 2.5);
      for (const t of trail) t.a -= dt * 3;
      trail = trail.filter((t) => t.a > 0);
      draw();
      if (phase === "over" || phase === "menu") {
        if (!balls.length && !trail.length) loop.stop();
      }
    });

    // ---------- Zeichnen ----------
    function line3(a, b) {
      const p = proj(...a);
      const q = proj(...b);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
      g.stroke();
    }

    function drawBall(b) {
      const p = proj(b.x, b.y, b.z);
      const r = B.BALL_R * p.s;
      // Schatten
      const sh = proj(b.x, 0, b.z);
      const hgt = Math.max(0, b.y);
      g.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.4 - hgt * 0.1)})`;
      g.beginPath();
      g.ellipse(sh.x, sh.y, r * (1 + hgt * 0.15), r * 0.35, 0, 0, Math.PI * 2);
      g.fill();
      const grad = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, "#ffb070");
      grad.addColorStop(0.6, "#ff7a1a");
      grad.addColorStop(1, "#a83a00");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.clip();
      g.strokeStyle = "rgba(60,20,0,.85)";
      g.lineWidth = Math.max(1, r * 0.07);
      const a = b.spin;
      g.beginPath();
      g.ellipse(p.x, p.y, r, Math.abs(Math.cos(a)) * r, 0, 0, Math.PI * 2);
      g.moveTo(p.x - r, p.y);
      g.lineTo(p.x + r, p.y);
      g.stroke();
      g.beginPath();
      g.ellipse(p.x + Math.sin(a) * r * 0.5, p.y, Math.abs(Math.cos(a * 0.7)) * r * 0.8, r, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    function drawRim(rx, front) {
      const n = 28;
      g.strokeStyle = "#ff6a00";
      g.lineWidth = Math.max(2, B.RIM.tube * 2 * proj(rx, B.RIM.y, B.RIM.z).s);
      g.shadowColor = "#ff6a00";
      g.shadowBlur = 8;
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = front ? Math.PI + (i / n) * Math.PI : (i / n) * Math.PI;
        const p = proj(rx + Math.cos(a) * B.RIM.r, B.RIM.y, B.RIM.z + Math.sin(a) * B.RIM.r);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
      g.shadowBlur = 0;
    }

    function drawNet(rx) {
      const n = 12;
      const depth = 0.42 + netPulse * 0.12;
      const sway = netPulse * 0.04;
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = 1;
      const top = [];
      const bot = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        top.push([rx + Math.cos(a) * B.RIM.r, B.RIM.y, B.RIM.z + Math.sin(a) * B.RIM.r]);
        bot.push([rx + Math.cos(a) * B.RIM.r * 0.55 + sway, B.RIM.y - depth, B.RIM.z + Math.sin(a) * B.RIM.r * 0.55]);
      }
      for (let i = 0; i < n; i++) {
        line3(top[i], bot[(i + 1) % n]);
        line3(top[(i + 1) % n], bot[i]);
      }
      g.beginPath();
      bot.forEach((b, i) => {
        const p = proj(...b);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      });
      g.closePath();
      g.stroke();
    }

    function draw() {
      st.begin();
      const W = st.width;
      const H = st.height;
      g.clearRect(0, 0, W, H);
      const moving = score >= MOVING_FROM;
      const rx = B.rimXAt(clock, moving);

      // Käfig / Raum
      const zFar = B.BOARD.z + 0.3;
      g.strokeStyle = "rgba(255,138,61,.16)";
      g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        const z = -0.6 + (i / 8) * (zFar + 0.6);
        line3([-1.2, 0, z], [-1.2, 3.6, z]);
        line3([1.2, 0, z], [1.2, 3.6, z]);
        line3([-1.2, 0, z], [1.2, 0, z]);
      }
      for (let y = 0; y <= 3.6; y += 0.45) {
        line3([-1.2, y, -0.6], [-1.2, y, zFar]);
        line3([1.2, y, -0.6], [1.2, y, zFar]);
      }
      // Rückwand
      const w0 = proj(-1.2, 3.6, zFar);
      const w1 = proj(1.2, 0, zFar);
      const wg = g.createLinearGradient(0, w0.y, 0, w1.y);
      wg.addColorStop(0, "#1a0f33");
      wg.addColorStop(1, "#2a1347");
      g.fillStyle = wg;
      g.fillRect(w0.x, w0.y, w1.x - w0.x, w1.y - w0.y);
      // Rampe
      const r0 = proj(-0.8, 0.02, 0.15);
      const r1 = proj(0.8, 0.02, 0.15);
      const r2 = proj(0.8, 0.02, 1.6);
      const r3 = proj(-0.8, 0.02, 1.6);
      g.fillStyle = "rgba(255,138,61,.08)";
      g.beginPath();
      g.moveTo(r0.x, r0.y);
      g.lineTo(r1.x, r1.y);
      g.lineTo(r2.x, r2.y);
      g.lineTo(r3.x, r3.y);
      g.fill();

      // Brett
      const b0 = proj(rx - B.BOARD.halfW, B.BOARD.y1, B.BOARD.z);
      const b1 = proj(rx + B.BOARD.halfW, B.BOARD.y0, B.BOARD.z);
      g.fillStyle = "rgba(255,255,255,.1)";
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.fillRect(b0.x, b0.y, b1.x - b0.x, b1.y - b0.y);
      g.strokeRect(b0.x, b0.y, b1.x - b0.x, b1.y - b0.y);
      const t0 = proj(rx - 0.2, B.RIM.y + 0.42, B.BOARD.z);
      const t1 = proj(rx + 0.2, B.RIM.y + 0.05, B.BOARD.z);
      g.strokeStyle = netPulse > 0 ? "#ffde59" : "#ff3d9a";
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = 10;
      g.strokeRect(t0.x, t0.y, t1.x - t0.x, t1.y - t0.y);
      g.shadowBlur = 0;
      // Halterung
      g.strokeStyle = "#7d6f9c";
      g.lineWidth = 3;
      line3([rx, B.RIM.y, B.BOARD.z], [rx, B.RIM.y, B.RIM.z + B.RIM.r]);

      // Anzeigetafel
      const sb = proj(rx, B.BOARD.y1 + 0.22, B.BOARD.z);
      g.fillStyle = "#000";
      g.fillRect(sb.x - 46, sb.y - 16, 92, 30);
      g.strokeStyle = "#ff8a3d";
      g.lineWidth = 1;
      g.strokeRect(sb.x - 46, sb.y - 16, 92, 30);
      g.font = "900 20px ui-monospace, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#ff3d3d";
      g.shadowColor = "#ff3d3d";
      g.shadowBlur = 8;
      g.fillText(String(score).padStart(3, "0"), sb.x, sb.y);
      g.shadowBlur = 0;

      // Tiefenordnung: Bälle hinter dem Ring zuerst
      const behind = balls.filter((b) => b.z > B.RIM.z);
      const front = balls.filter((b) => b.z <= B.RIM.z);
      drawRim(rx, false);
      for (const b of behind) drawBall(b);
      drawNet(rx);
      drawRim(rx, true);
      for (const b of front.sort((a, c) => c.z - a.z)) drawBall(b);

      // bereitliegender Ball
      if (ready && (phase === "play" || phase === "countdown")) {
        drawBall({ x: B.START.x, y: B.START.y, z: B.START.z, spin: 0.3 });
      }

      // Swipe-Spur
      if (trail.length > 1) {
        g.lineCap = "round";
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          g.strokeStyle = `rgba(45,226,230,${Math.max(0, b.a) * 0.6})`;
          g.lineWidth = 2 + i * 0.4;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      }
      if (phase === "countdown") {
        g.font = "900 72px ui-rounded, system-ui, sans-serif";
        g.fillStyle = "#fff";
        g.shadowColor = "#ff8a3d";
        g.shadowBlur = 20;
        g.fillText(String(Math.max(1, Math.ceil(countdown))), W / 2, H * 0.42);
        g.shadowBlur = 0;
      }
    }
    st.onResize = draw;

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Neon Hoops",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Wische vom unteren Bildschirmbereich nach oben in Richtung Korb. Die Geschwindigkeit am Ende des Wischens bestimmt die Wurfkraft, die Richtung (leicht schräg) das seitliche Ziel. Der Abwurfwinkel ist immer gleich."),
          h("p", {}, "Gleicher Wisch = gleicher Wurf. Es gibt keinen Zufall und keine versteckte Trefferhilfe – nur deine Hand und die Physik (Schwerkraft, Ring, Brett)."),
          h("h3", {}, "Punkte"),
          h("p", {}, `Korb 2 Punkte, Swish (ohne Ring/Brett) 3 Punkte. Ab ${STREAK_FOR_X2} Treffern in Folge zählt jeder Korb doppelt; ein Fehlwurf beendet die Serie. In den letzten ${FINAL_SPURT} Sekunden zählt alles doppelt. Ab ${MOVING_FROM} Punkten pendelt der Korb – gleichmäßig und vorhersehbar. Startgebühr ${ENTRY} Credits.`),
          h("h3", {}, "Preise"),
          h("div.prize-table", {}, PRIZES.slice().reverse().map(([min, prize]) => [h("span", {}, `ab ${min} Punkten`), h("b.num", {}, `${prize} Credits`)]))
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    showOverlay("menu");
    draw();

    return {
      finalize() {
        if (ticket) {
          economy.settle(ticket, prizeFor(score));
          ticket = null;
        }
      },
      destroy() {
        dead = true;
        loop.destroy();
        st.destroy();
      },
    };
  },
};
