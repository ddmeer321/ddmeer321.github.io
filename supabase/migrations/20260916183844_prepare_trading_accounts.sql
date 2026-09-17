-- NACHGETRAGEN am 17.09.2026. Diese Migration wurde am 16.09. um 18:38 auf
-- die Datenbank angewendet, aber nie eingecheckt. Dadurch beschrieb das Repo
-- tagelang einen anderen Stand als den laufenden - wer cc_create_trade im
-- Repo las, sah eine Pruefung, die live nicht mehr existierte.
--
-- Der Inhalt ist unveraendert aus supabase_migrations.schema_migrations
-- zurueckgeholt. TEILE DAVON SIND INZWISCHEN ERSETZT:
--   cc_bootstrap_trading  -> import_vorschau_als_einzige_quelle
--   cc_prepare_trading    -> keine_automatische_import_freigabe_mehr
-- Die Datei bleibt trotzdem stehen: Migrationen sind Verlauf, kein
-- Nachschlagewerk.

-- Let every authenticated, active profile use its existing player_id as a
-- public Trading-ID. The server account starts empty; untrusted browser saves
-- still go through the existing migration review before tradable items exist.

create or replace function public.cc_bootstrap_trading(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
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
  if v_hash<>v_request.legacy_save_hash then raise exception 'save_changed_after_review' using errcode='40001'; end if;
  if cardinality(v_request.risk_flags)>0 then raise exception 'review_contains_risk_flags' using errcode='42501'; end if;

  insert into public.cc_accounts(user_id,coins,total_coins_earned,total_clicks,migration_state,migrated_at)
  values(p_user_id,0,0,0,'active',now())
  on conflict(user_id) do update set migration_state='active',migrated_at=now();

  for v_row in
    select e.key as catalog_id,greatest(0,least(500,coalesce((e.value->>'count')::integer,0)-1)) as copies,
           c.name,c.rarity,c.icon
    from jsonb_each(coalesce(v_save->'ownedCursors','{}'::jsonb)) e
    join public.cc_item_catalog c on c.catalog_id=e.key and c.tradable
  loop
    for v_copy in 1..v_row.copies loop
      insert into public.cc_inventory_items(owner_id,item_type,catalog_id,item_data,source)
      values(p_user_id,'cursor',v_row.catalog_id,
        jsonb_build_object('name',v_row.name,'rarity',v_row.rarity,'icon',v_row.icon),'legacy');
      v_total:=v_total+1;
    end loop;
  end loop;
  update public.cc_migration_requests set status='imported',reviewed_at=coalesce(reviewed_at,now()) where user_id=p_user_id;
  return jsonb_build_object('status','active','importedItems',v_total);
end $$;

create or replace function public.cc_prepare_trading(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_player_id text; v_request jsonb; v_summary jsonb; v_flags jsonb; v_import jsonb;
begin
  perform public.cc_assert_active_user(p_user_id);
  select player_id into v_player_id from public.profiles where id=p_user_id;

  -- Trading access is independent from a legacy import. This lets a new or
  -- not-yet-migrated account receive trades without trusting localStorage.
  insert into public.cc_accounts(user_id,migration_state,migrated_at)
  values(p_user_id,'active',now())
  on conflict(user_id) do update set migration_state='active';

  begin
    v_request:=public.cc_request_legacy_migration(p_user_id);
  exception when sqlstate 'P0002' then
    v_request:=null;
  end;

  -- ACHTUNG: Diese Begruendung ist FALSCH und war die Sicherheitsluecke.
  -- "cursorCopies <= cursorTypes" vergleicht Summen; gepraegt wird pro Typ.
  -- A save with no duplicate cursor cannot mint a tradable item. It is safe to
  -- finish that empty import automatically; every non-empty legacy import stays
  -- in the owner queue.
  if v_request is not null and v_request->>'status'='pending' then
    v_summary:=v_request->'summary';
    v_flags:=coalesce(v_request->'riskFlags','[]'::jsonb);
    if jsonb_array_length(v_flags)=0
       and coalesce((v_summary->>'cursorCopies')::numeric,0)
           <= coalesce((v_summary->>'cursorTypes')::numeric,0) then
      update public.cc_migration_requests
        set status='approved',reviewed_at=now(),review_note='Automatisch: keine handelbaren Duplikate'
        where user_id=p_user_id and status='pending';
      v_import:=public.cc_bootstrap_trading(p_user_id);
    end if;
  end if;

  return jsonb_build_object(
    'status','active','tradingId',v_player_id,
    'importStatus',coalesce(v_import->>'status',v_request->>'status','not_requested'),
    'importNeedsOwner',coalesce(v_request->>'status'='pending',false)
  );
end $$;

create or replace function public.cc_security_status(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account public.cc_accounts%rowtype; v_request public.cc_migration_requests%rowtype; v_player_id text;
begin
 select * into v_account from public.cc_accounts where user_id=p_user_id;
 select * into v_request from public.cc_migration_requests where user_id=p_user_id;
 select player_id into v_player_id from public.profiles where id=p_user_id;
 return jsonb_build_object('phase','trading-test','economyEnabled',false,
  'tradingEnabled',v_account.migration_state='active','tradingId',v_player_id,
  'hasServerAccount',v_account.user_id is not null,
  'migration',case when v_request.user_id is null then null else jsonb_build_object(
   'status',v_request.status,'riskFlags',to_jsonb(v_request.risk_flags),'summary',v_request.summary,
   'requestedAt',v_request.requested_at,'reviewedAt',v_request.reviewed_at) end);
end $$;

create or replace function public.cc_search_players(p_user_id uuid,p_query text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_q text:=lower(trim(coalesce(p_query,''))); v_rows jsonb;
begin
  perform public.cc_assert_active_user(p_user_id);
  if length(v_q)<3 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows from (
    select p.id,p.username,p.player_id from public.profiles p
    where p.id<>p_user_id and p.banned=false and p.role in ('tester','admin','owner')
      and (lower(p.username) like '%'||v_q||'%' or lower(p.player_id) like '%'||v_q||'%')
    order by case when lower(p.player_id)=v_q then 0 when lower(p.username)=v_q then 1 else 2 end,p.username limit 10
  ) x;
  return v_rows;
end $$;

create or replace function public.cc_create_trade(p_user_id uuid,p_target_id uuid,p_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype; v_me public.profiles%rowtype; v_them public.profiles%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id); perform public.cc_assert_active_user(p_target_id);
  if p_user_id=p_target_id then raise exception 'cannot_trade_with_self' using errcode='22023'; end if;
  select * into v_me from public.profiles where id=p_user_id;
  select * into v_them from public.profiles where id=p_target_id;
  if v_me.role not in ('tester','admin','owner') or v_them.role not in ('tester','admin','owner') then
    raise exception 'test_access_required' using errcode='42501';
  end if;

  -- A target does not need to be online or to have imported a local save. Its
  -- empty account is provisioned from the authenticated profile and player_id.
  insert into public.cc_accounts(user_id,migration_state,migrated_at)
  values(p_user_id,'active',now()),(p_target_id,'active',now())
  on conflict(user_id) do update set migration_state='active';

  select * into v_trade from public.cc_trades where initiator_id=p_user_id and client_action_id=p_action_id;
  if v_trade.id is not null then return to_jsonb(v_trade); end if;
  insert into public.cc_trades(initiator_id,recipient_id,initiator_username,initiator_player_id,recipient_username,recipient_player_id,client_action_id)
  values(p_user_id,p_target_id,v_me.username,v_me.player_id,v_them.username,v_them.player_id,p_action_id) returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type) values(v_trade.id,p_user_id,'created');
  return to_jsonb(v_trade);
end $$;

revoke all on function public.cc_prepare_trading(uuid) from public,anon,authenticated;
grant execute on function public.cc_prepare_trading(uuid) to service_role;
