-- Fachliche Trade-Fehler duerfen nicht mehr als Serialisierungskonflikt
-- gemeldet werden.
--
-- WAS PASSIERT IST
--
-- Ein Trade vom 16.09. lief am 17.09. ab. Danach hat ein Aufrufer vier Tage
-- lang mit rund 2000 Anfragen pro Sekunde versucht, ihn zu bestaetigen --
-- rund 690 Millionen Aufrufe, 99 Prozent der gesamten Datenbank-CPU.
--
-- Der Grund steckte in einer einzigen Zeichenkette: '40001'. Das ist in
-- Postgres serialization_failure, also das genormte Signal "war nur ein
-- voruebergehender Konflikt, versuch es sofort nochmal". Client-Bibliotheken
-- und Verbindungsschichten werten das aus und wiederholen automatisch.
--
-- Nur ist "abgelaufen" nicht voruebergehend. Die Antwort sagte "gleich
-- klappt's", die Bedingung sagte "nie". Daraus wird eine Endlosschleife.
--
-- Betroffen waren drei Stellen, alle nach demselben Muster:
--   cc_confirm_trade    trade_changed_or_expired   (Trade abgelaufen/veraendert)
--   cc_confirm_trade    locked_inventory_changed   (gesperrtes Item weg)
--   cc_bootstrap_trading save_changed_after_review (Spielstand nach Pruefung geaendert)
--
-- Keine davon wird durch Wiederholen besser: der Zustand aendert sich nur,
-- wenn ein Mensch etwas tut. Sie bekommen deshalb P0001 (raise_exception) --
-- einen ganz normalen Fehler, den niemand automatisch wiederholt.
--
-- 40001 bleibt ausschliesslich fuer echte Serialisierungskonflikte, die
-- Postgres selbst erzeugt. Die Funktionen sind sonst unveraendert; die
-- Fehlermeldungen als Text bleiben gleich, und der Client unterscheidet
-- ohnehin daran und nicht am Code.

create or replace function public.cc_confirm_trade(p_user_id uuid, p_trade_id uuid, p_revision integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_trade public.cc_trades%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  -- war '40001' -- siehe Kopf dieser Datei
  if v_trade.status<>'offered' or v_trade.revision<>p_revision or v_trade.expires_at<=now() then raise exception 'trade_changed_or_expired' using errcode='P0001'; end if;
  if p_user_id=v_trade.initiator_id then update public.cc_trades set initiator_confirmed_revision=p_revision where id=p_trade_id;
  else update public.cc_trades set recipient_confirmed_revision=p_revision where id=p_trade_id; end if;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'confirmed',jsonb_build_object('revision',p_revision));
  select * into v_trade from public.cc_trades where id=p_trade_id;
  if v_trade.initiator_confirmed_revision=p_revision and v_trade.recipient_confirmed_revision=p_revision then
    -- war '40001' -- siehe Kopf dieser Datei
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

create or replace function public.cc_bootstrap_trading(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_save jsonb; v_hash text; v_request public.cc_migration_requests%rowtype;
  v_account_state text; v_row record; v_copy integer; v_total integer:=0;
begin
  perform public.cc_assert_active_user(p_user_id);
  select migration_state into v_account_state from public.cc_accounts where user_id=p_user_id for update;
  select * into v_request from public.cc_migration_requests where user_id=p_user_id for update;

  if v_account_state='active' and (v_request.user_id is null or v_request.status='imported') then
    return jsonb_build_object('status','active','importedItems',
      (select count(*) from public.cc_inventory_items where owner_id=p_user_id));
  end if;
  if v_request.status is distinct from 'approved' then
    raise exception 'owner_approval_required' using errcode='42501';
  end if;

  select save_data into v_save from public.game_saves
    where user_id=p_user_id and game_id='cursor-clicker' for update;
  if v_save is null then raise exception 'cursor_save_missing' using errcode='P0002'; end if;
  v_hash:=md5(v_save::text);
  -- war '40001' -- siehe Kopf dieser Datei
  if v_hash<>v_request.legacy_save_hash then raise exception 'save_changed_after_review' using errcode='P0001'; end if;
  if cardinality(v_request.risk_flags)>0 then raise exception 'review_contains_risk_flags' using errcode='42501'; end if;

  insert into public.cc_accounts(user_id,coins,total_coins_earned,total_clicks,migration_state,migrated_at)
  values(p_user_id,0,0,0,'active',now())
  on conflict(user_id) do update set migration_state='active',migrated_at=now();

  for v_row in select * from public.cc_import_vorschau(v_save) loop
    for v_copy in 1..v_row.stueck loop
      insert into public.cc_inventory_items(owner_id,item_type,catalog_id,item_data,source)
      values(p_user_id,'cursor',v_row.catalog_id,
        jsonb_build_object('name',v_row.name,'rarity',v_row.rarity,'icon',v_row.icon),'legacy');
      v_total:=v_total+1;
    end loop;
  end loop;

  update public.cc_migration_requests set status='imported',reviewed_at=coalesce(reviewed_at,now()) where user_id=p_user_id;
  return jsonb_build_object('status','active','importedItems',v_total);
end $function$;
