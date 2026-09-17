# Vorbereitet, nicht angewendet

Was hier liegt, ist **nicht** auf der Datenbank und **nicht** deployt. Der
Ordner heißt bewusst nicht `migrations/` — alles dort gilt als angewendet,
und ein gemischter Ordner wäre genau die Verwechslung, die am 16.09. schon
einmal Ärger gemacht hat.

Grund für die Trennung: Datenbank und Edge Functions lassen sich nicht auf
einen Branch legen. Sie wirken sofort für alle. Code kann man zum
Anschauen hinlegen, diese beiden nicht — deshalb liegen sie hier und
warten auf eine Entscheidung.

## `01_gate_freigegeben_statt_tester.sql`

Stellt den Zugang zum Trading um: **nicht mehr „hat den Tester-Rang", sondern
„der Owner hat dieses Konto freigegeben".**

Warum: Der Tester-Rang öffnet den kompletten Testbereich — Camera Arcade,
halbfertige Spiele, alle Testkopien. Nur damit jemand tauschen darf, ist das
zu viel. Die Freigabe des Imports gibt es ohnehin schon; sie wird jetzt zum
Eintritt.

Die Freigabe hängt an einer eigenen Spalte `cc_accounts.trading_freigegeben`,
die **ausschließlich** `cc_owner_review_migration` setzt. Kein Weg führt
daran vorbei — insbesondere kann sich niemand selbst freischalten, indem er
eine Funktion aufruft.

## `02_cursor-clicker-security.index.ts`

Dieselbe Umstellung in der Edge Function. Zwei Aktionen bleiben für **alle
Angemeldeten** offen, sonst käme nie jemand herein:

- `status` — wo stehe ich?
- `request_legacy_migration` und `prepare_trading` — Antrag stellen

Alles andere (Lounge, Suche, Trades) verlangt die Freigabe. Owner und Admin
kommen immer durch, sonst kann niemand mehr testen.

## Reihenfolge beim Anwenden

1. SQL anwenden
2. Edge Function deployen
3. Erst dann die öffentliche Seite verlinken

Zwischen 1 und 2 ist das System kurz strenger als nötig (die Function prüft
noch auf Rollen, die SQL schon auf Freigabe) — das sperrt niemanden aus, der
nicht ohnehin schon draußen wäre.
