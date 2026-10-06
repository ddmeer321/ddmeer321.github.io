// Alle Spiele der Halle. Neue Spiele: Eintrag hier + Modul unter js/games/.
// load() wird erst beim Öffnen aufgerufen (Code-Splitting per dynamic import).

export const ZONES = [
  { id: "slots", title: "Slot-Allee" },
  { id: "tables", title: "Tisch-Lounge" },
  { id: "arcade", title: "Arcade-Ecke" },
];

export const GAMES = [
  { id: "slots-fruit", zone: "slots", title: "Fruchtfiesta", blurb: "3×3 · 5 Linien", art: "slotFruit", css: "slots", load: () => import("./slots/slots.js"), opts: { machine: "fruit" } },
  { id: "slots-seven", zone: "slots", title: "Goldene Sieben", blurb: "Klassik · 1 Linie", art: "slotSeven", css: "slots", load: () => import("./slots/slots.js"), opts: { machine: "seven" } },
  { id: "slots-cosmo", zone: "slots", title: "Kosmo 5", blurb: "5×3 · Freispiele", art: "slotCosmo", css: "slots", wide: true, load: () => import("./slots/slots.js"), opts: { machine: "cosmo" } },
  { id: "blackjack", zone: "tables", title: "Blackjack", blurb: "Einsatz 10–500", art: "blackjack", table: true, css: "blackjack", load: () => import("./blackjack/blackjack.js") },
  { id: "roulette", zone: "tables", title: "Roulette", blurb: "Europäisch · eine Null", art: "roulette", table: true, css: "roulette", load: () => import("./roulette/roulette.js") },
  { id: "horses", zone: "tables", title: "Neon Derby", blurb: "Pferderennen · Sieg & Platz", art: "horses", table: true, css: "arcade", load: () => import("./horses/horses.js") },
  { id: "plinko", zone: "arcade", title: "Neon-Plinko", blurb: "3 Risikostufen · Multi-Drop", art: "plinko", css: "arcade", load: () => import("./plinko/plinko.js") },
  { id: "grabber", zone: "arcade", title: "Münzgreifer", blurb: "Greifautomat · Münzen & Chips", art: "grabber", css: "arcade", load: () => import("./grabber/grabber.js") },
  { id: "coinpusher", zone: "arcade", title: "Münzkaskade", blurb: "Coin Pusher", art: "pusher", css: "arcade", wide: true, load: () => import("./coinpusher/coinpusher.js") },
  { id: "hoops", zone: "arcade", title: "Neon Hoops", blurb: "Skill · 45 Sek.", art: "hoops", css: "arcade", best: "hoops", load: () => import("./hoops/hoops.js") },
  { id: "stacker", zone: "arcade", title: "Turmbau", blurb: "Skill · Timing", art: "stacker", css: "arcade", best: "stacker", load: () => import("./stacker/stacker.js") },
  { id: "cyclone", zone: "arcade", title: "Lichtwirbel", blurb: "Skill · Reaktion", art: "cyclone", css: "arcade", load: () => import("./cyclone/cyclone.js") },
];

export function gameById(id) {
  return GAMES.find((g) => g.id === id) || null;
}
