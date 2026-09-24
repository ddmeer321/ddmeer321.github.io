-- Additive Cursor Clicker security foundation. Existing game_saves stay untouched.
create table public.cc_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins numeric(30,4) not null default 0 check (coins >= 0),
  total_coins_earned numeric(30,4) not null default 0 check (total_coins_earned >= 0),
  total_clicks bigint not null default 0 check (total_clicks >= 0),
  revision bigint not null default 0 check (revision >= 0),
  economy_version integer not null default 1 check (economy_version > 0),
  migration_state text not null default 'pending' check (migration_state in ('pending','approved','active','rejected')),
  migrated_at timestamptz, last_action_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cc_migration_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_save_updated_at timestamptz not null, legacy_save_hash text not null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary)='object'),
  risk_flags text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending','approved','rejected','imported')),
  requested_at timestamptz not null default now(), reviewed_by uuid,
  reviewed_at timestamptz, review_note text
);
create table public.cc_trades (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null, recipient_id uuid not null,
  initiator_username text not null, initiator_player_id text not null,
  recipient_username text not null, recipient_player_id text not null,
  status text not null default 'draft' check (status in ('draft','offered','accepted','completed','declined','cancelled','expired','failed')),
  revision integer not null default 1 check (revision > 0),
  initiator_confirmed_revision integer, recipient_confirmed_revision integer,
  expires_at timestamptz not null default (now()+interval '24 hours'),
  completed_at timestamptz, failure_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (initiator_id<>recipient_id)
);
create table public.cc_inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('cursor','aura','employee','potion')),
  catalog_id text not null check (catalog_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  item_data jsonb not null default '{}'::jsonb check (jsonb_typeof(item_data)='object'),
  source text not null check (source in ('legacy','box','fusion','aura_box','employee_box','reward','trade','admin')),
  source_ref uuid, trade_lock_id uuid references public.cc_trades(id) on delete set null,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cc_trade_items (
  trade_id uuid not null references public.cc_trades(id) on delete restrict,
  item_id uuid not null references public.cc_inventory_items(id) on delete restrict,
  offered_by uuid not null,
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot)='object'),
  added_at timestamptz not null default now(), primary key (trade_id,item_id)
);
create table public.cc_trade_events (
  id bigint generated always as identity primary key,
  trade_id uuid not null references public.cc_trades(id) on delete restrict,
  actor_id uuid, event_type text not null check (event_type in ('created','offer_changed','confirmed','declined','cancelled','expired','completed','failed','owner_reviewed','owner_reverted')),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data)='object'),
  created_at timestamptz not null default now()
);
create table public.cc_security_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null, client_action_id uuid not null,
  action_type text not null check (length(action_type) between 1 and 64),
  status text not null check (status in ('accepted','rejected','failed')),
  reason_code text, request_hash text,
  result_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(result_summary)='object'),
  created_at timestamptz not null default now(), unique(user_id,client_action_id)
);
create index cc_inventory_owner_type_idx on public.cc_inventory_items(owner_id,item_type,catalog_id);
create index cc_inventory_trade_lock_idx on public.cc_inventory_items(trade_lock_id) where trade_lock_id is not null;
create index cc_trades_initiator_created_idx on public.cc_trades(initiator_id,created_at desc);
create index cc_trades_recipient_created_idx on public.cc_trades(recipient_id,created_at desc);
create index cc_trades_status_expires_idx on public.cc_trades(status,expires_at);
create index cc_trade_events_trade_idx on public.cc_trade_events(trade_id,id);
create index cc_security_actions_user_created_idx on public.cc_security_actions(user_id,created_at desc);

alter table public.cc_accounts enable row level security;
alter table public.cc_migration_requests enable row level security;
alter table public.cc_inventory_items enable row level security;
alter table public.cc_trades enable row level security;
alter table public.cc_trade_items enable row level security;
alter table public.cc_trade_events enable row level security;
alter table public.cc_security_actions enable row level security;
alter table public.cc_accounts force row level security;
alter table public.cc_migration_requests force row level security;
alter table public.cc_inventory_items force row level security;
alter table public.cc_trades force row level security;
alter table public.cc_trade_items force row level security;
alter table public.cc_trade_events force row level security;
alter table public.cc_security_actions force row level security;

revoke all on table public.cc_accounts,public.cc_migration_requests,public.cc_inventory_items,public.cc_trades,public.cc_trade_items,public.cc_trade_events,public.cc_security_actions from public,anon,authenticated;
revoke all on sequence public.cc_trade_events_id_seq,public.cc_security_actions_id_seq from public,anon,authenticated;
grant select,insert,update,delete on table public.cc_accounts,public.cc_migration_requests,public.cc_inventory_items,public.cc_trades,public.cc_trade_items,public.cc_trade_events,public.cc_security_actions to service_role;
grant usage,select on sequence public.cc_trade_events_id_seq,public.cc_security_actions_id_seq to service_role;

create function public.cc_set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
create trigger cc_accounts_set_updated_at before update on public.cc_accounts for each row execute function public.cc_set_updated_at();
create trigger cc_inventory_set_updated_at before update on public.cc_inventory_items for each row execute function public.cc_set_updated_at();
create trigger cc_trades_set_updated_at before update on public.cc_trades for each row execute function public.cc_set_updated_at();

create function public.cc_reject_trade_event_changes() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'cc_trade_events is append-only' using errcode='55000'; end $$;
create trigger cc_trade_events_immutable before update or delete on public.cc_trade_events for each row execute function public.cc_reject_trade_event_changes();

create function public.cc_security_status(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account public.cc_accounts%rowtype; v_request public.cc_migration_requests%rowtype;
begin
 select * into v_account from public.cc_accounts where user_id=p_user_id;
 select * into v_request from public.cc_migration_requests where user_id=p_user_id;
 return jsonb_build_object('phase','foundation','economyEnabled',false,'tradingEnabled',false,
  'hasServerAccount',v_account.user_id is not null,
  'migration',case when v_request.user_id is null then null else jsonb_build_object(
   'status',v_request.status,'riskFlags',to_jsonb(v_request.risk_flags),'summary',v_request.summary,
   'requestedAt',v_request.requested_at,'reviewedAt',v_request.reviewed_at) end);
end $$;

create function public.cc_request_legacy_migration(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_save jsonb; v_updated timestamptz; v_ver integer:=0; v_coins numeric:=0;
 v_types integer:=0; v_cursors numeric:=0; v_workers numeric:=0; v_flags text[]:='{}'; v_summary jsonb; v_status text;
begin
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'account_not_found' using errcode='P0002'; end if;
 select status into v_status from public.cc_migration_requests where user_id=p_user_id;
 if v_status in ('approved','imported') then
  select summary into v_summary from public.cc_migration_requests where user_id=p_user_id;
  return jsonb_build_object('status',v_status,'summary',v_summary);
 end if;
 select save_data,updated_at into v_save,v_updated from public.game_saves where user_id=p_user_id and game_id='cursor-clicker';
 if v_save is null then raise exception 'legacy_save_not_found' using errcode='P0002'; end if;
 if jsonb_typeof(v_save->'version')='number' then v_ver:=(v_save->>'version')::integer; end if;
 if jsonb_typeof(v_save->'coins')='number' then v_coins:=greatest(0,(v_save->>'coins')::numeric); end if;
 if jsonb_typeof(v_save->'ownedCursors')='object' then
  v_types:=jsonb_object_length(v_save->'ownedCursors');
  select coalesce(sum(case when jsonb_typeof(value->'count')='number' then greatest(0,(value->>'count')::numeric) else 0 end),0)
   into v_cursors from jsonb_each(v_save->'ownedCursors');
 end if;
 if jsonb_typeof(v_save#>'{factory,owned}')='object' then
  select coalesce(sum(case when jsonb_typeof(value)='number' then greatest(0,(value#>>'{}')::numeric) else 0 end),0)
   into v_workers from jsonb_each(v_save#>'{factory,owned}');
 end if;
 if v_ver not in (3,4) then v_flags:=array_append(v_flags,'unknown_save_version'); end if;
 if v_coins>1000000000000 then v_flags:=array_append(v_flags,'unusual_coin_balance'); end if;
 if v_cursors>100000 then v_flags:=array_append(v_flags,'unusual_cursor_count'); end if;
 if v_workers>100000 then v_flags:=array_append(v_flags,'unusual_employee_count'); end if;
 v_summary:=jsonb_build_object('saveVersion',v_ver,'coins',v_coins,'cursorTypes',v_types,'cursorCopies',v_cursors,'employeeCopies',v_workers,'hasFactory',jsonb_typeof(v_save->'factory')='object');
 insert into public.cc_migration_requests(user_id,legacy_save_updated_at,legacy_save_hash,summary,risk_flags,status)
 values(p_user_id,v_updated,md5(v_save::text),v_summary,v_flags,'pending')
 on conflict(user_id) do update set legacy_save_updated_at=excluded.legacy_save_updated_at,legacy_save_hash=excluded.legacy_save_hash,
 summary=excluded.summary,risk_flags=excluded.risk_flags,status='pending',requested_at=now(),reviewed_by=null,reviewed_at=null,review_note=null;
 return jsonb_build_object('status','pending','riskFlags',to_jsonb(v_flags),'summary',v_summary);
end $$;

create function public.cc_owner_trade_history(p_owner_id uuid,p_limit integer default 50,p_before timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
 then raise exception 'owner_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_rows from (
  select id,initiator_username,initiator_player_id,recipient_username,recipient_player_id,status,revision,
   expires_at,completed_at,failure_code,created_at,updated_at from public.cc_trades
  where p_before is null or created_at<p_before order by created_at desc limit least(greatest(coalesce(p_limit,50),1),100)
 ) t;
 return v_rows;
end $$;

revoke all on function public.cc_set_updated_at(),public.cc_reject_trade_event_changes(),public.cc_security_status(uuid),public.cc_request_legacy_migration(uuid),public.cc_owner_trade_history(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.cc_security_status(uuid),public.cc_request_legacy_migration(uuid),public.cc_owner_trade_history(uuid,integer,timestamptz) to service_role;
comment on table public.cc_trade_events is 'Append-only owner-visible trading audit trail.';
comment on table public.cc_migration_requests is 'Legacy saves remain untrusted and require owner review before import.';
