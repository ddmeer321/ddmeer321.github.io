# Neonpalast – Wirtschaft, Auszahlungsquoten und Simulationen (V1.1)

Alle Zahlen stammen aus den Skripten in `sim/` (fester Seed, reproduzierbar) bzw. sind exakt
berechnet. Die Unit-Tests (`tests/*.test.mjs`) prüfen die wichtigsten Grenzen bei jedem Lauf,
damit spätere Änderungen die Balance nicht unbemerkt verschieben.

**Grundsatz:** Credits sind reines Spielgeld ohne jeden Gegenwert. Trotzdem soll die Wirtschaft
glaubwürdig sein: Wer viel spielt, verliert im Mittel langsam; große Einzelgewinne sind möglich,
aber kein Spiel und keine Spielweise darf eine dauerhafte „Gelddruckmaschine“ sein.

**Es gibt keine dynamischen Quoten.** Kein Spiel verändert Wahrscheinlichkeiten abhängig von
Guthaben, Verlust- oder Gewinnserien, Spielzeit oder Einsatzhöhe. Jedes Ergebnis entsteht aus
festen, im Code dokumentierten Regeln.

## 1. Was in V1.0 kaputt war (`sim/v10-baseline.mjs`)

| Problem | V1.0 | Ursache |
|---|---|---|
| Lichtwirbel | erwartete Rückzahlung 10×–25× des Einsatzes | Start immer gegenüber dem Jackpot → reines Intervall-Timing, 61 ms Fenster, Jackpot 25× |
| Turmbau | 6×–15× für gute Spieler | Schritte ≥ 55 ms, Jackpot 15× |
| Neon Hoops | 1,3× schon bei 30 % Trefferquote, bis 8× | ~60 Würfe, Multiplikatoren stapeln, Preise bis 8× |
| Gratis-Nachschub | 500 Credits sofort, beliebig oft | „Freeroll“: alles auf eine Zahl, bei Verlust nachfüllen |
| Level-Bonus | 100 × Level; XP an Einsatzhöhe gekoppelt | Level-Rabatt bei Spielen mit kleinem Hausvorteil |
| Kosmo 5 | Gewinntabelle listete Nova-Linien bis 2000× | Nova liegt nicht auf Walze 1/5 → unerreichbar |
| Einsätze | Slots bis 500, Blackjack 500, ohne zentrale Limits | ein Klick konnte sehr große Summen bewegen |

Der Bericht des Nutzers („aus ~1.000 wurden > 100.000 Credits mit Lichtwirbel“) ist damit
vollständig erklärt: Bei ~10× erwarteter Rückzahlung je Runde wächst das Guthaben exponentiell.

## 2. Leitplanken V1.1

* **Zufallsspiele:** RTP 92–97 % (sichtbar, konstant, durch Simulation/Rechnung belegt).
* **Skillgames:** feste Startgebühr, gedeckelte Preistabelle, Schwierigkeit steigt **innerhalb**
  einer Runde (sichtbar: Tempo, Zonen). Zielkurve: Zufall ≤ 0,3 · Durchschnitt 0,3–0,7 ·
  gut ≈ 0,9–1,1 · Elite ≤ ≈ 1,3–1,6. Perfektes Timing kann immer treffen – es gibt keine
  versteckte Ergebnisverschiebung.
* **Einsatzlimits** pro Spiel zentral in `js/core/limits.js`; höchster Einzelgewinn einer Runde
  bleibt unter `MAX_SINGLE_WIN` = 60.000 (Tests prüfen das je Spiel).
* **Boni** sind Zeit-/Fortschrittsbelohnungen, keine Einsatzrabatte: XP nur schwach an die
  Einsatzhöhe gekoppelt, Level-Bonus gedeckelt, Nachschub mit Wartezeit.

### Einsatzlimits (`js/core/limits.js`)

| Spiel | Min | Max | Stufen / Besonderheit | höchster Einzelgewinn (theoretisch) |
|---|---|---|---|---|
| Blackjack | 10 | 1.000 | 10 … 1.000 | Split + Double: 4 × 2.000 = 8.000 |
| Roulette | 5 | 2.000 pro Runde | **max. 100 je Einzelzahl** | 2.000 auf Farbe → 4.000; Einzelzahl 3.600 |
| Fruchtfiesta | 5 | 250 | 5/10/25/50/100/250 | 150 × 50 = 7.500 pro Linie |
| Goldene Sieben | 5 | 50 | 5/10/20/30/50 | 1.000 × 50 = 50.000 |
| Kosmo 5 | 10 | 200 | 10/20/50/100/200 | 750 × 20 × 2 (Freispiel) = 30.000 pro Linie |
| Neon-Plinko | 5 | 100 | 5/10/20/50/100 | 100 × 200 = 20.000 pro Kugel |
| Neon Derby | 10 | 500 | 10 … 500 | 500 × 40 = 20.000 |
| Münzgreifer | 20 | 100 | 20/50/100 | ≈ 5 Münzen à max. 30 Einheiten × 20 = 3.000 |
| Münzkaskade | 10 pro Münze | – | – | Megamünze 15 × 10 = 150 |
| Neon Hoops | 40 Startgebühr | – | – | 120 (3×) |
| Turmbau | 20 Startgebühr | – | – | 60 (3×) |
| Lichtwirbel | 20 Startgebühr | – | – | 500 (25×, nur perfekte Runde) |

Ein Spieler mit 100.000 Credits kann so überall sinnvoll mit Einsätzen spielen, die sich
„groß“ anfühlen, aber kein einzelner Klick verdoppelt sein Vermögen.

## 3. Zufallsspiele

| Spiel | RTP | Quelle |
|---|---|---|
| Blackjack (Basisstrategie) | **99,5 %** (Hausvorteil 0,49 %) | `sim/blackjack.mjs`, 1 Mio. Hände |
| Roulette (europäisch) | **97,3 %** (1/37) | exakt |
| Fruchtfiesta | **94,2 %** | exakt (alle Walzenkombinationen) |
| Goldene Sieben | **94,7 %** | exakt |
| Kosmo 5 | **≈ 93 %** inkl. Freispiele | Simulation (Test) |
| Neon-Plinko Niedrig / Mittel / Hoch | **96,0 / 94,8 / 93,7 %** | Fachverteilung aus der Physik, `sim/plinko-dist.mjs` |
| Neon Derby Sieg / Platz | **≈ 92,4 / 91,6 %** | Monte-Carlo desselben Rennmodells, `sim/horses.mjs` |

### Blackjack-Prüfung (`sim/blackjack.mjs`, Basisstrategie, 6 Decks)

1 Mio. Hände: Hausvorteil 0,49 %, Blackjack-Quote 4,55 % (Theorie ≈ 4,5–4,75 %),
Dealer-Bust 23,1 %, Push 8,8 %, jeder Rang ≈ 1/13 (Mischung gleichverteilt). Dealer steht auf
allen 17, Blackjack zahlt 3:2, Dealer-Peek bei Ass/Zehn, Double auf zwei Karten, ein Split.
Es gibt keine Anpassung an Gewinn- oder Verlustserien – Serien sind normale Zufallsschwankung.

### Neon-Plinko

Die Kugel wird von einer deterministischen Physik (fester Zeitschritt 1/240 s, Pins mit
Restitution/Reibung) durch 12 Pin-Reihen geführt. Das Fach, in dem sie liegen bleibt, **ist** das
Ergebnis – es gibt keine vorab gezogene Zielposition, die animiert würde. Startversatz und
-impuls kommen aus dem Zufallsgenerator. `sim/plinko-dist.mjs` misst die Fachverteilung über
400.000 Würfe (symmetrisiert); die Multiplikatortabellen sind darauf abgestimmt, und ein Test
prüft, dass eine frische Simulation zur hinterlegten Verteilung passt.

| Risiko | Fächer (Rand → Mitte) | RTP | Höchstwert |
|---|---|---|---|
| Niedrig | 12 · 4 · 2 · 1,4 · 1,2 · 0,8 · 0,6 | 96,0 % | ×12 |
| Mittel | 50 · 12 · 4 · 1,8 · 1 · 0,6 · 0,2 | 94,8 % | ×50 |
| Hoch | 200 · 18 · 5 · 1,4 · 0,4 · 0,2 · 0,2 | 93,7 % | ×200 (≈ 1 : 645) |

Teil-Rückzahlungen (×0,2 … ×0,8) sind **Verluste** und werden auch so dargestellt.

### Neon Derby

Ein einziges Rennmodell (Grundtempo, Rennstil, Tagesform, geglättete Abschnittstempi). Vor dem
Rennen läuft dasselbe Modell 4.000-mal (Monte-Carlo) → Sieg-/Platzwahrscheinlichkeiten →
Quote = (1 − 7 % Marge) / p, auf 0,1 abgerundet, 1,2…40. Das angezeigte Rennen ist ein weiterer,
unabhängiger Lauf; die Animation zeigt exakt dessen Positionen, Sieger ist, wer in dieser
Simulation zuerst die Ziellinie erreicht. Die Tests prüfen u. a., dass gleicher Seed das gleiche
Rennen ergibt, die Animation zum Zieleinlauf passt, die Quoten zu den Wahrscheinlichkeiten passen
und unabhängige Rennen die Rückzahlung von ≈ 92 % bestätigen.

## 4. Arcade-Automaten mit Physik

### Münzgreifer (`sim/grabber.mjs`)

Preis pro Versuch 20/50/100; eine Münzeinheit = Einsatz/5. Der Griff ist vollständig
lagebasiert: Welche Münzen im Greifbereich liegen (Position, Überlappung, Lage im Haufen),
wie fest sie sitzen und ob sie beim Anheben/Schwenken herausrutschen, folgt aus festen Regeln.
Es gibt keine versteckte Griffstärken-Manipulation.

| Spielweise | Rückzahlung |
|---|---|
| wahllos | ≈ 45 % |
| menschlich gezielt (Zielfehler ~½ Münze) | ≈ 63 % |
| perfekter Rechner (probiert alle Positionen) | ≈ 87 % |

Damit ist der Greifer – wie in echten Arcades – ein Unterhaltungsautomat mit deutlich
negativem Erwartungswert; gutes Zielen hilft spürbar, macht ihn aber nicht profitabel.

### Münzkaskade 2.0 (`sim/coinpusher.mjs`)

Gutschriften entstehen **nur** durch sichtbar über die Vorderkante fallende Münzen (Seitenrinnen
sind Verlust). Trägheit, Kettenreaktionen, gestapelte Münzen und Kippzustände an der Kante sind
simuliert.

| Spielweise | Rückgabequote |
|---|---|
| zufälliger Einwurf | ≈ 92 % |
| mittig (optimal) | ≈ 97 % |
| seitlich | ≈ 80 % |

**Entscheidung zum 92–95 %-Ziel:** Die Quote hängt bei einem Pusher von der Spielweise ab.
Durchschnittliches Spiel liegt im Zielband; konsequent mittiges Werfen erreicht ≈ 97 % und bleibt
damit unter 100 % – Können wird belohnt, aber nicht zur Geldquelle. Eine strengere Quote hätte
sich nur durch unsichtbare Eingriffe (z. B. „klebrige“ Kante) erreichen lassen; das ist
ausgeschlossen.

## 5. Skillgames

Modell: Der zeitliche Fehler eines Spielers ist normalverteilt (σ in ms). Bei Turmbau kommt die
Bildraster-Quantisierung (60 Hz, σ ≈ 4,8 ms) hinzu. „Elite“ (σ ≈ 10 ms) ist für Menschen nur
mit großer Übung und konstanter Konzentration erreichbar.

### Lichtwirbel (`sim/cyclone.mjs`)

5 Stufen pro Runde, jede schneller (0,8 → 0,38 s pro Umlauf, 48 Lampen); jeder Jackpot-Treffer
in Folge beschleunigt zusätzlich ×0,85 (min. 0,34 s). Jackpot-Zone = genau eine Lampe.
Punkte 5/2/1 nach Abstand; Preis nur für hohe Gesamtpunktzahlen, 25× nur für eine perfekte Runde.
Die Lampe, die beim Tippen leuchtet, wird gewertet – exakt, ohne Verschiebung.

| Spieler | RTP | perfekte Runde |
|---|---|---|
| Zufall | 0,02 | 0 % |
| σ 60 ms (Gelegenheit) | 0,19 | 0 % |
| σ 40 ms (Durchschnitt) | 0,35 | 0 % |
| σ 25 ms (gut) | 0,65 | 0,01 % |
| σ 15 ms (sehr gut) | 1,08 | 0,1 % |
| σ 10 ms (Elite) | 1,55 | 0,7 % |

### Turmbau (`sim/stacker.mjs`)

Schrittzeit 125 ms (unten) → 24 ms (oberste zwei Reihen, ≈ 1,5 Bilder bei 60 Hz); ab Reihe 5
höchstens zwei, ab Reihe 8 nur noch ein Block. Zwischenpreis nach Reihe 8: 24 (1,2×) mitnehmen
oder weiter zum Jackpot 60 (3×).

| σ (ms) | RTP mitnehmen | RTP weiterbauen | Jackpot-Quote |
|---|---|---|---|
| 45 | 0,30 | 0,00 | 0,1 % |
| 30 | 0,66 | 0,04 | 1,3 % |
| 20 | 0,97 | 0,21 | 7 % |
| 15 | 1,10 | 0,52 | 18 % |
| 10 | 1,18 | 1,30 | 43 % |

Die Entscheidung „mitnehmen oder riskieren“ bleibt echt: Für fast alle ist Mitnehmen besser,
nur sehr präzise Spieler profitieren vom Weiterbauen.

### Neon Hoops (`sim/hoops.mjs`)

Startgebühr 40, 45 s, Korb 2 / Swish 3, ab 4 Treffern in Folge ×2, letzte 10 s ×2, ab 30 Punkten
pendelt der Korb (−25 % Trefferquote im Modell). Preise 8 … 120 (max. 3×).

| Trefferquote | Ø Punkte | RTP |
|---|---|---|
| 35 % | 45 | 0,21 |
| 50 % | 65 | 0,38 |
| 65 % | 90 | 0,61 |
| 80 % | 124 | 0,94 |
| 92 % | 159 | 1,30 |

### Was heißt das für „Farmen“?

Selbst ein Elite-Spieler, der stundenlang fehlerfrei auf σ 10 ms spielt, gewinnt bei Turmbau
≈ +6 Credits pro Runde (≈ 10 s) und bei Lichtwirbel ≈ +11 pro Runde – bei hoher Varianz.
Das ist ein spürbarer Lohn für echtes Können, aber um Größenordnungen kleiner als in V1.0
(dort: +200 … +500 pro Runde) und wächst nicht mit dem Guthaben, weil die Startgebühr fest ist.

## 6. Boni und Fortschritt

| Quelle | V1.1 | Begründung |
|---|---|---|
| Tagesbonus | 250 + 25 × (Level − 1), max. 1.000 | einmal pro Kalendertag |
| Nachschub | 300 Credits, wenn < 10, **20 Min. Wartezeit** | verhindert „Freeroll“-Schleifen |
| Level-Bonus | 50 × Level, max. 1.000 | XP pro Level wächst mit Level^1,35 |
| XP pro Runde | 2 + min(8, ⌊Einsatz/50⌋) | hohe Einsätze bringen kaum mehr XP |
| Tages-Challenges | 3 pro Tag, je 75 Credits + 30 XP, alle drei: +75 | kleine Ziele quer durch die Spiele |

Abschätzung „Level-Farming“: Blackjack mit Mindesteinsatz kostet im Mittel 0,05 Credits pro Hand
(2 XP). Level n → n+1 braucht 120·n^1,35 XP. Der Level-Bonus 50·(n+1) bringt dadurch
≈ 1,7 Credits pro Hand auf Level 1, ≈ 0,4 auf Level 10 und ≈ 0,3 ab Level 20 (weiter sinkend) –
eine Zeitbelohnung von anfangs einigen hundert, später ≈ 100 Credits pro Stunde, keine
Gelddruckmaschine (V1.0: 100 × Level und XP proportional zum Einsatz).

Boni werden in der Statistik getrennt gezählt („Boni erhalten“), sodass jederzeit gilt:
Guthaben = Startguthaben − Einsätze + Auszahlungen + Boni (die E2E-Tests prüfen das).

## 7. Gewinnstufen (`js/core/wintier.js`)

Die Stufe richtet sich nach Auszahlung : Einsatz (inkl. Einsatz):
< 1 Verlust · = 1 Einsatz zurück · > 1 Gewinn · ≥ 2 guter Gewinn · ≥ 5 großer Gewinn ·
≥ 20 Mega-Gewinn · ≥ 100 (oder echter Jackpot-Treffer) Jackpot. Teil-Rückzahlungen unter dem
Einsatz bekommen nie Gewinn-Inszenierung (z. B. Plinko ×0,2, Fruchtfiesta „2 Kirschen“ bei
5 Linien, Pferdewette verloren).

## 8. Simulationen erneut ausführen

```bash
cd arcade-casino
node sim/v10-baseline.mjs     # Ausgangslage V1.0
node sim/cyclone.mjs          # Lichtwirbel je Timing-Genauigkeit
node sim/stacker.mjs          # Turmbau je Timing-Genauigkeit
node sim/hoops.mjs            # Neon Hoops je Trefferquote
node sim/blackjack.mjs 1000000
node sim/plinko-dist.mjs      # Fachverteilung aus der Physik (dauert ~1 Min.)
node sim/grabber.mjs          # Münzgreifer je Spielweise
node sim/coinpusher.mjs       # Münzkaskade je Spielweise
node sim/horses.mjs           # Rennmodell: Quoten-Kalibrierung und RTP
```
