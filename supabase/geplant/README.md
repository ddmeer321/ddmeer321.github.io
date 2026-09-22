# Vorbereitet, nicht angewendet

**Aktuell liegt hier nichts.** Der Gate-Umbau vom 22.09. ist angewendet und
steht jetzt dort, wo Angewendetes hingehoert:

- `../migrations/20260922201829_gate_freigegeben_statt_tester.sql`
- `../functions/cursor-clicker-security/index.ts` (deployt als Version 7)

Der Ordner bleibt bestehen, weil der naechste Eingriff an Datenbank oder Edge
Function wieder einen Ort zum Hinlegen braucht.

## Wozu dieser Ordner
Was hier liegt, ist **nicht** auf der Datenbank und **nicht** deployt. Der
Ordner heißt bewusst nicht `migrations/` — alles dort gilt als angewendet,
und ein gemischter Ordner wäre genau die Verwechslung, die am 16.09. schon
einmal Ärger gemacht hat.

Grund für die Trennung: Datenbank und Edge Functions lassen sich nicht auf
einen Branch legen. Sie wirken sofort für alle. Code kann man zum
Anschauen hinlegen, diese beiden nicht — deshalb liegen sie hier und
warten auf eine Entscheidung.

## Reihenfolge beim Anwenden

1. SQL anwenden
2. Edge Function deployen
3. Erst dann die öffentliche Seite verlinken

Zwischen 1 und 2 ist das System kurz strenger als nötig: die SQL gilt schon,
die Function prüft noch die alte Regel. Das sperrt niemanden aus, der nicht
ohnehin schon draußen wäre — andersherum wäre es eine offene Tür.
