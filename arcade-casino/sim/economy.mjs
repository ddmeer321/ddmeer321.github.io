// Neonpalast V1.2 – Wirtschafts-Gesamtsimulation über 60 Tage je Spielertyp.
//
// Erwartungswert-Modell pro Tag (Varianz der einzelnen Spiele wird bewusst
// weggelassen; sie ist in den Einzel-Simulationen dokumentiert):
//   Quellen: Tagesbonus, Tages-Challenges, Level-Bonus, Gratis-Nachschub
//   Spiele:  Umsatz × (RTP − 1) je Spiel bzw. Startgebühr × (RTP − 1) bei Skillgames
//   Senken:  Lotto (RTP ≈ 58–60 %), Jukebox (einmalig), Songs (Einheitspreis)
// Lotto wird zusätzlich exakt per Monte-Carlo gezogen (Jackpots sind selten,
// aber möglich – der Median zeigt den typischen Verlauf).
//
// Aufruf: node sim/economy.mjs [Tage]

import { xpForLevel, levelReward, xpForRound } from "../js/core/progression.js";
import { dailyAmount, REFILL_AMOUNT } from "../js/core/bonus.js";
import { CHALLENGE_REWARD, ALL_DONE_BONUS } from "../js/core/challenges.js";
import { DRAWS, rtpOf, drawNumbers, evaluate } from "../js/core/lotto.js";
import { JUKEBOX_PRICE, SONG_PRICE } from "../js/core/jukebox.js";
import { TRACKS } from "../js/audio/tracks.js";
import { seeded } from "../js/core/rng.js";
import { simulate as cyclone } from "./cyclone.mjs";
import { simulate as stacker } from "./stacker.mjs";
import { simulate as hoops } from "./hoops.mjs";

const SHOP_SONGS = TRACKS.filter((t) => t.kind === "shop").length;

// RTPs der Zufallsspiele (docs/ECONOMY.md)
const RTP = { blackjack: 0.995, roulette: 0.973, slots: 0.945, plinko: 0.951, horses: 0.92, pusher: 0.93, grabber: 0.6 };
// Skillgames: Rückzahlung je Präzision (Simulationen, 20 000 Runden)
const skill = {
  cyclone: (sigma) => cyclone({ sigma, rounds: 20000, seed: 2 }).rtp,
  stacker: (sigma) => Math.max(stacker({ sigma, strategy: "take", rounds: 20000 }).rtp, stacker({ sigma, strategy: "go", rounds: 20000 }).rtp),
  hoops: (p) => hoops(p, 0.5, 4000, 2).rtp,
};

/**
 * Spielertyp: Runden pro Tag je Spiel mit Einsatz, Skill-Präzision, Challenge-Quote,
 * Lotto-Scheine, Kaufverhalten.
 */
const PLAYERS = {
  "Gelegenheitsspieler": { days: 0.5, play: { slots: [25, 10], plinko: [15, 10], horses: [3, 20] }, cyclone: [10, 60], challenges: 1, lotto: { daily: 1, grand: 0 }, buys: false },
  "Normaler Spieler": { days: 0.9, play: { slots: [60, 25], blackjack: [40, 30], roulette: [20, 40], plinko: [40, 10], horses: [10, 50], pusher: [40, 10] }, cyclone: [20, 50], stacker: [15, 30], hoops: [6, 0.6], challenges: 3, lotto: { daily: 2, grand: 2 }, buys: true },
  "Guter Skill-Spieler": { days: 1, play: { slots: [20, 25], plinko: [20, 20] }, cyclone: [60, 25], stacker: [40, 20], hoops: [15, 0.8], challenges: 3, lotto: { daily: 0, grand: 0 }, buys: true },
  "Elite-Skill (Worst Case)": { days: 1, play: {}, cyclone: [300, 10], stacker: [150, 10], hoops: [30, 0.92], challenges: 1, lotto: { daily: 0, grand: 0 }, buys: false },
  "High Roller": { days: 1, play: { blackjack: [200, 1000], roulette: [100, 2000], slots: [100, 250], horses: [20, 500] }, challenges: 2, lotto: { daily: 20, grand: 20 }, buys: true },
  "Challenge-Farmer": { days: 1, play: { slots: [10, 5], plinko: [10, 5], blackjack: [5, 10], roulette: [5, 5], horses: [3, 10], pusher: [10, 10] }, cyclone: [3, 60], stacker: [3, 30], hoops: [2, 0.4], challenges: 3, lotto: { daily: 0, grand: 0 }, buys: false },
  "Lotto-Spieler": { days: 1, play: { slots: [20, 10] }, challenges: 1, lotto: { daily: 20, grand: 20 }, buys: false },
  "Sammler (Jukebox)": { days: 0.9, play: { slots: [40, 10], plinko: [30, 10], pusher: [30, 10], horses: [5, 20] }, cyclone: [15, 50], challenges: 3, lotto: { daily: 1, grand: 1 }, buys: true, collector: true },
  "Gemischter Spieler": { days: 0.8, play: { slots: [40, 25], blackjack: [30, 50], roulette: [15, 50], plinko: [30, 20], horses: [8, 50], pusher: [30, 10], grabber: [5, 50] }, cyclone: [15, 40], stacker: [10, 25], hoops: [4, 0.65], challenges: 2, lotto: { daily: 3, grand: 3 }, buys: true },
};

function runPlayer(p, days, seed) {
  const rnd = seeded(seed);
  let bal = 1000;
  let xp = 0;
  let level = 1;
  let into = 0;
  let jukebox = false;
  let songs = 0;
  let jukeboxDay = null;
  let allSongsDay = null;
  let lottoSpent = 0;
  let lottoWon = 0;
  let sources = 0;
  let refills = 0;
  const cyc = p.cyclone ? skill.cyclone(p.cyclone[1]) : 0;
  const stk = p.stacker ? skill.stacker(p.stacker[1]) : 0;
  const hop = p.hoops ? skill.hoops(p.hoops[1]) : 0;
  for (let d = 0; d < days; d++) {
    if (rnd() > p.days) continue; // nicht jeder Tag ist Spieltag
    // Quellen
    const daily = dailyAmount(level);
    const ch = p.challenges * CHALLENGE_REWARD.credits + (p.challenges >= 3 ? ALL_DONE_BONUS : 0);
    bal += daily + ch;
    sources += daily + ch;
    xp += p.challenges * CHALLENGE_REWARD.xp;
    // Spiele (Erwartungswert), Einsätze gedeckelt durch Guthaben
    let rounds = 0;
    for (const [game, [n, stake]] of Object.entries(p.play)) {
      const affordable = Math.max(0, Math.min(n, Math.floor(bal / Math.max(1, stake) / 3)));
      bal += affordable * stake * (RTP[game] - 1);
      rounds += affordable;
      xp += affordable * xpForRound(stake);
    }
    const skillRounds = [[p.cyclone, cyc, 20], [p.stacker, stk, 20], [p.hoops, hop, 40]];
    for (const [cfg, rtp, entry] of skillRounds) {
      if (!cfg) continue;
      const n = Math.min(cfg[0], Math.floor(bal / entry));
      bal += n * entry * (rtp - 1);
      rounds += n;
      xp += n * xpForRound(entry);
    }
    // Lotto (exakte Ziehung)
    for (const [type, count] of Object.entries(p.lotto)) {
      if (!count) continue;
      if (type === "grand" && d % 3 !== 0) continue;
      const def = DRAWS[type];
      const n = Math.min(count, Math.floor(bal / def.price / 4));
      if (n <= 0) continue;
      const tickets = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, nums: drawNumbers(def.pool, rnd).sort((a, b) => a - b) }));
      const ev = evaluate(type, drawNumbers(def.pool, rnd), tickets);
      bal += ev.payout - n * def.price;
      lottoSpent += n * def.price;
      lottoWon += ev.payout;
      xp += Math.floor((n * def.price) / 40);
    }
    // Level-Aufstiege
    into += xp;
    xp = 0;
    while (into >= xpForLevel(level) && level < 99) {
      into -= xpForLevel(level);
      level++;
      bal += levelReward(level);
      sources += levelReward(level);
    }
    // Nachschub, falls pleite (höchstens 3× pro Tag wegen 20 Min. Wartezeit beim Spielen)
    if (bal < 10) {
      const k = 3;
      bal += k * REFILL_AMOUNT;
      sources += k * REFILL_AMOUNT;
      refills += k;
    }
    // Käufe (nur wenn danach noch ein Polster bleibt)
    if (p.buys || p.collector) {
      const cushion = p.collector ? 500 : 1500; // Rücklage, die ein Spieler nach dem Kauf behalten will
      if (!jukebox && bal >= JUKEBOX_PRICE + cushion) {
        bal -= JUKEBOX_PRICE;
        jukebox = true;
        jukeboxDay = d + 1;
      }
      while (jukebox && songs < SHOP_SONGS && bal >= SONG_PRICE + cushion && (p.collector || rnd() < 0.35)) {
        bal -= SONG_PRICE;
        songs++;
        if (songs === SHOP_SONGS) allSongsDay = d + 1;
      }
    }
    bal = Math.max(0, bal);
  }
  return { bal: Math.round(bal), level, jukeboxDay, songs, allSongsDay, lottoSpent, lottoWon, sources, refills };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = Number(process.argv[2]) || 60;
  console.log(`Lotto-RTP: täglich ${(rtpOf("daily") * 100).toFixed(1)} %, groß ${(rtpOf("grand") * 100).toFixed(1)} % · Jukebox ${JUKEBOX_PRICE} · Song ${SONG_PRICE} (${SHOP_SONGS} kaufbar)`);
  console.log(`Spielertyp                    Guthaben (Median, Tag ${days})   Level  Jukebox ab Tag  Songs  alle Songs  Lotto Einsatz→Rückfluss`);
  for (const [name, p] of Object.entries(PLAYERS)) {
    const runs = Array.from({ length: 41 }, (_, i) => runPlayer(p, days, 100 + i)).sort((a, b) => a.bal - b.bal);
    const m = runs[20];
    const lotto = m.lottoSpent ? `${m.lottoSpent} → ${m.lottoWon}` : "–";
    console.log(
      name.padEnd(28),
      String(m.bal).padStart(12),
      `(P10 ${runs[4].bal}, P90 ${runs[36].bal})`.padEnd(26),
      String(m.level).padStart(5),
      String(m.jukeboxDay ?? "–").padStart(10),
      String(m.songs).padStart(7),
      String(m.allSongsDay ?? "–").padStart(10),
      "  " + lotto
    );
  }
}

export { runPlayer, PLAYERS };
