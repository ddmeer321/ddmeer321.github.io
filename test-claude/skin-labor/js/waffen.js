// Waffenformen fuer das Skin-Labor.
//
// Eine Waffe ist KEIN Bild, sondern eine Liste von Pfaden in drei Gruppen:
//
//   lack     Teile, die der Skin einfaerbt (Gehaeuse, Schaft, Griff, Magazin)
//   metall   blanke Teile, die IMMER metallisch bleiben (Lauf, Visier)
//   dunkel   Innenteile und Kunststoff, die immer dunkel bleiben
//
// Diese Trennung ist der wichtigste Grund, warum eine generierte Skin nicht
// billig aussieht: eine Waffe, die komplett in einer Farbe getaucht wird,
// wirkt sofort wie ein Aufkleber. Echte Skins lackieren nur einen Teil.
//
// Beim Zeichnen zaehlen zwei Dinge mehr als Details:
//   1. Die Teile muessen ANEINANDER stossen. Schwebende Einzelteile lesen
//      sich sofort als Spielzeug.
//   2. Das Laengenverhaeltnis. Eine Waffe ist lang und schmal -- alles unter
//      etwa 3:1 wirkt gedrungen.
//
// "linien" sind duenne Fugen, die ueber die Lackierung gezeichnet werden.
// Sie kosten fast nichts und geben der Flaeche Struktur.

window.WAFFEN = [
// NICHT DABEI: das Sturmgewehr.
//
// Fuenf Anlaeufe, jedes Mal sah es nach Wasserpistole aus. Der Grund ist
// nicht behebbar, indem man laenger an den Zahlen dreht: eine Waffe mit
// Schaft, Gehaeuse, Handschutz, Lauf, Magazin und Griff hat sechs Teile,
// deren Verhaeltnis zueinander stimmen muss. Sowas zeichnet man in einem
// Vektorprogramm und schaut dabei zu -- nicht als Pfaddaten von Hand.
//
// Messer und Pistole sind dagegen wenige grosse Flaechen und funktionieren
// auf Anhieb. Genau darin steckt die Erkenntnis dieses Prototyps: nicht die
// 250 Skins sind die Arbeit, sondern die zehn Silhouetten darunter.

  {
    id: "pistole",
    name: "Pistole",
    viewBox: [12, 34, 388, 266],
    lack: [
      // Schlitten
      "M 40 56 L 356 56 L 364 68 L 364 102 L 40 102 Z",
      // Rahmen mit Staubschutz nach vorne
      "M 44 102 L 344 102 L 344 124 L 200 124 L 190 138 L 104 138 L 44 122 Z",
      // Griffstueck: faellt nach hinten ab, das ist die typische Neigung
      "M 48 102 L 100 136 L 110 262 Q 112 278 96 278 L 66 278 Q 52 278 49 264 L 26 130 Q 23 108 42 102 Z",
    ],
    metall: [
      "M 356 72 L 384 72 L 384 88 L 356 88 Z",
      "M 52 44 L 76 44 L 76 56 L 52 56 Z",
      "M 334 44 L 350 44 L 350 56 L 334 56 Z",
    ],
    dunkel: [
      // Auswurffenster
      "M 236 64 L 306 64 L 306 86 L 236 86 Z",
      // Abzugsbuegel
      "M 186 124 L 200 124 L 200 172 Q 200 188 218 188 L 244 188 L 244 199 L 214 199 Q 184 199 184 172 Z",
      "M 205 132 L 215 132 L 215 170 L 205 170 Z",
      // Magazinboden
      "M 60 270 L 110 270 L 113 288 L 57 288 Z",
    ],
    linien: [
      "M 40 78 L 364 78",
      "M 60 60 L 60 98",
      "M 74 60 L 74 98",
      "M 88 60 L 88 98",
      "M 34 146 L 90 164",
      "M 40 182 L 96 200",
      "M 46 218 L 102 236",
    ],
  },

  {
    id: "messer",
    name: "Messer",
    // Bei Messern ist die Klinge das Schaustueck -- sie bekommt den Lack,
    // der Griff bleibt dunkel. Genau wie bei CS2-Messern.
    viewBox: [24, 52, 512, 110],
    lack: [
      "M 186 82 L 380 70 L 452 75 Q 502 84 524 108 Q 470 133 388 135 L 186 134 Z",
    ],
    metall: [
      "M 160 72 L 188 72 L 188 146 L 160 146 Z",
      "M 30 100 L 44 100 L 44 128 L 30 128 Z",
    ],
    dunkel: [
      "M 42 94 L 162 90 L 162 134 L 42 138 Q 30 138 30 127 L 30 105 Q 30 94 42 94 Z",
    ],
    linien: [
      "M 190 98 Q 356 84 512 106",
      "M 62 98 L 62 133",
      "M 84 97 L 84 132",
      "M 106 96 L 106 131",
      "M 128 95 L 128 130",
    ],
  },
];
