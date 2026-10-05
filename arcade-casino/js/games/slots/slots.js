// Gemeinsame Slot-Oberfläche für alle drei Maschinen (Konfiguration in machines.js).

import { h } from "../../ui/dom.js";
import { createBetControl } from "../../ui/betControl.js";
import { createStage, createLoop } from "../../render/stage.js";
import { MACHINES } from "./machines.js";
import { spin as doSpin } from "./engine.js";
import { symbolImage, symbolIcon, SYMBOL_NAMES } from "./symbols.js";

const SPIN_SPEED = 20; // Symbole pro Sekunde
const easeOutBack = (t) => {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const mod = (a, n) => ((a % n) + n) % n;

export default {
  mount(root, ctx) {
    const m = MACHINES[ctx.opts.machine] || MACHINES.fruit;
    const { economy, play, haptic, particles } = ctx;
    const data = ctx.data;
    const gameId = ctx.id;
    const limits = { min: m.betSteps[0], max: m.betSteps[m.betSteps.length - 1] };
    const t = m.theme;
    let dead = false;

    // ---------- DOM ----------
    const stage = h("div.game-stage.slot-stage", {
      style: { "--sf": t.frame, "--sf2": t.frame2, "--sbg0": t.bg[0], "--sbg1": t.bg[1] },
    });
    const marquee = h("div.slot-marquee", {}, h("div.marquee-bulbs", { "aria-hidden": "true" }, Array.from({ length: 9 }, () => h("i"))), h("h2", {}, m.name), h("p", {}, m.tagline));
    const windowEl = h("div.slot-window", { style: { "--aspect": `${m.reels} / ${m.rows * (m.reels === 5 ? 1.05 : 1)}` }, role: "button", "aria-label": "Walzen drehen", tabindex: "-1" });
    const winVal = h("strong.num", {}, "0");
    const msgVal = h("strong", {}, "Viel Glück!");
    const freeBadge = h("div.slot-free", { hidden: true });
    const cabinet = h(
      "div.slot-cabinet",
      { style: { "--cab-w": m.reels === 5 ? "640px" : "430px" } },
      freeBadge,
      windowEl,
      h("div.slot-meter", {}, h("div.slot-display", {}, h("small", {}, "Gewinn"), winVal), h("div.slot-display.msg", { style: { flex: "1.6" } }, h("small", {}, "Info"), msgVal))
    );
    stage.append(marquee, cabinet);

    const controls = h("div.game-controls");
    const betCtl = createBetControl({
      steps: m.betSteps,
      value: Number(data.bet) || m.defaultBet,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
        render();
      },
    });
    const spinBtn = h("button.btn.btn-primary.spin-btn", { type: "button", "aria-keyshortcuts": "Space" }, "Dreh");
    const autoBtn = h("button.btn.btn-sm.auto-btn", { type: "button", "aria-pressed": "false" }, "Auto");
    const lineInfo = h("div.ctrl-label", {}, h("small", {}, "Linien"), h("strong.num", {}, String(m.lines.length)));
    controls.append(h("div.ctrl-group", {}, lineInfo, betCtl.el), h("div.ctrl-group", {}, spinBtn, autoBtn));
    root.append(stage, controls);

    // ---------- Canvas ----------
    const st = createStage(windowEl, { maxDpr: 2 });
    const { ctx: g } = st;
    const reels = m.strips.map((strip, i) => ({
      strip,
      pos: Number.isInteger(data.stops?.[i]) ? mod(data.stops[i], strip.length) : (i * 7) % strip.length,
      state: "idle",
      speed: 0,
      tween: null,
      lastIdx: 0,
      stopAt: 0,
    }));

    // ---------- Spielzustand ----------
    let phase = "idle"; // idle | spinning | showing
    let outcome = null;
    let ticket = null;
    let spinT = 0;
    let quick = false;
    let isFree = false;
    let auto = false;
    let autoTimer = 0;
    let highlight = null; // { lines, t, idx }
    let winShown = 0;
    let free = data.free && Number.isInteger(data.free.n) && data.free.n > 0 && m.betSteps.includes(data.free.bet) ? { n: data.free.n, bet: data.free.bet, total: data.free.total || 0 } : null;

    function lineBetFor(bet) {
      return bet / m.lines.length;
    }

    function updateFreeBadge() {
      if (free && free.n > 0) {
        freeBadge.hidden = false;
        freeBadge.textContent = `Freispiele: ${free.n} · Gewinne ×${m.freeSpinMultiplier || 1}`;
      } else freeBadge.hidden = true;
    }

    function setMsg(s) {
      msgVal.textContent = s;
    }

    function updateControls() {
      const spinning = phase === "spinning";
      spinBtn.textContent = spinning ? "Stopp" : free?.n ? "Frei" : "Dreh";
      spinBtn.classList.toggle("is-stop", spinning);
      betCtl.setDisabled(spinning || Boolean(free?.n));
      autoBtn.setAttribute("aria-pressed", String(auto));
    }

    // ---------- Ablauf ----------

    function startSpin() {
      if (dead) return;
      if (phase === "spinning") {
        quickStop();
        return;
      }
      clearTimeout(autoTimer);
      isFree = Boolean(free && free.n > 0);
      const bet = isFree ? free.bet : betCtl.value;
      if (!isFree) {
        const check = economy.validateBet(bet, limits);
        if (!check.ok) {
          play("ui.error");
          haptic("impulse");
          setAuto(false);
          ctx.toast(check.reason === "Nicht genug Credits" ? "Nicht genug Credits – Einsatz senken oder in der Halle nachfüllen." : check.reason, { icon: "⚠️", tone: "red" });
          return;
        }
        ticket = economy.placeBet(gameId, bet, limits);
        if (!ticket) return;
      } else {
        free.n--;
        data.free = { n: free.n, bet: free.bet, total: free.total };
        updateFreeBadge();
      }

      outcome = doSpin(m, lineBetFor(bet), { multiplier: isFree ? m.freeSpinMultiplier || 1 : 1 });
      outcome.bet = bet;
      data.stops = outcome.stops;
      ctx.save();

      phase = "spinning";
      quick = false;
      highlight = null;
      winShown = 0;
      winVal.textContent = "0";
      setMsg(isFree ? "Freispiel!" : "Die Walzen drehen …");
      marquee.classList.remove("is-winning");
      spinT = 0;
      play("reel.start");
      haptic("impulse");

      // Stopp-Zeitpunkte inkl. Spannungsaufbau
      let delay = 0.55;
      let scattersSoFar = 0;
      reels.forEach((r, i) => {
        r.state = "spin";
        r.speed = 0;
        r.tween = null;
        r.anticipate = false;
        if (i > 0) delay += 0.22;
        if (m.scatter && scattersSoFar >= 2) {
          delay += 0.8;
          r.anticipate = true;
        } else if (m.reels === 3 && i === 2 && anticipationFor3(outcome.grid)) {
          delay += 0.7;
          r.anticipate = true;
        }
        r.stopAt = delay;
        if (m.scatter) scattersSoFar += outcome.grid[i].filter((s) => s === m.scatter.symbol).length;
      });
      updateControls();
      loop.start();
    }

    function anticipationFor3(grid) {
      // zwei gleiche wertvolle Symbole auf der Gewinnlinie vorne
      const row = m.payRow ?? 1;
      const a = grid[0][row];
      const b = grid[1][row];
      return a === b && ["seven", "star", "bell"].includes(a);
    }

    function quickStop() {
      quick = true;
      reels.forEach((r, i) => {
        if (r.state === "spin") r.stopAt = spinT + 0.02 + i * 0.06;
      });
    }

    function beginStop(r, i) {
      const len = r.strip.length;
      r.pos = mod(r.pos, len);
      let d = mod(r.pos - outcome.stops[i], len);
      const minTravel = r.speed > 10 ? 3 : 1;
      if (d < minTravel) d += len;
      if (quick) {
        // Schnellstopp: kürzester Weg zum (bereits feststehenden) Ziel
        d = mod(r.pos - outcome.stops[i], len);
        if (d < 0.5) d += len;
      }
      const target = r.pos - d;
      const dur = quick ? 0.22 : Math.max(0.28, Math.min(1.2, (d / Math.max(8, r.speed)) * 1.5));
      r.tween = { from: r.pos, to: target, t: 0, d: dur };
      r.state = "stopping";
    }

    function reelStopped(r, i) {
      r.state = "idle";
      r.speed = 0;
      r.pos = mod(r.tween.to, r.strip.length);
      r.tween = null;
      const last = i === reels.length - 1;
      play("reel.stop", { pan: (i / (reels.length - 1) - 0.5) * 1.2, pitch: last ? 0.85 : 1 });
      haptic(last ? "heavy" : "impulse", last ? 1 : 0.7);
      if (m.scatter && outcome.grid[i].includes(m.scatter.symbol)) play("coin.clink", { pitch: 1.4 });
      const next = reels[i + 1];
      if (next?.anticipate) play("reel.anticipation");
      if (reels.every((x) => x.state === "idle")) finishSpin();
    }

    function finishSpin() {
      phase = "showing";
      const total = outcome.total;
      const bet = outcome.bet;
      if (ticket) {
        economy.settle(ticket, total);
        ticket = null;
      } else if (isFree) {
        if (total > 0) economy.credit(gameId, total, "freespin");
        economy.countRound(gameId);
        free.total += total;
      }

      const ratio = total / bet;
      const winLines = outcome.lines.slice();
      highlight = winLines.length || outcome.scatter ? { lines: winLines, scatter: outcome.scatter, t: 0, idx: -1 } : null;

      if (total > 0) {
        const rect = windowEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        marquee.classList.add("is-winning");
        if (ratio >= 15) {
          play("win.big");
          haptic("big");
          particles.burst(cx, cy, { kind: "coins", count: 50, spread: 1.6, power: 1.3 });
          particles.burst(cx, cy, { kind: "confetti", count: ratio >= 50 ? 90 : 40, spread: 2 });
          ctx.banner({ title: ratio >= 50 ? "Megagewinn!" : "Großgewinn!", sub: "+" + ctx.fmt(total), ms: 2600 });
          if (ratio >= 20) ctx.progression.award("slots-big");
          setAuto(false);
        } else if (ratio >= 3) {
          play("win.medium");
          haptic("success");
          particles.burst(cx, cy, { kind: "coins", count: 18 });
        } else {
          play("win.small");
          haptic("tap");
        }
        particles.coinsToBalance(cx, cy, Math.min(16, 3 + Math.round(ratio * 2)));
        setMsg(describeWin(winLines[0], outcome.scatter));
      } else {
        setMsg(isFree ? "Kein Gewinn – weiter geht's" : "Kein Gewinn");
      }

      if (outcome.scatter?.freeSpins) {
        const n = outcome.scatter.freeSpins;
        if (!free || free.n <= 0) free = { n: 0, bet, total: 0 };
        free.n += n;
        data.free = { n: free.n, bet: free.bet, total: free.total };
        ctx.progression.award("slots-free");
        play("levelup");
        haptic("big");
        ctx.banner({ title: `${n} Freispiele!`, sub: `Gewinne ×${m.freeSpinMultiplier}`, ms: 2400 });
        setAuto(false);
      }

      if (isFree && free.n <= 0) {
        const sum = free.total;
        free = null;
        data.free = null;
        setTimeout(() => {
          if (dead) return;
          ctx.banner({ title: "Freispiele vorbei", sub: "+" + ctx.fmt(sum), tone: sum > 0 ? "win" : "push", ms: 2400 });
        }, 1200);
      }
      ctx.save();
      updateFreeBadge();
      phase = "idle";
      betCtl.fitToBalance();
      updateControls();

      // Fortsetzung: Freispiele laufen automatisch, Auto-Dreh optional
      if (free && free.n > 0) {
        autoTimer = setTimeout(startSpin, total > 0 ? 1900 : 1100);
      } else if (auto) {
        autoTimer = setTimeout(startSpin, total > 0 ? 1600 : 650);
      }
      if (!highlight) loop.stop();
      render();
    }

    function describeWin(line, scatter) {
      if (line) {
        const name = line.symbol === "mixed" ? "Mix" : SYMBOL_NAMES[line.symbol] || line.symbol;
        return `${m.lines.length > 1 ? `Linie ${line.line + 1}: ` : ""}${line.count}× ${name} = ${ctx.fmt(line.win)}`;
      }
      if (scatter) return `${scatter.count}× Komet!`;
      return "";
    }

    function setAuto(v) {
      auto = v;
      updateControls();
      if (!v) clearTimeout(autoTimer);
    }

    // ---------- Rendering ----------

    const loop = createLoop((dt) => {
      if (phase === "spinning") {
        spinT += dt;
        reels.forEach((r, i) => {
          if (r.state === "spin") {
            r.speed = Math.min(SPIN_SPEED + i, r.speed + dt * 90);
            r.pos -= r.speed * dt;
            if (spinT >= r.stopAt) beginStop(r, i);
          } else if (r.state === "stopping") {
            r.tween.t += dt;
            const k = Math.min(1, r.tween.t / r.tween.d);
            r.pos = r.tween.from + (r.tween.to - r.tween.from) * easeOutBack(k);
            r.speed = Math.max(0, r.speed - dt * 30);
            if (k >= 1) reelStopped(r, i);
          }
          const idx = Math.floor(r.pos);
          if (idx !== r.lastIdx) {
            r.lastIdx = idx;
            if (i === 0 && r.state === "spin") play("reel.tick", { vol: 0.6 });
          }
        });
      }
      if (highlight) {
        highlight.t += dt;
        // Gewinnzähler hochzählen
        const total = outcome.total;
        if (winShown < total) {
          winShown = Math.min(total, winShown + Math.max(1, total * dt * 1.6));
          winVal.textContent = ctx.fmt(Math.floor(winShown));
          if (Math.random() < 0.5) play("coin.clink", { vol: 0.35, pitch: 1.2 });
        }
        const cycle = 1.2;
        const n = highlight.lines.length;
        const idx = highlight.t < 1 ? -1 : n ? Math.floor((highlight.t - 1) / cycle) % n : -1;
        if (idx !== highlight.idx) {
          highlight.idx = idx;
          if (idx >= 0) setMsg(describeWin(highlight.lines[idx], null));
        }
        if (highlight.t > 1 + cycle * Math.max(1, n) * 3 && phase !== "spinning") {
          // Nach drei Durchläufen ruhig weiterleuchten, Loop anhalten
          winVal.textContent = ctx.fmt(total);
          loop.stop();
        }
      }
      render();
    });

    function geom() {
      const W = st.width;
      const H = st.height;
      const pad = Math.max(6, W * 0.015);
      const gap = Math.max(4, W * 0.012);
      const rw = (W - pad * 2 - gap * (m.reels - 1)) / m.reels;
      const sh = (H - pad * 2) / m.rows;
      return { W, H, pad, gap, rw, sh, size: Math.min(rw, sh) * 0.8 };
    }

    function cellCenter(G, r, row) {
      return [G.pad + r * (G.rw + G.gap) + G.rw / 2, G.pad + row * G.sh + G.sh / 2];
    }

    const darkReels = m.id === "cosmo";

    function render() {
      st.begin();
      const G = geom();
      g.clearRect(0, 0, G.W, G.H);
      const bg = g.createLinearGradient(0, 0, 0, G.H);
      bg.addColorStop(0, "#07040e");
      bg.addColorStop(1, "#140b24");
      g.fillStyle = bg;
      g.fillRect(0, 0, G.W, G.H);

      const px = G.size * st.dpr;
      reels.forEach((r, i) => {
        const x = G.pad + i * (G.rw + G.gap);
        const y = G.pad;
        const hgt = G.sh * m.rows;
        g.save();
        g.beginPath();
        g.roundRect ? g.roundRect(x, y, G.rw, hgt, 8) : g.rect(x, y, G.rw, hgt);
        g.clip();
        const rg = g.createLinearGradient(x, 0, x + G.rw, 0);
        if (darkReels) {
          rg.addColorStop(0, "#120a2c");
          rg.addColorStop(0.5, "#24164f");
          rg.addColorStop(1, "#120a2c");
        } else {
          rg.addColorStop(0, "#d8d0e6");
          rg.addColorStop(0.5, "#fffdf8");
          rg.addColorStop(1, "#d8d0e6");
        }
        g.fillStyle = rg;
        g.fillRect(x, y, G.rw, hgt);

        const len = r.strip.length;
        const first = Math.floor(r.pos) - 1;
        const blur = r.speed > 8;
        for (let j = first; j <= first + m.rows + 2; j++) {
          const sym = r.strip[mod(j, len)];
          const cy = y + (j - r.pos) * G.sh + G.sh / 2;
          const img = symbolImage(sym, px);
          const sx = x + G.rw / 2 - G.size / 2;
          if (blur) {
            g.globalAlpha = 0.35;
            g.drawImage(img, sx, cy - G.size / 2 - G.sh * 0.18, G.size, G.size);
            g.drawImage(img, sx, cy - G.size / 2 + G.sh * 0.18, G.size, G.size);
            g.globalAlpha = 0.7;
          }
          g.drawImage(img, sx, cy - G.size / 2, G.size, G.size);
          g.globalAlpha = 1;
        }
        // Walzenwölbung
        const sh = g.createLinearGradient(0, y, 0, y + hgt);
        sh.addColorStop(0, "rgba(0,0,0,.55)");
        sh.addColorStop(0.18, "rgba(0,0,0,0)");
        sh.addColorStop(0.82, "rgba(0,0,0,0)");
        sh.addColorStop(1, "rgba(0,0,0,.55)");
        g.fillStyle = sh;
        g.fillRect(x, y, G.rw, hgt);
        if (r.anticipate && r.state !== "idle" && phase === "spinning") {
          g.strokeStyle = t.accent;
          g.lineWidth = 4;
          g.shadowColor = t.accent;
          g.shadowBlur = 16;
          g.strokeRect(x + 2, y + 2, G.rw - 4, hgt - 4);
          g.shadowBlur = 0;
        }
        g.restore();
      });

      // Klassik: nur Mittellinie zählt
      if (m.mode === "classic") {
        g.fillStyle = "rgba(5,3,12,.35)";
        g.fillRect(0, G.pad, G.W, G.sh);
        g.fillRect(0, G.pad + G.sh * 2, G.W, G.sh);
        const ly = G.pad + G.sh * 1.5;
        g.strokeStyle = t.line;
        g.globalAlpha = 0.8;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(2, ly);
        g.lineTo(G.W - 2, ly);
        g.stroke();
        g.globalAlpha = 1;
      }

      // Gewinnanzeige
      if (highlight && phase !== "spinning") {
        const pulse = 0.6 + 0.4 * Math.sin(highlight.t * 8);
        const showAll = highlight.idx < 0;
        const list = showAll ? highlight.lines : [highlight.lines[highlight.idx]];
        const colors = ["#ffde59", "#2de2e6", "#ff3d9a", "#8cff5a", "#9b5cff"];
        list.forEach((ln, k) => {
          if (!ln) return;
          const col = showAll ? colors[k % colors.length] : t.line;
          const rows = m.lines[ln.line];
          g.save();
          g.strokeStyle = col;
          g.lineWidth = 4;
          g.lineJoin = "round";
          g.shadowColor = col;
          g.shadowBlur = 14;
          g.globalAlpha = 0.85;
          g.beginPath();
          rows.forEach((row, r) => {
            const [cx, cy] = cellCenter(G, r, row);
            if (r === 0) g.moveTo(cx - G.rw / 2, cy);
            g.lineTo(cx, cy);
            if (r === rows.length - 1) g.lineTo(cx + G.rw / 2, cy);
          });
          if (m.mode !== "classic") g.stroke();
          g.globalAlpha = pulse;
          for (const [r, row] of ln.cells) {
            const [cx, cy] = cellCenter(G, r, row);
            g.strokeRect(cx - G.rw / 2 + 4, cy - G.sh / 2 + 4, G.rw - 8, G.sh - 8);
          }
          g.restore();
        });
        if (highlight.scatter) {
          g.save();
          g.strokeStyle = "#2de2e6";
          g.shadowColor = "#2de2e6";
          g.shadowBlur = 18;
          g.lineWidth = 4;
          g.globalAlpha = pulse;
          for (const [r, row] of highlight.scatter.cells) {
            const [cx, cy] = cellCenter(G, r, row);
            g.beginPath();
            g.arc(cx, cy, Math.min(G.rw, G.sh) * 0.46, 0, Math.PI * 2);
            g.stroke();
          }
          g.restore();
        }
      }
    }
    st.onResize = () => render();

    // ---------- Hilfe ----------
    ctx.setHelp(() => {
      const rows = [];
      const lb = lineBetFor(betCtl.value);
      const payRow = (syms, label, mult) =>
        h("div.paytable-row", {}, h("span.pt-syms", {}, syms.map((s) => symbolIcon(s, 30))), h("span", {}, label), h("span.pt-pay.num", {}, `${mult}× → ${ctx.fmt(mult * lb * (m.mode === "classic" ? 1 : 1))}`));
      for (const [sym, pays] of Object.entries(m.pays)) {
        for (const [n, mult] of Object.entries(pays).sort((a, b) => b[0] - a[0])) {
          rows.push(payRow(Array(Number(n)).fill(sym), `${n}× ${SYMBOL_NAMES[sym]}`, mult));
        }
      }
      if (m.mixed) rows.push(payRow(m.mixed.symbols, "3 gemischt (7/Stern/Bar)", m.mixed.pay));
      if (m.cherry) for (const [n, mult] of Object.entries(m.cherry.pays).sort((a, b) => b[0] - a[0])) rows.push(payRow(Array(Number(n)).fill("cherry"), `${n}× Kirsche (beliebige Position)`, mult));
      if (m.scatter) for (const [n, mult] of Object.entries(m.scatter.pays)) rows.push(payRow(Array(Number(n)).fill("comet"), `${n}× Komet irgendwo: ${m.scatter.freeSpins[n]} Freispiele + ${mult}× Gesamteinsatz`, mult * m.lines.length));
      const strip = m.strips[0];
      const counts = {};
      strip.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
      const RTP = { fruit: "94,2 % (exakt)", seven: "94,7 % (exakt)", cosmo: "ca. 93 % (Simulation, inkl. Freispiele)" };
      ctx.openModal({
        title: m.name,
        body: h(
          "div.help-text",
          {},
          h("p", {}, m.mode === "classic" ? "Nur die mittlere Linie zählt. Kirschen zählen an jeder Position der Linie." : `${m.lines.length} Gewinnlinien, gewertet von links nach rechts. Pro Linie zählt nur der höchste Gewinn.${m.wild ? " Nova (Wild) ersetzt alle Symbole außer dem Kometen." : ""}`),
          h("p", {}, `Einsatz ${ctx.fmt(betCtl.value)} = ${ctx.fmt(lb)} pro Linie. Werte unten: Vielfaches des Linieneinsatzes → Credits.`),
          h("h3", {}, "Gewinntabelle"),
          h("div.paytable", {}, rows),
          h("h3", {}, "Wahrscheinlichkeiten"),
          h("p", {}, `Jede Walze stoppt gleichverteilt auf einer von ${strip.length} Positionen. Walze 1 enthält: ${Object.entries(counts).map(([s, n]) => `${n}× ${SYMBOL_NAMES[s] || "Leerfeld"}`).join(", ")}. Theoretische Auszahlungsquote: ${RTP[m.id]}.`),
          h("p", {}, "Tippe während des Drehens auf „Stopp“, um die Walzen sofort anzuhalten – das Ergebnis steht beim Start bereits fest und ändert sich dadurch nicht.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      });
    });

    // ---------- Eingaben ----------
    spinBtn.addEventListener("click", startSpin);
    windowEl.addEventListener("click", () => {
      if (phase !== "spinning") startSpin();
      else quickStop();
    });
    autoBtn.addEventListener("click", () => {
      play("ui.toggle");
      haptic("tap");
      setAuto(!auto);
      if (auto && phase === "idle") startSpin();
    });
    function onKey(e) {
      if (ctx.isModalOpen() || e.repeat) return;
      if (e.code === "Space" || e.key === "Enter") {
        if (document.activeElement?.tagName === "BUTTON" && document.activeElement !== spinBtn) return;
        e.preventDefault();
        startSpin();
      }
    }
    window.addEventListener("keydown", onKey);

    updateFreeBadge();
    updateControls();
    render();
    if (free?.n) {
      setMsg(`${free.n} Freispiele warten!`);
      autoTimer = setTimeout(startSpin, 1200);
    }

    return {
      finalize() {
        if (ticket && outcome) {
          economy.settle(ticket, outcome.total);
          ticket = null;
        } else if (phase === "spinning" && isFree && outcome) {
          if (outcome.total > 0) economy.credit(gameId, outcome.total, "freespin");
          if (outcome.scatter?.freeSpins && free) {
            free.n += outcome.scatter.freeSpins;
            data.free = { n: free.n, bet: free.bet, total: free.total };
          }
          phase = "idle";
        }
      },
      pause() {
        setAuto(false);
      },
      destroy() {
        dead = true;
        clearTimeout(autoTimer);
        loop.destroy();
        st.destroy();
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
