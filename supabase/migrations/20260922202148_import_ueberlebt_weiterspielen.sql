-- Der Import scheiterte, sobald jemand nach dem Antrag weitergespielt hat.
--
-- WAS PASSIERT IST: cc_request_legacy_migration merkt sich beim Antrag den
-- md5 des Spielstands. cc_bootstrap_trading verglich beim Import den
-- LEBENDEN Spielstand damit und warf 'save_changed_after_review', sobald er
-- abwich. Weiterspielen aendert ihn aber immer -- jede Muenze zaehlt.
--
-- Und der Ausweg war zu: die Lounge blendet "Import beantragen" aus, solange
-- ein Antrag auf 'pending' steht (js/main.js: el.importBeantragen.hidden =
-- stand.status === "pending" || ...). Ein neuer Antrag haette den Hash
-- aufgefrischt, war aber genau dann nicht erreichbar, wenn man ihn brauchte.
-- Ergebnis: drei Antraege, die der Owner nicht freigeben KONNTE.
--
-- WAS DER HASH EIGENTLICH SCHUETZEN SOLLTE: dass niemand einen harmlosen
-- Stand einreicht, freigegeben wird und dann etwas ganz anderes importiert.
-- Das bleibt geschuetzt -- nur nicht mehr ueber Gleichheit, sondern ueber die
-- Pruefpunkte: importiert wird der aktuelle Stand, aber NUR wenn er keinen
-- Alarm ausloest, der zum Zeitpunkt der Freigabe noch nicht dastand.
--
-- Normal weiterspielen loest keinen Alarm aus. Ein Stand, der ploetzlich die
-- Schwellen reisst, schon. Genau die Unterscheidung war gemeint.

-- Kennzahlen und Pruefpunkte lagen bisher inline in
-- cc_request_legacy_migration. Jetzt an einer Stelle, weil Antrag UND Import
-- sie brauchen -- zwei Kopien waeren zwei Wahrheiten.
create or replace function public.cc_save_kennzahlen(p_save jsonb)
returns jsonb language plpgsql immutable security definer set search_path='' as $$
declare v_ver integer:=0; v_coins numeric:=0; v_types integer:=0;
        v_cursors numeric:=0; v_workers numeric:=0; v_flags text[]:='{}';
begin
  if jsonb_typeof(p_save->'version')='number' then v_ver:=(p_save->>'version')::integer; end if;
  if jsonb_typeof(p_save->'coins')='number' then v_coins:=greatest(0,(p_save->>'coins')::numeric); end if;
  if jsonb_typeof(p_save->'ownedCursors')='object' then
    select count(*) into v_types from jsonb_object_keys(p_save->'ownedCursors');
    select coalesce(sum(case when jsonb_typeof(value->'count')='number' then greatest(0,(value->>'count')::numeric) else 0 end),0)
      into v_cursors from jsonb_each(p_save->'ownedCursors');
  end if;
  if jsonb_typeof(p_save#>'{factory,owned}')='object' then
    select coalesce(sum(case when jsonb_typeof(value)='number' then greatest(0,(value#>>'{}')::numeric) else 0 end),0)
      into v_workers from jsonb_each(p_save#>'{factory,owned}');
  end if;
  if v_ver not in (3,4) then v_flags:=array_append(v_flags,'unknown_save_version'); end if;
  if v_coins>1000000000000 then v_flags:=array_append(v_flags,'unusual_coin_balance'); end if;
  if v_cursors>100000 then v_flags:=array_append(v_flags,'unusual_cursor_count'); end if;
  if v_workers>100000 then v_flags:=array_append(v_flags,'unusual_employee_count'); end if;
  return jsonb_build_object(
    'summary', jsonb_build_object('saveVersion',v_ver,'coins',v_coins,'cursorTypes',v_types,
                                  'cursorCopies',v_cursors,'employeeCopies',v_workers,
                                  'hasFactory',jsonb_typeof(p_save->'factory')='object'),
    'flags', to_jsonb(v_flags));
end $$;
revoke all on function public.cc_save_kennzahlen(jsonb) from public, anon, authenticated;
grant execute on function public.cc_save_kennzahlen(jsonb) to service_role;

create or replace function public.cc_request_legacy_migration(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_save jsonb; v_updated timestamptz; v_kenn jsonb; v_summary jsonb; v_flags text[]; v_status text;
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'account_not_found' using errcode='P0002'; end if;
  select status into v_status from public.cc_migration_requests where user_id=p_user_id;
  if v_status in ('approved','imported') then
    select summary into v_summary from public.cc_migration_requests where user_id=p_user_id;
    return jsonb_build_object('status',v_status,'summary',v_summary);
  end if;
  select save_data,updated_at into v_save,v_updated from public.game_saves where user_id=p_user_id and game_id='cursor-clicker';
  if v_save is null then raise exception 'legacy_save_not_found' using errcode='P0002'; end if;

  v_kenn:=public.cc_save_kennzahlen(v_save);
  v_summary:=v_kenn->'summary';
  select array(select jsonb_array_elements_text(v_kenn->'flags')) into v_flags;

  insert into public.cc_migration_requests(user_id,legacy_save_updated_at,legacy_save_hash,summary,risk_flags,status)
  values(p_user_id,v_updated,md5(v_save::text),v_summary,v_flags,'pending')
  on conflict(user_id) do update set legacy_save_updated_at=excluded.legacy_save_updated_at,legacy_save_hash=excluded.legacy_save_hash,
    summary=excluded.summary,risk_flags=excluded.risk_flags,status='pending',requested_at=now(),reviewed_by=null,reviewed_at=null,review_note=null;
  return jsonb_build_object('status','pending','riskFlags',to_jsonb(v_flags),'summary',v_summary);
end $$;
revoke all on function public.cc_request_legacy_migration(uuid) from public,anon,authenticated;
grant execute on function public.cc_request_legacy_migration(uuid) to service_role;

create or replace function public.cc_bootstrap_trading(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_save jsonb; v_request public.cc_migration_requests%rowtype;
  v_account_state text; v_row record; v_copy integer; v_total integer:=0;
  v_kenn jsonb; v_jetzt text[]; v_neu text[];
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

  -- Importiert wird der AKTUELLE Stand. Geprueft wird nicht mehr, OB er sich
  -- geaendert hat (das tut er beim Weiterspielen immer), sondern ob die
  -- Aenderung einen Pruefpunkt ausloest, der bei der Freigabe noch nicht da
  -- war. errcode bleibt P0001 und nicht 40001: ein geaenderter Spielstand
  -- aendert sich nicht von selbst zurueck, Wiederholen hilft nicht.
  v_kenn:=public.cc_save_kennzahlen(v_save);
  select array(select jsonb_array_elements_text(v_kenn->'flags')) into v_jetzt;
  select array(select unnest(v_jetzt) except select unnest(coalesce(v_request.risk_flags,'{}'::text[]))) into v_neu;
  if cardinality(v_neu)>0 then
    raise exception 'save_changed_after_review' using errcode='P0001';
  end if;

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

  -- Festhalten, was TATSAECHLICH hereinkam, nicht was beim Antrag dastand.
  -- Sonst behauptet der Datensatz hinterher etwas, das so nie importiert wurde.
  update public.cc_migration_requests
     set status='imported', reviewed_at=coalesce(reviewed_at,now()),
         summary=v_kenn->'summary', legacy_save_hash=md5(v_save::text), risk_flags=v_jetzt
   where user_id=p_user_id;
  return jsonb_build_object('status','active','importedItems',v_total);
end $$;
revoke all on function public.cc_bootstrap_trading(uuid) from public,anon,authenticated;
grant execute on function public.cc_bootstrap_trading(uuid) to service_role;
