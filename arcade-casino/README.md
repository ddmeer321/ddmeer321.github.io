# Neonpalast – Arcade-Casino im Browser (V1.2.1)

Eine antippbare Arcade-Casino-Halle mit Casino-, Physik- und Skill-Automaten.
**Ausschließlich virtuelles Spielgeld** – keine Käufe, keine Auszahlungen, keine Verbindung
zu echtem Geld, Kryptowährungen oder handelbaren Gegenständen.

Start: `arcade-casino/index.html` über einen beliebigen Static-Server öffnen (kein Build-Schritt,
keine Abhängigkeiten zur Laufzeit). Grafikstil: [`ART_DIRECTION.md`](ART_DIRECTION.md).
Wirtschaft, Quoten und alle Simulationen: [`docs/ECONOMY.md`](docs/ECONOMY.md).
Musik-Herkunft: [`docs/MUSIC.md`](docs/MUSIC.md). Audit und Recherche V1.2: [`docs/V1.2_NOTES.md`](docs/V1.2_NOTES.md).

## Inhalt

| Bereich | Spiel | Kurzbeschreibung |
|---|---|---|
| Palast-Lounge | **Jukebox** *(V1.2)* | dauerhafter Kauf (5.000 C), steht leuchtend in der Halle, 10 Eigenkompositionen, Songs alle zum selben Preis |
| | **Rubbellose** *(neu)* | eigener Tisch: Lose links kaufen, auf dem Tisch ablegen, groß nach vorn holen und mit dem Finger freirubbeln – 3 Lossorten (20/50/200 C), Ergebnis beim Kauf festgelegt |
| | **Neon Lotto** *(V1.2.1)* | täglich 4 aus 40 (Schein 50 C) und alle 3 Tage das Große Neon Lotto 6 aus 49 + Neonzahl (100 C, Höchstgewinn 1 : 139.838.160), Ziehungs-Show live oder als Aufzeichnung |
| Slot-Allee | **Fruchtfiesta** | 3×3, 5 Linien, Kirschen ab 2 – RTP exakt 94,2 % · Einsatz 5–250 |
| | **Goldene Sieben** | klassisch, 1 Linie, Mischgewinne – RTP exakt 94,7 % · Einsatz 5–50 |
| | **Kosmo 5** | 5×3, 10 Linien, Nova-Wild (Walze 2–4), Komet-Freispiele ×2 – RTP ≈ 93 % · 10–200 |
| Tisch-Lounge | **Blackjack** | 6 Decks, Hit/Stand/Double/Split, S17, 3:2, Peek – Hausvorteil 0,49 % · 10–1.000 |
| | **Roulette** | europäisch, animierter Kessel – 97,3 % · bis 2.000 pro Runde, 100 je Einzelzahl |
| | **Neon Derby** *(neu)* | 6 Pferde, Sieg-/Platzwette, Quoten aus Monte-Carlo desselben Rennmodells, 10–20 s Rennen mit Führungswechseln |
| Arcade-Ecke | **Neon-Plinko** | echte Pin-Physik bestimmt das Fach, 3 Risikostufen (≈ 95 % – Risiko = Varianz), Multi-Drop ×10, bis ×200 |
| | **Münzgreifer** *(neu)* | Kralle positionieren, mehrere Münzen greifen, manche rutschen beim Anheben heraus, Auszahlung über den Schacht |
| | **Münzkaskade 2.0** | Coin Pusher mit Trägheit, Kettenreaktionen, Stapeln, Kipp-Zustand an der Kante |
| | **Neon Hoops** | Basketball per Swipe, deterministische Wurfphysik, 45 s, Serien – neu balanciert |
| | **Turmbau** | Stacker, oben deutlich schneller, Zwischenpreis oder Risiko – neu balanciert |
| | **Lichtwirbel** | 5 Stufen, Zonen Blau/Pink/Jackpot – V1.2: Blau erreichbar, V1.2.1: steilere Preiskurve |

Dazu: Guthaben mit Hochzähl-Animation, Tagesbonus, Nachschub mit Wartezeit, XP/Level,
25 Erfolge, **3 Tages-Challenges**, Statistik (inkl. Boni und Ausgaben), Bestwerte, Hallen-Themes,
Einstellungen und Spielregeln je Automat.

### Neu: Rubbellose

Ein Tisch in der Palast-Lounge. Links der Losverkauf (Neon Sieben 20 C, Glückszahlen 50 C,
Diamant-Tresor 200 C), rechts der eigene Tisch, auf dem gekaufte Lose liegen (höchstens 12).
Ein Los antippen holt es groß nach vorn, der Tisch verschwimmt dahinter; die Felder werden
mit Finger oder Maus freigerubbelt („Alles aufdecken“ für Tastatur/Barrierefreiheit). Danach
„Gewinn einfordern“ (gold) bzw. „Los ablegen“ (rot). Das Ergebnis steht beim Kauf fest und ist
gespeichert; Gewinnpläne und RTP (68–69 %) stehen im Spiel und in `docs/ECONOMY.md` (7b).
Rubbellose zählen nicht zu den 12 Automaten (Entdecker-Erfolg und Jukebox-Freischaltung
bleiben unverändert) und sind in Pause/Auszeit gesperrt.

### V1.2.1 – Touch-, Lotto- und Balance-Hotfix

* **Touch:** Direkte Spielflächen (Neon Hoops, Münzgreifer, Münzkaskade, Neon-Plinko, Turmbau,
  Lichtwirbel) und die Halteknöpfe („Kugel“, Lichtwirbel-Stopp) lassen keine Browser-Gesten mehr
  zu (`touch-action: none`, kein Markieren/Kontextmenü). Lotto, Halle, Menüs und Overlays scrollen
  normal. Vorher konnte ein leichtes Verrutschen beim Halten die Geste abbrechen.
* **Neon Lotto:** täglich 4 aus 40 (Hauptgewinn 1 : 91.390 statt 1 : 4.845), Großes Neon Lotto
  6 aus 49 + Neonzahl 0–9 mit neun Gewinnklassen (6 + Neonzahl 1 : 139.838.160). Die Show zieht
  erst sechs Kugeln, dann nach einer Spannungspause separat die Neonzahl. Gewinnplan und
  Wahrscheinlichkeiten in `docs/ECONOMY.md`, Abschnitt 7.
* **Lichtwirbel:** nur die Preistabelle – 17 Punkte = Break-even, 19/21/23 Punkte = 24/30/50
  Credits, perfekt 160. Schwierigkeit unverändert.
* **Ladefehler:** Kommt eine Spieldatei nicht an (z. B. Server kurz 503), heißt es „Automat konnte
  gerade nicht geladen werden“ mit „Erneut versuchen“; echte Spielfehler bleiben „außer Betrieb“.
* **Spielstände:** V1.2-Lottoziehungen bleiben unverändert (alte Regeln, gleiche Zahlen,
  Einforder-Status); offene alte Scheine werden einmal vollständig erstattet.

### Neu in V1.2 – „Alles hat Gewicht“

* **Palast-Lounge:** erste Zone der Halle mit Jukebox und Lotto-Studio. Beide zeigen ihren
  Zustand direkt am Objekt (zu verkaufen / leuchtet / spielt; nächste Ziehung / LIVE / Gewinn wartet).
* **Jukebox:** bestätigter Kauf, Licht flackert an, erste Musik startet. Bibliothek, Abspieler
  (Play/Pause/Weiter/Zurück, Zufall, Lautstärke), Probehören, Songkauf mit kurzem Unlock-Moment.
  In Spielen läuft Musik leiser (einstellbar: leiser/normal/aus). Herkunft: `docs/MUSIC.md`.
* **Neon Lotto:** Scheine mit 4 Zahlen, max. 20 pro Ziehung. Das Ergebnis wird zum Termin einmal
  ausgelost und gespeichert; die Show (Studio → Kugelmaschine → vier Zahlen → Auswertung) zeigt
  es nur – live, wenn man gerade da ist, sonst als Aufzeichnung über den Posteingang. Gewinne
  werden per goldenem Knopf eingefordert (genau einmal), Verluste ehrlich mit „Zurück“ beendet.
  Archiv aller Ziehungen.
* **Posteingang** 📬 mit Badge in der Kopfzeile (generisch: id, Typ, Zeit, Titel, gelesen, Nutzdaten, Aktion).
* **Balance:** Lichtwirbel neu (Blau 95 % für normale Spieler), Plinko-Risiko = Varianz,
  ehrliche Texte bei Rückzahlungen unter dem Einsatz, Gesamtsimulation 9 Spielertypen (`sim/economy.mjs`).
* **Responsible Play:** „Gesunde Pause“ ist kein Erfolg mehr; Lotto-Studio bleibt in Pausen offen
  (Gewinne einfordern), Scheinkauf ist gesperrt.
* **Spielstand v3** mit Migration aus V1.1 (und weiter aus V1.0).

### Neu in V1.1

* **Economy-Rebalance:** Lichtwirbel (V1.0: 10–25× erwartete Rückzahlung), Turmbau, Hoops,
  Nachschub und Level-Bonus waren ausnutzbar. Alle Skillgames haben jetzt feste Startgebühren,
  gedeckelte Preise und steigende Schwierigkeit; zentrale Einsatzlimits (`js/core/limits.js`).
  Details und Simulationsergebnisse: `docs/ECONOMY.md`.
* **Einheitliches Gewinn-Feedback** (`js/core/wintier.js`, `js/ui/celebrate.js`): Verlust,
  Einsatz zurück, klein, gut, groß, Mega, Jackpot – relativ zum Einsatz. Jackpot-Inszenierung
  mit Pause → Einschlag → Lichtwelle → Titel → Multiplikator → Count-Up → Partikel → Ton →
  Haptik, per Tippen überspringbar, verkürzt bei reduzierter Bewegung. Teil-Rückzahlungen werden
  nie als Gewinn inszeniert.
* **Spielkontrolle** (⏸ oben rechts): Pause 15/30/60 Min., verbindliche Auszeit 1/3/7/30/90 Tage
  (lässt sich nach Bestätigung nicht vorzeitig aufheben – auch nicht per Reset), neutrale
  Erinnerung nach 30/60/90 Min. aktiver Spielzeit, Hilfe-Seite mit Warnzeichen und seriösen
  Anlaufstellen. Keine Belohnung fürs Weiterspielen, keine „Hol dir deine Verluste zurück“-Texte.
* **Spielstand v2** mit Migration aus V1.0 (Guthaben, XP, Level, Erfolge, Einstellungen,
  Statistik, Bestwerte, Münzfeld bleiben erhalten).

## Architektur

```
arcade-casino/
  index.html            App-Rahmen (HUD, Views, Overlays)
  css/                  tokens (Designsystem), base, components, hub, games + je Spiel nachgeladen
  js/main.js            Verdrahtung: Zustand, Wirtschaft, Progression, Spielkontrolle, Router
  js/core/              state (v3 + Migration), storage, economy (Tickets, Sperr-Guard, spend),
                        limits, wintier, control (Pause/Auszeit/Session), challenges,
                        lotto, jukebox, inbox, progression, bonus, rng, events, tablock
  js/audio/             audio.js (ein AudioContext, Busse SFX/Haptik/Ambience/Musik, Limits),
                        synth.js + tracks.js + music.js (Jukebox-Synthesizer, Stücke, Abspieler),
                        feedback.js (Vibration + Fake-Haptik)
  js/ui/                dom, toast, modal, banner, celebrate, control, fx, betControl, panels,
                        jukebox (Kauf + Panel), inbox
  js/render/            stage (Canvas mit DPR-Deckel/Resize, rAF-Loop mit Tab-Pause)
  js/hub/               Halle + prozedurale SVG-Automaten
  js/games/<spiel>/     je Spiel: reine Logik/Physik (in Node testbar) + Darstellung/Bedienung
  sim/                  Monte-Carlo-/Timing-Simulationen für die Balance
  tests/                Node-Unit-Tests + Playwright-E2E
  docs/                 ECONOMY.md (Balance), MUSIC.md (Herkunft), V1.1_PLAN.md, V1.2_NOTES.md
```

Jedes Spiel exportiert `mount(root, ctx)` und erhält über `ctx` die gemeinsamen Systeme
(Wirtschaft, Limits, Audio, Haptik, `celebrate`, `report` für Challenges, `setPhase` für Tests,
Dialoge, Partikel, Speicher). Rückgabe: `destroy()`, optional `finalize()` und `pause()`.

## Fairness

* Beträge sind sichere positive Ganzzahlen. Der Einsatz wird **vor** jeder Animation abgebucht;
  jede Runde hat ein Ticket, das genau einmal ausgezahlt wird.
* **Keine dynamischen Quoten:** Nichts hängt von Guthaben, Serien oder Spielzeit ab.
* Ergebnisse entstehen ehrlich: Slots/Roulette ziehen vorab und zeigen das Ergebnis;
  **Plinko, Münzgreifer, Münzkaskade und Basketball berechnen das Ergebnis aus der sichtbaren
  Physik**; Neon Derby zeigt genau den simulierten Rennverlauf; Skillgames werten exakt den
  Zustand im Moment der Eingabe.
* Wer mitten in der Runde geht oder neu lädt, bekommt fair abgerechnet.
* Pause/Auszeit sperren Einsätze zentral in der Wirtschaft (nicht nur in der Oberfläche) – auch Lotto-Scheine.
* Lotto: ein gespeichertes Ergebnis pro Ziehungs-id, Einfordern genau einmal. Ehrliche Grenze:
  lokale Uhr und localStorage sind mit Entwicklerwerkzeugen manipulierbar (bei Spielgeld akzeptiert).
* Nur ein Tab ist aktiv (Tab-Sperre).
* Der Spielstand liegt nur lokal im Browser und ist nicht gegen absichtliche Manipulation
  (Entwicklerwerkzeuge) geschützt – bei reinem Spielgeld bewusst akzeptiert.

## Leistung & Mobilgeräte

* Mobile-first: getestet auf 360×640, 390×844, 844×390 (quer), 768×1024, 1366×820, 1440×900.
* Canvas-Auflösung mit gedeckeltem DPR (max. 2) und **adaptiver Auflösung**: Liegt die
  mittlere Bildzeit über 90 Bilder bei > 26 ms, senkt `js/render/stage.js` die Pixeldichte
  schrittweise bis 1. Gemessen (Chromium ohne GPU, 4× CPU-Drosselung, 390×844 @3×):
  Münzkaskade 19 → 41 fps, Münzgreifer 25 → 50 fps, Plinko ×10 60 fps, Derby/Lichtwirbel 60 fps.
* rAF-Schleifen stoppen in Ruhe (Tischspiele, Turmbau-Menü) und bei verstecktem Tab.
* Partikel gedeckelt, Plinko-Pin-Ticks und Hufschläge mit Ratenlimit und Stimmen-Deckel,
  Physik mit festem Zeitschritt (Plinko 1/240 s, Pusher 1/120 s).
* Reduzierte Bewegung (System oder Einstellung): kürzere Inszenierung, keine Blitze/Wackler.

## Tests

```bash
cd arcade-casino
npm test            # 127 Unit-Tests (node --test): Wirtschaft, Limits, Migration v1→v3, Pause/Auszeit,
                    # Gewinnstufen, Challenges, Blackjack-Regeln + Simulation, Roulette, Slots,
                    # Plinko-Physik/RTP, Münzgreifer, Münzkaskade, Pferderennen, Lichtwirbel,
                    # Turmbau- und Hoops-Balance, Jukebox + Musik-Engine, Lotto, Rubbellose, Posteingang
npm run test:e2e    # 123 Browser-Checks (Playwright/Chromium, eigener Server, ~8 Min.)
```

Die E2E-Tests warten auf Spielzustände (`data-phase` am Spielcontainer) statt auf feste Zeiten.
Sie spielen in jedem Spiel echte Runden und prüfen die Bilanz (Guthaben = Start − Einsätze +
Auszahlungen + Boni − Ausgaben), Navigation inkl. Browser-Zurück, Neuladen, Pause/Auszeit (mit
simulierter Uhr), die neutrale Erinnerung, die Migration eines V1.0-Spielstands, Jukebox (Kauf,
Songs, leiser in Spielen, Neuladen), Lotto (Scheine, 20er-Limit, Live-Ziehung mit simulierter Uhr,
verpasste Ziehung über den Posteingang, Neuladen während der Show, Einfordern genau einmal,
Verlust, 6 aus 49 + Neonzahl, Erstattung alter Scheine), Touch-Gesten auf Spielflächen bei
320/375/390 px (echte Touch-Wischer über das DevTools-Protokoll), Ladefehler vs. Defekt, Layouts auf mehreren Bildschirmgrößen, reduzierte Bewegung, fehlende
Browserfunktionen und die Tab-Sperre – jeweils ohne Konsolenfehler.

## Bekannte Grenzen

* Physik ist bewusst vereinfacht (2D bzw. 2,5D, kein allgemeiner Rigid-Body-Solver) – aber
  das Ergebnis folgt immer aus der sichtbaren Simulation.
* Skillgames können für extrem präzise Spieler positiv sein (Elite σ 10 ms ≈ 1,3–1,76×,
  siehe `docs/ECONOMY.md`); der absolute Ertrag ist durch feste Startgebühren klein.
* Ton startet (browserbedingt) erst nach der ersten Berührung. iOS Safari unterstützt keine
  Vibration – dort übernimmt die Klang-Haptik.
* Pause/Auszeit gelten nur für diesen Browser (lokaler Spielstand).
* Lotto-Termine folgen der lokalen Zeitzone des Geräts; wer reist, sieht die Ziehung zur lokalen Uhrzeit.
* Musik ist synthetisch (keine Aufnahmen); auf Handy-Lautsprechern fehlt der Bass.
* Kein Service Worker/Offline-Modus, keine Cloud-Speicherung.
