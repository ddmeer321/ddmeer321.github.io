-- Trading: Senden entsperren, Verhandeln ohne Rueckfall auf Entwurf
--
-- BEFUND (24.09.2026, an cc_security_actions gemessen):
--   create_trade    23 angenommen
--   set_offer       30 angenommen
--   send_offer       4 angenommen /  37 gescheitert an both_sides_need_items
--   confirm_trade   16 angenommen /   9 gescheitert an trade_changed_or_expired
--   abgeschlossen    2
--
-- 23 Trades angefangen, 4 je abgeschickt, 2 fertig geworden. Der Abschluss
-- selbst war nie das Problem: Bei beiden fertigen Trades sind alle 24 Items
-- korrekt uebertragen und entsperrt worden. Es scheiterte davor.
--
-- ZWEI FUNKTIONEN ARBEITETEN GEGENEINANDER.
--
-- cc_send_trade_offer verlangte, dass BEIDE Seiten schon Items eingelegt
-- haben, bevor ueberhaupt gesendet werden darf. Vom Entwurf erfaehrt der
-- Empfaenger aber nur, wenn er zufaellig selbst die Lounge offen hat -- denn
-- "gesendet" passiert ja nie. Wer nicht gleichzeitig davorsitzt, kommt nie
-- weiter. Das sind die 37.
--
-- cc_set_trade_offer setzte bei JEDER Aenderung den Status zurueck auf
-- 'draft'. Ein bereits gesendetes Angebot fiel damit aus 'offered' heraus --
-- cc_confirm_trade verlangt aber 'offered'. Das sind die 9.
--
-- Dieselbe Form wie der Import-Stau: eine Sperre an einer Stelle, an der der
-- einzige Weg vorwaerts noch gar nicht erreichbar ist.

-- ---------------------------------------------------------------- 1. Senden
--
-- Nur noch der SENDER muss etwas anbieten. Ein Angebot zu senden heisst
-- gerade, dass die Gegenseite noch nicht geantwortet hat -- die Forderung
-- nach Items von beiden Seiten stand hier genau falsch herum. Die Regel ist
-- nicht weg, sie steht ab jetzt in cc_confirm_trade (Abschnitt 3).
create or replace function public.cc_send_trade_offer(p_user_id uuid, p_trade_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_trade public.cc_trades%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  if v_trade.status<>'draft' or v_trade.expires_at<=now() then raise exception 'trade_not_sendable' using errcode='55000'; end if;
  if not exists(select 1 from public.cc_trade_items where trade_id=p_trade_id and offered_by=p_user_id)
    then raise exception 'sender_needs_items' using errcode='23514'; end if;
  -- Die Frist laeuft ab jetzt neu: Sie soll Untaetigkeit messen, nicht das
  -- Alter des Trades. Sonst haette die Gegenseite nach dem Verhandeln nur
  -- noch den Rest der ersten 24 Stunden zum Antworten.
  update public.cc_trades set status='offered',revision=revision+1,
    initiator_confirmed_revision=null,recipient_confirmed_revision=null,
    expires_at=now()+interval '24 hours'
    where id=p_trade_id returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'offer_changed',jsonb_build_object('sent',true,'revision',v_trade.revision));
  return to_jsonb(v_trade);
end $function$;

-- ------------------------------------------------------------ 2. Verhandeln
--
-- Einzige Aenderung: Der Status BLEIBT stehen. Frueher fiel ein gesendetes
-- Angebot bei jeder Aenderung zurueck auf 'draft' und musste neu gesendet
-- werden.
--
-- Das Loeschen beider Bestaetigungen bleibt ausdruecklich drin: An ein Ja zu
-- einem anderen Angebot soll niemand gebunden sein. Das ist die
-- Sicherheitseigenschaft, nicht der Fehler.
create or replace function public.cc_set_trade_offer(p_user_id uuid, p_trade_id uuid, p_item_ids uuid[])
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_trade public.cc_trades%rowtype; v_expected integer; v_found integer;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  if v_trade.status not in ('draft','offered') or v_trade.expires_at<=now() then raise exception 'trade_not_editable' using errcode='55000'; end if;
  update public.cc_inventory_items set trade_lock_id=null where id in
    (select item_id from public.cc_trade_items where trade_id=p_trade_id and offered_by=p_user_id);
  delete from public.cc_trade_items where trade_id=p_trade_id and offered_by=p_user_id;
  v_expected:=coalesce(cardinality(p_item_ids),0);
  if v_expected>20 then raise exception 'too_many_items' using errcode='22023'; end if;
  if v_expected>0 then
    perform 1 from public.cc_inventory_items where id=any(p_item_ids) for update;
    select count(*) into v_found from public.cc_inventory_items where id=any(p_item_ids) and owner_id=p_user_id and trade_lock_id is null and item_type='cursor';
    if v_found<>v_expected then raise exception 'invalid_or_locked_item' using errcode='42501'; end if;
    insert into public.cc_trade_items(trade_id,item_id,offered_by,item_snapshot)
    select p_trade_id,i.id,p_user_id,jsonb_build_object('catalogId',i.catalog_id,'name',i.item_data->>'name','rarity',i.item_data->>'rarity','icon',i.item_data->>'icon')
      from public.cc_inventory_items i where i.id=any(p_item_ids);
    update public.cc_inventory_items set trade_lock_id=p_trade_id where id=any(p_item_ids);
  end if;
  update public.cc_trades set revision=revision+1,
    initiator_confirmed_revision=null,recipient_confirmed_revision=null,
    expires_at=now()+interval '24 hours'
    where id=p_trade_id returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'offer_changed',jsonb_build_object('count',v_expected,'revision',v_trade.revision));
  return to_jsonb(v_trade);
end $function$;

-- ------------------------------------------------------------ 3. Bestaetigen
--
-- Hierher gehoert die Regel "keine einseitigen Trades": an die Stelle, an der
-- tatsaechlich etwas den Besitzer wechselt. Der deutsche Text dazu in der
-- Edge Function ("Beide Spieler muessen mindestens einen Cursor anbieten")
-- stimmt erst hier -- beim Senden war er schlicht falsch.
--
-- Sonst unveraendert.
create or replace function public.cc_confirm_trade(p_user_id uuid, p_trade_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_trade public.cc_trades%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  -- war '40001': serialization_failure wird von Clients automatisch wiederholt,
  -- und ein abgelaufener Trade wird nie wieder gueltig -> Endlosschleife.
  if v_trade.status<>'offered' or v_trade.revision<>p_revision or v_trade.expires_at<=now() then raise exception 'trade_changed_or_expired' using errcode='P0001'; end if;
  if not exists(select 1 from public.cc_trade_items where trade_id=p_trade_id and offered_by=v_trade.initiator_id)
     or not exists(select 1 from public.cc_trade_items where trade_id=p_trade_id and offered_by=v_trade.recipient_id)
     then raise exception 'both_sides_need_items' using errcode='23514'; end if;
  if p_user_id=v_trade.initiator_id then update public.cc_trades set initiator_confirmed_revision=p_revision where id=p_trade_id;
  else update public.cc_trades set recipient_confirmed_revision=p_revision where id=p_trade_id; end if;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'confirmed',jsonb_build_object('revision',p_revision));
  select * into v_trade from public.cc_trades where id=p_trade_id;
  if v_trade.initiator_confirmed_revision=p_revision and v_trade.recipient_confirmed_revision=p_revision then
    -- war '40001', gleicher Grund
    if exists(select 1 from public.cc_trade_items ti left join public.cc_inventory_items i on i.id=ti.item_id
      where ti.trade_id=p_trade_id and (i.id is null or i.owner_id<>ti.offered_by or i.trade_lock_id<>p_trade_id))
      then raise exception 'locked_inventory_changed' using errcode='P0001'; end if;
    update public.cc_inventory_items i set owner_id=case when ti.offered_by=v_trade.initiator_id then v_trade.recipient_id else v_trade.initiator_id end,
      trade_lock_id=null,source='trade',source_ref=p_trade_id,version=version+1
      from public.cc_trade_items ti where ti.trade_id=p_trade_id and i.id=ti.item_id;
    update public.cc_accounts set revision=revision+1,last_action_at=now() where user_id in (v_trade.initiator_id,v_trade.recipient_id);
    update public.cc_trades set status='completed',completed_at=now() where id=p_trade_id returning * into v_trade;
    insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'completed',jsonb_build_object('revision',p_revision));
  end if;
  return to_jsonb(v_trade);
end $function$;

-- ------------------------------------------------------------- 4. Aufraeumen
--
-- EINMALIG, keine Regelaenderung. Am 24.09. sind ALLE 16 offenen Trades
-- bereits abgelaufen -- keiner davon kann je weiterlaufen, auch nach dieser
-- Migration nicht. In vieren haengen zusammen 11 Items in Sperre und stehen
-- ihren Besitzern nicht zur Verfuegung (9 bei Florian, je 1 bei ddmeer321 und
-- biti_trading).
--
-- Reihenfolge: erst entsperren, dann protokollieren, dann den Status setzen
-- -- die Bedingung 'draft','offered' muss fuer alle drei noch greifen.
-- 'expired' ist in beiden CHECK-Constraints bereits erlaubt, actor_id darf
-- leer bleiben (Systemaktion, kein Nutzer).
update public.cc_inventory_items set trade_lock_id=null
where trade_lock_id in (
  select id from public.cc_trades where status in ('draft','offered') and expires_at<=now()
);

insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data)
select id,null,'expired',jsonb_build_object('quelle','migration 20260924180000')
from public.cc_trades where status in ('draft','offered') and expires_at<=now();

update public.cc_trades set status='expired'
where status in ('draft','offered') and expires_at<=now();
