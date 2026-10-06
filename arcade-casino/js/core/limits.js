// Zentrale Einsatzlimits und Economy-Leitplanken (V1.1).
//
// Grundsatz: Zufallsspiele haben einen sichtbaren, kleinen Hausvorteil (RTP 92–97 %).
// Skillgames haben eine feste Startgebühr und eine gedeckelte Preistabelle; die
// Schwierigkeit steigt innerhalb einer Runde. Max-Einsätze sind so gewählt, dass
// der höchste mögliche Einzelgewinn einer Runde grob ≤ 50.000 Credits bleibt –
// ein Glückstreffer darf groß sein, aber kein einzelner Klick soll die gesamte
// Spielwirtschaft sprengen. Begründungen und Simulationen: docs/ECONOMY.md.

export const LIMITS = {
  blackjack: { min: 10, max: 1000, steps: [10, 20, 30, 50, 80, 100, 150, 200, 300, 500, 750, 1000] },
  roulette: { min: 5, max: 2000, maxStraight: 100 },
  "slots-fruit": { min: 5, max: 250, steps: [5, 10, 25, 50, 100, 250] },
  "slots-seven": { min: 5, max: 50, steps: [5, 10, 20, 30, 50] },
  "slots-cosmo": { min: 10, max: 200, steps: [10, 20, 50, 100, 200] },
  plinko: { min: 1, max: 100, steps: [1, 2, 5, 10, 20, 50, 100] },
  horses: { min: 10, max: 500, steps: [10, 20, 50, 100, 200, 500] },
  grabber: { min: 20, max: 100, steps: [20, 50, 100] },
  coinpusher: { coin: 10 },
  hoops: { entry: 40 },
  stacker: { entry: 20 },
  cyclone: { entry: 20 },
};

/** Grobe Obergrenze für einen einzelnen Rundengewinn (Dokumentation + Tests). */
export const MAX_SINGLE_WIN = 60000;
