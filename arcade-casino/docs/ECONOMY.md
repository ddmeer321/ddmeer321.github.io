# Neonpalast – Wirtschaft, Auszahlungsquoten und Simulationen (V1.2)

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
| Lichtwirbel | 20 Startgebühr | – | – | 160 (8×, nur perfekte Runde; V1.1: 500) |

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
| Neon-Plinko Niedrig / Mittel / Hoch | **95,1 / 94,8 / 95,3 %** (V1.2) | Fachverteilung aus der Physik, `sim/plinko-dist.mjs` |
| Neon Derby Sieg / Platz | **≈ 92,4 / 91,6 %** | Monte-Carlo desselben Rennmodells, `sim/horses.mjs` |

### Blackjack-Prüfung (`sim/blackjack.mjs`, Basisstrategie, 6 Decks)

1 Mio. Hände: Hausvorteil 0,49 % (V1.2-Nachprüfung mit 500.000 Händen: 0,55 %, Blackjack-Quote
4,57 %, Dealer-Bust 23,1 %, Push 8,8 % – Abweichung im Rahmen des Zufalls, keine Regeländerung).
V1.1-Messung, Blackjack-Quote 4,55 % (Theorie ≈ 4,5–4,75 %),
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
| Niedrig | 12 · 3 · 2 · 1,4 · 1,2 · 0,8 · 0,6 | 95,1 % | ×12 |
| Mittel | 50 · 12 · 4 · 1,8 · 1 · 0,6 · 0,2 | 94,8 % | ×50 |
| Hoch | 200 · 18 · 5 · 1,6 · 0,4 · 0,2 · 0,2 | 95,3 % | ×200 (≈ 1 : 645) |

**V1.2-Entscheidung:** „Risiko“ bedeutet jetzt nur noch Varianz. In V1.1 lagen die Stufen
bei 96,0 / 94,8 / 93,7 % – wer „Hoch“ wählte, zahlte also zusätzlich eine schlechtere Quote,
ohne dass das sichtbar war. Mit zwei Feldwerten (Niedrig 4 → 3, Hoch 1,4 → 1,6; alle Werte
bleiben Vielfache von 0,2, damit jede Auszahlung ganzzahlig ist) liegen alle drei innerhalb
von 0,5 Prozentpunkten. Die Physik ist unverändert; ein Test prüft die Spanne.

Teil-Rückzahlungen (×0,2 … ×0,8) sind **Verluste** und werden auch so dargestellt.

### Neon Derby

Ein einziges Rennmodell (Grundtempo, Rennstil, Tagesform, geglättete Abschnittstempi). Vor dem
Rennen läuft dasselbe Modell 4.000-mal (Monte-Carlo) → Sieg-/Platzwahrscheinlichkeiten →
Quote = (1 − 7 % Marge) / p, auf 0,1 abgerundet, 1,2…40. Das angezeigte Rennen ist ein weiterer,
unabhängiger Lauf; die Animation zeigt exakt dessen Positionen, Sieger ist, wer in dieser
Simulation zuerst die Ziellinie erreicht. Die Tests prüfen u. a., dass gleicher Seed das gleiche
Rennen ergibt, die Animation zum Zieleinlauf passt, die Quoten zu den Wahrscheinlichkeiten passen
und unabhängige Rennen die Rückzahlung von ≈ 92 % bestätigen.

`sim/horses.mjs` (30 Startfelder × 400 Rennen): Sieg-RTP 92,4 %, Platz-RTP 91,6 %, der Favorit
gewinnt in 30,2 % der Rennen (seine Wahrscheinlichkeit laut Quote: 29,9 % – passt),
Pferde mit Quote ≥ 8 gewinnen 17 % aller Rennen, Ø Renndauer 14,1 s, Ø 2,4 Führungswechsel
pro Rennen, höchste Quote 27,7.

## 4. Arcade-Automaten mit Physik

### Münzgreifer (`sim/grabber.mjs`)

Preis pro Versuch 20/50/100; eine Münzeinheit = Einsatz/5. Der Griff ist vollständig
lagebasiert: Welche Münzen im Greifbereich liegen (Position, Überlappung, Lage im Haufen),
wie fest sie sitzen und ob sie beim Anheben/Schwenken herausrutschen, folgt aus festen Regeln.
Es gibt keine versteckte Griffstärken-Manipulation.

| Spielweise | Rückzahlung |
|---|---|
| wahllos | ≈ 46 % (2,31 Einheiten/Griff) |
| menschlich gezielt (Zielfehler ~½ Münze) | ≈ 63 % (3,14) |
| perfekter Rechner (probiert alle Positionen) | ≈ 88 % (4,39) |

Damit ist der Greifer – wie in echten Arcades – ein Unterhaltungsautomat mit deutlich
negativem Erwartungswert; gutes Zielen hilft spürbar, macht ihn aber nicht profitabel.

### Münzkaskade 2.0 (`sim/coinpusher.mjs`)

Gutschriften entstehen **nur** durch sichtbar über die Vorderkante fallende Münzen (Seitenrinnen
sind Verlust). Trägheit, Kettenreaktionen, gestapelte Münzen und Kippzustände an der Kante sind
simuliert.

| Spielweise | Rückgabequote |
|---|---|
| zufälliger Einwurf | ≈ 91–92 % |
| mittig (optimal) | ≈ 97 % |
| seitlich | ≈ 74–80 % (viele Münzen fallen in die Seitenrinnen) |

(1.500 Einwürfe je Lauf; die Spanne ergibt sich aus verschiedenen Seeds/Laufzeiten.
Bei Dauerbetrieb – ein Einwurf alle 0,45 s – fallen pro Schieber-Zyklus meist 3–7 Münzen
über die Vorderkante; einzelne Zyklen werfen 8–10.)

**Entscheidung zum 92–95 %-Ziel:** Die Quote hängt bei einem Pusher von der Spielweise ab.
Durchschnittliches Spiel liegt im Zielband; konsequent mittiges Werfen erreicht ≈ 97 % und bleibt
damit unter 100 % – Können wird belohnt, aber nicht zur Geldquelle. Eine strengere Quote hätte
sich nur durch unsichtbare Eingriffe (z. B. „klebrige“ Kante) erreichen lassen; das ist
ausgeschlossen.

## 5. Skillgames

Modell: Der zeitliche Fehler eines Spielers ist normalverteilt (σ in ms). Bei Turmbau kommt die
Bildraster-Quantisierung (60 Hz, σ ≈ 4,8 ms) hinzu. „Elite“ (σ ≈ 10 ms) ist für Menschen nur
mit großer Übung und konstanter Konzentration erreichbar.

### Lichtwirbel (`sim/cyclone.mjs`) – V1.2 neu abgestimmt

**Problem in V1.1:** Die blaue Zone war nur ±2 Lampen breit, bei 7–17 ms pro Lampe. Für
Menschen (Tipp-Streuung σ ≈ 40–60 ms) war selbst Blau weitgehend Zufall – „Economy sicher“
war zu „frustrierend“ geworden.

**V1.2:** Zonen nach Abstand zur Jackpot-Lampe: Jackpot = 1 Lampe (5 Punkte), Pink = ±2
(3 Punkte), Blau = ±6 (1 Punkt). Umläufe 0,95 → 0,85 → 0,76 → 0,68 → 0,6 s (48 Lampen),
jeder Jackpot-Treffer in Folge ×0,92 schneller (min. 0,5 s). Fein gestufte Preistabelle von
7 Punkten (0,2×) bis 25 Punkten (8×, perfekte Runde). Gewertet wird exakt die Lampe beim Tippen.

| Spieler | RTP | Jackpot je Stopp | Pink oder besser | Blau oder besser |
|---|---|---|---|---|
| Zufall | 0,02 | 2 % | 10 % | 27 % |
| σ 80 ms (Anfänger) | 0,27 | 8 % | 38 % | 79 % |
| σ 60 ms (Gelegenheit) | 0,42 | 11 % | 49 % | 90 % |
| σ 50 ms (normal) | 0,52 | 13 % | 57 % | **95 %** |
| σ 40 ms (geübt) | 0,65 | 16 % | 67 % | 98 % |
| σ 25 ms (gut) | 0,89 | 25 % | 87 % | 100 % |
| σ 15 ms (sehr gut) | 1,16 | 39 % | 98 % | 100 % |
| σ 10 ms (Elite) | 1,57 | 55 % | 100 % | 100 % |

Lernkurve: Blau ist für normale Spieler fast sicher, Pink ist eine echte Aufgabe, der Jackpot
bleibt selten. Rückzahlung steigt gleichmäßig mit der Präzision; die V1.0-Gelddruckmaschine
(10–25×) bleibt ausgeschlossen.

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
In der Gesamtsimulation (Abschnitt 9) ist das der bewusst extreme „Elite-Worst-Case“
(450 Skill-Runden täglich auf σ 10 ms): rund +5.000 Credits pro Tag. Realistisch gute Spieler
(σ 15–25 ms) liegen bei Rückzahlung 0,9–1,16 und damit nahe null.
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

## 7. Neon Lotto (V1.2, `js/core/lotto.js`)

Zwei Ziehungen mit derselben Technik. Pro Ziehung höchstens **20 Scheine**; jeder Schein hat
genau 4 verschiedene Zahlen. Feste Gewinne (kein Pool, da es nur einen Spieler gibt).

| | Neon Lotto | Großes Neon Lotto |
|---|---|---|
| Termin | täglich 20:00 Uhr | alle 3 Tage 21:00 Uhr |
| Zahlen | 4 aus 20 (4.845 Kombinationen) | 4 aus 24 (10.626 Kombinationen) |
| Schein | 50 C | 100 C |
| 4 Richtige | 10.000 C · 1 : 4.845 | 120.000 C · 1 : 10.626 |
| 3 Richtige | 1.000 C · 1 : 75,7 (64/4.845) | 4.000 C · 1 : 132,8 (80/10.626) |
| 2 Richtige | 100 C · 1 : 6,7 (720/4.845) | 150 C · 1 : 9,3 (1.140/10.626) |
| 1 / 0 Richtige | 46,2 % / 37,6 % | 42,9 % / 45,6 % |
| Erwartete Auszahlung je Schein | 30,13 C | 57,51 C |
| **RTP** | **60,3 %** | **57,5 %** |

Formel: P(k Richtige) = C(4,k) · C(N−4, 4−k) / C(N,4). Ein Test vergleicht die exakte Rechnung
mit 200.000 Monte-Carlo-Ziehungen.

**Effekt von 1–20 Scheinen** (verschiedene Scheine): Die Gewinnchance wächst etwa linear, der
Erwartungswert bleibt pro Schein gleich negativ. Mit 20 Scheinen: mindestens 3 Richtige in
≈ 24 % (täglich) bzw. ≈ 14 % (groß) der Ziehungen; Höchstgewinn 1 : 242 bzw. 1 : 531 Ziehungen.
Erwarteter Verlust bei 20 Scheinen: ≈ 397 C (täglich) bzw. ≈ 850 C (groß) pro Ziehung.

**Coin-Sink:** Lotto ist bewusst ein Ausgabeposten mit Unterhaltungswert (RTP ≈ 58–60 %).
Maximal fließen so ≈ 400 + 283 = ≈ 680 C pro Tag ab (alle Scheine ausgereizt).

**Ausnahme vom Einzelgewinn-Deckel:** Der Höchstgewinn des Großen Lottos (120.000 C) liegt über
`MAX_SINGLE_WIN` (60.000). Das ist bewusst die eine Stelle für einen „lebensverändernden“ Treffer:
höchstens 20 Scheine alle 3 Tage, 1 : 10.626 je Schein – selbst mit Maximaleinsatz statistisch
etwa einmal in vier Jahren.

**Ehrlichkeit:** Jede Ziehung hat eine stabile id (`daily-2026-10-06`). Das Ergebnis wird beim
ersten Erreichen des Termins einmal mit crypto-Zufall erzeugt und sofort gespeichert; die
Show zeigt es nur. Neuladen, Tabwechsel, Überspringen oder Zurückgehen ändern nichts. Ziehungen
ohne eigene Scheine werden nicht ausgelost. Einfordern ist atomar (Flag + Gutschrift + sofortiges
Speichern in einem Schritt) – Doppelklick, zweites Öffnen oder Neuladen zahlen nicht erneut.
Grenze: Alles läuft im Browser; wer Systemuhr oder localStorage mit Entwicklerwerkzeugen
verändert, kann Termine oder Ergebnisse manipulieren. Bei reinem Spielgeld ist das akzeptiert.

## 8. Jukebox und Songs (V1.2, `js/core/jukebox.js`)

| Kauf | Preis | Begründung |
|---|---|---|
| Jukebox (dauerhaft, 2 Stücke inklusive) | **5.000 C** | ≈ 1–2 Wochen gemischtes Spielen; erstes großes Ziel |
| jedes weitere Stück | **1.500 C** (alle gleich) | ≈ 2–4 Tage; Musikgeschmack ist subjektiv |
| besondere Stücke | nicht käuflich | Level 10 bzw. alle 12 Automaten gespielt |

Gesamtsenke: 5.000 + 6 × 1.500 = **14.000 C**. Käufe zählen in der Statistik als „Ausgegeben“,
nicht als Einsatz: Guthaben = Start − Einsätze + Auszahlungen + Boni − Ausgaben.
V1.2 hat den Jukebox-Preis nach der Simulation von 6.000 auf 5.000 gesenkt (bei 6.000 kam ein
normaler Spieler erst nach ≈ 6 Wochen dazu).

## 9. Gesamtsimulation 60 Tage (`sim/economy.mjs`)

Erwartungswert-Modell je Spieltag mit allen Quellen (Tagesbonus, Challenges, Level-Bonus,
Nachschub) und Senken (Hausvorteil, Skill-Startgebühren, Lotto exakt ausgelost, Jukebox, Songs).
41 Läufe je Typ; Median und 10./90. Perzentil des Guthabens nach 60 Tagen (Start 1.000):

| Spielertyp | Guthaben (Median) | P10 – P90 | Level | Jukebox ab Tag | Songs (von 6) |
|---|---|---|---|---|---|
| Gelegenheitsspieler (kauft nichts) | 9.582 | 7.787 – 10.965 | 7 | – | – |
| Normaler Spieler | 2.872 | 1.921 – 5.268 | 15 | 37 | 2 |
| Guter Skill-Spieler | 21.205 | – | 14 | 12 | 6 (Tag 31) |
| Elite-Skill (Worst Case, σ 10 ms) | 315.100 | – | 20 | – | – |
| High Roller | 2.505 | 1.956 – 5.821 | 9 | 55 | 0 |
| Challenge-Farmer | 38.002 | – | 10 | – | – |
| Lotto-Spieler (20 + 20 Scheine) | 2.490 | 1.715 – 9.815 | 7 | – | – |
| Sammler (Jukebox) | 16.810 | 14.082 – 18.195 | 12 | 13 | 6 (Tag 29) |
| Gemischter Spieler | 4.643 | 2.436 – 5.888 | 13 | – | – |

Lesart:
* Wer viel und hoch zockt, pendelt um ein Niveau – die Boni gleichen den Hausvorteil grob aus.
  Wer etwas besitzen will, muss sich bewusst zurückhalten; genau dadurch bekommen Coins Gewicht.
* Sammler kommen in knapp zwei Wochen zur Jukebox und in einem Monat zur ganzen Bibliothek.
* Der Challenge-Farmer (nur Mindesteinsätze) wächst um ≈ 600 C pro Tag – eine begrenzte
  Zeitbelohnung, kein Exploit. Er würde die Jukebox nach ≈ 10 Tagen erreichen.
* Elite-Timing bleibt der einzige stark positive Pfad; er setzt dauerhaft maschinennahe
  Präzision voraus und ist als Grenze dokumentiert (siehe Abschnitt 5).
* Lotto-Dauerspieler verlieren planmäßig ≈ 40 % ihres Lotto-Einsatzes.

## 10. Gewinnstufen (`js/core/wintier.js`)

Die Stufe richtet sich nach Auszahlung : Einsatz (inkl. Einsatz):
< 1 Verlust · = 1 Einsatz zurück · > 1 Gewinn · ≥ 2 guter Gewinn · ≥ 5 großer Gewinn ·
≥ 20 Mega-Gewinn · ≥ 100 (oder echter Jackpot-Treffer) Jackpot. Teil-Rückzahlungen unter dem
Einsatz bekommen nie Gewinn-Inszenierung (z. B. Plinko ×0,2, Fruchtfiesta „2 Kirschen“ bei
5 Linien, Pferdewette verloren).

## 11. Simulationen erneut ausführen

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
node sim/economy.mjs 60       # V1.2: Gesamtwirtschaft je Spielertyp über 60 Tage
node sim/horses.mjs           # Rennmodell: Quoten-Kalibrierung und RTP
```
