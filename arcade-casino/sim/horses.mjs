// Pferderennen: Plausibilität des Rennmodells, Quoten und Rückzahlung.
import * as H from "../js/games/horses/logic.js";

export function analyse(cards = 40, racesPerCard = 600, seed0 = 1) {
  let stakeW = 0, retW = 0, stakeP = 0, retP = 0, leadChanges = 0, favWins = 0, races = 0, dur = 0, upsets = 0;
  const favP = [];
  let maxOdds = 0;
  for (let c = 0; c < cards; c++) {
    const card = H.makeCard(seed0 * 1000 + c);
    const m = H.buildMarket(card);
    maxOdds = Math.max(maxOdds, ...m.win);
    const fav = m.pWin.indexOf(Math.max(...m.pWin));
    favP.push(m.pWin[fav]);
    for (let r = 0; r < racesPerCard; r++) {
      // Unabhängige Rennen (anderer Seed-Raum als die Quotenberechnung)
      const res = H.runRace(card, (0x9e3779b9 ^ (c * 7777 + r * 31337 + seed0)) >>> 0, { track: r < 20 });
      races++;
      dur += res.duration;
      if (res.order[0] === fav) favWins++;
      if (m.win[res.order[0]] >= 8) upsets++;
      for (let i = 0; i < 6; i++) {
        stakeW += 100; retW += H.payout("win", i, 100, m.win[i], res.order);
        stakeP += 100; retP += H.payout("place", i, 100, m.place[i], res.order);
      }
      if (res.frames) {
        let leader = -1;
        for (const f of res.frames) { const l = f.indexOf(Math.max(...f)); if (l !== leader) { if (leader >= 0) leadChanges++; leader = l; } }
      }
    }
  }
  return { rtpWin: retW / stakeW, rtpPlace: retP / stakeP, favWinRate: favWins / races, avgFavP: favP.reduce((a, b) => a + b) / favP.length, avgDuration: dur / races, leadChangesPerRace: leadChanges / (cards * 20), upsetRate: upsets / races, maxOdds };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  console.log(analyse(+process.argv[2] || 30, +process.argv[3] || 400), `${Date.now() - t0} ms`);
}
