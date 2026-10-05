// Lichtwirbel – Timing-Automat. Ein Licht läuft im Kreis; wer es auf dem
// Jackpot-Feld stoppt, gewinnt am meisten. Die Bewegung ist gleichmäßig und
// vorhersehbar; das Ergebnis hängt nur vom Zeitpunkt des Tippens ab.

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { createBetControl } from "../../ui/betControl.js";

const N = 36;
const BASE_LAP = 2.2; // Sekunden pro Runde
const PAYS = [
  { dist: 0, mult: 25, label: "Jackpot" },
  { dist: 1, mult: 4, label: "Nah dran" },
  { dist: 2, mult: 1, label: "Einsatz zurück" },
];
const STEPS = [10, 20, 50, 100];

export function cycloneMultiplier(index) {
  const d = Math.min(index, N - index);
  const p = PAYS.find((x) => x.dist === d);
  return p ? p.mult : 0;
}

export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    const data = ctx.data;
    let dead = false;
    const stage = h("div.game-stage.arcade-stage", { style: { "--ac": "var(--violet)" } });
    const streakVal = h("strong.num", {}, "0");
    const lapVal = h("strong.num", {}, "1,0×");
    stage.append(h("div.arcade-hud", {}, h("div.slot-display", {}, h("small", {}, "Jackpot-Serie"), streakVal), h("div.slot-display", {}, h("small", {}, "Tempo"), lapVal)));
    const controls = h("div.game-controls");
    const betCtl = createBetControl({
      steps: STEPS,
      value: Number(data.bet) || 10,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
      },
    });
    const actBtn = h("button.btn.btn-primary.btn-lg", { type: "button", style: { minWidth: "150px" } }, "Start");
    const status = h("div.status-line", {}, "Start drücken, dann im richtigen Moment stoppen");
    controls.append(status, h("div.ctrl-group", {}, betCtl.el, actBtn));
    root.append(stage, controls);
    const st = createStage(stage);
    const g = st.ctx;

    let phase = "idle"; // idle | running | stopped
    let pos = 0; // Licht-Position in Zellen (float)
    let ticket = null;
    let streak = 0;
    let lap = BASE_LAP;
    let result = null;
    let resultT = 0;
    let lastCell = 0;
    let t = 0;

    function speedFactor() {
      return BASE_LAP / lap;
    }

    function updateHud() {
      streakVal.textContent = String(streak);
      lapVal.textContent = speedFactor().toLocaleString("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 1 }) + "×";
    }

    function act() {
      if (phase === "running") return stopLight();
      const bet = betCtl.value;
      const check = economy.validateBet(bet, { min: STEPS[0], max: STEPS[STEPS.length - 1] });
      if (!check.ok) {
        play("ui.error");
        ctx.toast(check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("cyclone", bet, { min: STEPS[0], max: STEPS[STEPS.length - 1] });
      if (!ticket) return;
      play("coin.insert");
      haptic("impulse");
      phase = "running";
      result = null;
      // Start immer an derselben Stelle (gegenüber dem Jackpot)
      pos = N / 2;
      lastCell = Math.floor(pos);
      actBtn.textContent = "Stopp!";
      actBtn.classList.add("btn-gold");
      betCtl.setDisabled(true);
      status.textContent = "Jetzt stoppen!";
      loop.start();
    }

    function stopLight() {
      if (phase !== "running" || !ticket) return;
      const idx = Math.floor(pos) % N;
      const mult = cycloneMultiplier(idx);
      const bet = ticket.stake;
      economy.settle(ticket, bet * mult);
      ticket = null;
      phase = "stopped";
      result = { idx, mult };
      resultT = 0;
      actBtn.textContent = "Nochmal";
      actBtn.classList.remove("btn-gold");
      betCtl.setDisabled(false);
      betCtl.fitToBalance();
      play("reel.stop", { pitch: 1.2 });
      haptic("heavy");
      const r = stage.getBoundingClientRect();
      if (mult >= 25) {
        streak++;
        lap = Math.max(0.9, lap * 0.86);
        ctx.progression.award("cyclone-jackpot");
        ctx.progression.setBest("cyclone-streak", streak);
        play("win.big");
        haptic("big");
        particles.burst(r.left + r.width / 2, r.top + r.height / 2, { kind: "confetti", count: 80, spread: 2 });
        particles.coinsToBalance(r.left + r.width / 2, r.top + r.height / 2, 16);
        ctx.banner({ title: "Jackpot!", sub: `+${ctx.fmt(bet * mult)}`, ms: 2200 });
        status.textContent = "Jackpot! Das Licht wird schneller …";
      } else {
        if (streak > 0) status.textContent = "Serie vorbei – Tempo zurückgesetzt";
        streak = 0;
        lap = BASE_LAP;
        if (mult > 1) {
          play("win.medium");
          haptic("success");
          particles.coinsToBalance(r.left + r.width / 2, r.top + r.height / 2, 8);
          status.textContent = `Knapp! ${mult}× = +${ctx.fmt(bet * mult)}`;
        } else if (mult === 1) {
          play("push");
          status.textContent = "Einsatz zurück";
        } else {
          play("lose");
          status.textContent = `Daneben (${Math.min(idx, N - idx)} Felder entfernt)`;
        }
      }
      updateHud();
      ctx.progression.addXp(2);
    }

    function geom() {
      const W = st.width;
      const H = st.height;
      const R = Math.min(W, H) * 0.38;
      return { W, H, R, cx: W / 2, cy: H / 2 + 20 };
    }

    function draw() {
      st.begin();
      const { W, H, R, cx, cy } = geom();
      g.clearRect(0, 0, W, H);
      // Schale
      const dish = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      dish.addColorStop(0, "#2a1a4a");
      dish.addColorStop(1, "#0b0614");
      g.fillStyle = dish;
      g.beginPath();
      g.arc(cx, cy, R * 1.2, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(226,209,255,.4)";
      g.lineWidth = 2;
      g.stroke();
      const cur = Math.floor(pos) % N;
      const br = Math.max(5, R * 0.075);
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R;
        const m = cycloneMultiplier(i);
        const base = m >= 25 ? "#ffc53d" : m >= 4 ? "#ff3d9a" : m >= 1 ? "#2de2e6" : "#5b4a8a";
        // Nachleuchten hinter dem Licht
        const back = (cur - i + N) % N;
        let on = phase !== "idle" && back < 5 ? 1 - back / 5 : 0;
        if (result && i === result.idx) on = 0.6 + 0.4 * Math.sin(resultT * 12);
        if (phase === "idle") on = m > 0 ? 0.35 + 0.25 * Math.sin(t * 3 + i) : 0;
        g.fillStyle = base;
        g.globalAlpha = 0.25 + on * 0.75;
        if (on > 0.5) {
          g.shadowColor = base;
          g.shadowBlur = br * 3;
        }
        g.beginPath();
        g.arc(x, y, m >= 25 ? br * 1.45 : br, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
        if (on >= 0.99 || (result && i === result.idx)) {
          g.fillStyle = "#fff";
          g.beginPath();
          g.arc(x, y, br * 0.45, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Mitte
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `900 ${R * 0.22}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = "#ffc53d";
      g.shadowColor = "#ffc53d";
      g.shadowBlur = 14;
      g.fillText(result ? (result.mult ? `${result.mult}×` : "—") : "25×", cx, cy - R * 0.08);
      g.shadowBlur = 0;
      g.font = `800 ${R * 0.09}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = "#e2d1ff";
      g.fillText(result ? (PAYS.find((p) => p.mult === result.mult)?.label || "Daneben") : "JACKPOT OBEN", cx, cy + R * 0.16);
    }
    st.onResize = draw;

    const loop = createLoop((dt) => {
      t += dt;
      if (phase === "running") {
        pos = (pos + (N / lap) * dt) % N;
        const c = Math.floor(pos);
        if (c !== lastCell) {
          lastCell = c;
          play("cyclone.tick", { pitch: c === 0 ? 1.6 : 1, vol: c === 0 ? 1 : 0.55 });
          if (c === 0) haptic("tick");
        }
      }
      if (result) resultT += dt;
      draw();
      if (phase !== "running" && resultT > 2) loop.stop();
    });

    actBtn.addEventListener("click", act);
    stage.addEventListener("pointerdown", (e) => {
      if (phase === "running") {
        e.preventDefault();
        stopLight();
      }
    });
    function onKey(e) {
      if (ctx.isModalOpen() || e.repeat) return;
      if (e.code === "Space" || e.key === "Enter") {
        if (document.activeElement?.tagName === "BUTTON" && document.activeElement !== actBtn) return;
        e.preventDefault();
        act();
      }
    }
    window.addEventListener("keydown", onKey);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Lichtwirbel",
        body: h(
          "div.help-text",
          {},
          h("p", {}, `Ein Licht läuft gleichmäßig im Kreis über ${N} Felder. Tippe (oder Leertaste), um es anzuhalten. Es startet immer gegenüber dem Jackpot – mit Rhythmusgefühl kannst du lernen, wann du drücken musst.`),
          h("table", {}, h("tbody", {}, PAYS.map((p) => h("tr", {}, h("td", {}, p.dist === 0 ? "Jackpot-Feld" : `${p.dist} Feld${p.dist > 1 ? "er" : ""} daneben`), h("td", {}, `${p.mult}× Einsatz`))))),
          h("p", {}, "Nach jedem Jackpot wird das Licht schneller (bis zu einem Limit). Ein Fehlversuch setzt das Tempo zurück. Kein Zufall – nur dein Timing.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    updateHud();
    loop.start();
    setTimeout(() => {
      if (phase === "idle" && !dead) loop.stop();
    }, 4000);

    return {
      finalize() {
        // Verlassen bei laufendem Licht: Licht stoppt an der aktuellen Stelle
        if (phase === "running" && ticket) stopLight();
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
