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
| `config/features.js` | Bedeutung von `features` (Anzeigetext + Reihenfolge) |
| `assets/js/library-games.js` | **Wie** daraus eine Spielkarte wird (DOM) |
| `assets/css/library.css` | Aussehen der Badges (`.status-*`) |

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
| `features` | Liste der Fähigkeiten **und Hinweise** aus `config/features.js` (`multiplayer`, `leaderboard`, `pc`, `tablet`, `mobile`, `offline`, `mobile-wip`), z.B. `["multiplayer", "pc", "mobile-wip"]`. Erscheint als kleine Chips im Textteil der Karte (siehe unten). |
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

## Mini-Status / Fähigkeiten (`features`)

`type`, `status` und `features` beantworten drei verschiedene Fragen und
werden deshalb getrennt gehalten:

| Feld | Frage | Anzahl | Wo auf der Karte |
|---|---|---|---|
| `type` | Was für ein Spiel ist es? | genau eins | links im Bild |
| `status` | In welchem Zustand ist es? | genau einer, oft befristet | rechts im Bild |
| `features` | Was kann es? | mehrere, dauerhaft | im Textteil, unter der Beschreibung |

```json
"features": ["multiplayer", "leaderboard", "pc", "tablet", "mobile-wip"]
```

### Zwei Sorten von Chips

| Sorte | Sagt | Beispiel | Farbe |
|---|---|---|---|
| **Fähigkeit** (Vorgabe) | was das Spiel kann | „Multiplayer", „PC", „Tablet" | wählbarer Farbton |
| **Hinweis** (`kind: "caveat"`) | wo es (noch) hakt | „Am Handy unfertig" | immer rot |

Hinweise ersparen dem Besucher die Enttäuschung, ein Spiel auf einem Gerät zu
öffnen, auf dem es (noch) nicht rund läuft. Neon Bot Arena ist ausdrücklich
auch fürs Handy gebaut — es hat Touch-Steuerung samt Geräteauswahl —, das
Layout dort ist nur noch nicht fertig. Genau das sagt der Hinweis, ohne dass
die Beschreibung länger werden muss.

Deshalb heißt der Chip „Am Handy unfertig" und nicht „Nicht fürs Handy": das
eine ist ein Zwischenstand, das andere wäre eine Absichtserklärung. Was am
Handy konkret klemmt, steht in `ROADMAP.md` der Kontext-Wissensbasis.

### Regeln

- **Die Reihenfolge auf der Karte kommt aus `config/features.js`**, nicht aus
  der `config.json`. Dadurch stehen gleiche Chips auf allen Karten an
  derselben Stelle, egal wie ein Spiel sie einträgt. Hinweise stehen dabei
  immer **hinter** den Fähigkeiten, auch wenn sie in der `config.json` vorne
  eingetragen sind.
- **Höchstens 4 Fähigkeiten und 2 Hinweise je Karte** — getrennt gezählt.
  Bei einer gemeinsamen Obergrenze könnte ein Spiel mit vielen Fähigkeiten
  seinen Hinweis verlieren, und der ist die wichtigere der beiden Angaben.
  Überzähliges wird abgeschnitten und in der Konsole gemeldet.
- **Rot ist reserviert.** Nur Hinweise sind rot, und sie können ihren Ton
  nicht selbst wählen — er kommt aus `CAVEAT_TINT`. Eine Fähigkeit kann Rot
  gar nicht erst auswählen (`FEATURE_TINTS` enthält es nicht). Dadurch heißt
  Rot auf der ganzen Seite dasselbe: „aufpassen", nie bloß „bunt".
- **Der Text eines Hinweises muss die Einschränkung selbst benennen**
  („Am Handy unfertig", nicht bloß „Handy"). Die Farbe darf die Aussage nicht
  allein tragen — sonst geht sie verloren, sobald jemand Farben schlecht
  unterscheidet oder die Karte schwarzweiß gedruckt wird.
- **Die Farbe der Fähigkeiten kommt aus einem festen kleinen Vorrat**
  (`purple`, `amber`, `teal`, `neutral`) — nicht aus einer Farbe je
  Fähigkeit. Dadurch braucht eine neue Fähigkeit kein neues CSS, und die
  Karten bleiben ruhig, auch wenn irgendwann zehn Fähigkeiten existieren.
- **Chips sind nur eingefärbt, Status-Badges sind Vollflächen.** Ein Status
  ist eine Meldung und darf auffallen, eine Fähigkeit ist eine
  Sacheigenschaft und soll die Karte nicht dominieren.
- Unbekannte, doppelte oder leere Einträge kosten nur den einen Chip, nie das
  ganze Spiel — sie werden ignoriert und in der Konsole gemeldet.

Die Chips sind dafür gedacht, die Kurzbeschreibung zu **ergänzen oder zu
ersetzen**. Ein Spiel darf also auch nur `features` und keine `description`
haben.

### Neue Fähigkeit oder neuen Hinweis hinzufügen

In `config/features.js` einen Eintrag ergänzen — an der Stelle, an der der Chip
auf der Karte erscheinen soll:

```js
controller: { label: "Gamepad", tint: "purple" },          // Fähigkeit
"touch-wip": { label: "Touch unfertig", kind: "caveat" },  // Hinweis
```

Ein Hinweis bekommt **keinen** `tint` — sein Ton ist fest. Danach ist
`"features": ["controller"]` in jeder `config.json` gültig. **CSS ist nicht
nötig.** Ein Tippfehler im Farbton fällt auf `neutral` zurück, der Chip bleibt
also lesbar.

Ein wirklich neuer Farbton wäre der Ausnahmefall und braucht eine
`.tint-<name>`-Regel in `assets/css/library.css` mit den drei Werten
`--feature-bg`, `--feature-line` und `--feature-ink` — plus einen Eintrag in
`FEATURE_TINTS`. Vorher lohnt die Frage, ob nicht ein bestehender Ton passt:
je mehr Töne es gibt, desto unruhiger werden die Karten. Rot kommt dafür nicht
in Frage, das gehört den Hinweisen.

Aktuelle Zuordnung: `multiplayer` → purple, `leaderboard` → amber,
`pc`/`tablet`/`mobile` → teal (alle Geräte derselbe Ton, sie gehören
zusammen), `offline` → neutral, alle Hinweise → rose.

### Was aktuell wo steht

| Spiel | Chips | Grundlage |
|---|---|---|
| Neon Bot Arena | `multiplayer`, `leaderboard`, `pc`, `tablet`, `mobile-wip` | Koop mit Lobby-Codes, `online-leaderboard.js`, Tastatur/Maus, Touch-Steuerung mit Stick/Feuer/Spezial. Der Hinweis stammt aus zwei im Testlauf gefundenen Fehlern (siehe `ROADMAP.md`), nicht aus einer Designentscheidung. |
| Snake | `pc`, `mobile` | Pfeiltasten (`keydown`) und `touchstart` auf dem Spielfeld; Highscore nur lokal, deshalb keine `leaderboard` |

`offline` ist in `config/features.js` definiert, aber **bei keinem Spiel
gesetzt**: die Seite hat keinen Service Worker, ohne Netz lässt sich also nicht
einmal die Seite laden. Der Chip wäre eine falsche Zusage. Sobald es echte
Offline-Unterstützung gibt, reicht der Eintrag in der `config.json`.

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

2. In `assets/css/library.css` die passende Farbe ergänzen:

```css
.status-soon { background: var(--pink); color: #fff; }
```

## Robustheit und Sicherheit

- Ein fehlendes oder fehlerhaftes `config.json` betrifft immer nur **ein**
  Spiel — die restlichen Karten und die Seite laden normal weiter.
- Unbekannter `status` → das Spiel wird angezeigt, nur ohne Badge.
- Unbekannte Fähigkeit in `features` → nur dieser eine Chip entfällt.
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
  Prüfung hinzufügen, dann in `assets/js/library-games.js` anzeigen. Unbekannte Felder
  werden bis dahin ignoriert und erzeugen nur eine Konsolen-Warnung, brechen
  also nichts.
- **Spiel-Uploads fremder Entwickler**: `validateGameConfig()` aus
  `config/schema.js` enthält kein DOM und lässt sich unverändert in einer
  automatischen Prüfung (z.B. im PR-Check) wiederverwenden. Ein hochgeladenes
  Spiel wäre ein Ordner `games/<id>/` mit eigener `config.json` — die
  Veröffentlichung bleibt der bewusste Registry-Eintrag.
