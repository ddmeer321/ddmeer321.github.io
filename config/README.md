# Spiel-Konfiguration

Spiel-Metadaten werden nicht im HTML der Startseite gepflegt, sondern je Spiel
in einer `config.json`. Die Startseite baut ihre Spielkarten daraus auf.

## Aufteilung

| Datei | Zuständig für |
|---|---|
| `games/<id>/config.json` | **Daten** über ein Spiel (Name, Typ, Status, Link …) |
| `config/games.js` | **Welche** Spiele öffentlich sind (Allowlist) + Laden |
| `config/schema.js` | **Ob** eine `config.json` gültig ist (Validierung) |
| `config/types.js` | Bedeutung von `type` (Anzeigetext) |
| `config/statuses.js` | Bedeutung von `status` (Anzeigetext + Badge-Klasse) |
| `library-games.js` | **Wie** daraus eine Spielkarte wird (DOM) |
| `library.css` | Aussehen der Badges (`.status-*`) |

Die `config.json` beschreibt nur, **was** ein Spiel ist. Anzeigetexte,
CSS-Klassen, HTML und Rendering-Logik stehen bewusst **nicht** darin.

## Felder in `config.json`

**Pflicht**

| Feld | Bedeutung |
|---|---|
| `id` | Eindeutige Kennung, nur `a-z`, `0-9`, `-` (z.B. `neon-bot-arena`). Stabiler Bezugspunkt für spätere Features. |
| `name` | Angezeigter Titel (max. 80 Zeichen). |
| `type` | Art des Spiels — eine id aus `config/types.js` (`minigame`, `clicker`, `action`, `puzzle`). Erscheint links auf der Karte. |
| `entry` | Startseite des Spiels, **relativ zum Seiten-Root**, muss auf `.html` enden (z.B. `snake.html`, `games/foo/index.html`). |

**Optional**

| Feld | Bedeutung |
|---|---|
| `status` | Veröffentlichungs-/Update-Status aus `config/statuses.js` (`stable`, `new`, `beta`, `updated`). Erscheint rechts auf der Karte. Fehlt das Feld oder steht `stable` drin, wird **kein** Badge angezeigt. |
| `statusUntil` | Datum `JJJJ-MM-TT`, bis zu dem das Status-Badge angezeigt wird (siehe unten). Ohne dieses Feld bleibt der Status dauerhaft sichtbar. |
| `version` | Versionsnummer im Format `1.0.0`. |
| `author` | Wer das Spiel gemacht hat. |
| `description` | Kurzbeschreibung auf der Karte (max. 400 Zeichen). |
| `thumbnail` | Vorschaubild, relativ zum Seiten-Root. |
| `thumbnailAlt` | Alt-Text des Vorschaubilds (Barrierefreiheit). |
| `icon` | Emoji als Ersatz, wenn es kein `thumbnail` gibt (z.B. `🐍`). |

## Status automatisch auslaufen lassen (`statusUntil`)

Ein „Neu"-Badge soll meist nicht ewig stehen bleiben. Mit `statusUntil` läuft
es von selbst ab — ohne dass jemand daran denken muss, es später zu entfernen:

```json
"status": "new",
"statusUntil": "2026-08-17"
```

- Das Badge wird **bis einschließlich** des angegebenen Tages angezeigt und
  verschwindet am Folgetag. Für „eine Woche neu" also: Veröffentlichungsdatum
  + 7 Tage.
- Danach verhält sich die Karte wie ein Spiel ohne Status: rechts entsteht gar
  kein Element. Die `config.json` muss dafür **nicht** angefasst werden.
- Ohne `statusUntil` bleibt der Status dauerhaft sichtbar — sinnvoll z.B. für
  `beta`, das bis zum echten Release stehen bleiben soll.
- Ein ungültiges Datum wird ignoriert (Badge bleibt sichtbar) und in der
  Konsole gemeldet — ein Tippfehler macht kein Spiel unsichtbar.

Der Vergleich passiert über die lokale Uhrzeit des Besuchers. Ein Gerät mit
falsch gestellter Uhr kann ein Badge daher einen Tag früher oder später
ausblenden; für rein dekorative Badges ist das unkritisch.

## Neues Spiel hinzufügen

1. `games/<id>/config.json` anlegen (siehe Felder oben).
2. In `config/games.js` eine Zeile zu `PUBLIC_GAME_CONFIGS` hinzufügen.

Schritt 2 ist die einzige Stelle, die über eine Veröffentlichung entscheidet:
Es gibt **keine** automatische Suche nach `config.json`-Dateien. Dadurch kann
ein Testbereich oder ein unfertiges Spiel nicht versehentlich öffentlich
gelistet werden.

## Neuen Spieltyp hinzufügen

In `config/types.js` einen Eintrag ergänzen:

```js
racing: { label: "Rennspiel" },
```

Danach ist `"type": "racing"` in jeder `config.json` gültig.

## Neuen Status hinzufügen

1. In `config/statuses.js` ergänzen:

```js
soon: { badge: true, label: "Bald", badgeClass: "status-soon" },
```

2. In `library.css` die passende Farbe ergänzen:

```css
.status-soon { background: var(--pink); color: #fff; }
```

## Robustheit und Sicherheit

- Ein fehlendes oder fehlerhaftes `config.json` betrifft immer nur **ein**
  Spiel — die restlichen Karten und die Seite laden normal weiter.
- Unbekannter `status` → das Spiel wird angezeigt, nur ohne Badge.
- Unbekannter `type` → das Spiel wird übersprungen (Pflichtfeld mit fester
  Auswahl), Meldung in der Browser-Konsole.
- Config-Daten gelten nie als vertrauenswürdiges HTML: Texte werden
  ausschließlich über `textContent` gesetzt, Pfade werden vorher geprüft
  (keine absoluten URLs, kein `..`, kein `javascript:`/`data:`).
- Kein `eval()`, kein `Function()`-Konstruktor, keine dynamische
  Code-Ausführung aus Config-Werten.

## Nicht veröffentlichte Spiele

`test-claude/cursor-clicker/config.json` existiert bereits, steht aber
**absichtlich nicht** in `PUBLIC_GAME_CONFIGS` und erscheint dadurch nirgends
auf der öffentlichen Startseite. Cursor Clicker bleibt in der
Release-Vorbereitung; erst mit dem Eintrag in der Registry wäre er
veröffentlicht.

## Spätere Erweiterungen

Die Struktur ist so angelegt, dass dafür nichts umgebaut werden muss:

- **Weitere Metadaten** (`releasedAt`, `updatedAt`, `changelog`,
  `contributors`): Feld in `config/schema.js` zu `ALLOWED_FIELDS` und zur
  Prüfung hinzufügen, dann in `library-games.js` anzeigen. Unbekannte Felder
  werden bis dahin ignoriert und erzeugen nur eine Konsolen-Warnung, brechen
  also nichts.
- **Spiel-Uploads fremder Entwickler**: `validateGameConfig()` aus
  `config/schema.js` enthält kein DOM und lässt sich unverändert in einer
  automatischen Prüfung (z.B. im PR-Check) wiederverwenden. Ein hochgeladenes
  Spiel wäre ein Ordner `games/<id>/` mit eigener `config.json` — die
  Veröffentlichung bleibt der bewusste Registry-Eintrag.
