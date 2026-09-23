# Vorbereitet, nicht angewendet

## Was gerade wartet

- **`01_freigabe_bindet_an_vorschau.sql`** — bindet die Owner-Freigabe an die
  Vorschau, die der Owner tatsaechlich gesehen hat, und nimmt einen
  ueberfluessigen Grant auf `cc_ist_freigegeben` zurueck. Hintergrund im Kopf
  der Datei und in `SECURITY_CHECK.md` (Eintrag vom 22.09.).
- **`02_cursor-clicker-security.index.ts`** — dieselbe Umstellung in der Edge
  Function: die Freigabe schickt `vorschauHash` mit.

Der passende Frontend-Teil (`admin/admin.js` reicht den Hash durch) liegt
bereits auf dem Branch `freigabe-bindet-an-vorschau` und ist ohne die beiden
Dateien hier wirkungslos — er schickt dann ein Feld mit, das niemand liest.

Der Gate-Umbau vom 22.09. ist dagegen angewendet und steht dort, wo
Angewendetes hingehoert: `../migrations/20260922201829_...` und
`../functions/cursor-clicker-security/index.ts` (deployt als Version 7).

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
