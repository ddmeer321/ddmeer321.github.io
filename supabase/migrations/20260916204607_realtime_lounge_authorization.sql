-- Trading-Lounge: Presence und Chat ueber private Realtime-Kanaele.
--
-- ACHTUNG BEIM LESEN: Die Begruendung weiter unten zu cc_darf_in_diesen_trade
-- ("Der Mustervergleich steht VOR dem ::uuid") ist FALSCH und wurde von der
-- naechsten Migration korrigiert. Die Datei bleibt so stehen, wie sie
-- angewendet wurde - sie ist Verlauf, nicht Anleitung.
--
-- WARUM PRIVAT UND NICHT EINFACH OFFEN: Der Anon-Key steht im Quelltext
-- jeder Seite (assets/js/supabase-client.js) - das muss er auch. Ein
-- oeffentlicher Realtime-Kanal ist damit fuer jeden im Internet offen, der
-- den Quelltext liest. test-gate.js sperrt die SEITE, nicht den KANAL.
-- Ohne diese Policies koennte also jeder in der Lounge mitlesen und
-- mitschreiben, ohne die Seite je zu oeffnen.
--
-- Realtime prueft diese Policies einmal beim Verbinden: Es fragt
-- realtime.messages ab und macht die Abfrage danach rueckgaengig. Es wird
-- nichts gespeichert; die Tabelle dient nur als Ort fuer die Regeln.
--
-- ZUSAETZLICH NOETIG, und zwar im Dashboard: Unter Realtime -> Settings
-- muss "Allow public access" AUS sein. Sonst kann man denselben Topic
-- weiterhin als oeffentlichen Kanal betreten und die Regeln hier umgehen.

-- Der Lounge-Kanal: derselbe Personenkreis, der auch den Testbereich sehen
-- darf. Gesperrte Konten kommen nicht rein.
create or replace function public.cc_darf_in_die_lounge()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and banned = false
      and role in ('tester','admin','owner')
  );
$$;
revoke all on function public.cc_darf_in_die_lounge() from public, anon;
grant execute on function public.cc_darf_in_die_lounge() to authenticated;

-- Der Chat zu einem einzelnen Trade: nur die beiden Beteiligten.
-- Der Mustervergleich steht VOR dem ::uuid - ein Cast auf einen
-- unbrauchbaren Text wuerde sonst einen Fehler werfen und die ganze
-- Verbindung scheitern lassen.
create or replace function public.cc_darf_in_diesen_trade()
returns boolean language sql stable security definer set search_path='' as $$
  select realtime.topic() ~ '^cc-trade-[0-9a-f-]{36}$'
     and exists (
       select 1 from public.cc_trades t
       where t.id = substring(realtime.topic() from 10)::uuid
         and (select auth.uid()) in (t.initiator_id, t.recipient_id)
     );
$$;
revoke all on function public.cc_darf_in_diesen_trade() from public, anon;
grant execute on function public.cc_darf_in_diesen_trade() to authenticated;

-- Lesen heisst hier: Nachrichten und Anwesenheit der anderen empfangen.
create policy "cc_lounge_empfangen" on realtime.messages
for select to authenticated
using (
  realtime.messages.extension in ('broadcast','presence')
  and (
    (realtime.topic() = 'cc-lounge' and public.cc_darf_in_die_lounge())
    or public.cc_darf_in_diesen_trade()
  )
);

-- Schreiben heisst: selbst senden und die eigene Anwesenheit melden.
create policy "cc_lounge_senden" on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast','presence')
  and (
    (realtime.topic() = 'cc-lounge' and public.cc_darf_in_die_lounge())
    or public.cc_darf_in_diesen_trade()
  )
);
