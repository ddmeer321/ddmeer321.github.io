-- Portable object-key count for the legacy migration review.
create or replace function public.cc_request_legacy_migration(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
  select count(*) into v_types from jsonb_object_keys(v_save->'ownedCursors');
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
revoke all on function public.cc_request_legacy_migration(uuid) from public,anon,authenticated;
grant execute on function public.cc_request_legacy_migration(uuid) to service_role;
