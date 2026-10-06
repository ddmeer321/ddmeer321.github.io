// Turmbau – Stacker-Automat. Logik in logic.js (deterministisch, kein Zufall).

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import * as S from "./logic.js";

const ENTRY = 20;
const MINOR = 50;
const MAJOR = 300;

export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    let dead = false;
    const stage = h("div.game-stage.arcade-stage", { style: { "--ac": "var(--lime)" } });
    const controls = h("div.game-controls");
    const status = h("div.status-line", {}, `Startgebühr ${ENTRY} · Zwischenpreis ${MINOR} · Jackpot ${MAJOR}`);
    const stopBtn = h("button.btn.btn-primary.btn-lg", { type: "button", style: { minWidth: "200px" } }, "Stopp");
    controls.append(status, stopBtn);
    root.append(stage, controls);
    const st = createStage(stage);
    const g = st.ctx;

    let gm = null;
    let phase = "menu"; // menu | play | choice | over
    let ticket = null;
    let acc = 0;
    let falling = [];
    let flashT = 0;
    let overlay = null;
    let blink = 0;

    function showOverlay(nodes) {
      overlay?.remove();
      overlay = h("div.arcade-overlay", {}, nodes);
      stage.append(overlay);
    }

    function menu(text) {
      showOverlay([
        h("h3.neon-title", {}, text || "Turmbau"),
        h("p", {}, `Stoppe die wandernden Blöcke genau über dem Turm. Überstehende Teile fallen ab. In Reihe ${S.MINOR_ROW} kannst du ${MINOR} Credits mitnehmen oder um den Jackpot (${MAJOR}) in Reihe ${S.ROWS} weiterbauen.`),
        h("button.btn.btn-primary.btn-lg", { type: "button", onclick: start }, `Start · ${ENTRY} Credits`),
        h("p", { style: { fontSize: "12px" } }, `Bestwert: Reihe ${ctx.progression.best("stacker")}`),
      ]);
    }

    function start() {
      if (phase === "play") return;
      const check = economy.validateBet(ENTRY, { min: ENTRY, max: ENTRY });
      if (!check.ok) {
        play("ui.error");
        ctx.toast("Nicht genug Credits", { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("stacker", ENTRY, { min: ENTRY, max: ENTRY });
      if (!ticket) return;
      overlay?.remove();
      overlay = null;
      gm = S.createGame();
      falling = [];
      acc = 0;
      phase = "play";
      play("coin.insert");
      haptic("impulse");
      status.textContent = "Stopp drücken, wenn die Blöcke über dem Turm stehen";
      stopBtn.disabled = false;
      loop.start();
    }

    function stop() {
      if (phase !== "play" || !gm) return;
      const row = gm.row;
      const res = S.place(gm);
      const { cellX, cellY, cs } = geom();
      for (const c of res.lost) falling.push({ x: cellX(c), y: cellY(row), vy: 0, t: 0, cs });
      if (res.lost.length) {
        play("stack.chop");
        haptic("impulse");
      }
      if (res.kept.length) {
        play(res.perfect ? "stack.perfect" : "stack.place", { pitch: 1 + row * 0.06, semi: row });
        haptic(res.perfect ? "success" : "tap");
        flashT = 0.25;
      }
      ctx.progression.setBest("stacker", gm.row);
      if (gm.over) {
        if (gm.won) finish(MAJOR, "Jackpot!");
        else finish(0, "Eingestürzt");
        return;
      }
      if (gm.row === S.MINOR_ROW) {
        phase = "choice";
        stopBtn.disabled = true;
        play("win.small");
        showOverlay([
          h("h3.neon-title", {}, "Zwischenpreis!"),
          h("p", {}, `Reihe ${S.MINOR_ROW} geschafft. Nimm ${MINOR} Credits mit – oder riskiere sie für den Jackpot von ${MAJOR} Credits.`),
          h("button.btn.btn-gold.btn-lg", { type: "button", onclick: () => finish(MINOR, "Gewinn eingesteckt") }, `${MINOR} nehmen`),
          h(
            "button.btn.btn-primary",
            {
              type: "button",
              onclick: () => {
                overlay.remove();
                overlay = null;
                phase = "play";
                stopBtn.disabled = false;
                play("go");
              },
            },
            "Weiter zum Jackpot"
          ),
        ]);
      }
    }

    function finish(prize, title) {
      phase = "over";
      stopBtn.disabled = true;
      if (ticket) {
        economy.settle(ticket, prize);
        ticket = null;
      }
      ctx.progression.addXp(gm ? gm.row * 2 : 0);
      const r = stage.getBoundingClientRect();
      if (prize >= MAJOR) {
        ctx.progression.award("stacker-top");
        play("win.big");
        haptic("big");
        particles.burst(r.left + r.width / 2, r.top + r.height * 0.3, { kind: "confetti", count: 90, spread: 2 });
      } else if (prize > 0) {
        play("win.medium");
        haptic("success");
      } else {
        play("lose");
        haptic("heavy");
      }
      if (prize > 0) particles.coinsToBalance(r.left + r.width / 2, r.top + r.height / 2, Math.min(18, prize / 15));
      status.textContent = prize ? `+${prize} Credits` : `Erreicht: Reihe ${gm?.row ?? 0}`;
      setTimeout(() => {
        if (dead) return;
        menu(`${title}${prize ? ` +${prize}` : ""}`);
      }, prize >= MAJOR ? 1400 : 700);
    }

    function geom() {
      const W = st.width;
      const H = st.height;
      const cs = Math.min((W * 0.86) / S.COLS, (H * 0.86) / S.ROWS);
      const x0 = (W - cs * S.COLS) / 2;
      const y0 = (H - cs * S.ROWS) / 2 + 6;
      return { W, H, cs, x0, y0, cellX: (c) => x0 + c * cs, cellY: (r) => y0 + (S.ROWS - 1 - r) * cs };
    }

    function cell(x, y, cs, color, on) {
      const p = cs * 0.08;
      g.fillStyle = on ? color : "rgba(255,255,255,.05)";
      if (on) {
        g.shadowColor = color;
        g.shadowBlur = cs * 0.35;
      }
      g.beginPath();
      g.roundRect ? g.roundRect(x + p, y + p, cs - 2 * p, cs - 2 * p, cs * 0.12) : g.rect(x + p, y + p, cs - 2 * p, cs - 2 * p);
      g.fill();
      g.shadowBlur = 0;
      if (on) {
        g.fillStyle = "rgba(255,255,255,.35)";
        g.fillRect(x + p * 2, y + p * 2, cs * 0.3, cs * 0.12);
      }
    }

    function colorFor(r) {
      return r >= S.ROWS - 1 ? "#ff3d9a" : r >= S.MINOR_ROW ? "#2de2e6" : r >= S.MINOR_ROW - 1 ? "#ffc53d" : "#8cff5a";
    }

    function draw() {
      st.begin();
      const { W, H, cs, x0, y0, cellX, cellY } = geom();
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#07040e";
      g.fillRect(x0 - 8, y0 - 8, cs * S.COLS + 16, cs * S.ROWS + 16);
      // Preiszeilen
      for (const [r, label, col] of [
        [S.ROWS - 1, `JACKPOT ${MAJOR}`, "#ff3d9a"],
        [S.MINOR_ROW - 1, `PREIS ${MINOR}`, "#ffc53d"],
      ]) {
        g.fillStyle = col;
        g.globalAlpha = 0.14;
        g.fillRect(x0, cellY(r), cs * S.COLS, cs);
        g.globalAlpha = 1;
        g.strokeStyle = col;
        g.lineWidth = 1;
        g.strokeRect(x0, cellY(r), cs * S.COLS, cs);
      }
      for (let r = 0; r < S.ROWS; r++) for (let c = 0; c < S.COLS; c++) cell(cellX(c), cellY(r), cs, "", false);
      if (gm) {
        gm.stack.forEach((cells, r) => {
          for (const c of cells) cell(cellX(c), cellY(r), cs, colorFor(r), true);
        });
        if (phase === "play" && !gm.over) {
          for (let i = 0; i < gm.width; i++) cell(cellX(gm.pos + i), cellY(gm.row), cs, flashT > 0 ? "#fff" : colorFor(gm.row), true);
        }
      }
      for (const f of falling) {
        g.globalAlpha = Math.max(0, 1 - f.t / 0.9);
        cell(f.x, f.y, f.cs, "#ff5a5a", true);
        g.globalAlpha = 1;
      }
      // Beschriftung
      g.font = `900 ${Math.max(10, cs * 0.32)}px ui-rounded, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = blink % 1 < 0.5 ? "#fff" : "rgba(255,255,255,.6)";
      g.fillText(`JACKPOT ${MAJOR}`, W / 2, cellY(S.ROWS - 1) + cs / 2);
      g.fillText(`PREIS ${MINOR}`, W / 2, cellY(S.MINOR_ROW - 1) + cs / 2);
    }
    st.onResize = draw;

    const loop = createLoop((dt) => {
      blink += dt;
      if (phase === "play" && gm && !gm.over) {
        acc += dt * 1000;
        const ms = S.stepMs(gm.row);
        while (acc >= ms) {
          acc -= ms;
          S.advance(gm);
          play("cyclone.tick", { pitch: 0.6 + gm.row * 0.04, vol: 0.6 });
        }
      }
      flashT = Math.max(0, flashT - dt);
      for (const f of falling) {
        f.t += dt;
        f.vy += 1400 * dt;
        f.y += f.vy * dt;
      }
      falling = falling.filter((f) => f.t < 0.9);
      draw();
      if ((phase === "menu" || phase === "over") && !falling.length) loop.stop();
    });

    stopBtn.addEventListener("click", stop);
    stage.addEventListener("pointerdown", (e) => {
      if (phase === "play" && !overlay) {
        e.preventDefault();
        stop();
      }
    });
    function onKey(e) {
      if (ctx.isModalOpen() || e.repeat) return;
      if (e.code === "Space" || e.key === "Enter") {
        if (phase === "play") {
          e.preventDefault();
          stop();
        }
      }
    }
    window.addEventListener("keydown", onKey);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Turmbau",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Eine Reihe Blöcke wandert hin und her. Tippe (oder Leertaste/„Stopp“), um sie anzuhalten. Nur Blöcke, die auf der Reihe darunter stehen, bleiben liegen – der Rest fällt ab. Ohne Block ist das Spiel vorbei."),
          h("p", {}, `Mit jeder Reihe wird es schneller; ab Reihe 5 sind höchstens zwei, ab Reihe 10 nur noch ein Block unterwegs. Reihe ${S.MINOR_ROW}: ${MINOR} Credits mitnehmen oder weiter. Reihe ${S.ROWS}: Jackpot ${MAJOR} Credits.`),
          h("p", {}, "Die Bewegung ist vollständig gleichmäßig und vorhersehbar – kein Zufall, reines Timing.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    stopBtn.disabled = true;
    menu();
    draw();

    return {
      finalize() {
        // Verlassen mitten im Spiel: erreichter Zwischenpreis zählt, sonst verfällt der Einsatz
        if (ticket) {
          economy.settle(ticket, phase === "choice" ? MINOR : 0);
          ticket = null;
        }
      },
      destroy() {
        dead = true;
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
