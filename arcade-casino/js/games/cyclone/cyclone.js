// Lichtwirbel V1.1 – Timing-Automat mit 5 Stufen pro Runde.
// Logik und Preistabelle: logic.js. Gewertet wird exakt die Lampe, die zum
// Zeitpunkt des Tippens leuchtet (berechnet aus derselben Formel wie die
// Anzeige). Kein Zufall nach dem Start einer Stufe, kein Nachjustieren.

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { randInt } from "../../core/rng.js";
import * as C from "./logic.js";

const AUTO_STOP_MS = 9000;

export { pointsFor as cyclonePoints } from "./logic.js";

export default {
  mount(root, ctx) {
    const { economy, play, haptic } = ctx;
    const ENTRY = ctx.limits.entry || 20;
    let dead = false;

    const stage = h("div.game-stage.arcade-stage", { style: { "--ac": "var(--violet)" } });
    const stageVal = h("strong.num", {}, "–");
    const ptsVal = h("strong.num", {}, "0");
    const lapVal = h("strong.num", {}, "–");
    stage.append(
      h(
        "div.arcade-hud",
        {},
        h("div.slot-display", {}, h("small", {}, "Stufe"), stageVal),
        h("div.slot-display", {}, h("small", {}, "Punkte"), ptsVal),
        h("div.slot-display", {}, h("small", {}, "Umlauf"), lapVal)
      )
    );
    const controls = h("div.game-controls");
    const status = h("div.status-line", { role: "status" }, `Startgebühr ${ENTRY} Credits · 5 Stopps pro Runde`);
    const actBtn = h("button.btn.btn-primary.btn-lg", { type: "button", style: { minWidth: "200px" }, "aria-keyshortcuts": "Space" }, `Start · ${ENTRY}`);
    controls.append(status, actBtn);
    root.append(stage, controls);
    const st = createStage(stage);
    const g = st.ctx;

    // ---------- Zustand ----------
    let phase = "idle"; // idle | ready | running | between | result
    let ticket = null;
    let stageIdx = 0;
    let streak = 0;
    let points = 0;
    let jackpots = 0;
    let startBulb = 0;
    let lap = C.lapFor(0);
    let t0 = 0;
    let frozen = null; // { bulb, pts }
    let history = [];
    let timer = 0;
    let t = 0;
    let flashT = 0;

    function setPhase(p) {
      phase = p;
      ctx.setPhase(p);
      stage.dataset.start = String(startBulb);
      stage.dataset.lap = String(lap);
      stage.dataset.t0 = String(t0);
    }

    function hud() {
      stageVal.textContent = phase === "idle" ? "–" : `${Math.min(stageIdx + 1, C.STAGES)}/${C.STAGES}`;
      ptsVal.textContent = String(points);
      lapVal.textContent = phase === "idle" ? "–" : `${lap.toFixed(2).replace(".", ",")}s`;
    }

    function startRound() {
      if (phase !== "idle" && phase !== "result") return;
      const check = economy.validateBet(ENTRY, { min: ENTRY, max: ENTRY });
      if (!check.ok) {
        play("ui.error");
        ctx.toast(check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("cyclone", ENTRY, { min: ENTRY, max: ENTRY });
      if (!ticket) return;
      play("coin.insert");
      haptic("impulse");
      stageIdx = 0;
      streak = 0;
      points = 0;
      jackpots = 0;
      history = [];
      actBtn.textContent = "Stopp!";
      actBtn.classList.add("btn-gold");
      beginStage();
      loop.start();
    }

    function beginStage() {
      lap = C.lapFor(stageIdx, streak);
      startBulb = randInt(C.BULBS);
      frozen = null;
      setPhase("ready");
      hud();
      status.textContent = `Stufe ${stageIdx + 1}: gleich geht's los …`;
      clearTimeout(timer);
      // kurzer sichtbarer Vorlauf: Startlampe blinkt, dann läuft das Licht
      timer = setTimeout(() => {
        if (dead) return;
        t0 = performance.now();
        setPhase("running");
        status.textContent = streak > 0 ? `Serie ${streak} – schneller!` : "Jetzt stoppen!";
        play("go", { vol: 0.5 });
        timer = setTimeout(() => stopLight(performance.now(), true), AUTO_STOP_MS);
      }, ctx.reducedMotion() ? 250 : 550);
    }

    function stopLight(now, auto = false) {
      if (phase !== "running") return;
      clearTimeout(timer);
      const bulb = C.bulbAt(startBulb, lap, now - t0);
      const pts = C.pointsFor(bulb);
      points += pts;
      frozen = { bulb, pts };
      history.push(pts);
      if (pts === C.POINTS[0]) {
        jackpots++;
        streak++;
        play("stack.perfect", { semi: stageIdx * 2 });
        haptic("success");
        flashT = 0.6;
        ctx.particles.floatText(...screenOf(0), "JACKPOT +" + pts, "#ffc53d");
      } else if (pts > 0) {
        streak = 0;
        const pink = pts === C.POINTS[1];
        play("reel.stop", { pitch: pink ? 1.5 : 1.2 });
        haptic(pink ? "success" : "impulse");
        if (pink) flashT = 0.25;
        ctx.particles.floatText(...screenOf(bulb), "+" + pts, pink ? "#ff3d9a" : "#2de2e6");
      } else {
        streak = 0;
        play("reel.stop", { pitch: 0.8, vol: 0.7 });
        haptic("tap");
      }
      const zn = C.zoneOf(bulb)?.[2];
      status.textContent = `${auto ? "Automatisch gestoppt · " : ""}${zn === "jackpot" ? "Volltreffer! +5" : zn === "pink" ? "Pinke Zone +3" : zn === "blau" ? "Blaue Zone +1" : `${C.distance(bulb)} Lampen daneben · 0`}`;
      stageIdx++;
      setPhase("between");
      hud();
      timer = setTimeout(() => {
        if (dead) return;
        if (stageIdx >= C.STAGES) finishRound();
        else beginStage();
      }, ctx.reducedMotion() ? 450 : 850);
    }

    function finishRound() {
      const prize = C.prizeFor(points, ENTRY);
      if (ticket) {
        economy.settle(ticket, prize);
        ticket = null;
      }
      ctx.setPhase("result");
      phase = "result";
      ctx.progression.setBest("cyclone", points);
      if (jackpots >= 1) ctx.progression.award("cyclone-jackpot");
      ctx.progression.setBest("cyclone-streak", history.reduce((acc, p) => (p === C.POINTS[0] ? [acc[0] + 1, Math.max(acc[1], acc[0] + 1)] : [0, acc[1]]), [0, 0])[1]);
      ctx.report("cyclone:round", { points, jackpots });
      const perfect = points === C.MAX_POINTS;
      ctx.celebrate({ stake: ENTRY, payout: prize, jackpot: perfect, title: perfect ? "PERFEKTE RUNDE" : undefined, detail: `${points} Punkte` });
      status.textContent = `${points} Punkte → ${prize > ENTRY ? `${prize} Credits (+${prize - ENTRY})` : prize > 0 ? `${prize} Credits zurück · Einsatz ${ENTRY}` : "kein Preis"}`;
      actBtn.textContent = `Nochmal · ${ENTRY}`;
      actBtn.classList.remove("btn-gold");
      hud();
    }

    function act(now) {
      if (phase === "running") stopLight(now);
      else if (phase === "idle" || phase === "result") startRound();
    }

    // ---------- Darstellung ----------
    function geom() {
      const W = st.width;
      const H = st.height;
      const R = Math.min(W, H - 70) * 0.4;
      return { W, H, R, cx: W / 2, cy: (H + 60) / 2 };
    }

    function screenOf(bulb) {
      const { R, cx, cy } = geom();
      const a = (bulb / C.BULBS) * Math.PI * 2 - Math.PI / 2;
      const r = st.canvas.getBoundingClientRect();
      return [r.left + cx + Math.cos(a) * R, r.top + cy + Math.sin(a) * R - 14];
    }

    function draw(now) {
      st.begin();
      const { W, H, R, cx, cy } = geom();
      g.clearRect(0, 0, W, H);
      const dish = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      dish.addColorStop(0, "#2a1a4a");
      dish.addColorStop(1, "#0b0614");
      g.fillStyle = dish;
      g.beginPath();
      g.arc(cx, cy, R * 1.18, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = flashT > 0 ? `rgba(255,197,61,${0.4 + flashT})` : "rgba(226,209,255,.4)";
      g.lineWidth = flashT > 0 ? 4 : 2;
      g.stroke();

      let pos = null;
      if (phase === "running") pos = C.lightPos(startBulb, lap, now - t0);
      const cur = frozen ? frozen.bulb : pos !== null ? Math.floor(pos) : phase === "ready" ? startBulb : -1;
      const br = Math.max(3.5, R * 0.052);
      for (let i = 0; i < C.BULBS; i++) {
        const a = (i / C.BULBS) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R;
        const y = cy + Math.sin(a) * R;
        const d = C.distance(i);
        const z = C.zoneOf(i);
        const base = !z ? "#5b4a8a" : z[2] === "jackpot" ? "#ffc53d" : z[2] === "pink" ? "#ff3d9a" : "#2de2e6";
        let on = z ? 0.35 : 0.12;
        if (phase === "idle") on = z ? 0.45 + 0.3 * Math.sin(t * 3) : 0.15;
        if (pos !== null) {
          const back = (cur - i + C.BULBS) % C.BULBS;
          if (back < 4) on = Math.max(on, 1 - back / 4);
        }
        if (i === cur && phase === "ready") on = 0.5 + 0.5 * Math.sin(t * 20);
        if (frozen && i === frozen.bulb) on = 0.75 + 0.25 * Math.sin(t * 14);
        g.fillStyle = i === cur && phase !== "idle" ? "#fff" : base;
        g.globalAlpha = Math.min(1, on);
        if (on > 0.6) {
          g.shadowColor = base;
          g.shadowBlur = br * 3;
        }
        g.beginPath();
        g.arc(x, y, d === 0 ? br * 1.5 : br, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
      // Jackpot-Markierung
      g.fillStyle = "#ffc53d";
      g.beginPath();
      g.moveTo(cx, cy - R - br * 3.6);
      g.lineTo(cx - br * 1.2, cy - R - br * 5.4);
      g.lineTo(cx + br * 1.2, cy - R - br * 5.4);
      g.closePath();
      g.fill();
      // Mitte: Stufen-Anzeige
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `900 ${R * 0.2}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = "#ffc53d";
      g.shadowColor = "#ffc53d";
      g.shadowBlur = 12;
      g.fillText(phase === "idle" ? "LICHTWIRBEL" : `${points}`, cx, cy - R * 0.1);
      g.shadowBlur = 0;
      g.font = `800 ${R * 0.085}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = "#e2d1ff";
      g.fillText(phase === "idle" ? "5 Stopps · Jackpot oben" : "PUNKTE", cx, cy + R * 0.1);
      // Stufen-Punkte
      for (let i = 0; i < C.STAGES; i++) {
        const x = cx + (i - 2) * R * 0.17;
        const y = cy + R * 0.32;
        const p = history[i];
        g.fillStyle = p === undefined ? "rgba(255,255,255,.12)" : p === C.POINTS[0] ? "#ffc53d" : p === C.POINTS[1] ? "#ff3d9a" : p > 0 ? "#2de2e6" : "#5b4a8a";
        g.beginPath();
        g.arc(x, y, R * 0.045, 0, Math.PI * 2);
        g.fill();
      }
    }
    st.onResize = () => draw(performance.now());

    let lastTick = -1;
    const loop = createLoop((dt, now) => {
      t += dt;
      flashT = Math.max(0, flashT - dt);
      if (phase === "running") {
        const b = C.bulbAt(startBulb, lap, now - t0);
        if (b !== lastTick) {
          lastTick = b;
          if (C.distance(b) === 0) play("cyclone.tick", { pitch: 1.6, vol: 0.9 });
          else if (b % 2 === 0) play("cyclone.tick", { vol: 0.4 });
        }
      }
      draw(now);
      if (phase === "result" && flashT <= 0 && t > 3) loop.stop();
    });

    // ---------- Eingaben ----------
    actBtn.addEventListener("pointerdown", (e) => {
      if (phase === "running") {
        e.preventDefault();
        act(performance.now());
      }
    });
    actBtn.addEventListener("click", () => {
      if (phase !== "running") act(performance.now());
    });
    stage.addEventListener("pointerdown", (e) => {
      if (phase === "running") {
        e.preventDefault();
        act(performance.now());
      }
    });
    function onKey(e) {
      if (ctx.isModalOpen() || e.repeat) return;
      if (e.code === "Space" || e.key === "Enter") {
        if (document.activeElement?.tagName === "BUTTON" && document.activeElement !== actBtn) return;
        e.preventDefault();
        act(performance.now());
      }
    }
    window.addEventListener("keydown", onKey);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Lichtwirbel",
        body: h(
          "div.help-text",
          {},
          h("p", {}, `Eine Runde kostet ${ENTRY} Credits und hat ${C.STAGES} Stopps. Bei jedem Stopp läuft ein Licht mit gleichmäßiger Geschwindigkeit über ${C.BULBS} Lampen – es startet an einer zufälligen, sichtbaren Lampe. Tippe (oder Leertaste), um es anzuhalten. Es zählt genau die Lampe, die in diesem Moment leuchtet.`),
          h("table", {}, h("tbody", {}, [
            ["Jackpot-Lampe (gold, oben)", `${C.POINTS[0]} Punkte`],
            [`Pinke Zone (bis ${C.ZONES[1][0]} Lampen daneben)`, `${C.POINTS[1]} Punkte`],
            [`Blaue Zone (bis ${C.ZONES[2][0]} Lampen daneben)`, `${C.POINTS[2]} Punkt`],
          ].map(([a, b]) => h("tr", {}, h("td", {}, a), h("td", {}, b))))),
          h("p", {}, `Jede Stufe ist schneller (${C.BASE_LAPS.map((x) => x.toFixed(2).replace(".", ",")).join(" · ")} s pro Umlauf). Jeder Jackpot-Treffer in Folge macht die nächste Stufe zusätzlich ${Math.round((1 - C.STREAK_SPEEDUP) * 100)} % schneller.`),
          h("h3", {}, "Preise nach Punkten"),
          h("div.prize-table", {}, C.PRIZES.map(([min, m]) => [h("span", {}, min === C.MAX_POINTS ? `${min} (perfekt)` : `ab ${min}`), h("b.num", {}, `${Math.round(m * ENTRY)} Credits`)])),
          h("p", {}, "Kein Zufall nach dem Start einer Stufe, keine Korrektur: Ein perfekter Tipp trifft immer. Langfristig gewinnen nur sehr präzise Spieler etwas mehr, als sie einsetzen.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    setPhase("idle");
    hud();
    loop.start();
    timer = setTimeout(() => {
      if (phase === "idle" && !dead) loop.stop();
    }, 4000);

    return {
      finalize() {
        // Verlassen mitten in der Runde: restliche Stopps zählen 0 Punkte.
        if (ticket) {
          economy.settle(ticket, C.prizeFor(points, ENTRY));
          ticket = null;
        }
      },
      pause() {},
      destroy() {
        dead = true;
        clearTimeout(timer);
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
