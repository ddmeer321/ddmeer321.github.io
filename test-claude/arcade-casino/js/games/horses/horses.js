// Pferderennen – Startfeld, Wette, animiertes Rennen. Modell & Quoten: logic.js.
// Das gezeigte Rennen ist exakt die Simulation (Positionen je Zeitschritt);
// Sieger ist, wer in dieser Simulation zuerst die Ziellinie erreicht.

import { h, clear } from "../../ui/dom.js";
import { createStage, createLoop } from "../../render/stage.js";
import { createBetControl } from "../../ui/betControl.js";
import { randInt } from "../../core/rng.js";
import * as H from "./logic.js";

const fmtOdds = (o) => o.toFixed(1).replace(".", ",");

export default {
  mount(root, ctx) {
    const { economy, play, haptic } = ctx;
    const data = ctx.data;
    const L = ctx.limits;
    let dead = false;

    // ---------- DOM ----------
    const stage = h("div.game-stage.horses-stage");
    const trackBox = h("div.horse-track");
    const commentary = h("div.horse-commentary", { role: "status", "aria-live": "polite" }, "Wähle dein Pferd");
    const list = h("div.horse-list", { role: "radiogroup", "aria-label": "Startfeld" });
    stage.append(trackBox, commentary, list);
    const controls = h("div.game-controls");
    const typeSeg = h("div.segmented", { role: "group", "aria-label": "Wettart" });
    let betType = data.type === "place" ? "place" : "win";
    for (const [id, label] of [["win", "Sieg"], ["place", "Platz (1.–2.)"]]) {
      const b = h("button", { type: "button", "aria-pressed": String(id === betType) }, label);
      b.addEventListener("click", () => {
        if (phase !== "card") return;
        betType = id;
        data.type = id;
        typeSeg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        play("ui.toggle");
        renderList();
      });
      typeSeg.append(b);
    }
    const betCtl = createBetControl({
      steps: L.steps,
      value: Number(data.bet) || 20,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
        renderList();
      },
    });
    const startBtn = h("button.btn.btn-primary.btn-lg", { type: "button" }, "Rennen starten");
    controls.append(h("div.ctrl-group", {}, typeSeg), h("div.ctrl-group", {}, betCtl.el, startBtn));
    root.append(stage, controls);
    const st = createStage(trackBox);
    const g = st.ctx;

    // ---------- Zustand ----------
    let phase = "card"; // card | race | result
    let card = null;
    let market = null;
    let pick = -1;
    let ticket = null;
    let race = null; // { res, t, leader, called }
    let stakeInfo = null;
    let hoofT = 0;
    let history = Array.isArray(data.history) ? data.history.filter((x) => x && Number.isInteger(x.no)).slice(0, 6) : [];

    function setPhase(p) {
      phase = p;
      ctx.setPhase(p);
      startBtn.disabled = p !== "card" || pick < 0 || !market;
      betCtl.setDisabled(p !== "card");
      typeSeg.querySelectorAll("button").forEach((b) => (b.disabled = p !== "card"));
      startBtn.textContent = p === "result" ? "Nächstes Rennen" : "Rennen starten";
      if (p === "result") startBtn.disabled = false;
    }

    function newCard() {
      card = H.makeCard(randInt(2 ** 31));
      market = null;
      pick = -1;
      race = null;
      commentary.textContent = "Quoten werden berechnet …";
      renderList();
      draw(0);
      setPhase("card");
      // Quoten = Monte-Carlo desselben Rennmodells (kurz rechnen, dann anzeigen)
      setTimeout(() => {
        if (dead) return;
        market = H.buildMarket(card);
        commentary.textContent = "Wähle dein Pferd – Quote × Einsatz = Auszahlung";
        renderList();
        setPhase("card");
      }, 30);
    }

    function renderList() {
      clear(list);
      if (!card) return;
      card.horses.forEach((hh, i) => {
        const odds = market ? (betType === "win" ? market.win[i] : market.place[i]) : null;
        const p = market ? (betType === "win" ? market.pWin[i] : market.pPlace[i]) : null;
        const btn = h(
          `button.horse-row${pick === i ? ".is-picked" : ""}`,
          { type: "button", role: "radio", "aria-checked": String(pick === i), disabled: phase !== "card" || !market, dataset: { horse: String(i), odds: odds !== null ? String(odds) : "" } },
          h("span.horse-no", { style: { "--silk": hh.silk } }, String(hh.no)),
          h("span.horse-name", {}, hh.name, h("small", {}, H.STYLES[hh.style].label)),
          h("span.horse-prob", {}, p !== null ? `${Math.round(p * 100)} %` : "…"),
          h("span.horse-odds.num", {}, odds !== null ? fmtOdds(odds) : "…")
        );
        btn.addEventListener("click", () => {
          if (phase !== "card" || !market) return;
          pick = i;
          play("chip", { pitch: 0.9 + i * 0.05 });
          haptic("tick");
          renderList();
          const o = betType === "win" ? market.win[i] : market.place[i];
          commentary.textContent = `Nr. ${hh.no} ${hh.name} · ${betType === "win" ? "Sieg" : "Platz"} · mögliche Auszahlung ${ctx.fmt(Math.floor(betCtl.value * o))}`;
          setPhase("card");
        });
        list.append(btn);
      });
    }

    function startRace() {
      if (phase === "result") {
        newCard();
        return;
      }
      if (phase !== "card" || pick < 0 || !market) return;
      const stake = betCtl.value;
      const check = economy.validateBet(stake, { min: L.min, max: L.max });
      if (!check.ok) {
        play("ui.error");
        ctx.toast(check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      ticket = economy.placeBet("horses", stake, { min: L.min, max: L.max });
      if (!ticket) return;
      const odds = betType === "win" ? market.win[pick] : market.place[pick];
      stakeInfo = { stake, odds, type: betType, horse: pick };
      // Das Rennen: ein unabhängiger Lauf desselben Modells, komplett berechnet
      const res = H.runRace(card, randInt(2 ** 31), { track: true });
      race = { res, t: -1.2, leader: -1, called: new Set() };
      play("race.bell");
      haptic("impulse");
      commentary.textContent = "Die Pferde gehen in die Startboxen …";
      setPhase("race");
      renderList();
      loop.start();
    }

    function framePos(t) {
      const fr = race.res.frames;
      const k = Math.max(0, t / H.DT);
      const i = Math.min(fr.length - 1, Math.floor(k));
      const j = Math.min(fr.length - 1, i + 1);
      const f = k - Math.floor(k);
      return fr[i].map((x, n) => x + (fr[j][n] - x) * f);
    }

    function call(key, text) {
      if (race.called.has(key)) return;
      race.called.add(key);
      commentary.textContent = text;
    }

    function finishRace() {
      const order = race.res.order;
      const { stake, odds, type, horse } = stakeInfo;
      const pay = H.payout(type, horse, stake, odds, order);
      if (ticket) {
        economy.settle(ticket, pay);
        ticket = null;
      }
      const winner = card.horses[order[0]];
      const winOdds = market.win[order[0]];
      const margin = race.res.finish[order[1]] - race.res.finish[order[0]];
      history.unshift({ no: winner.no, name: winner.name, odds: winOdds });
      history = history.slice(0, 6);
      data.history = history;
      ctx.save();
      const won = pay > 0;
      ctx.report("horses:race", { won, odds: won ? odds : 0, type });
      if (won && type === "win" && odds >= 8) ctx.progression.award("horses-underdog");
      const underdog = won && winOdds >= 8 && order[0] === horse;
      const placeText = order.slice(0, 3).map((i, k) => `${k + 1}. Nr. ${card.horses[i].no}`).join(" · ");
      commentary.textContent = `${margin < 0.06 ? "Fotofinish! " : ""}Sieger: Nr. ${winner.no} ${winner.name} (Quote ${fmtOdds(winOdds)}) · ${placeText}`;
      play("race.cheer", { vol: underdog ? 1 : 0.6 });
      ctx.celebrate({
        stake,
        payout: pay,
        jackpot: underdog && odds >= 15,
        title: won ? (underdog ? "Außenseiter-Sieg!" : type === "win" ? "Dein Pferd gewinnt!" : "Platz erreicht!") : "Nicht im Ziel vorn",
        detail: won ? `Quote ${fmtOdds(odds)}` : `Sieger Nr. ${winner.no}`,
      });
      setPhase("result");
    }

    // ---------- Animation ----------
    const loop = createLoop((dt) => {
      if (phase !== "race" || !race) {
        draw(dt);
        loop.stop();
        return;
      }
      const before = race.t;
      race.t += dt;
      if (before < 0 && race.t >= 0) {
        play("race.gate");
        haptic("heavy");
        commentary.textContent = "Und los geht's!";
      }
      if (race.t >= 0) {
        const pos = framePos(race.t);
        const leader = pos.indexOf(Math.max(...pos));
        const lp = pos[leader] / H.DISTANCE;
        if (leader !== race.leader && race.t > 0.8 && lp < 0.97) {
          if (race.leader >= 0) {
            const hh = card.horses[leader];
            commentary.textContent = `Nr. ${hh.no} ${hh.name} übernimmt die Führung!`;
            play("chip", { pitch: 1.4, vol: 0.4 });
          }
          race.leader = leader;
        }
        if (lp > 0.5) call("half", `Halbzeit – vorne: Nr. ${card.horses[leader].no} ${card.horses[leader].name}`);
        if (lp > 0.78) {
          call("final", "Zielgerade! Wer hat noch Reserven?");
          if (!race.called.has("cheer")) {
            race.called.add("cheer");
            play("race.cheer", { vol: 0.5 });
          }
        }
        hoofT -= dt;
        if (hoofT <= 0) {
          hoofT = 0.07;
          const i = randInt(6);
          play("race.hoof", { pan: (i - 2.5) / 4, pitch: 0.9 + i * 0.04, vol: 0.7 });
          if (randInt(5) === 0) haptic("tick", 0.4);
        }
        if (race.t >= race.res.duration + 0.05 && !race.called.has("end")) {
          race.called.add("end");
          finishRace();
        }
      }
      draw(dt);
    });

    function draw() {
      st.begin();
      const W = st.width;
      const Hh = st.height;
      g.clearRect(0, 0, W, Hh);
      const lanes = 6;
      const top = 26;
      const laneH = (Hh - top - 8) / lanes;
      // Kamera: führendes Pferd bei ~62 % der Breite
      const pxPerUnit = Math.max(W / 34, 8);
      let pos = card ? card.horses.map(() => 0) : [];
      if (race && race.t >= 0) pos = framePos(race.t);
      const leadPos = pos.length ? Math.max(...pos) : 0;
      const camX = Math.max(0, Math.min(H.DISTANCE + 6 - W / pxPerUnit, leadPos - (W * 0.62) / pxPerUnit));
      const X = (u) => (u - camX) * pxPerUnit;
      // Bahn
      const grd = g.createLinearGradient(0, top, 0, Hh);
      grd.addColorStop(0, "#14301f");
      grd.addColorStop(1, "#0b1f14");
      g.fillStyle = grd;
      g.fillRect(0, top, W, Hh - top);
      // Distanzmarken
      g.font = "800 10px ui-rounded, system-ui, sans-serif";
      g.textAlign = "center";
      for (let u = 0; u <= H.DISTANCE; u += 10) {
        const x = X(u);
        if (x < -20 || x > W + 20) continue;
        g.strokeStyle = "rgba(255,255,255,.12)";
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, Hh);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.5)";
        // Beschriftung am Rand nicht abschneiden
        if (x > 14 && x < W - 14) g.fillText(u === H.DISTANCE ? "ZIEL" : `${H.DISTANCE - u}`, x, top - 8);
      }
      // Ziellinie
      const fx = X(H.DISTANCE);
      if (fx > -10 && fx < W + 10) {
        for (let y = top, k = 0; y < Hh; y += 8, k++) {
          g.fillStyle = k % 2 ? "#fff" : "#111";
          g.fillRect(fx - 3, y, 6, 8);
        }
      }
      // Startboxen
      const sx = X(0);
      if (sx > -30) {
        g.fillStyle = "rgba(183,168,214,.35)";
        g.fillRect(sx - 18, top, 8, Hh - top);
      }
      // Bahnlinien
      for (let i = 0; i <= lanes; i++) {
        g.strokeStyle = "rgba(255,255,255,.08)";
        g.beginPath();
        g.moveTo(0, top + i * laneH);
        g.lineTo(W, top + i * laneH);
        g.stroke();
      }
      if (!card) return;
      // Pferde
      const tNow = race ? Math.max(0, race.t) : 0;
      card.horses.forEach((hh, i) => {
        const x = X(pos[i]);
        const y = top + (i + 0.62) * laneH;
        drawHorse(x, y, Math.min(laneH / 30, 1.3), hh.silk, tNow * 9 + i, i === pick, hh.no, race && race.t >= 0);
      });
    }

    function drawHorse(x, y, s, silk, ph, picked, no, running) {
      const legs = running ? Math.sin(ph) : 0;
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      if (picked) {
        g.fillStyle = "rgba(255,197,61,.25)";
        g.beginPath();
        g.ellipse(-8, 6, 30, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = "#2a1a12";
      g.lineWidth = 2.6;
      g.lineCap = "round";
      // Beine (Galopp)
      const legPairs = [
        [-14, legs],
        [-9, -legs],
        [4, -legs],
        [9, legs],
      ];
      for (const [lx, a] of legPairs) {
        g.beginPath();
        g.moveTo(lx, -2);
        g.lineTo(lx + a * 5, 9);
        g.stroke();
      }
      // Körper
      g.fillStyle = "#5a3220";
      g.beginPath();
      g.ellipse(-3, -5, 15, 6.5, 0, 0, Math.PI * 2);
      g.fill();
      // Hals & Kopf
      g.beginPath();
      g.moveTo(8, -8);
      g.lineTo(15, -17);
      g.lineTo(21, -15);
      g.lineTo(13, -4);
      g.closePath();
      g.fill();
      g.beginPath();
      g.ellipse(19, -15, 5, 3, 0.3, 0, Math.PI * 2);
      g.fill();
      // Schweif
      g.strokeStyle = "#2a1a12";
      g.beginPath();
      g.moveTo(-17, -6);
      g.quadraticCurveTo(-24, -4 + legs * 2, -25, 2);
      g.stroke();
      // Jockey
      g.fillStyle = silk;
      g.shadowColor = silk;
      g.shadowBlur = picked ? 12 : 4;
      g.beginPath();
      g.ellipse(-1, -14, 5.5, 4.5, -0.4, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.beginPath();
      g.arc(3, -19, 3, 0, Math.PI * 2);
      g.fill();
      // Startnummer
      g.fillStyle = "#fff";
      g.fillRect(-9, -9, 9, 7);
      g.fillStyle = "#111";
      g.font = "900 7px ui-rounded, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(no), -4.5, -5.3);
      g.restore();
    }
    st.onResize = () => draw();

    // ---------- Eingaben ----------
    startBtn.addEventListener("click", startRace);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Pferderennen",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Wähle ein Pferd, die Wettart und deinen Einsatz. „Sieg“: dein Pferd muss gewinnen. „Platz“: es muss Erster oder Zweiter werden. Die Auszahlung ist Einsatz × Quote."),
          h("h3", {}, "Wie entstehen die Quoten?"),
          h("p", {}, `Jedes Pferd hat ein Grundtempo und einen Rennstil (Frühstarter werden langsamer, Endspurtler schneller, Konstante halten ihr Tempo). Dazu kommen Tagesform und Tempo-Schwankungen in ${H.SEGMENTS} Abschnitten – so entstehen Führungswechsel und Aufholjagden. Vor dem Rennen wird genau dieses Modell ${H.MC_RUNS.toLocaleString("de-DE")}-mal durchgespielt; die Häufigkeiten sind die angezeigten Wahrscheinlichkeiten. Quote = (1 − ${Math.round(H.MARGIN * 100)} %) ÷ Wahrscheinlichkeit, auf 0,1 abgerundet.`),
          h("p", {}, "Das gezeigte Rennen ist ein weiterer, unabhängiger Lauf desselben Modells. Die Animation zeigt exakt dessen Positionen – wer in der Simulation zuerst die Ziellinie erreicht, gewinnt. Langfristig zahlen Wetten etwa 92 % zurück.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    newCard();

    return {
      finalize() {
        if (ticket && race && stakeInfo) {
          economy.settle(ticket, H.payout(stakeInfo.type, stakeInfo.horse, stakeInfo.stake, stakeInfo.odds, race.res.order));
          ticket = null;
        }
      },
      pause() {},
      destroy() {
        dead = true;
        loop.destroy();
        st.destroy();
      },
    };
  },
};
