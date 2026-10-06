// Münzkaskade – Coin Pusher. Physik in physics.js, hier Darstellung + Bedienung.

import { h } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import * as P from "./physics.js";
import { random } from "../../core/rng.js";

const COIN_PRICE = 10; // Credits pro Münze
const DROP_GAP = 0.22; // s zwischen zwei Einwürfen beim Gedrückthalten
const FIXED_DT = 1 / 120;

export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    const data = ctx.data;
    let dead = false;
    ctx.setPhase("play"); // Endlosautomat: immer bespielbar (für Tests/Zustandsanzeige)

    // ---------- Zustand ----------
    let world = P.deserialize(data.world, random);
    if (!world || world.coins.length < 20) {
      world = P.createWorld(random);
      P.seedField(world);
    }
    let dropX = typeof data.dropX === "number" && Number.isFinite(data.dropX) ? Math.max(-P.HALF_W + P.R, Math.min(P.HALF_W - P.R, data.dropX)) : 0;
    let holding = false;
    let holdTimer = 0;
    let freeDrops = 0;
    let freeTimer = 0;
    let session = { in: 0, out: 0 };
    let edgeFlash = 0;
    let pendingCredit = 0;
    let creditTimer = 0;
    let saveTimer = 0;
    let acc = 0;
    let shake = 0;
    const tray = []; // gestapelte Münzen in der Schale (Deko)

    // ---------- DOM ----------
    const stage = h("div.game-stage.arcade-stage", { style: { "--ac": "var(--cyan)" } });
    const inVal = h("strong.num", {}, "0");
    const outVal = h("strong.num", {}, "0");
    stage.append(
      h("div.arcade-hud", {}, h("div.slot-display", {}, h("small", {}, "Eingeworfen"), inVal), h("div.slot-display", {}, h("small", {}, "Ausgezahlt"), outVal))
    );
    const hint = h("div.arcade-hint", {}, "Tippen oder halten zum Einwerfen · Position wählen");
    stage.append(hint);
    const controls = h("div.game-controls");
    const leftBtn = h("button.btn.btn-icon", { type: "button", "aria-label": "Einwurf nach links" }, "◀");
    const rightBtn = h("button.btn.btn-icon", { type: "button", "aria-label": "Einwurf nach rechts" }, "▶");
    const dropBtn = h("button.btn.btn-gold.btn-lg", { type: "button" }, h("span.coin-ico.sm"), ` Einwerfen · ${COIN_PRICE}`);
    controls.append(h("div.ctrl-group", {}, leftBtn, dropBtn, rightBtn));
    root.append(stage, controls);

    const st = createStage(stage);
    const g = st.ctx;

    // ---------- Projektion ----------
    let L = null;
    function layout() {
      const W = st.width;
      const H = st.height;
      const ppu = Math.min((W * 0.94) / (2 * P.HALF_W), (H * 0.8) / P.LEN);
      const backY = Math.max(70, H * 0.17);
      const fieldH = Math.min(H * 0.86 - backY, P.LEN * ppu * 1.2);
      L = { W, H, ppu, backY, frontY: backY + fieldH, sBack: 0.7, a: 0.7, pusherH: 13 };
    }
    function f(y) {
      // Perspektive: hinten gestaucht, vorne gestreckt
      const t = Math.max(0, Math.min(1.15, y / P.LEN));
      return t / (1 + L.a - L.a * t);
    }
    function scaleAt(y) {
      return L.sBack + (1 - L.sBack) * f(y);
    }
    function proj(x, y, lift = 0) {
      const s = scaleAt(y);
      return { x: L.W / 2 + x * L.ppu * s, y: L.backY + (L.frontY - L.backY) * f(y) - lift * L.ppu * s * 0.5, s };
    }
    function unprojX(sx, y) {
      return (sx - L.W / 2) / (L.ppu * scaleAt(y));
    }
    st.onResize = () => {
      layout();
      draw();
    };
    layout();

    // ---------- Einwurf ----------
    let lastDrop = -1;
    function tryDrop() {
      if (dead) return;
      const now = performance.now() / 1000;
      if (now - lastDrop < DROP_GAP * 0.9) return;
      if (world.coins.length >= P.MAX_COINS) {
        ctx.toast("Die Maschine ist voll – kurz warten", { icon: "⏳" });
        return;
      }
      if (!economy.debit("coinpusher", COIN_PRICE, "coin")) {
        holding = false;
        play("ui.error");
        haptic("impulse");
        ctx.toast("Nicht genug Credits für eine Münze", { icon: "⚠️", tone: "red" });
        return;
      }
      lastDrop = now;
      const type = P.rollType(random);
      P.dropCoin(world, dropX, type);
      session.in++;
      inVal.textContent = ctx.fmt(session.in);
      play("coin.insert", { pan: dropX / P.HALF_W });
      haptic("tap", 0.7);
      hint.style.opacity = "0";
      ensureRunning();
    }

    function setDropFromClient(clientX) {
      const p = st.toLocal(clientX, 0);
      dropX = Math.max(-P.HALF_W + P.R, Math.min(P.HALF_W - P.R, unprojX(p.x, world.py * 0.5)));
      data.dropX = dropX;
    }

    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      stage.setPointerCapture?.(e.pointerId);
      setDropFromClient(e.clientX);
      holding = true;
      holdTimer = DROP_GAP;
      tryDrop();
      e.preventDefault();
    });
    stage.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" || holding) setDropFromClient(e.clientX);
      ensureRunning();
    });
    const stopHold = () => {
      holding = false;
    };
    stage.addEventListener("pointerup", stopHold);
    stage.addEventListener("pointercancel", stopHold);
    stage.addEventListener("lostpointercapture", stopHold);

    function nudge(d) {
      dropX = Math.max(-P.HALF_W + P.R, Math.min(P.HALF_W - P.R, dropX + d));
      data.dropX = dropX;
      play("ui.toggle");
      haptic("tick");
      ensureRunning();
    }
    leftBtn.addEventListener("click", () => nudge(-6));
    rightBtn.addEventListener("click", () => nudge(6));
    dropBtn.addEventListener("click", tryDrop);
    function onKey(e) {
      if (ctx.isModalOpen()) return;
      if (e.key === "ArrowLeft") nudge(-4);
      else if (e.key === "ArrowRight") nudge(4);
      else if (e.code === "Space") {
        e.preventDefault();
        tryDrop();
      }
    }
    window.addEventListener("keydown", onKey);

    // ---------- Simulation ----------
    const hum = ctx.loop({ filter: "lowpass", f: 160, q: 0.7, gain: 0.012 });

    function handle(ev) {
      const c = ev.coin;
      const pan = Math.max(-1, Math.min(1, c.x / P.HALF_W));
      if (ev.kind === "land") {
        play("coin.land", { pan, vol: 0.7, pitch: 0.9 + Math.random() * 0.2 });
        haptic("tick", 0.5);
      } else if (ev.kind === "shelfDrop") {
        play("coin.clink", { pan, vol: 0.5 });
      } else if (ev.kind === "climb") {
        play("coin.clink", { pan, vol: 0.25, pitch: 1.3 });
      } else if (ev.kind === "topple") {
        play("coin.land", { pan, vol: 0.45, pitch: 1.1 });
        haptic("tick", 0.4);
      } else if (ev.kind === "win") {
        const val = P.COIN_TYPES[c.type].value * COIN_PRICE;
        cycleWins++;
        cycleValue += val;
        pendingCredit += val;
        session.out += val;
        outVal.textContent = ctx.fmt(session.out);
        edgeFlash = 1;
        const p = proj(c.x, P.LEN);
        const r = st.canvas.getBoundingClientRect();
        particles.floatText(r.left + p.x, r.top + p.y - 8, "+" + val, c.type === "gold" ? "#ffde59" : "#ffc53d");
        play("coin.fall", { pan });
        haptic("tap");
        const total = ctx.progression.bump("pusher-coins");
        if (total >= 50) ctx.progression.award("pusher-50");
        if (c.type === "gold") {
          ctx.progression.award("pusher-gold");
          play("win.small");
          haptic("success");
          particles.burst(r.left + p.x, r.top + p.y, { kind: "coins", count: 14 });
        }
        if (c.type === "mega") {
          ctx.celebrate({ stake: COIN_PRICE, payout: val, x: r.left + p.x, y: r.top + p.y, detail: "Mega-Münze", banner: true });
          shake = 0.3;
        }
        if (c.type === "star") {
          freeDrops += P.COIN_TYPES.star.bonus;
          play("win.medium");
          haptic("big");
          particles.burst(r.left + p.x, r.top + p.y, { kind: "confetti", count: 50, spread: 1.4 });
          ctx.banner({ title: "Münzregen!", sub: `${P.COIN_TYPES.star.bonus} Gratis-Münzen`, ms: 1800 });
          shake = 0.4;
        }
        if (tray.length < 40) tray.push({ x: (Math.random() - 0.5) * 0.8, t: c.type });
      } else if (ev.kind === "lost") {
        play("coin.land", { pan, vol: 0.35, pitch: 0.7 });
      }
    }

    function flushCredit() {
      if (pendingCredit > 0) {
        const amount = pendingCredit;
        pendingCredit = 0;
        economy.credit("coinpusher", amount, "pusher");
        const r = st.canvas.getBoundingClientRect();
        const p = proj(0, P.LEN);
        particles.coinsToBalance(r.left + p.x, r.top + p.y + 20, Math.min(8, 1 + amount / 20));
      }
    }

    // Kettenreaktionen: Münzen, die innerhalb eines Schieber-Zyklus fallen
    let cycleWins = 0;
    let cycleValue = 0;
    let rising = false;
    let lastPy = world.py;
    function checkCycle() {
      const nowRising = world.py > lastPy;
      if (nowRising && !rising) {
        if (cycleWins >= 3) {
          const el = h("div.combo-flash", {}, `Kettenreaktion ×${cycleWins}`);
          stage.append(el);
          setTimeout(() => el.remove(), 900);
          play(cycleWins >= 6 ? "win.medium" : "win.small", { vol: 0.8 });
          haptic(cycleWins >= 6 ? "success" : "impulse");
        }
        if (cycleWins > 0) ctx.report("coinpusher:push", { coins: cycleWins, credits: cycleValue });
        if (cycleWins >= 5) ctx.progression.award("pusher-chain");
        cycleWins = 0;
        cycleValue = 0;
      }
      rising = nowRising;
      lastPy = world.py;
    }

    let idleTime = 0;
    const loop = createLoop((dt) => {
      acc += dt;
      let steps = 0;
      const pyBefore = world.py;
      while (acc >= FIXED_DT && steps < 6) {
        acc -= FIXED_DT;
        steps++;
        for (const ev of P.step(world, FIXED_DT)) handle(ev);
        checkCycle();
      }
      if (steps === 6) acc = 0;
      hum.set({ gain: 0.006 + Math.min(0.02, Math.abs(world.py - pyBefore) * 0.02) });

      if (holding) {
        holdTimer -= dt;
        if (holdTimer <= 0) {
          holdTimer = DROP_GAP;
          tryDrop();
        }
      }
      if (freeDrops > 0) {
        freeTimer -= dt;
        if (freeTimer <= 0) {
          freeTimer = 0.18;
          freeDrops--;
          P.dropCoin(world, (Math.random() * 2 - 1) * (P.HALF_W - P.R), "normal");
          play("coin.insert", { vol: 0.6 });
        }
      }
      creditTimer += dt;
      if (creditTimer > 0.45) {
        creditTimer = 0;
        flushCredit();
      }
      saveTimer += dt;
      if (saveTimer > 2.5) {
        saveTimer = 0;
        persist();
      }
      edgeFlash = Math.max(0, edgeFlash - dt * 2.5);
      shake = Math.max(0, shake - dt);

      // Energiesparen: Wenn sich länger nichts tut, läuft der Schieber trotzdem
      // weiter (er ist Teil des Spiels), aber nur solange der Automat sichtbar ist.
      idleTime += dt;
      draw();
    });

    function ensureRunning() {
      idleTime = 0;
      if (!loop.running) loop.start();
    }

    function persist() {
      data.world = P.serialize(world);
      ctx.save();
    }

    // ---------- Zeichnen ----------
    function coinShape(x, y, s, rx, type, alpha = 1, flip = 1, rot = 0, tilt = 0) {
      const ry = rx * 0.46 * flip * (1 - tilt * 0.45);
      g.globalAlpha = alpha;
      const edge = type === "gold" ? "#a86b00" : type === "star" ? "#7a1e6b" : type === "mega" ? "#3b1d80" : "#9a6a00";
      const face = type === "gold" ? "#ffe066" : type === "star" ? "#ff7ad0" : type === "mega" ? "#9b5cff" : "#f2b632";
      const rim = type === "gold" ? "#fff6c8" : type === "star" ? "#ffd1f0" : type === "mega" ? "#ffd84d" : "#ffe39a";
      g.fillStyle = edge;
      g.beginPath();
      g.ellipse(x, y + rx * 0.16, rx, Math.abs(ry), 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = face;
      g.beginPath();
      g.ellipse(x, y, rx, Math.abs(ry), 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rim;
      g.lineWidth = Math.max(1, rx * 0.12);
      g.beginPath();
      g.ellipse(x, y, rx * 0.66, Math.abs(ry) * 0.66, 0, 0, Math.PI * 2);
      g.stroke();
      // Prägung dreht sich mit der Münze (sichtbare Bewegung/Rotation)
      if (type === "normal" && rx > 4) {
        g.strokeStyle = "rgba(154,106,0,.55)";
        g.lineWidth = Math.max(1, rx * 0.09);
        g.beginPath();
        g.moveTo(x + Math.cos(rot) * rx * 0.42, y + Math.sin(rot) * Math.abs(ry) * 0.42);
        g.lineTo(x - Math.cos(rot) * rx * 0.42, y - Math.sin(rot) * Math.abs(ry) * 0.42);
        g.stroke();
      }
      if (type === "mega") {
        g.fillStyle = "#ffd84d";
        g.font = `900 ${rx * 0.6}px system-ui`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(P.COIN_TYPES.mega.value), x, y + 1);
      }
      if (type === "star") {
        g.fillStyle = "#fff";
        g.font = `900 ${rx * 0.8}px system-ui`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("★", x, y + 1);
      } else if (type === "gold") {
        g.fillStyle = "rgba(255,255,255,.75)";
        g.beginPath();
        g.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.18, Math.abs(ry) * 0.18, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      void s;
    }

    function quad(p1, p2, p3, p4, fill) {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.fill();
    }

    function draw() {
      st.begin();
      const { W, H } = L;
      g.clearRect(0, 0, W, H);
      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 6);

      const hw = P.HALF_W;
      const ph = L.pusherH;
      // Rückwand
      const bl = proj(-hw, 0);
      const br = proj(hw, 0);
      const wallTop = bl.y - L.ppu * 30 * bl.s * 0.5;
      const wg = g.createLinearGradient(0, wallTop, 0, bl.y);
      wg.addColorStop(0, "#1a0f33");
      wg.addColorStop(1, "#2e1c58");
      g.fillStyle = wg;
      g.fillRect(bl.x, wallTop, br.x - bl.x, bl.y - wallTop);
      g.fillStyle = "#2de2e6";
      for (let i = 0; i < 9; i++) {
        const x = bl.x + ((br.x - bl.x) * (i + 0.5)) / 9;
        g.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(world.t * 4 + i));
        g.beginPath();
        g.arc(x, wallTop + 6, 2.5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;

      // Boden (Feld)
      const fl = proj(-hw, P.LEN);
      const fr = proj(hw, P.LEN);
      const floor = g.createLinearGradient(0, bl.y, 0, fl.y);
      floor.addColorStop(0, "#22164a");
      floor.addColorStop(1, "#3b2566");
      quad(bl, br, fr, fl, floor);
      // Rasterlinien
      g.strokeStyle = "rgba(45,226,230,.08)";
      g.lineWidth = 1;
      for (let y = 10; y < P.LEN; y += 10) {
        const a = proj(-hw, y);
        const b = proj(hw, y);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }

      // Seitenwände (bis SIDE_OPEN) + Rinnen
      const so = P.SIDE_OPEN;
      for (const side of [-1, 1]) {
        const a = proj(side * hw, 0);
        const b = proj(side * hw, so);
        g.strokeStyle = "rgba(143,246,248,.55)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(a.x, a.y - 30);
        g.lineTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.lineTo(b.x, b.y - 22 * b.s);
        g.stroke();
        const c = proj(side * hw, P.LEN);
        // Seitenrinne: dunkler Spalt mit Warnstreifen – hier fallen Münzen ins Leere
        g.fillStyle = "rgba(0,0,0,.75)";
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(c.x, c.y);
        g.lineTo(c.x + side * 16, c.y);
        g.lineTo(b.x + side * 12, b.y);
        g.closePath();
        g.fill();
        g.save();
        g.clip();
        g.strokeStyle = "rgba(255,90,90,.55)";
        g.lineWidth = 3;
        for (let k = -4; k < 14; k++) {
          const yy = b.y + k * 8;
          g.beginPath();
          g.moveTo(b.x - 20, yy);
          g.lineTo(b.x + 20, yy + side * 10);
          g.stroke();
        }
        g.restore();
        g.fillStyle = "rgba(255,90,90,.85)";
        g.font = `900 ${Math.max(8, 9 * b.s)}px ui-rounded, system-ui, sans-serif`;
        g.textAlign = "center";
        g.save();
        g.translate((b.x + c.x) / 2 + side * 3, (b.y + c.y) / 2);
        g.rotate(side * Math.PI / 2);
        g.fillText("RINNE", 0, 0);
        g.restore();
      }

      // Schieber
      const py = world.py;
      const tl = proj(-hw, 0, ph);
      const tr = proj(hw, 0, ph);
      const fl2 = proj(-hw, py, ph);
      const fr2 = proj(hw, py, ph);
      const bl2 = proj(-hw, py, 0);
      const br2 = proj(hw, py, 0);
      quad(tl, tr, fr2, fl2, "#5a4a85");
      g.strokeStyle = "rgba(255,255,255,.08)";
      for (let i = 1; i < 6; i++) {
        const a = proj(-hw + (2 * hw * i) / 6, 0, ph);
        const b = proj(-hw + (2 * hw * i) / 6, py, ph);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      const face = g.createLinearGradient(0, fl2.y, 0, bl2.y);
      face.addColorStop(0, "#b7a8d6");
      face.addColorStop(1, "#6b5c94");
      quad(fl2, fr2, br2, bl2, face);
      g.fillStyle = "#ff3d9a";
      g.fillRect(fl2.x, fl2.y - 1, fr2.x - fl2.x, 2);

      // Münzen: Regal, dann Feld (von hinten nach vorn)
      const shelf = world.coins.filter((c) => c.layer === 0).sort((a, b) => a.y - b.y);
      const field = world.coins.filter((c) => c.layer === 1).sort((a, b) => a.y - b.y);
      const stackedCoins = world.coins.filter((c) => c.layer === 2).sort((a, b) => a.y - b.y);
      for (const c of shelf) {
        const p = proj(c.x, c.y, ph + c.z);
        coinShape(p.x, p.y, p.s, c.r * L.ppu * p.s, c.type, 1, 1, c.rot);
      }
      const now = performance.now() / 1000;
      for (const c of field) {
        const tt = P.teeter(c);
        const wob = tt > 0 ? Math.sin(now * 18 + c.id) * tt * 1.5 : 0;
        const p = proj(c.x, c.y, c.z - tt * 1.2);
        if (tt > 0.3) {
          g.fillStyle = `rgba(255,61,154,${tt * 0.35})`;
          g.beginPath();
          g.ellipse(p.x, p.y, c.r * L.ppu * p.s * 1.25, c.r * L.ppu * p.s * 0.6, 0, 0, Math.PI * 2);
          g.fill();
        }
        coinShape(p.x + wob, p.y, p.s, c.r * L.ppu * p.s, c.type, 1, 1, c.rot, tt);
      }
      // Stapel: liegen erhöht auf anderen Münzen
      for (const c of stackedCoins) {
        const tt = P.teeter(c);
        const p = proj(c.x, c.y, 2.4 - tt);
        g.fillStyle = "rgba(0,0,0,.28)";
        g.beginPath();
        g.ellipse(p.x + 2, p.y + c.r * L.ppu * p.s * 0.55, c.r * L.ppu * p.s, c.r * L.ppu * p.s * 0.4, 0, 0, Math.PI * 2);
        g.fill();
        coinShape(p.x, p.y, p.s, c.r * L.ppu * p.s, c.type, 1, 1, c.rot, tt);
      }

      // Vorderkante
      const glow = 0.5 + edgeFlash * 0.5;
      g.fillStyle = `rgba(255,61,154,${glow})`;
      g.shadowColor = "#ff3d9a";
      g.shadowBlur = 10 + edgeFlash * 20;
      g.fillRect(fl.x, fl.y, fr.x - fl.x, 4);
      g.shadowBlur = 0;

      // Fallende Münzen
      for (const c of world.falling) {
        const t = c.fall.t;
        const base = proj(c.x, P.LEN);
        let x = base.x;
        let y = base.y + 0.5 * 1400 * t * t;
        if (c.fall.side) {
          const sp = proj(c.x, c.y);
          x = sp.x + c.fall.side * t * 60;
          y = sp.y + 0.5 * 1200 * t * t;
        }
        const rx = c.r * L.ppu * base.s;
        coinShape(x, y, base.s, rx, c.type, Math.max(0, 1 - t / 0.9), Math.cos(t * 14));
      }

      // Schale
      const trayTop = fl.y + 30;
      if (trayTop < H - 10) {
        g.fillStyle = "#0d0820";
        g.fillRect(fl.x - 10, trayTop, fr.x - fl.x + 20, H - trayTop);
        g.strokeStyle = "rgba(255,197,61,.35)";
        g.strokeRect(fl.x - 10, trayTop, fr.x - fl.x + 20, H - trayTop);
        tray.forEach((tc, i) => {
          const rx = P.R * L.ppu * 0.8;
          const x = L.W / 2 + tc.x * (fr.x - fl.x) * 0.9;
          const y = H - 10 - (i % 4) * 3 - rx * 0.2;
          coinShape(x, Math.min(H - 6, y), 1, rx, tc.t);
        });
      }

      // Einwurf-Schacht
      const chute = proj(dropX, 0, 34);
      const cw = P.R * L.ppu * chute.s * 1.6;
      g.fillStyle = "rgba(255,197,61,.18)";
      g.beginPath();
      g.moveTo(chute.x - cw * 0.6, chute.y);
      g.lineTo(chute.x + cw * 0.6, chute.y);
      const landing = proj(dropX, Math.max(P.R, world.py - P.R * 1.6), ph);
      g.lineTo(landing.x + cw * 0.4, landing.y);
      g.lineTo(landing.x - cw * 0.4, landing.y);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffc53d";
      g.shadowColor = "#ffc53d";
      g.shadowBlur = 12;
      g.beginPath();
      g.roundRect ? g.roundRect(chute.x - cw / 2, chute.y - 8, cw, 12, 4) : g.rect(chute.x - cw / 2, chute.y - 8, cw, 12);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#1a0f33";
      g.fillRect(chute.x - cw * 0.35, chute.y - 4, cw * 0.7, 3);
      g.restore();
    }

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Münzkaskade",
        body: h(
          "div.help-text",
          {},
          h("p", {}, `Jede Münze kostet ${COIN_PRICE} Credits. Tippe auf die Position, an der die Münze einfallen soll – oder halte gedrückt, um mehrere Münzen nacheinander einzuwerfen. Am Computer: Pfeiltasten und Leertaste.`),
          h("p", {}, "Die Münze landet auf dem Schieber. Er fährt regelmäßig vor und zurück und schiebt die Münzen übers Feld. Was über die vordere Kante fällt, gehört dir. Vorne an den Seiten gibt es Rinnen – dort fallen Münzen ins Leere."),
          h("h3", {}, "Besondere Münzen"),
          h("p", {}, `Goldmünze: zählt ${P.COIN_TYPES.gold.value}× (${P.COIN_TYPES.gold.value * COIN_PRICE} Credits). Sternmünze: löst einen Münzregen mit ${P.COIN_TYPES.star.bonus} Gratis-Münzen aus. Mega-Münze (groß, lila): zählt ${P.COIN_TYPES.mega.value}× und ist schwer – sie lässt sich weniger leicht verschieben. Beim Einwurf ist etwa jede ${Math.round(1 / P.DROP_ODDS.gold)}. Münze aus Gold, jede ${Math.round(1 / P.DROP_ODDS.star)}. ein Stern und jede ${Math.round(1 / P.DROP_ODDS.mega)}. eine Mega-Münze.`),
          h("h3", {}, "Physik"),
          h("p", {}, "Geschobene Münzen gleiten ein Stück nach und stoßen andere an – so entstehen Kettenreaktionen. Wird es eng, rutschen Münzen auf ihre Nachbarn und bilden kleine Stapel; verschwindet die Unterlage, fallen sie mit. Eine Münze fällt erst, wenn ihr Mittelpunkt die Kante überschreitet – bis dahin kann sie gefährlich weit überstehen (sie wackelt und leuchtet rosa)."),
          h("p", {}, "Es gibt keine versteckte Steuerung: Was fällt, entscheidet allein die (vereinfachte) Physik. Langfristig fällt etwas weniger heraus, als hineinkommt – vor allem durch die rot markierten Seitenrinnen (Simulation: mittig eingeworfen ≈ 97 %, wahllos ≈ 92 %, an den Rand ≈ 80 %). Das Feld wird gespeichert und bleibt beim nächsten Besuch so liegen.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    draw();
    loop.start();

    return {
      finalize() {
        flushCredit();
        persist();
      },
      pause() {
        holding = false;
      },
      destroy() {
        dead = true;
        flushCredit();
        persist();
        hum.stop();
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
