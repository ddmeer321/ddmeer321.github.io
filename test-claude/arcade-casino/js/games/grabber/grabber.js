// Münzgreifer – Darstellung und Ablauf. Physik und Griff-Regeln: physics.js.
// Ablauf: zielen → absenken → schließen → hochfahren (lockere Münzen fallen)
// → zum Schacht fahren (wackelige Münzen fallen) → öffnen → Münzen rutschen
// durch den Schacht → Gutschrift. Das Ergebnis steht beim Schließen fest und
// ergibt sich nur aus Position und Lage der Münzen.

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { createBetControl } from "../../ui/betControl.js";
import { random } from "../../core/rng.js";
import * as G from "./physics.js";

const STYLE = {
  bronze: { face: "#d9893b", rim: "#ffcf9a", edge: "#7a3f12", label: "1" },
  silver: { face: "#cfd6e6", rim: "#ffffff", edge: "#6b7491", label: "2" },
  gold: { face: "#ffc53d", rim: "#fff3a8", edge: "#a86b00", label: "5" },
  chip: { face: "#9b5cff", rim: "#e2d1ff", edge: "#3b1d80", label: "★" },
  diamond: { face: "#2de2e6", rim: "#ffffff", edge: "#0a6f73", label: "◆" },
};

export default {
  mount(root, ctx) {
    const { economy, play, haptic } = ctx;
    const data = ctx.data;
    const L = ctx.limits;
    let dead = false;

    let world = G.deserialize(data.pile, random);
    if (!world) {
      world = G.createWorld(random);
      data.pile = G.serialize(world);
    }
    world.rnd = random;

    // ---------- DOM ----------
    const stage = h("div.game-stage.arcade-stage.grabber-stage", { style: { "--ac": "var(--gold)" } });
    const lastVal = h("strong.num", {}, "–");
    stage.append(h("div.arcade-hud", {}, h("div.slot-display", {}, h("small", {}, "Letzter Griff"), lastVal)));
    const hint = h("div.arcade-hint", {}, "Greifer ziehen oder antippen · dann „Greifen!“");
    stage.append(hint);
    const controls = h("div.game-controls");
    const betCtl = createBetControl({
      steps: L.steps,
      label: "Einsatz/Griff",
      value: Number(data.bet) || L.min,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
        draw();
      },
    });
    const leftBtn = h("button.btn.btn-icon", { type: "button", "aria-label": "Greifer nach links" }, "◀");
    const rightBtn = h("button.btn.btn-icon", { type: "button", "aria-label": "Greifer nach rechts" }, "▶");
    const grabBtn = h("button.btn.btn-gold.btn-lg", { type: "button", "aria-keyshortcuts": "Space" }, "Greifen!");
    controls.append(h("div.ctrl-group", {}, betCtl.el), h("div.ctrl-group", {}, leftBtn, grabBtn, rightBtn));
    root.append(stage, controls);
    const st = createStage(stage);
    const g = st.ctx;

    // ---------- Zustand ----------
    let phase = "aim"; // aim | down | close | up | move | open | tally | back
    let clawX = typeof data.clawX === "number" && Number.isFinite(data.clawX) ? Math.min(G.CLAW_MAX_X, Math.max(G.CLAW_MIN_X, data.clawX)) : (G.CLAW_MIN_X + G.CLAW_MAX_X) / 2;
    let targetX = clawX;
    let palmY = G.PALM_START_Y;
    let open = 1; // 1 offen, 0 geschlossen
    let plan = null;
    let ticket = null;
    let entry = 0;
    let held = []; // { coin, ox, oy, fate, dropAt }
    let falling = []; // frei fallende Münzen außerhalb des Haufens
    let chute = []; // Münzen im Schacht
    let payout = 0;
    let paidCoins = 0;
    let phaseT = 0;
    let moveFrom = 0;
    let moveDur = 1;
    let wallT = 0.5;
    let acc = 0;
    let swayT = 0;
    let pendingRefill = [];

    function setPhase(p) {
      phase = p;
      phaseT = 0;
      ctx.setPhase(p === "aim" ? "aim" : p === "tally" ? "tally" : "grabbing");
      const busy = p !== "aim";
      grabBtn.disabled = busy;
      leftBtn.disabled = busy;
      rightBtn.disabled = busy;
      betCtl.setDisabled(busy);
    }

    const unitCredits = () => betCtl.value / 5;
    const coinCredits = (c, perUnit) => Math.round(G.COIN_TYPES[c.type].value * perUnit);

    // ---------- Geometrie ----------
    function geom() {
      const W = st.width;
      const H = st.height;
      const s = Math.min((W - 10) / (G.BOX_W + 0.4), (H - 70) / (G.BOX_H + 2));
      const ox = (W - G.BOX_W * s) / 2;
      const oy = 60 + (H - 70 - (G.BOX_H + 2) * s) / 2 + s;
      return { W, H, s, ox, oy };
    }
    let GM = null;
    const X = (x) => GM.ox + x * GM.s;
    const Y = (y) => GM.oy + (G.BOX_H - y) * GM.s;

    // ---------- Ablauf ----------
    function startGrab() {
      if (phase !== "aim") return;
      entry = betCtl.value;
      const check = economy.validateBet(entry, { min: L.min, max: L.max });
      if (!check.ok) {
        play("ui.error");
        ctx.toast(check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("grabber", entry, { min: L.min, max: L.max });
      if (!ticket) return;
      clawX = targetX = Math.min(G.CLAW_MAX_X, Math.max(G.CLAW_MIN_X, targetX));
      data.clawX = clawX;
      hint.style.opacity = "0";
      play("coin.insert");
      haptic("impulse");
      payout = 0;
      paidCoins = 0;
      plan = G.planGrab(world, clawX); // Ergebnis steht fest – abhängig nur von der Lage
      motor = ctx.loop({ filter: "lowpass", f: 220, q: 1, gain: 0.025 });
      setPhase("down");
      loop.start();
    }
    let motor = null;

    function closeClaw() {
      setPhase("close");
      play("grab.clamp");
      haptic("impulse");
      const ids = new Set(plan.items.map((i) => i.coin.id));
      world.coins = world.coins.filter((c) => !ids.has(c.id));
      held = plan.items.map((it) => ({ coin: it.coin, ox: it.coin.x - clawX, oy: it.coin.y - plan.palmY, fate: it.fate, dropAt: it.dropAt }));
    }

    function release(item, intoChute) {
      held = held.filter((x) => x !== item);
      const c = item.coin;
      c.x = clawX + item.ox;
      c.y = palmY + item.oy;
      c.px = c.x;
      c.py = c.y + 0.02;
      if (intoChute) {
        c.inChute = true;
        c.x = Math.min(G.CHUTE_W - c.r, Math.max(c.r, c.x));
        c.px = c.x;
        chute.push(c);
      } else {
        c.inChute = false;
        world.coins.push(c);
        play("coin.fall", { vol: 0.5, pan: (c.x / G.BOX_W) * 2 - 1 });
        haptic("tick");
      }
    }

    function finishTally() {
      const credits = payout;
      if (ticket) {
        economy.settle(ticket, credits);
        ticket = null;
      }
      lastVal.textContent = `${paidCoins} · ${ctx.fmt(credits)}`;
      ctx.report("grabber:grab", { coins: paidCoins, credits });
      if (paidCoins >= 5) ctx.progression.award("grabber-5");
      const r = st.canvas.getBoundingClientRect();
      ctx.celebrate({ stake: entry, payout: credits, x: r.left + X(G.CHUTE_W / 2), y: r.top + Y(1), detail: `${paidCoins} Münze${paidCoins === 1 ? "" : "n"}`, jackpot: credits >= entry * 20 });
      chute = [];
      pendingRefill = G.refill(world, random);
      for (const c of pendingRefill) play("coin.land", { delay: 0.2, vol: 0.4 });
      data.pile = G.serialize(world);
      ctx.save();
    }

    // ---------- Simulation/Animation ----------
    const loop = createLoop((dt) => {
      phaseT += dt;
      swayT += dt;
      // freie Münzen (Haufen, fallende, Schacht) – feste Schritte
      acc += dt;
      let n = 0;
      while (acc >= 1 / 120 && n < 6) {
        acc -= 1 / 120;
        n++;
        G.step(world, 1 / 120, world.coins);
        if (chute.length) G.step(world, 1 / 120, chute);
      }
      if (n === 6) acc = 0;

      if (phase === "aim") {
        clawX += (targetX - clawX) * Math.min(1, dt * 10);
        open = Math.min(1, open + dt * 3);
        palmY += (G.PALM_START_Y - palmY) * Math.min(1, dt * 6);
      } else if (phase === "down") {
        const speed = 9;
        palmY = Math.max(plan.palmY, palmY - speed * dt);
        if (palmY <= plan.palmY + 1e-6) closeClaw();
      } else if (phase === "close") {
        open = Math.max(0, open - dt * 4);
        if (open <= 0 && phaseT > 0.3) setPhase("up");
      } else if (phase === "up") {
        palmY = Math.min(G.PALM_START_Y, palmY + 7 * dt);
        for (const it of held.slice()) if (it.fate === "dropLift" && phaseT >= it.dropAt) release(it, false);
        if (palmY >= G.PALM_START_Y) {
          // lockere Münzen fallen spätestens oben heraus
          for (const it of held.slice()) if (it.fate === "dropLift") release(it, false);
          moveFrom = clawX;
          const target = G.CHUTE_W / 2;
          moveDur = Math.max(0.6, (moveFrom - target) / 8);
          wallT = (moveDur * (moveFrom - (G.WALL_X + 1.2))) / (moveFrom - target);
          setPhase("move");
          play("grab.stop", { vol: 0.6 });
        }
      } else if (phase === "move") {
        const k = Math.min(1, phaseT / moveDur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        clawX = moveFrom + (G.CHUTE_W / 2 - moveFrom) * e;
        // Wackelige Münzen fallen, solange der Greifer noch über dem Haufen ist
        for (const it of held.slice()) {
          if (it.fate === "dropMove" && phaseT >= Math.min(it.dropAt * 0.6, wallT * 0.9)) release(it, false);
        }
        if (k >= 1) {
          setPhase("open");
          play("grab.stop");
          haptic("impulse");
        }
      } else if (phase === "open") {
        open = Math.min(1, open + dt * 3);
        if (open > 0.4 && held.length) {
          for (const it of held.slice()) release(it, true);
          play("grab.chute");
        }
        if (phaseT > 0.5) setPhase("tally");
      } else if (phase === "tally") {
        // Münzen, die unten im Schacht ankommen, werden gezählt
        const perUnit = entry / 5;
        for (const c of chute) {
          if (!c.counted && c.y <= c.r + 0.15) {
            c.counted = true;
            const v = coinCredits(c, perUnit);
            payout += v;
            paidCoins++;
            const r = st.canvas.getBoundingClientRect();
            ctx.particles.floatText(r.left + X(c.x), r.top + Y(c.y) - 10, `+${ctx.fmt(v)}`, STYLE[c.type].face);
            play("coin.clink", { pitch: 1 + paidCoins * 0.05 });
            haptic("tap", 0.6);
          }
        }
        const allIn = chute.every((c) => c.counted);
        if ((allIn && phaseT > 0.4) || phaseT > 3) {
          for (const c of chute) {
            if (!c.counted) {
              c.counted = true;
              payout += coinCredits(c, perUnit);
              paidCoins++;
            }
          }
          finishTally();
          motor?.stop();
          motor = null;
          setPhase("back");
          moveFrom = clawX;
        }
      } else if (phase === "back") {
        const k = Math.min(1, phaseT / 0.8);
        clawX = moveFrom + (targetX - moveFrom) * (1 - Math.pow(1 - k, 2));
        if (k >= 1 && phaseT > 1.2) {
          setPhase("aim");
          data.pile = G.serialize(world);
          ctx.save();
        }
      }
      motor?.set({ gain: phase === "down" || phase === "up" || phase === "move" || phase === "back" ? 0.03 : 0.008 });
      draw();
      if (phase === "aim" && Math.abs(targetX - clawX) < 0.01 && phaseT > 2) loop.stop();
    });

    // ---------- Zeichnen ----------
    function coin(c, x, y) {
      const st2 = STYLE[c.type];
      const r = c.r * GM.s;
      g.fillStyle = st2.edge;
      g.beginPath();
      g.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
      g.fill();
      const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      grd.addColorStop(0, st2.rim);
      grd.addColorStop(0.55, st2.face);
      grd.addColorStop(1, st2.edge);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r * 0.97, 0, Math.PI * 2);
      g.fill();
      if (c.type === "chip") {
        g.strokeStyle = "#fff";
        g.lineWidth = r * 0.18;
        g.setLineDash([r * 0.35, r * 0.35]);
        g.beginPath();
        g.arc(x, y, r * 0.8, c.rot, c.rot + Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      } else {
        g.strokeStyle = st2.rim;
        g.lineWidth = Math.max(1, r * 0.1);
        g.beginPath();
        g.arc(x, y, r * 0.66, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = c.type === "silver" ? "#4b5470" : "#fff";
      g.font = `900 ${r * 0.8}px ui-rounded, system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(STYLE[c.type].label, x, y + r * 0.05);
    }

    function draw() {
      st.begin();
      GM = geom();
      const { W, H, s } = GM;
      g.clearRect(0, 0, W, H);
      // Kasten
      const bx = X(0);
      const by = Y(G.BOX_H);
      const bw = G.BOX_W * s;
      const bh = G.BOX_H * s;
      const bg = g.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, "#160c2e");
      bg.addColorStop(1, "#2a1550");
      g.fillStyle = bg;
      g.fillRect(bx, by, bw, bh);
      // Schacht
      g.fillStyle = "rgba(255,197,61,.08)";
      g.fillRect(X(0), Y(9), G.CHUTE_W * s, 9 * s);
      g.fillStyle = "#3b2566";
      g.fillRect(X(G.CHUTE_W), Y(9.5), (G.WALL_X - G.CHUTE_W) * s, 9.5 * s);
      g.fillStyle = "#ffc53d";
      g.shadowColor = "#ffc53d";
      g.shadowBlur = 10;
      g.fillRect(X(0.2), Y(9.2), (G.CHUTE_W - 0.4) * s, 3);
      g.shadowBlur = 0;
      g.save();
      g.translate(X(G.CHUTE_W / 2), Y(5));
      g.rotate(-Math.PI / 2);
      g.font = `900 ${Math.max(9, s * 0.7)}px ui-rounded, system-ui, sans-serif`;
      g.fillStyle = "rgba(255,197,61,.55)";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("AUSGABE", 0, 0);
      g.restore();
      // Münzen
      for (const c of world.coins) coin(c, X(c.x), Y(c.y));
      for (const c of chute) coin(c, X(c.x), Y(c.y));
      // Greifer
      const sway = phase === "move" ? Math.sin(swayT * 9) * 0.12 * (1 - Math.min(1, phaseT / moveDur)) : 0;
      const cx = X(clawX + sway);
      const py = Y(palmY);
      g.strokeStyle = "#b7a8d6";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, by);
      g.lineTo(cx, py - s * 1.6);
      g.stroke();
      // Schiene oben
      g.fillStyle = "#5b4a8a";
      g.fillRect(bx, by, bw, s * 0.5);
      g.fillStyle = "#ffc53d";
      g.fillRect(cx - s * 0.8, by, s * 1.6, s * 0.5);
      // gehaltene Münzen
      for (const it of held) coin(it.coin, X(clawX + sway + it.ox), Y(palmY + it.oy));
      // Krallenkörper
      g.fillStyle = "#cfc2ee";
      g.strokeStyle = "#5b4a8a";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect ? g.roundRect(cx - s * 1.1, py - s * 1.6, s * 2.2, s * 1.1, s * 0.3) : g.rect(cx - s * 1.1, py - s * 1.6, s * 2.2, s * 1.1);
      g.fill();
      g.stroke();
      // Zinken
      const spread = G.GRIP_HALF * (0.6 + open * 0.55);
      g.strokeStyle = "#e9e2ff";
      g.lineWidth = Math.max(3, s * 0.32);
      g.lineCap = "round";
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + side * s * 0.8, py - s * 0.7);
        g.quadraticCurveTo(cx + side * spread * s * 1.25, py + s * 0.4, cx + side * (spread - (1 - open) * 1.1) * s, py + s * (0.6 - open * 0.2));
        g.stroke();
      }
      // Glas
      const gl = g.createLinearGradient(bx, by, bx + bw, by + bh);
      gl.addColorStop(0, "rgba(255,255,255,.08)");
      gl.addColorStop(0.4, "rgba(255,255,255,0)");
      g.fillStyle = gl;
      g.fillRect(bx, by, bw, bh);
      g.strokeStyle = "rgba(255,197,61,.6)";
      g.lineWidth = 2;
      g.strokeRect(bx, by, bw, bh);
      // Wertlegende
      if (phase === "aim") {
        const perUnit = unitCredits();
        const items = Object.keys(STYLE);
        const lw = Math.min(W - 20, 360);
        const lx = (W - lw) / 2;
        const ly = by + bh + 8;
        if (ly + 18 < H) {
          items.forEach((t, i) => {
            const x = lx + (lw / items.length) * (i + 0.5);
            coin({ type: t, r: 0.55, rot: 0 }, x - 14, ly + 8);
            g.fillStyle = "#e2d1ff";
            g.font = `800 11px ui-rounded, system-ui, sans-serif`;
            g.textAlign = "left";
            g.fillText(String(Math.round(G.COIN_TYPES[t].value * perUnit)), x - 4, ly + 9);
          });
        }
      }
    }
    st.onResize = () => draw();

    // ---------- Eingaben ----------
    function aimAt(clientX) {
      if (phase !== "aim" || !GM) return;
      const p = st.toLocal(clientX, 0);
      targetX = Math.min(G.CLAW_MAX_X, Math.max(G.CLAW_MIN_X, (p.x - GM.ox) / GM.s));
      data.clawX = targetX;
      hint.style.opacity = "0";
      if (!loop.running) loop.start();
    }
    let dragging = false;
    stage.addEventListener("pointerdown", (e) => {
      if (phase !== "aim") return;
      dragging = true;
      stage.setPointerCapture?.(e.pointerId);
      aimAt(e.clientX);
      play("ui.toggle", { vol: 0.5 });
      e.preventDefault();
    });
    stage.addEventListener("pointermove", (e) => {
      if (dragging) aimAt(e.clientX);
    });
    stage.addEventListener("pointerup", () => (dragging = false));
    stage.addEventListener("pointercancel", () => (dragging = false));
    const nudge = (d) => {
      if (phase !== "aim") return;
      targetX = Math.min(G.CLAW_MAX_X, Math.max(G.CLAW_MIN_X, targetX + d));
      data.clawX = targetX;
      play("ui.toggle", { vol: 0.6 });
      haptic("tick");
      if (!loop.running) loop.start();
    };
    leftBtn.addEventListener("click", () => nudge(-0.5));
    rightBtn.addEventListener("click", () => nudge(0.5));
    grabBtn.addEventListener("click", startGrab);
    function onKey(e) {
      if (ctx.isModalOpen()) return;
      if (e.key === "ArrowLeft") nudge(-0.35);
      else if (e.key === "ArrowRight") nudge(0.35);
      else if (e.code === "Space" && !e.repeat) {
        if (document.activeElement?.tagName === "BUTTON" && document.activeElement !== grabBtn) return;
        e.preventDefault();
        startGrab();
      }
    }
    window.addEventListener("keydown", onKey);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Münzgreifer",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Wähle den Einsatz pro Griff, ziehe den Greifer über die gewünschte Stelle (oder tippe sie an) und drücke „Greifen!“. Er senkt sich, bis seine Zinken den Haufen berühren, schließt sich und bringt alles, was er festhält, zum Ausgabeschacht."),
          h("h3", {}, "Was hält, was fällt?"),
          h("p", {}, `Das entscheidet allein die Lage: Münzen mittig und tief zwischen den Zinken sitzen fest. Münzen am Rand rutschen beim Hochfahren heraus, leicht wackelige beim Fahren zum Schacht. Der Greifer fasst höchstens ${G.CAPACITY} Münzen. Es gibt keine zufällige Greifkraft.`),
          h("h3", {}, "Werte"),
          h("p", {}, `Bronze 1 · Silber 2 · Gold 5 · Chip ★ 10 · Diamant ◆ 30 Einheiten; eine Einheit ist ein Fünftel deines Einsatzes (die Legende unten zeigt die Credits). Herausgeholte Münzen werden von oben zufällig nachgefüllt – seltene Münzen kommen genauso selten nach, wie oben angegeben (Bronze 64 %, Silber 22 %, Gold 9 %, Chip 4 %, Diamant 1 %).`),
          h("p", {}, "Langfristig bringt auch sehr gutes Zielen etwas weniger zurück, als man einsetzt (Simulation: wahllos ≈ 45 %, gezielt ≈ 63 %, rechnerisch perfekt ≈ 87 %).")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    setPhase("aim");
    draw();
    loop.start();

    return {
      finalize() {
        if (!ticket || !plan) return;
        // Ergebnis stand beim Start fest: ausgelieferte Münzen gemäß Plan abrechnen.
        const perUnit = entry / 5;
        const deliver = plan.items.filter((i) => i.fate === "deliver");
        const total = deliver.reduce((s, i) => s + coinCredits(i.coin, perUnit), 0);
        economy.settle(ticket, total);
        ticket = null;
        const keep = new Set(deliver.map((i) => i.coin.id));
        for (const it of plan.items) if (!keep.has(it.coin.id) && !world.coins.includes(it.coin)) world.coins.push(it.coin);
        world.coins = world.coins.filter((c) => !keep.has(c.id));
        G.refill(world, random);
        G.settle(world, 300);
        data.pile = G.serialize(world);
      },
      pause() {},
      destroy() {
        dead = true;
        motor?.stop();
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
        void dead;
      },
    };
  },
};
