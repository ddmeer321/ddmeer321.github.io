# Deployte Edge Functions

Was hier liegt, ist **auf dem Server aktiv**. Der Ordner ist das Gegenstück
zu `supabase/geplant/`: dort liegt, was noch auf eine Entscheidung wartet,
hier liegt der laufende Stand.

Angelegt wurde er, weil die laufende Function vorher in keinem Repo stand.
Sie existierte nur auf Supabase — bei einem Neuaufbau wäre sie weg gewesen,
und niemand hätte nachlesen können, was tatsächlich läuft.

## `cursor-clicker-security`

Der einzige Weg, auf dem das Frontend Trading-Aktionen auslöst. Prüft
Anmeldung, Sperre, Rang, Wiederholungen (clientActionId) und die Rate, und
ruft dann die SQL-Funktionen mit dem Service-Key.

Drei Aktionen brauchen **keinen Rang**, weil sie der Eingang sind:
`status`, `prepare_trading`, `request_legacy_migration`. Ohne diese Ausnahme
kann niemand je einen Import beantragen und deshalb auch nie freigegeben
werden.

## Abgleich

Ob der Stand hier dem auf dem Server entspricht, lässt sich nur durch
Nachsehen prüfen — es gibt keine Automatik dafür. Wer die Function per
Dashboard oder MCP ändert, ändert bitte auch diese Datei.
