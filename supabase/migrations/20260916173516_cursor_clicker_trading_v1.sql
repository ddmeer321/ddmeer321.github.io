-- Cursor Clicker Trading v1: owner-reviewed legacy import and atomic cursor swaps.
create table public.cc_item_catalog (
  catalog_id text primary key,
  name text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','epic','legendary','mythic','secret')),
  icon text not null,
  tradable boolean not null default true
);

insert into public.cc_item_catalog(catalog_id,name,rarity,icon) values
('wooden','Wooden Cursor','common','🪵'),('stone','Stone Cursor','common','🪨'),
('copper','Copper Cursor','uncommon','🔶'),('neon','Neon Cursor','uncommon','💠'),
('ice','Ice Cursor','rare','❄️'),('steel','Steel Cursor','rare','⚙️'),
('fire','Fire Cursor','epic','🔥'),('storm','Storm Cursor','epic','⚡'),
('hacker','Hacker Cursor','legendary','💻'),('phoenix','Phoenix Cursor','legendary','🦅'),
('galaxy','Galaxy Cursor','mythic','🌌'),('quantum','Quantum Cursor','mythic','⚛️'),
('void','Void Cursor','secret','🕳️'),('origin','Origin Cursor','secret','✨')
on conflict (catalog_id) do update set name=excluded.name,rarity=excluded.rarity,icon=excluded.icon;

alter table public.cc_item_catalog enable row level security;
alter table public.cc_item_catalog force row level security;
revoke all on table public.cc_item_catalog from public,anon,authenticated;
grant select on table public.cc_item_catalog to service_role;
create policy "Security server only" on public.cc_item_catalog for all to anon,authenticated using(false) with check(false);

alter table public.cc_trades add column if not exists client_action_id uuid;
create unique index if not exists cc_trades_initiator_action_uidx
  on public.cc_trades(initiator_id,client_action_id) where client_action_id is not null;

create or replace function public.cc_assert_active_user(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=p_user_id and banned=false) then
    raise exception 'account_unavailable' using errcode='42501';
  end if;
end $$;

create or replace function public.cc_owner_review_migration(p_owner_id uuid,p_user_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode='22023'; end if;
  update public.cc_migration_requests set status=p_decision,reviewed_by=p_owner_id,reviewed_at=now(),review_note=left(coalesce(p_note,''),500)
   where user_id=p_user_id and status='pending' returning status into v_status;
  if v_status is null then raise exception 'pending_request_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('status',v_status);
end $$;

create or replace function public.cc_owner_migration_queue(p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at),'[]'::jsonb) into v_rows from (
    select r.user_id,p.username,p.player_id,r.summary,r.risk_flags,r.requested_at
    from public.cc_migration_requests r join public.profiles p on p.id=r.user_id
    where r.status='pending'
  ) x;
  return v_rows;
end $$;

create or replace function public.cc_bootstrap_trading(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_save jsonb; v_hash text; v_request public.cc_migration_requests%rowtype; v_row record; v_copy integer; v_total integer:=0;
begin
  perform public.cc_assert_active_user(p_user_id);
  if exists(select 1 from public.cc_accounts where user_id=p_user_id and migration_state='active') then
    return jsonb_build_object('status','active','importedItems',(select count(*) from public.cc_inventory_items where owner_id=p_user_id));
  end if;
  select * into v_request from public.cc_migration_requests where user_id=p_user_id for update;
  if v_request.status is distinct from 'approved' then raise exception 'owner_approval_required' using errcode='42501'; end if;
  select save_data into v_save from public.game_saves where user_id=p_user_id and game_id='cursor-clicker' for update;
  if v_save is null then raise exception 'cursor_save_missing' using errcode='P0002'; end if;
  v_hash:=md5(v_save::text);
  if v_hash<>v_request.legacy_save_hash then raise exception 'save_changed_after_review' using errcode='40001'; end if;
  if cardinality(v_request.risk_flags)>0 then raise exception 'review_contains_risk_flags' using errcode='42501'; end if;
  insert into public.cc_accounts(user_id,coins,total_coins_earned,total_clicks,migration_state,migrated_at)
  values(p_user_id,coalesce((v_save->>'coins')::numeric,0),coalesce((v_save->>'totalCoinsEarned')::numeric,0),coalesce((v_save->>'totalClicks')::bigint,0),'active',now())
  on conflict(user_id) do update set migration_state='active',migrated_at=now();
  for v_row in
    select e.key as catalog_id,greatest(0,least(500,coalesce((e.value->>'count')::integer,0)-1)) as copies,
           c.name,c.rarity,c.icon
    from jsonb_each(coalesce(v_save->'ownedCursors','{}'::jsonb)) e
    join public.cc_item_catalog c on c.catalog_id=e.key and c.tradable
  loop
    for v_copy in 1..v_row.copies loop
      insert into public.cc_inventory_items(owner_id,item_type,catalog_id,item_data,source)
      values(p_user_id,'cursor',v_row.catalog_id,jsonb_build_object('name',v_row.name,'rarity',v_row.rarity,'icon',v_row.icon),'legacy');
      v_total:=v_total+1;
    end loop;
  end loop;
  update public.cc_migration_requests set status='imported',reviewed_at=coalesce(reviewed_at,now()) where user_id=p_user_id;
  return jsonb_build_object('status','active','importedItems',v_total);
end $$;

create or replace function public.cc_search_players(p_user_id uuid,p_query text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_q text:=lower(trim(coalesce(p_query,''))); v_rows jsonb;
begin
  perform public.cc_assert_active_user(p_user_id);
  if length(v_q)<3 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_rows from (
    select p.id,p.username,p.player_id from public.profiles p
    where p.id<>p_user_id and p.banned=false
      and (lower(p.username) like '%'||v_q||'%' or lower(p.player_id) like '%'||v_q||'%')
    order by case when lower(p.username)=v_q then 0 else 1 end,p.username limit 10
  ) x;
  return v_rows;
end $$;

create or replace function public.cc_trading_snapshot(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inventory jsonb; v_trades jsonb; v_account text;
begin
  perform public.cc_assert_active_user(p_user_id);
  select migration_state into v_account from public.cc_accounts where user_id=p_user_id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at),'[]'::jsonb) into v_inventory from (
    select id,catalog_id,item_data,trade_lock_id,created_at from public.cc_inventory_items where owner_id=p_user_id and item_type='cursor'
  ) i;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into v_trades from (
    select tr.id,tr.initiator_id,tr.recipient_id,tr.initiator_username,tr.initiator_player_id,
      tr.recipient_username,tr.recipient_player_id,tr.status,tr.revision,tr.initiator_confirmed_revision,
      tr.recipient_confirmed_revision,tr.expires_at,tr.completed_at,tr.failure_code,tr.created_at,tr.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('itemId',ti.item_id,'offeredBy',ti.offered_by,'snapshot',ti.item_snapshot) order by ti.added_at) from public.cc_trade_items ti where ti.trade_id=tr.id),'[]'::jsonb) items,
      coalesce((select jsonb_agg(jsonb_build_object('type',ev.event_type,'actorId',ev.actor_id,'createdAt',ev.created_at) order by ev.id) from public.cc_trade_events ev where ev.trade_id=tr.id),'[]'::jsonb) events
    from public.cc_trades tr where tr.initiator_id=p_user_id or tr.recipient_id=p_user_id
    order by tr.updated_at desc limit 50
  ) t;
  return jsonb_build_object('accountState',coalesce(v_account,'pending'),'inventory',v_inventory,'trades',v_trades);
end $$;

create or replace function public.cc_create_trade(p_user_id uuid,p_target_id uuid,p_action_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype; v_me public.profiles%rowtype; v_them public.profiles%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id); perform public.cc_assert_active_user(p_target_id);
  if p_user_id=p_target_id then raise exception 'cannot_trade_with_self' using errcode='22023'; end if;
  if not exists(select 1 from public.cc_accounts where user_id=p_user_id and migration_state='active') then raise exception 'trading_not_active' using errcode='42501'; end if;
  if not exists(select 1 from public.cc_accounts where user_id=p_target_id and migration_state='active') then raise exception 'target_not_active' using errcode='42501'; end if;
  select * into v_trade from public.cc_trades where initiator_id=p_user_id and client_action_id=p_action_id;
  if v_trade.id is not null then return to_jsonb(v_trade); end if;
  select * into v_me from public.profiles where id=p_user_id; select * into v_them from public.profiles where id=p_target_id;
  insert into public.cc_trades(initiator_id,recipient_id,initiator_username,initiator_player_id,recipient_username,recipient_player_id,client_action_id)
  values(p_user_id,p_target_id,v_me.username,v_me.player_id,v_them.username,v_them.player_id,p_action_id) returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type) values(v_trade.id,p_user_id,'created');
  return to_jsonb(v_trade);
end $$;

create or replace function public.cc_set_trade_offer(p_user_id uuid,p_trade_id uuid,p_item_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
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
  update public.cc_trades set status='draft',revision=revision+1,initiator_confirmed_revision=null,recipient_confirmed_revision=null where id=p_trade_id returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'offer_changed',jsonb_build_object('count',v_expected,'revision',v_trade.revision));
  return to_jsonb(v_trade);
end $$;

create or replace function public.cc_send_trade_offer(p_user_id uuid,p_trade_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  if v_trade.status<>'draft' or v_trade.expires_at<=now() then raise exception 'trade_not_sendable' using errcode='55000'; end if;
  if not exists(select 1 from public.cc_trade_items where trade_id=p_trade_id and offered_by=v_trade.initiator_id)
    or not exists(select 1 from public.cc_trade_items where trade_id=p_trade_id and offered_by=v_trade.recipient_id)
    then raise exception 'both_sides_need_items' using errcode='23514'; end if;
  update public.cc_trades set status='offered',revision=revision+1,initiator_confirmed_revision=null,recipient_confirmed_revision=null where id=p_trade_id returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'offer_changed',jsonb_build_object('sent',true,'revision',v_trade.revision));
  return to_jsonb(v_trade);
end $$;

create or replace function public.cc_confirm_trade(p_user_id uuid,p_trade_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  if v_trade.status<>'offered' or v_trade.revision<>p_revision or v_trade.expires_at<=now() then raise exception 'trade_changed_or_expired' using errcode='40001'; end if;
  if p_user_id=v_trade.initiator_id then update public.cc_trades set initiator_confirmed_revision=p_revision where id=p_trade_id;
  else update public.cc_trades set recipient_confirmed_revision=p_revision where id=p_trade_id; end if;
  insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'confirmed',jsonb_build_object('revision',p_revision));
  select * into v_trade from public.cc_trades where id=p_trade_id;
  if v_trade.initiator_confirmed_revision=p_revision and v_trade.recipient_confirmed_revision=p_revision then
    if exists(select 1 from public.cc_trade_items ti left join public.cc_inventory_items i on i.id=ti.item_id
      where ti.trade_id=p_trade_id and (i.id is null or i.owner_id<>ti.offered_by or i.trade_lock_id<>p_trade_id))
      then raise exception 'locked_inventory_changed' using errcode='40001'; end if;
    update public.cc_inventory_items i set owner_id=case when ti.offered_by=v_trade.initiator_id then v_trade.recipient_id else v_trade.initiator_id end,
      trade_lock_id=null,source='trade',source_ref=p_trade_id,version=version+1
      from public.cc_trade_items ti where ti.trade_id=p_trade_id and i.id=ti.item_id;
    update public.cc_accounts set revision=revision+1,last_action_at=now() where user_id in (v_trade.initiator_id,v_trade.recipient_id);
    update public.cc_trades set status='completed',completed_at=now() where id=p_trade_id returning * into v_trade;
    insert into public.cc_trade_events(trade_id,actor_id,event_type,event_data) values(p_trade_id,p_user_id,'completed',jsonb_build_object('revision',p_revision));
  end if;
  return to_jsonb(v_trade);
end $$;

create or replace function public.cc_close_trade(p_user_id uuid,p_trade_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_trade public.cc_trades%rowtype; v_status text; v_event text;
begin
  perform public.cc_assert_active_user(p_user_id);
  select * into v_trade from public.cc_trades where id=p_trade_id for update;
  if v_trade.id is null or p_user_id not in (v_trade.initiator_id,v_trade.recipient_id) then raise exception 'trade_not_found' using errcode='P0002'; end if;
  if v_trade.status not in ('draft','offered') then return to_jsonb(v_trade); end if;
  if p_mode='cancel' and p_user_id=v_trade.initiator_id then v_status:='cancelled';v_event:='cancelled';
  elsif p_mode='decline' and p_user_id=v_trade.recipient_id then v_status:='declined';v_event:='declined';
  else raise exception 'invalid_close_action' using errcode='42501'; end if;
  update public.cc_inventory_items set trade_lock_id=null where trade_lock_id=p_trade_id;
  update public.cc_trades set status=v_status where id=p_trade_id returning * into v_trade;
  insert into public.cc_trade_events(trade_id,actor_id,event_type) values(p_trade_id,p_user_id,v_event);
  return to_jsonb(v_trade);
end $$;

revoke all on function public.cc_assert_active_user(uuid),
 public.cc_owner_review_migration(uuid,uuid,text,text),public.cc_owner_migration_queue(uuid),public.cc_bootstrap_trading(uuid),public.cc_search_players(uuid,text),
 public.cc_trading_snapshot(uuid),public.cc_create_trade(uuid,uuid,uuid),public.cc_set_trade_offer(uuid,uuid,uuid[]),
 public.cc_send_trade_offer(uuid,uuid),public.cc_confirm_trade(uuid,uuid,integer),public.cc_close_trade(uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.cc_owner_review_migration(uuid,uuid,text,text),public.cc_owner_migration_queue(uuid),public.cc_bootstrap_trading(uuid),public.cc_search_players(uuid,text),
 public.cc_trading_snapshot(uuid),public.cc_create_trade(uuid,uuid,uuid),public.cc_set_trade_offer(uuid,uuid,uuid[]),
 public.cc_send_trade_offer(uuid,uuid),public.cc_confirm_trade(uuid,uuid,integer),public.cc_close_trade(uuid,uuid,text)
 to service_role;
