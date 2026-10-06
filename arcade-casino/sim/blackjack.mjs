// Blackjack: Massensimulation mit Basisstrategie (6 Decks, S17, DAS, 1× Split,
// geteilte Asse 1 Karte, kein Surrender/Insurance, Peek). Prüft Kartenverteilung,
// Blackjack-/Bust-/Push-Häufigkeiten und den Hausvorteil.
import { createShoe, createRound, handValue, cardValue } from "../js/games/blackjack/logic.js";
import { seeded } from "../js/core/rng.js";

// Basisstrategie (vereinfacht korrekt für S17/DAS/6D)
function decide(g, dealerUp) {
  const h = g.hand;
  const { total, soft } = handValue(h.cards);
  const up = cardValue(dealerUp.r) === 11 ? 11 : cardValue(dealerUp.r);
  if (g.canSplit()) {
    const r = h.cards[0].r;
    const v = cardValue(r);
    if (r === "A" || v === 8) return "split";
    if (v === 9 && ![7, 10, 11].includes(up)) return "split";
    if ((v === 2 || v === 3) && up <= 7) return "split";
    if (v === 6 && up <= 6) return "split";
    if (v === 7 && up <= 7) return "split";
    if (v === 4 && (up === 5 || up === 6)) return "split";
  }
  if (soft) {
    if (total >= 19) return total === 19 && up === 6 && g.canDouble() ? "double" : "stand";
    if (total === 18) {
      if (up >= 3 && up <= 6 && g.canDouble()) return "double";
      if (up <= 8) return "stand";
      return "hit";
    }
    const dbl = { 17: [3, 6], 16: [4, 6], 15: [4, 6], 14: [5, 6], 13: [5, 6] }[total];
    if (dbl && up >= dbl[0] && up <= dbl[1] && g.canDouble()) return "double";
    return "hit";
  }
  if (total >= 17) return "stand";
  if (total >= 13) return up <= 6 ? "stand" : "hit";
  if (total === 12) return up >= 4 && up <= 6 ? "stand" : "hit";
  if (total === 11) return g.canDouble() ? "double" : "hit";
  if (total === 10) return up <= 9 && g.canDouble() ? "double" : "hit";
  if (total === 9) return up >= 3 && up <= 6 && g.canDouble() ? "double" : "hit";
  return "hit";
}

export function simulate(hands = 200000, seed = 1) {
  const rnd = seeded(seed);
  const shoe = createShoe(6, rnd);
  let wagered = 0, returned = 0, bj = 0, dealerBust = 0, pushes = 0, doubles = 0, splits = 0;
  const rankCount = {};
  for (let i = 0; i < hands; i++) {
    if (shoe.needsShuffle()) shoe.shuffle();
    const g = createRound(10, () => {
      const c = shoe.draw();
      rankCount[c.r] = (rankCount[c.r] || 0) + 1;
      return c;
    });
    const up = g.round.dealer[0];
    let guard = 0;
    while (g.round.phase === "player" && guard++ < 20) {
      const a = decide(g, up);
      if (a === "split") { splits++; g.split(); }
      else if (a === "double") { doubles++; g.double(); }
      else if (a === "hit") g.hit();
      else g.stand();
    }
    g.dealerPlay();
    const res = g.settle();
    wagered += g.totalBet();
    returned += res.total;
    if (res.hands.some((h) => h.result === "blackjack")) bj++;
    if (handValue(g.round.dealer).total > 21) dealerBust++;
    pushes += res.hands.filter((h) => h.result === "push").length;
  }
  const totalCards = Object.values(rankCount).reduce((a, b) => a + b, 0);
  const rankShare = Object.fromEntries(Object.entries(rankCount).map(([r, c]) => [r, c / totalCards]));
  return { hands, rtp: returned / wagered, houseEdge: 1 - returned / wagered, bjRate: bj / hands, dealerBustRate: dealerBust / hands, pushRate: pushes / hands, doubleRate: doubles / hands, splitRate: splits / hands, rankShare };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const r = simulate(+process.argv[2] || 300000);
  console.log({ ...r, rankShare: Object.fromEntries(Object.entries(r.rankShare).map(([k, v]) => [k, +(v * 13).toFixed(4)])) }, `${Date.now() - t0} ms`);
}
