# Neonpalast – Arcade-Casino im Browser (V1.1)

Eine antippbare Arcade-Casino-Halle mit Casino-, Physik- und Skill-Automaten.
**Ausschließlich virtuelles Spielgeld** – keine Käufe, keine Auszahlungen, keine Verbindung
zu echtem Geld, Kryptowährungen oder handelbaren Gegenständen.

Start: `arcade-casino/index.html` über einen beliebigen Static-Server öffnen (kein Build-Schritt,
keine Abhängigkeiten zur Laufzeit). Grafikstil: [`ART_DIRECTION.md`](ART_DIRECTION.md).
Wirtschaft, Quoten und alle Simulationen: [`docs/ECONOMY.md`](docs/ECONOMY.md).

## Inhalt

| Bereich | Spiel | Kurzbeschreibung |
|---|---|---|
| Slot-Allee | **Fruchtfiesta** | 3×3, 5 Linien, Kirschen ab 2 – RTP exakt 94,2 % · Einsatz 5–250 |
| | **Goldene Sieben** | klassisch, 1 Linie, Mischgewinne – RTP exakt 94,7 % · Einsatz 5–50 |
| | **Kosmo 5** | 5×3, 10 Linien, Nova-Wild (Walze 2–4), Komet-Freispiele ×2 – RTP ≈ 93 % · 10–200 |
| Tisch-Lounge | **Blackjack** | 6 Decks, Hit/Stand/Double/Split, S17, 3:2, Peek – Hausvorteil 0,49 % · 10–1.000 |
| | **Roulette** | europäisch, animierter Kessel – 97,3 % · bis 2.000 pro Runde, 100 je Einzelzahl |
| | **Neon Derby** *(neu)* | 6 Pferde, Sieg-/Platzwette, Quoten aus Monte-Carlo desselben Rennmodells, 10–20 s Rennen mit Führungswechseln |
| Arcade-Ecke | **Neon-Plinko** *(neu)* | echte Pin-Physik bestimmt das Fach, 3 Risikostufen (96,0/94,8/93,7 %), Multi-Drop ×10, bis ×200 |
| | **Münzgreifer** *(neu)* | Kralle positionieren, mehrere Münzen greifen, manche rutschen beim Anheben heraus, Auszahlung über den Schacht |
| | **Münzkaskade 2.0** | Coin Pusher mit Trägheit, Kettenreaktionen, Stapeln, Kipp-Zustand an der Kante |
| | **Neon Hoops** | Basketball per Swipe, deterministische Wurfphysik, 45 s, Serien – neu balanciert |
| | **Turmbau** | Stacker, oben deutlich schneller, Zwischenpreis oder Risiko – neu balanciert |
| | **Lichtwirbel** | 5 Stufen, jede schneller, Jackpot-Zone eine Lampe – komplett neu balanciert |

Dazu: Guthaben mit Hochzähl-Animation, Tagesbonus, Nachschub mit Wartezeit, XP/Level,
26 Achievements, **3 Tages-Challenges**, Statistik (inkl. Boni), Bestwerte, Hallen-Themes,
Einstellungen und Spielregeln je Automat.

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
  js/core/              state (v2 + Migration), storage, economy (Tickets, Sperr-Guard),
                        limits, wintier, control (Pause/Auszeit/Session), challenges,
                        progression, bonus, rng, events, tablock
  js/audio/             audio.js (ein AudioContext, synthetisierte Klänge, Stimmen-/Ratenlimits),
                        feedback.js (Vibration + Fake-Haptik)
  js/ui/                dom, toast, modal, banner, celebrate, control, fx, betControl, panels
  js/render/            stage (Canvas mit DPR-Deckel/Resize, rAF-Loop mit Tab-Pause)
  js/hub/               Halle + prozedurale SVG-Automaten
  js/games/<spiel>/     je Spiel: reine Logik/Physik (in Node testbar) + Darstellung/Bedienung
  sim/                  Monte-Carlo-/Timing-Simulationen für die Balance
  tests/                Node-Unit-Tests + Playwright-E2E
  docs/                 ECONOMY.md (Balance), V1.1_PLAN.md (Analyse V1.0)
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
* Pause/Auszeit sperren Einsätze zentral in der Wirtschaft (nicht nur in der Oberfläche).
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
npm test            # 82 Unit-Tests (node --test): Wirtschaft, Limits, Migration, Pause/Auszeit,
                    # Gewinnstufen, Challenges, Blackjack-Regeln + Simulation, Roulette, Slots,
                    # Plinko-Physik/RTP, Münzgreifer, Münzkaskade, Pferderennen, Lichtwirbel,
                    # Turmbau- und Hoops-Balance
npm run test:e2e    # 75 Browser-Checks (Playwright/Chromium, eigener Server, ~6 Min.)
```

Die E2E-Tests warten auf Spielzustände (`data-phase` am Spielcontainer) statt auf feste Zeiten.
Sie spielen in jedem Spiel echte Runden und prüfen die Bilanz (Guthaben = Start − Einsätze +
Auszahlungen + Boni), Navigation inkl. Browser-Zurück, Neuladen, Pause/Auszeit (mit simulierter
Uhr), die neutrale Erinnerung, die Migration eines V1.0-Spielstands, Layouts auf mehreren
Bildschirmgrößen, reduzierte Bewegung, fehlende Browserfunktionen und die Tab-Sperre – jeweils
ohne Konsolenfehler.

## Bekannte Grenzen

* Physik ist bewusst vereinfacht (2D bzw. 2,5D, kein allgemeiner Rigid-Body-Solver) – aber
  das Ergebnis folgt immer aus der sichtbaren Simulation.
* Skillgames können für extrem präzise Spieler leicht positiv sein (Elite ≈ 1,3–1,55×,
  siehe `docs/ECONOMY.md`); der absolute Ertrag ist durch feste Startgebühren klein.
* Ton startet (browserbedingt) erst nach der ersten Berührung. iOS Safari unterstützt keine
  Vibration – dort übernimmt die Klang-Haptik.
* Pause/Auszeit gelten nur für diesen Browser (lokaler Spielstand).
* Kein Service Worker/Offline-Modus, keine Cloud-Speicherung.
