-- Der Cast auf uuid war die Falle: Postgres wertet ihn beim Planen der
-- Funktion aus, NICHT erst nachdem der Mustervergleich davor true ergeben
-- hat. Ein Kanalname wie "cc-trade-unsinn" - oder auch nur der Lounge-Topic
-- selbst - liess damit die ganze Verbindung scheitern:
--   invalid input syntax for type uuid: ""
-- Nachgemessen am 16.09.2026; die Begruendung in der vorigen Migration war
-- falsch. Aufgefallen ist es nur, weil die Policy-Logik ueberhaupt
-- durchgespielt wurde - im Browser waere es als "Lounge geht nicht"
-- aufgetaucht, ohne erkennbaren Grund.
--
-- Loesung: gar nicht casten. Die uuid der Spalte wird zu Text gemacht - das
-- geht immer - und mit dem Kanalnamen verglichen. Ein unbrauchbarer Name
-- passt dann einfach auf keine Zeile, statt einen Fehler zu werfen.
create or replace function public.cc_darf_in_diesen_trade()
returns boolean language sql stable security definer set search_path='' as $$
  select realtime.topic() like 'cc-trade-%'
     and exists (
       select 1 from public.cc_trades t
       where t.id::text = substring(realtime.topic() from 10)
         and (select auth.uid()) in (t.initiator_id, t.recipient_id)
     );
$$;
revoke all on function public.cc_darf_in_diesen_trade() from public, anon;
grant execute on function public.cc_darf_in_diesen_trade() to authenticated;
