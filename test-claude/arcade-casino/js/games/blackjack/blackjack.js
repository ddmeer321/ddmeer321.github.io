// Blackjack – Tisch, Animationen und Einbindung in die Wirtschaft.
// Die Regeln selbst stehen in logic.js.

import { h, clear } from "../../ui/dom.js";
import { createBetControl } from "../../ui/betControl.js";
import { createShoe, createRound, handValue } from "./logic.js";
import { LIMITS as ALL_LIMITS } from "../../core/limits.js";

const BET_STEPS = ALL_LIMITS.blackjack.steps;
const LIMITS = { min: ALL_LIMITS.blackjack.min, max: ALL_LIMITS.blackjack.max };
const RESULT_TEXT = { win: "Gewonnen", blackjack: "Blackjack!", push: "Push", lose: "Verloren", bust: "Bust" };
const CHIP_COLORS = ["#ff3d9a", "#2de2e6", "#ffc53d", "#8cff5a", "#9b5cff"];

function cardEl(card, faceDown) {
  const red = card.s === "♥" || card.s === "♦";
  const face = ["J", "Q", "K"].includes(card.r);
  const suit = card.s + "︎";
  return h(
    `div.card${faceDown ? ".is-down" : ""}`,
    { "aria-label": faceDown ? "verdeckte Karte" : `${card.r}${card.s}` },
    h(
      `div.card-face${red ? ".red" : ""}${face ? ".face" : ""}`,
      {},
      h("span.card-corner.tl", {}, card.r, h("small", {}, suit)),
      h("span.card-pip", {}, face ? card.r : card.r === "A" ? suit : suit),
      h("span.card-corner.br", {}, card.r, h("small", {}, suit))
    ),
    h("div.card-back")
  );
}

function totalText(cards, hideSecond) {
  if (!cards.length) return "";
  const shown = hideSecond ? [cards[0]] : cards;
  const { total, soft } = handValue(shown);
  if (soft && total < 21 && !hideSecond) return `${total - 10}/${total}`;
  return String(total);
}

export default {
  mount(root, ctx) {
    const { economy, play, haptic, particles } = ctx;
    const data = ctx.data;
    let dead = false;
    let busy = false;
    let phase = "bet"; // bet | play | dealer | result
    ctx.setPhase(phase);
    let shoe = createShoe(6);
    let game = null;
    let ticket = null;
    let shown = new Set();
    let flipHole = null;

    // ---------- DOM ----------
    const stage = h("div.game-stage.felt.bj-stage");
    const shoeEl = h("div.bj-shoe", { "aria-hidden": "true" });
    const dealerTotal = h("span.bj-total.num");
    const dealerCards = h("div.bj-cards");
    const handsEl = h("div.bj-hands");
    stage.append(
      shoeEl,
      h("div.bj-zone", {}, h("div.bj-label", {}, "Dealer", dealerTotal), dealerCards),
      h("div.bj-rules", {}, "Blackjack zahlt 3 : 2", h("span", {}, "Dealer steht auf allen 17")),
      h("div.bj-zone", {}, handsEl)
    );

    const controls = h("div.game-controls");
    const status = h("div.status-line", { role: "status" }, "Einsatz wählen und austeilen");
    const betCtl = createBetControl({
      steps: BET_STEPS,
      value: Number(data.bet) || 50,
      getBalance: () => economy.balance,
      onChange: (v) => {
        data.bet = v;
        ctx.save();
      },
    });
    const dealBtn = h("button.btn.btn-primary.btn-lg", { type: "button" }, "Austeilen");
    const betBar = h("div.bj-betbar", {}, betCtl.el, dealBtn);

    const mk = (label, icon, key, cls = "") =>
      h(`button.btn${cls}`, { type: "button", "aria-keyshortcuts": key }, h("span", { "aria-hidden": "true" }, icon), label);
    const hitBtn = mk("Karte", "＋", "H", ".btn-cyan");
    const standBtn = mk("Halten", "✋", "S", ".btn-primary");
    const doubleBtn = mk("Verdoppeln", "×2", "D", ".btn-gold");
    const splitBtn = mk("Teilen", "⇆", "P");
    const actions = h("div.bj-actions", {}, hitBtn, standBtn, doubleBtn, splitBtn);

    controls.append(status, betBar);
    root.append(stage, controls);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Blackjack",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Ziel: näher an 21 als der Dealer, ohne 21 zu überschreiten. Bildkarten zählen 10, Asse 1 oder 11."),
          h("h3", {}, "Aktionen"),
          h("p", {}, "Karte (H) – eine weitere Karte. Halten (S) – keine Karte mehr. Verdoppeln (D) – Einsatz verdoppeln, genau eine Karte. Teilen (P) – zwei gleiche Karten in zwei Hände aufteilen (einmal pro Runde)."),
          h("h3", {}, "Regeln"),
          h("p", {}, "6 Decks · Dealer steht auf allen 17 · Blackjack zahlt 3:2 · Gewinn zahlt 1:1 · Gleichstand (Push) gibt den Einsatz zurück · Dealer prüft bei Ass oder Zehn sofort auf Blackjack · geteilte Asse erhalten nur eine Karte · 21 nach Teilen zählt nicht als Blackjack · keine Versicherung."),
          h("p", {}, "Wer den Tisch mitten in der Runde verlässt, hält automatisch alle offenen Hände – der Dealer spielt zu Ende und die Runde wird normal abgerechnet.")
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    // ---------- Hilfsfunktionen ----------
    const wait = (ms) => new Promise((r) => setTimeout(r, ctx.reducedMotion() ? Math.min(ms, 120) : ms));

    function setStatus(t) {
      status.textContent = t;
    }

    function animateDeal(el, faceDown) {
      if (ctx.reducedMotion()) return;
      const from = shoeEl.getBoundingClientRect();
      const to = el.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      el.classList.add("is-dealing");
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(-25deg) rotateY(180deg)`;
      void el.offsetWidth;
      el.classList.remove("is-dealing");
      el.style.transform = "";
      if (faceDown) el.classList.add("is-down");
    }

    function handBox(i) {
      const hd = game.round.hands[i];
      const cards = h("div.bj-cards");
      const total = h("span.bj-total.num");
      const chips = Math.min(5, 1 + Math.floor(Math.log2(hd.bet / 10 + 1)));
      const bet = h(
        "div.bj-bet.num",
        {},
        h("span", { style: { display: "flex" } }, Array.from({ length: chips }, (_, k) => h("span.bj-chip", { style: { "--c": CHIP_COLORS[k % 5], marginLeft: k ? "-14px" : "0" } }))),
        ctx.fmt(hd.bet)
      );
      const el = h("div.bj-hand", {}, cards, h("div.bj-label", {}, game.round.hands.length > 1 ? `Hand ${i + 1}` : "Du", total), bet);
      return { el, cards, total, bet };
    }

    let handEls = [];

    /** Baut die Hände aus dem Rundenzustand neu (nur bereits gezeigte Karten). */
    function rebuildHands() {
      clear(handsEl);
      handEls = game.round.hands.map((_, i) => handBox(i));
      handEls.forEach((he, i) => {
        handsEl.append(he.el);
        for (const c of game.round.hands[i].cards) if (shown.has(c)) he.cards.append(cardEl(c, false));
      });
      updateTotals();
    }

    function updateTotals() {
      const r = game.round;
      const dealerShown = r.dealer.filter((c) => shown.has(c));
      const hidden = r.holeHidden && dealerShown.length >= 2;
      dealerTotal.textContent = totalText(dealerShown, hidden);
      const dv = handValue(hidden ? dealerShown.slice(0, 1) : dealerShown).total;
      dealerTotal.classList.toggle("is-bust", dv > 21);
      r.hands.forEach((hd, i) => {
        const he = handEls[i];
        if (!he) return;
        const cards = hd.cards.filter((c) => shown.has(c));
        he.total.textContent = totalText(cards, false);
        const v = handValue(cards).total;
        he.total.classList.toggle("is-bust", v > 21);
        he.total.classList.toggle("is-21", v === 21);
        he.el.classList.toggle("is-active", r.phase === "player" && r.hands.length > 1 && i === r.active);
        he.el.classList.toggle("is-waiting", r.phase === "player" && r.hands.length > 1 && i !== r.active);
        he.bet.lastChild.textContent = ctx.fmt(hd.bet);
      });
    }

    /** Animiert alle noch nicht gezeigten Karten aus dem Log nacheinander. */
    async function syncCards(gap = 300) {
      for (const entry of game.round.log) {
        if (shown.has(entry.card)) continue;
        if (dead) return;
        shown.add(entry.card);
        const isHole = entry.to === "dealer" && game.round.dealer.indexOf(entry.card) === 1 && game.round.holeHidden;
        const el = cardEl(entry.card, false);
        if (entry.to === "dealer") dealerCards.append(el);
        else handEls[entry.hand]?.cards.append(el);
        if (isHole) flipHole = el;
        animateDeal(el, isHole);
        if (isHole && ctx.reducedMotion()) el.classList.add("is-down");
        play("card.deal", { pan: entry.to === "dealer" ? 0.2 : -0.1 });
        haptic("tap", 0.6);
        updateTotals();
        await wait(gap);
      }
    }

    async function revealHole() {
      if (flipHole && flipHole.classList.contains("is-down")) {
        flipHole.classList.remove("is-down");
        play("card.flip");
        haptic("tap");
        flipHole = null;
        updateTotals();
        await wait(450);
      }
    }

    function showActions() {
      if (betBar.parentNode) betBar.remove();
      if (!actions.parentNode) controls.append(actions);
      const bal = economy.balance;
      const can = phase === "play" && !busy && game?.round.phase === "player";
      hitBtn.disabled = !can || !game.canHit();
      standBtn.disabled = !can;
      doubleBtn.disabled = !can || !game.canDouble(bal);
      splitBtn.disabled = !can || !game.canSplit(bal);
    }

    function showBetBar() {
      if (actions.parentNode) actions.remove();
      if (!betBar.parentNode) controls.append(betBar);
      betCtl.fitToBalance();
      betCtl.setDisabled(false);
      dealBtn.disabled = false;
      dealBtn.textContent = phase === "result" ? "Nochmal" : "Austeilen";
    }

    // ---------- Ablauf ----------

    async function deal() {
      if (busy || (phase !== "bet" && phase !== "result")) return;
      const bet = betCtl.value;
      const check = economy.validateBet(bet, LIMITS);
      if (!check.ok) {
        play("ui.error");
        haptic("impulse");
        ctx.toast(check.reason === "Nicht genug Credits" ? "Nicht genug Credits – Einsatz senken oder in der Halle nachfüllen." : check.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      busy = true;
      ticket = economy.placeBet("blackjack", bet, LIMITS);
      if (!ticket) {
        busy = false;
        return;
      }
      play("chip.stack");
      haptic("impulse");
      betCtl.setDisabled(true);
      dealBtn.disabled = true;

      if (shoe.needsShuffle()) {
        shoe.shuffle();
        ctx.toast("Der Schlitten wird neu gemischt", { icon: "🔀" });
        play("card.deal");
        await wait(500);
        if (dead) return;
      }

      game = createRound(bet, shoe.draw);
      shown = new Set();
      flipHole = null;
      clear(dealerCards);
      phase = "play";
      ctx.setPhase(phase);
      rebuildHands();
      showActions();
      setStatus("Karten werden ausgeteilt …");
      await syncCards(280);
      if (dead) return;
      busy = false;

      if (game.round.phase === "done") {
        await revealHole();
        if (dead) return;
        return finish();
      }
      setStatus("Deine Entscheidung");
      showActions();
    }

    async function afterAction() {
      updateTotals();
      if (game.round.phase === "dealer") {
        return dealerTurn();
      }
      busy = false;
      const hd = game.round.hands[game.round.active];
      setStatus(game.round.hands.length > 1 ? `Hand ${game.round.active + 1}: deine Entscheidung` : "Deine Entscheidung");
      if (hd && handValue(hd.cards).total === 21) setStatus("21!");
      showActions();
    }

    async function act(kind) {
      if (busy || phase !== "play" || !game || game.round.phase !== "player") return;
      const hd = game.hand;
      if (kind === "hit") {
        if (!game.canHit()) return;
        busy = true;
        showActions();
        game.hit();
        await syncCards(260);
      } else if (kind === "stand") {
        busy = true;
        play("ui.toggle");
        haptic("tap");
        game.stand();
      } else if (kind === "double") {
        if (!game.canDouble(economy.balance)) return;
        if (!economy.addStake(ticket, hd.bet)) {
          play("ui.error");
          return;
        }
        busy = true;
        play("chip.stack");
        haptic("impulse");
        game.double();
        updateTotals();
        await syncCards(300);
      } else if (kind === "split") {
        if (!game.canSplit(economy.balance)) return;
        if (!economy.addStake(ticket, hd.bet)) {
          play("ui.error");
          return;
        }
        busy = true;
        play("chip.stack");
        haptic("impulse");
        game.split();
        rebuildHands();
        await syncCards(320);
      }
      if (dead) return;
      const v = handValue(hd.cards).total;
      if (v > 21) {
        play("lose", { vol: 0.6 });
        haptic("heavy");
      }
      await afterAction();
    }

    async function dealerTurn() {
      phase = "dealer";
      ctx.setPhase(phase);
      busy = true;
      showActions();
      setStatus("Dealer ist am Zug …");
      game.dealerPlay();
      await wait(300);
      if (dead) return;
      await revealHole();
      if (dead) return;
      await syncCards(560);
      if (dead) return;
      await wait(250);
      if (dead) return;
      finish();
    }

    function finish() {
      const res = game.settle();
      if (!res || !ticket) return;
      const stake = ticket.stake;
      const settled = economy.settle(ticket, res.total);
      ticket = null;
      phase = "result";
      ctx.setPhase(phase);
      busy = false;
      updateTotals();

      res.hands.forEach((r, i) => {
        const he = handEls[i];
        if (!he) return;
        he.el.append(h(`span.bj-result.r-${r.result}`, {}, RESULT_TEXT[r.result]));
      });

      const net = settled ? settled.net : res.total - stake;
      const anyBJ = res.hands.some((r) => r.result === "blackjack");
      if (anyBJ) ctx.progression.award("bj-natural");
      if (game.round.split && res.hands.every((r) => r.result === "win" || r.result === "blackjack")) ctx.progression.award("bj-split-win");
      if (game.round.hands.some((hd, i) => hd.doubled && res.hands[i].result === "win")) ctx.progression.award("bj-double-win");
      game.round.hands.forEach((hd, i) => {
        ctx.report("blackjack:hand", { result: res.hands[i].result, total: handValue(hd.cards).total, doubled: Boolean(hd.doubled) });
      });

      const center = handsEl.getBoundingClientRect();
      const cx = center.left + center.width / 2;
      const cy = center.top + center.height / 3;
      // Einheitliches Gewinn-Feedback relativ zum Gesamteinsatz (inkl. Double/Split)
      const tier = ctx.celebrate({
        stake,
        payout: res.total,
        x: cx,
        y: cy,
        title: net > 0 ? (anyBJ ? "Blackjack!" : "Gewonnen") : net === 0 ? "Push" : "Verloren",
        detail: anyBJ ? "3 : 2" : undefined,
      }).tier;
      if (anyBJ && tier !== "loss") particles.burst(cx, cy, { kind: "confetti", count: 50, spread: 1.6 });
      if (net > 0) setStatus(`Gewinn: ${ctx.signed(net)} Credits`);
      else if (net === 0) setStatus("Unentschieden – Einsatz zurück");
      else setStatus(`Verlust: ${ctx.signed(net)} Credits`);
      showBetBar();
    }

    // ---------- Eingaben ----------
    dealBtn.addEventListener("click", deal);
    hitBtn.addEventListener("click", () => act("hit"));
    standBtn.addEventListener("click", () => act("stand"));
    doubleBtn.addEventListener("click", () => act("double"));
    splitBtn.addEventListener("click", () => act("split"));

    function onKey(e) {
      if (ctx.isModalOpen() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "h") act("hit");
      else if (k === "s") act("stand");
      else if (k === "d") act("double");
      else if (k === "p") act("split");
      else if ((k === "enter" || k === " ") && (phase === "bet" || phase === "result")) {
        if (document.activeElement && document.activeElement.tagName === "BUTTON" && document.activeElement !== dealBtn) return;
        e.preventDefault();
        deal();
      }
    }
    window.addEventListener("keydown", onKey);

    showBetBar();

    return {
      /** Runde sofort korrekt abrechnen (Verlassen/Neuladen mitten in der Runde). */
      finalize() {
        if (!ticket || ticket.settled || !game) return;
        const res = game.round.phase === "done" ? game.settle() : game.autoFinish();
        if (res) economy.settle(ticket, res.total);
        ticket = null;
      },
      destroy() {
        dead = true;
        window.removeEventListener("keydown", onKey);
      },
    };
  },
};
