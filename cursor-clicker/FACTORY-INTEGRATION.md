# Cursor Clicker: integrierte Mitarbeiter-Fabrik

## Lokale Vorschau (nicht veröffentlicht)
- Hauptspiel: http://127.0.0.1:8915/cursor-clicker/
- Fabrik: http://127.0.0.1:8915/cursor-clicker/fabrik/
- Grundlage: normales Cursor Clicker aus origin/main, Commit 3a42c20.
- Der alte lokale Branch und sein test-claude-Fabrik-WIP wurden nicht übernommen oder bearbeitet.
- Der unabhängige Designentwurf unter test-chatgpt/cursor-clicker-fabrik-design bleibt unverändert.
- Kein Commit/Push. Die Dateien des Hauptspiels mussten im alten Checkout zunächst aus origin/main bereitgestellt werden.

## Verhalten
Ein aktueller Coinbestand ab 100.000 schaltet die Fabrik dauerhaft frei. Es werden keine Coins
für die Freischaltung abgezogen. Rechts mittig erscheint ein abgerundetes quadratisches Fabrik-Logo.
Auch der Direktaufruf der Fabrik prüft diese Freischaltung.

Der erste Fabrikbesuch startet ohne Demo-Coins, Mitarbeiter oder Tränke. Mitarbeiter werden
aus Mitarbeiter-Boxen gezogen, in drei Arbeitsplätze eingesetzt und durch Tränke zeitweise verstärkt.
Ein Mitarbeiter-Klick produziert einen Coin. Der persönliche Cursor-Multiplikator verändert diese
Rate nicht. Fabrik-Klicks erhöhen nicht die Statistik der manuellen Klicks.

Einnahmen sammeln sich in einem separaten abholbaren Betrag innerhalb desselben Spielstands.
Beim Abholen werden nur ganze Coins einmalig auf coins und totalCoinsEarned gebucht.
Bruchteile bleiben liegen. Boxen und Tränke werden aus derselben Coin-Kasse bezahlt.
Offline-Produktion ist pro Abwesenheit auf acht Stunden begrenzt; Tränke laufen währenddessen
nach ihrer tatsächlichen Restlaufzeit ab. Im normalen geöffneten Spiel wird ebenfalls produziert.

## Speicherung und Sicherheit
- Hauptspiel und Fabrik importieren denselben state.js/save.js, verwenden dieselbe Wallet.
- Live-Schlüssel unverändert: cursorClicker.save.v1.live; Schema jetzt Version 4.
- Alte v1–v3 Spielstände bleiben migrierbar. Bestehende Cursor, Duplikate, Mutationen,
  Auren, Favoriten, Ausrüstung, Erfolge und Einstellungen bleiben erhalten.
- Fabrikdaten sind unter factory Bestandteil des vollständigen Saves und des Quick-Saves.
- Der Designschlüssel cursorClicker.factoryDesign.v2 wird niemals gelesen/importiert.
- Beide Seiten werden im selben Tab besucht. Web Locks verhindern zwei gleichzeitig schreibende Tabs.
  Erforderlich: aktueller Browser auf HTTPS oder localhost. Nach Schließen des ersten Tabs
  kann ein zweiter Tab über „Erneut versuchen“ geladen werden.
- Navigation speichert synchron lokal und wartet bis zu 1,5 Sekunden auf Cloud-Versand.
- Supabase bleibt beim bestehenden CloudSave-Adapter und game_saves-Spielschlüssel cursor-clicker.
  Keine Datenbankänderung, keine neuen Schlüssel, keine Admin-Zugriffe.
- Auf localhost ist Cloud-Sync ausdrücklich deaktiviert: Testfortschritt landet nie im echten Konto.
  Local Storage ist außerdem nach Origin getrennt: github.io-Spielstände erscheinen nicht automatisch auf localhost.
- Cloud-Uploads werden pro Seite in Reihenfolge verarbeitet. Ein älterer Cloud-Save desselben Kontos
  darf einen neueren lokalen Save nicht überschreiben. Der erste Account-Abgleich bindet den Save
  an cloudOwnerId; bei einem anderen Konto wird nicht der vorige Kontostand übernommen.
- Nach vier Sekunden wird ein hängender Initial-Abgleich verworfen und für diese Seite nicht hochgeladen.
  Nach Netzwerkausfall Seite neu öffnen. Dies ist kein serverseitiges geräteübergreifendes Konflikt-Merging.
- Freischaltung/Offline-Wirtschaft sind clientseitige Spielregeln, kein Anti-Cheat-System.
- „Spielstand zurücksetzen“ im Hauptspiel setzt auch die Fabrik zurück.

## Dateien
- js/core/factoryModel.js: reine Freischalt-, Offline- und Abholberechnungen
- js/data/factory.js: Mitarbeiter, Boxen, Tränke und Chancen
- js/core/session.js: gemeinsamer Schreibschutz
- js/core/state.js und save.js: gemeinsamer Save, Migration und Cloud-Abgleich
- js/ui/factoryEntry.js und css/factory-entry.css: Zugang im Hauptspiel
- fabrik/: Fabrik-Oberfläche mit bestehendem Design
- tests/factory.test.mjs: deterministische Modell-, Migrations- und Cloud-Mock-Tests

## Tests
Aus dem Repository:
```powershell
node --experimental-default-type=module cursor-clicker/tests/factory.test.mjs
python -m http.server 8915 --bind 127.0.0.1
```

Separater Browser-Test ohne Veränderung des normalen localhost-Spielstands:
```powershell
python -m http.server 8916 --bind 127.0.0.1
```
Dann http://127.0.0.1:8916/cursor-clicker/tests/browser-fixture.html öffnen.
Die Fixture ist hart auf diesen lokalen Host/Port beschränkt, überschreibt keinen vorhandenen Save
und enthält 99.999 Coins plus zwei Wooden Cursor. Bestehende Coin-Achievements des Hauptspiels
können beim Start weitere Coins vergeben und dadurch die Fabrik bereits freischalten.
Test-Fixture nicht für die Veröffentlichung nötig.

Browser-geprüft: Boxkauf, Mitarbeiter einsetzen, Trank kaufen/aktivieren, 22 → 44 Klicks/s,
630 Coins abholen, identischer Coinstand 91.529 im Hauptspiel und nach Neuladen,
bestehendes Cursor-Inventar unverändert, Mitarbeiter und Boost nach Rückkehr erhalten,
paralleler zweiter Tab gesperrt; keine JavaScript-Warnungen/Fehler im getesteten Ablauf.
Echte Supabase-Konto-Synchronisierung wurde nicht gegen Produktionsdaten getestet.
