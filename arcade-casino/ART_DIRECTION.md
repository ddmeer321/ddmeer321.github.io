# Art Direction – Neonpalast

## Recherche (Kurzfassung)

Untersucht wurden aktuelle Browser-/Mobile-Arcade-Titel und Artikel zu Stilrichtungen
(u. a. Mobile-Art-Style-Übersichten 2025/26, Analysen zur Gestaltung von *Balatro*,
Coin-Pusher-Umsetzungen im Browser auf itch.io/GitHub, Diskussionen zu isometrisch
vs. Top-Down auf Canvas). Wiederkehrende Erkenntnisse:

* Erfolgreiche Casino-/Arcade-Spiele leben von **dunklen Hintergründen, wenigen sehr
  gesättigten Akzentfarben, leuchtenden UI-Momenten und kräftiger Typografie** –
  Lesbarkeit von Zahlen (Guthaben, Einsatz, Multiplikator) hat höchste Priorität.
* **Vektor-/Flat-2D** skaliert verlustfrei auf jede Pixeldichte, braucht praktisch keine
  Asset-Dateien und lädt sofort; Kosten entstehen nur bei sehr vielen komplexen Pfaden
  und Verläufen pro Frame.
* **Pixel Art** ist schnell lesbar, verlangt aber für jede Animation handgezeichnete
  Frames und wirkt auf hochauflösenden Phones nur mit sauberem Integer-Scaling gut.
* **Isometrie** sieht als Hub reizvoll aus, nutzt aber Hochformat-Displays schlecht
  (breite Raute) und verdeckt kleine Objekte hinter großen.
* **Echtes 3D (WebGL)** wirkt hochwertig, ist für viele Minispiele aber der größte
  Aufwand und das größte Risiko auf schwachen Geräten.

## Bewertung

| Kriterium            | Pixel/Retro | Neon-Vektor 2D | Pseudo-3D (Canvas) | Isometrisch | WebGL-3D |
|----------------------|:-----------:|:--------------:|:------------------:|:-----------:|:--------:|
| Entwicklungsaufwand  | mittel (Frames) | **niedrig** | mittel | hoch | sehr hoch |
| Visuelle Qualität    | gut | **gut–sehr gut** (Glow, Licht) | sehr gut | sehr gut | sehr gut |
| Performance          | sehr gut | **sehr gut** | gut | gut | mittel |
| Mobile-Tauglichkeit  | gut | **sehr gut** (scharf, skalierbar) | gut | mäßig (Hochformat) | mäßig |
| Animierbarkeit       | aufwendig | **sehr gut** (CSS/Canvas, Code) | gut | aufwendig | gut |
| Erweiterbarkeit      | mittel | **sehr gut** (Bausteine) | gut | mittel | mittel |
| Konsistenz Hub/Spiele| gut | **sehr gut** | gut | schwierig | gut |

## Entscheidung: „Neon-Vektor-Diorama"

**Stilisierte 2D-Vektorgrafik mit Neon-Beleuchtung, gezielt ergänzt durch Pseudo-3D**
(perspektivische Projektion) dort, wo die Spielmechanik Tiefe braucht (Coin Pusher,
Basketball, Roulette-Kessel).

* **Hub**: eine Halle als Querschnitt-Diorama – Rückwand mit Leuchtschriften, Boden mit
  perspektivischem Raster, Automaten und Tische als prozedural erzeugte SVG-Objekte.
  Kein Charakter, alles direkt antippbar. Auf dem Smartphone werden die Bereiche
  („Slot-Allee", „Tisch-Lounge", „Arcade-Ecke") untereinander gestapelt, am Desktop
  stehen sie nebeneinander.
* **Spiele**: Canvas 2D für bewegte Szenen, DOM für Bedienelemente. Gemeinsame
  Zeichenfunktionen (Karten, Chips, Münzen, Glow, Panels) sorgen dafür, dass jede Szene
  aus denselben Bausteinen entsteht.
* **Keine Bild-Assets**: Grafiken, Symbole und Sounds werden im Code erzeugt
  (SVG, Canvas, Web Audio). Dadurch ist das Spiel winzig und überall gestochen scharf.

## Designsystem (Kurzreferenz – Details in `css/tokens.css`)

* **Grundton**: Nachtviolett `#0b0614` → `#1e1236`, Flächen leicht aufgehellt, feine
  helle Kanten (`rgba(255,255,255,.08)`).
* **Neonakzente** (sparsam, mit Bedeutung):
  * Pink `#ff3d9a` – Marke, Hauptaktion
  * Cyan `#2de2e6` – Info, Auswahl, Fokus
  * Gold `#ffc53d` – Geld, Gewinne, Guthaben
  * Lime `#8cff5a` – Erfolg, Treffer
  * Violett `#9b5cff` – Progression, XP
  * Rot `#ff5a5a` – Verlust, Warnung
* **Tischfilz**: tiefes Petrol `#0c5c55` mit Vignette (passt zur violetten Halle).
* **Typografie**: Systemschrift (abgerundet, wo verfügbar), Überschriften 800–900,
  Großbuchstaben mit Laufweite; Zahlen immer `tabular-nums`. Bewusst keine Webfonts
  (Ladezeit, Datenschutz).
* **Formen**: Radien 10/16/24 px, Buttons mindestens 44 px hoch, „gedrückte" Buttons
  sinken 2 px ein (physisches Gefühl).
* **Licht**: Neon = farbiger `box-shadow`/`shadowBlur` + heller Kern. Glow nur für
  Interaktives und Gewinne, damit er Bedeutung behält.
* **Bewegung**: kurze federnde Übergänge (160–320 ms), Zahlen zählen hoch, Gewinne
  bekommen Partikel + Ton + Impuls. `prefers-reduced-motion` reduziert Deko-Animationen.
* **Partikel**: ein zentrales, gedeckeltes System (max. ~220 gleichzeitig).

## V1.1-Ergänzungen

Die neuen Automaten bleiben im selben Neon-Vektor-Stil und nutzen dieselben Bausteine:

* **Neon-Plinko**: dunkle Glasfront, Pins als kleine Lichtpunkte, die beim Treffer kurz
  aufglühen; Fächer farbcodiert von kühl (×0,2) bis heiß (Rand-Jackpot). Die Risikostufe
  verändert nur die Beschriftung/Farbe der Fächer, nie das Brett.
* **Münzgreifer**: Glaskasten mit Rahmenlicht, Münzhaufen aus denselben Münz-Zeichenfunktionen
  wie die Münzkaskade (Bronze, Silber, Gold, Chip, Diamant), Kralle als schlichte Vektorform,
  Schacht links mit Lauflicht.
* **Neon Derby**: Rennbahn in Seitenansicht mit mitlaufender Kamera (das führende Pferd bei
  etwa 62 % der Breite) und Distanzmarken; Pferde als stilisierte Silhouetten mit
  Galopp-Beinen und Startnummer in den Farben der Seidentrikots (Pink, Cyan, Gold, Lime,
  Violett, Orange).
* **Gewinnstufen**: Banner wachsen mit der Stufe; Mega/Jackpot nutzen eine Vollflächen-Szene
  (Lichtwelle, Titel, Multiplikator, hochzählender Betrag). Verluste bleiben ruhig – nie Gold,
  nie Konfetti.
* **Spielkontrolle**: bewusst sachlich – Cyan statt Pink/Gold, keine Animationen, klare
  Endzeiten. Hilfe-Inhalte sind reiner Text mit Links, ohne Casino-Optik.

## V1.2-Ergänzungen: Palast-Lounge

* **Jukebox:** klassischer Bogen mit Regenbogen-Neonrand, sechs Leuchtröhren, Lautsprechergitter.
  Vor dem Kauf gedimmt und entsättigt mit schrägem „ZU VERKAUFEN“-Schild; nach dem Kauf flackert
  das Licht in Stufen an, die Röhren pulsieren im Takt und Notenzeichen steigen auf. Das Display
  zeigt den laufenden Titel. Keine Inszenierung über die Halle hinaus – ein Musikkauf ist kein Jackpot.
* **Lotto-Studio:** Bildschirm mit Kugelmaschine (Glaskuppel, bunte Kugeln) über einem Studiopult.
  Ruhig wippende Kugeln im Normalzustand, wirbelnde Kugeln und rote „REC“-Leuchte bei LIVE,
  goldener Rahmen, wenn ein Ergebnis oder Gewinn wartet.
* **Ziehungs-Show:** dunkles Studio mit Lichtkegel, Kugeln mit weißem Zahlenfeld (lesbar auch klein),
  Treffer auf Scheinen mit Goldring und Häkchen (nicht nur Farbe). Gewinn: goldener, sanft
  pulsierender Knopf mit klarem Text; Verlust: ruhiger roter „Zurück“-Knopf, keine Effekte.
* **Posteingang:** schlichte Liste, ungelesen = pinker Punkt + Rand, Badge in der Kopfzeile.

## Abgrenzung

Die Recherche diente nur als Inspiration. Es werden keine fremden Grafiken, Marken,
Logos, Figuren oder Layouts übernommen; Name, Symbole und Automaten sind eigene
Entwürfe.
