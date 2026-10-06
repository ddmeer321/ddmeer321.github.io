// Blackjack-Regeln (rein, ohne DOM – testbar in Node).
//
// Regeln: 6 Decks, neu gemischt ab 75 % Verbrauch. Dealer steht auf allen 17.
// Blackjack zahlt 3:2. Dealer prüft bei Ass/Zehn auf Blackjack (Peek).
// Double Down auf die ersten zwei Karten jeder Hand (auch nach Split).
// Einmaliges Teilen gleichrangiger Karten (gleicher Wert, z. B. K+K oder 10+J
// zählt NICHT – nur gleicher Rang). Geteilte Asse bekommen genau eine Karte.
// 21 nach Split ist kein Blackjack (zahlt 1:1). Keine Versicherung, kein Surrender.

import { random, shuffle } from "../../core/rng.js";

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardValue(rank) {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

export function createShoe(decks = 6, rnd = random) {
  let cards = [];
  let total = 0;
  const shoe = {
    shuffle() {
      cards = [];
      for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
      shuffle(cards, rnd);
      total = cards.length;
    },
    draw() {
      if (!cards.length) shoe.shuffle();
      return cards.pop();
    },
    needsShuffle() {
      return cards.length < total * 0.25;
    },
    get remaining() {
      return cards.length;
    },
    /** Nur für Tests: legt die nächsten Karten fest (erste = zuerst gezogen). */
    stack(list) {
      for (let i = list.length - 1; i >= 0; i--) cards.push(list[i]);
    },
  };
  shoe.shuffle();
  return shoe;
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export function isBlackjack(cards, fromSplit = false) {
  return !fromSplit && cards.length === 2 && handValue(cards).total === 21;
}

/**
 * Eine Runde. Alle Aktionen sind synchron; die UI animiert hinterher.
 * draw(): liefert die nächste Karte.
 */
export function createRound(bet, draw) {
  const round = {
    phase: "player", // player | dealer | done
    dealer: [],
    holeHidden: true,
    hands: [{ cards: [], bet, doubled: false, fromSplit: false, splitAces: false, done: false, result: null, payout: 0 }],
    active: 0,
    split: false,
    log: [], // Abfolge der gezogenen Karten für die Animation
  };

  function give(target, handIndex) {
    const c = draw();
    if (target === "dealer") round.dealer.push(c);
    else round.hands[handIndex].cards.push(c);
    round.log.push({ to: target, hand: handIndex, card: c });
    return c;
  }

  // Austeilen: Spieler, Dealer, Spieler, Dealer (verdeckt)
  give("player", 0);
  give("dealer");
  give("player", 0);
  give("dealer");

  const hand = () => round.hands[round.active];

  function advance() {
    while (round.active < round.hands.length && round.hands[round.active].done) round.active++;
    if (round.active >= round.hands.length) {
      round.phase = "dealer";
    }
  }

  function finishHandIfNeeded(h) {
    const v = handValue(h.cards).total;
    if (v >= 21 || h.doubled || h.splitAces) h.done = true;
  }

  // Sofortige Blackjack-Prüfung (Peek)
  const playerBJ = isBlackjack(round.hands[0].cards);
  const up = round.dealer[0];
  const dealerBJ = isBlackjack(round.dealer);
  const peek = up.r === "A" || cardValue(up.r) === 10;
  if (playerBJ || (peek && dealerBJ)) {
    round.hands[0].done = true;
    round.phase = "done";
    round.holeHidden = false;
  }

  const api = {
    round,
    get hand() {
      return hand();
    },
    canHit() {
      return round.phase === "player" && !hand().done;
    },
    canDouble(balance = Infinity) {
      const h = hand();
      return round.phase === "player" && !h.done && h.cards.length === 2 && !h.splitAces && balance >= h.bet;
    },
    canSplit(balance = Infinity) {
      const h = hand();
      return round.phase === "player" && !round.split && h.cards.length === 2 && h.cards[0].r === h.cards[1].r && balance >= h.bet;
    },
    hit() {
      if (!api.canHit()) return null;
      const h = hand();
      const c = give("player", round.active);
      finishHandIfNeeded(h);
      advance();
      return c;
    },
    stand() {
      if (round.phase !== "player") return;
      hand().done = true;
      advance();
    },
    double() {
      if (!api.canDouble()) return null;
      const h = hand();
      h.bet *= 2;
      h.doubled = true;
      const c = give("player", round.active);
      h.done = true;
      advance();
      return c;
    },
    split() {
      if (!api.canSplit()) return false;
      const h = hand();
      const second = h.cards.pop();
      const aces = second.r === "A";
      const h2 = { cards: [second], bet: h.bet, doubled: false, fromSplit: true, splitAces: aces, done: false, result: null, payout: 0 };
      h.fromSplit = true;
      h.splitAces = aces;
      round.hands.splice(round.active + 1, 0, h2);
      round.split = true;
      give("player", round.active);
      give("player", round.active + 1);
      for (const x of round.hands) finishHandIfNeeded(x);
      advance();
      return true;
    },
    /** Dealer spielt (nur wenn mindestens eine Hand nicht überkauft ist). */
    dealerPlay() {
      if (round.phase !== "dealer") return;
      round.holeHidden = false;
      const anyAlive = round.hands.some((h) => handValue(h.cards).total <= 21);
      if (anyAlive) {
        while (handValue(round.dealer).total < 17) give("dealer");
      }
      round.phase = "done";
    },
    /** Spielt alle offenen Hände als „Stand“ zu Ende (beim Verlassen des Tisches). */
    autoFinish() {
      while (round.phase === "player") api.stand();
      api.dealerPlay();
      return api.settle();
    },
    /** Ergebnis je Hand + Gesamtauszahlung (inkl. Einsatz). */
    settle() {
      if (round.phase !== "done") return null;
      round.holeHidden = false;
      const d = handValue(round.dealer).total;
      const dBJ = isBlackjack(round.dealer);
      let total = 0;
      for (const h of round.hands) {
        const v = handValue(h.cards).total;
        const bj = isBlackjack(h.cards, h.fromSplit);
        if (bj && dBJ) h.result = "push";
        else if (bj) h.result = "blackjack";
        else if (dBJ) h.result = "lose";
        else if (v > 21) h.result = "bust";
        else if (d > 21 || v > d) h.result = "win";
        else if (v === d) h.result = "push";
        else h.result = "lose";
        h.payout = h.result === "blackjack" ? Math.floor(h.bet * 2.5) : h.result === "win" ? h.bet * 2 : h.result === "push" ? h.bet : 0;
        total += h.payout;
      }
      return { total, hands: round.hands.map((h) => ({ result: h.result, payout: h.payout, bet: h.bet })) };
    },
    totalBet() {
      return round.hands.reduce((s, h) => s + h.bet, 0);
    },
  };
  return api;
}
