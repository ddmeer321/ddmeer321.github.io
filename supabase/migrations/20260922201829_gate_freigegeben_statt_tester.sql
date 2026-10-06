-- GATE: "vom Owner freigegeben" statt "hat den Tester-Rang".
--
-- Der Tester-Rang oeffnet den ganzen Testbereich. Wer nur handeln koennen
-- soll, braucht das nicht. Die Freigabe des Imports gibt es ohnehin schon -
-- sie wird jetzt zum Eintritt.

-- Eine eigene Spalte, nicht migration_state: Letzteres wird auch von
-- cc_prepare_trading gesetzt, also von einer Funktion, die jeder Angemeldete
-- aufrufen darf. Als Tuer waere das wertlos. Diese Spalte setzt genau EINE
-- Funktion, und die verlangt den Owner.
alter table public.cc_accounts
  add column if not exists trading_freigegeben boolean not null default false,
  add column if not exists freigegeben_von uuid references public.profiles(id),
  add column if not exists freigegeben_am timestamptz;

-- Wer heute schon Items hat, ist offensichtlich frueher freigegeben worden -
-- sonst haette er keine. Diese Konten bleiben drin, statt sie auszusperren.
update public.cc_accounts a set trading_freigegeben = true, freigegeben_am = coalesce(freigegeben_am, now())
where exists (select 1 from public.cc_inventory_items i where i.owner_id = a.user_id);

create or replace function public.cc_ist_freigegeben(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.cc_accounts a
    join public.profiles p on p.id = a.user_id
    where a.user_id = p_user_id and a.trading_freigegeben and p.banned = false
  ) or exists (
    -- Owner und Admin kommen immer durch, sonst kann niemand mehr pruefen.
    select 1 from public.profiles p
    where p.id = p_user_id and p.banned = false and p.role in ('admin','owner')
  );
$$;
revoke all on function public.cc_ist_freigegeben(uuid) from public, anon;
grant execute on function public.cc_ist_freigegeben(uuid) to authenticated, service_role;

-- Die Freigabe passiert genau hier und sonst nirgends.
create or replace function public.cc_owner_review_migration(p_owner_id uuid,p_user_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text; v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode='22023'; end if;
  update public.cc_migration_requests set status=p_decision,reviewed_by=p_owner_id,reviewed_at=now(),
         review_note=left(coalesce(p_note,''),500)
   where user_id=p_user_id and status='pending' returning status into v_status;
  if v_status is null then raise exception 'pending_request_not_found' using errcode='P0002'; end if;

  if p_decision='approved' then
    insert into public.cc_accounts(user_id,migration_state,migrated_at,trading_freigegeben,freigegeben_von,freigegeben_am)
    values(p_user_id,'active',now(),true,p_owner_id,now())
    on conflict(user_id) do update set trading_freigegeben=true, freigegeben_von=p_owner_id, freigegeben_am=now();
    v_result:=public.cc_bootstrap_trading(p_user_id);
    return jsonb_build_object('status','active','importedItems',v_result->'importedItems');
  end if;
  return jsonb_build_object('status',v_status);
end $$;
revoke all on function public.cc_owner_review_migration(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cc_owner_review_migration(uuid,uuid,text,text) to service_role;

-- Lounge-Kanal: Freigabe statt Rolle.
create or replace function public.cc_darf_in_die_lounge()
returns boolean language sql stable security definer set search_path='' as $$
  select public.cc_ist_freigegeben((select auth.uid()));
$$;
revoke all on function public.cc_darf_in_die_lounge() from public, anon;
grant execute on function public.cc_darf_in_die_lounge() to authenticated;

-- Handeln darf, wer freigegeben ist. Das ersetzt die Rollenpruefung UND die
-- Selbst-Aktivierung, die vorher jedes Ziel ungefragt auf "active" setzte.
create or replace function public.cc_create_trade(p_user_id uuid,p_target_id uuid,p_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype; v_me public.profiles%rowtype; v_them public.profiles%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id); perform public.cc_assert_active_user(p_target_id);
  if p_user_id=p_target_id then raise exception 'cannot_trade_with_self' using errcode='22023'; end if;
  if not public.cc_ist_freigegeben(p_user_id) then raise exception 'trading_not_active' using errcode='42501'; end if;
  if not public.cc_ist_freigegeben(p_target_id) then raise exception 'target_not_active' using errcode='42501'; end if;

  select * into v_me from public.profiles where id=p_user_id;
  select * into v_them from public.profiles where id=p_target_id;

  select * into v_trade from public.cc_trades where initiator_id=p_user_id and client_action_id=p_action_id;
  if v_trade.id is not null then return to_jsonb(v_trade); end if;
  insert into public.cc_trades(initiator_id,recipient_id,initiator_username,initiator_player_id,recipient_username,recipient_player_id,client_action_id)
  values(p_user_id,p_target_id,v_me.username,v_me.player_id,v_them.username,v_them.player_id,p_action_id) returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type) values(v_trade.id,p_user_id,'created');
  return to_jsonb(v_trade);
end $$;
revoke all on function public.cc_create_trade(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cc_create_trade(uuid,uuid,uuid) to service_role;

-- Gefunden wird, wer freigegeben ist. Wer nicht handeln kann, soll auch nicht
-- als Handelspartner auftauchen - sonst laeuft man in eine Fehlermeldung.
create or replace function public.cc_search_players(p_user_id uuid,p_query text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_q text:=lower(trim(coalesce(p_query,''))); v_rows jsonb;
begin
  perform public.cc_assert_active_user(p_user_id);
  if length(v_q)<3 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows from (
    select p.id,p.username,p.player_id from public.profiles p
    where p.id<>p_user_id and p.banned=false and public.cc_ist_freigegeben(p.id)
      and (lower(p.username) like '%'||v_q||'%' or lower(p.player_id) like '%'||v_q||'%')
    order by case when lower(p.player_id)=v_q then 0 when lower(p.username)=v_q then 1 else 2 end,p.username limit 10
  ) x;
  return v_rows;
end $$;
revoke all on function public.cc_search_players(uuid,text) from public,anon,authenticated;
grant execute on function public.cc_search_players(uuid,text) to service_role;
