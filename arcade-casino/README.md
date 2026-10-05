# Neonpalast – Arcade-Casino im Browser

Eine begehbare (bzw. antippbare) Arcade-Casino-Halle mit Casino- und Skill-Automaten.
**Ausschließlich virtuelles Spielgeld** – keine Käufe, keine Auszahlungen, keine Verbindung
zu echtem Geld, Kryptowährungen oder anderen Vermögenswerten.

Start: `arcade-casino/index.html` über einen beliebigen Static-Server öffnen (kein Build-Schritt,
keine Abhängigkeiten zur Laufzeit). Grafikstil und Designentscheidungen: siehe
[`ART_DIRECTION.md`](ART_DIRECTION.md).

## Inhalt

| Bereich | Spiel | Kurzbeschreibung |
|---|---|---|
| Slot-Allee | **Fruchtfiesta** | 3×3, 5 Gewinnlinien, Kirschen zahlen ab 2 – RTP exakt 94,2 % |
| | **Goldene Sieben** | klassische 3-Walzen-Maschine, 1 Linie, Mischgewinne, Kirschen überall – RTP exakt 94,7 % |
| | **Kosmo 5** | 5×3, 10 Linien, Wild (Nova), Scatter (Komet) → Freispiele mit ×2 – RTP ≈ 93 % (Simulation) |
| Tisch-Lounge | **Blackjack** | 6 Decks, Hit/Stand/Double/Split, Dealer steht auf 17, BJ 3:2, Dealer-Peek |
| | **Roulette** | europäisch, animierter Kessel mit Kugel, Zahl/Farbe/Gerade/Ungerade/Hälften/Dutzende/Kolonnen |
| Arcade-Ecke | **Münzkaskade** | Coin Pusher mit vereinfachter Physik, Gold- und Sternmünzen, gespeichertes Münzfeld |
| | **Neon Hoops** | Basketball per Swipe, deterministische 3D-Flugbahn mit Ring/Brett/Netz, 45 s, Serien, beweglicher Korb |
| | **Turmbau** | Stacker: Timing, Zwischenpreis oder Risiko bis zum Jackpot |
| | **Lichtwirbel** | Cyclone-Timing-Ring: Licht auf dem Jackpot-Feld stoppen, wird mit jeder Serie schneller |

Dazu: Guthaben mit Hochzähl-Animation, Tagesbonus, Gratis-Nachschub bei < 10 Credits,
XP/Level mit Level-Bonus, 19 Achievements, Statistik, Bestwerte, freischaltbare Hallen-Themes,
Einstellungen (Lautstärken, Vibration, Klang-Haptik, Bewegung, Theme), Spielregeln je Automat.

## Architektur

```
arcade-casino/
  index.html            App-Rahmen (HUD, Views, Overlays)
  css/tokens.css        Designsystem-Tokens (Farben, Radien, Schatten, Zeiten, Themes)
  css/base|components|hub|games.css   Layout, UI-Bausteine, Halle, gemeinsames Spiel-Layout
  css/<spiel>.css       spielspezifische Styles (werden beim Öffnen nachgeladen)
  js/main.js            Verdrahtung: Zustand, Wirtschaft, Progression, HUD, Router, Lebenszyklus
  js/core/              state (Laden/Bereinigen/Speichern), storage (sicheres localStorage),
                        economy (Einsätze/Tickets/Auszahlung), progression, bonus, rng, events, tablock
  js/audio/             audio.js (ein AudioContext, synthetisierte Klänge, Busse, Stimmenlimit),
                        feedback.js (Vibration + Fake-Haptik)
  js/ui/                dom, toast, modal, banner, fx (gedeckeltes Partikel-Overlay), betControl, panels
  js/render/            stage (Canvas mit DPR/Resize, rAF-Loop mit Tab-Pause), palette
  js/hub/               Halle + prozedurale SVG-Automaten
  js/games/<spiel>/     je Spiel: reine Logik (testbar) + Darstellung/Bedienung
  tests/                Node-Unit-Tests + Playwright-E2E
```

Jedes Spiel exportiert `mount(root, ctx)` und erhält über `ctx` die gemeinsamen Systeme
(Wirtschaft, Audio, Haptik, Toasts, Dialoge, Partikel, Speicher). Rückgabe: `destroy()`,
optional `finalize()` (Runde sofort korrekt abrechnen) und `pause()`.

## Wirtschaft & Fairness

* Beträge sind immer sichere positive Ganzzahlen; NaN, negative oder gebrochene Werte werden abgelehnt.
* Der Einsatz wird **vor** jeder Animation synchron abgebucht; jede Runde hat ein Ticket, das genau
  einmal ausgezahlt werden kann (doppelte Auszahlungen sind ausgeschlossen).
* Ergebnisse stehen beim Start fest; Animationen zeigen sie nur. Wer ein Spiel mitten in der Runde
  verlässt oder neu lädt, bekommt die Runde fair abgerechnet (Blackjack: offene Hände halten,
  Slots/Roulette: feststehendes Ergebnis, Hoops: aktuelle Punktzahl).
* Nur ein Tab ist aktiv (Tab-Sperre), damit sich Spielstände nicht gegenseitig überschreiben.
* Wahrscheinlichkeiten sind im Code nachvollziehbar: Walzenstreifen in `js/games/slots/machines.js`,
  Coin-Pusher-Münztypen in `js/games/coinpusher/physics.js`, Roulette 1/37 je Zahl.
* Skill-Spiele (Hoops, Turmbau, Lichtwirbel) enthalten **keinen** Zufall und keine versteckte Steuerung.
* **Hinweis:** Der Spielstand liegt nur lokal im Browser und ist nicht gegen absichtliche
  Manipulation geschützt (Entwicklerwerkzeuge). Bei reinem Spielgeld ist das bewusst akzeptiert.

## Tests

```bash
cd arcade-casino
npm test            # 36 Unit-Tests (node --test): Wirtschaft, Bereinigung, Progression,
                    # Blackjack-Regeln, Roulette-Auszahlungen, Slot-RTP & Auswertung,
                    # Coin-Pusher-Physik, Wurfphysik, Stacker, Lichtwirbel
npm run test:e2e    # 32 Browser-Checks (Playwright/Chromium, startet eigenen Server)
```

Die E2E-Tests prüfen u. a.: Halle lädt, jedes Spiel öffnet per Touch und „Zurück“ (inkl.
Browser-Zurück) funktioniert, Blackjack-Runden inkl. Tastatur, ungültige Einsätze werden
verhindert, Roulette zahlt in mehreren Runden exakt richtig aus, Slots gewinnen und verlieren,
Spielstand übersteht Neuladen, Coin Pusher schiebt Münzen über die Kante und speichert das Feld,
Basketball trifft mit passendem und verfehlt mit schwachem Swipe, das Spiel läuft ohne Web Audio,
ResizeObserver, Vibration und localStorage, und ein zweiter Tab sperrt den ersten – jeweils ohne
Konsolenfehler.

## Bekannte Grenzen

* Coin-Pusher-Physik ist bewusst 2D (keine gestapelten Münzen, keine Trägheit) – performant und
  glaubwürdig, aber keine echte Rigid-Body-Simulation.
* Basketball normalisiert das Wisch-Tempo auf die Höhe des Spielfelds; auf sehr unterschiedlichen
  Bildschirmen fühlt sich die nötige Wischgeschwindigkeit leicht anders an.
* Ton startet (browserbedingt) erst nach der ersten Berührung/Taste. iOS Safari unterstützt keine
  Vibration – dort übernimmt die Klang-Haptik.
* Kein Service Worker/Offline-Modus, keine Cloud-Speicherung.
* Das Spiel ist in `games/arcade-casino/config.json` beschrieben, aber (noch) nicht in
  `config/games.js` öffentlich gelistet.

## Mögliche Erweiterungen

* Cloud-Speicherung über das vorhandene Konto-System der Seite (`assets/js/cloud-save.js`)
* Weitere Skill-Automaten (Darts, Mini-Bowling, Memory unter Zeitdruck)
* Weitere Slots mit eigenen Mechaniken (Cluster-Pays, Hold & Spin)
* Tägliche Herausforderungen und Wochen-Ranglisten
* Service Worker für Offline-Spiel
