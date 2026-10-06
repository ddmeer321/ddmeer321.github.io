-- EINE QUELLE FUER "WAS ENTSTEHT BEIM IMPORT".
--
-- Bisher stand die Rechnung an drei Stellen: im Praege-Durchlauf von
-- cc_bootstrap_trading, in der Zusammenfassung von
-- cc_request_legacy_migration und - falsch - in der Auto-Freigabe von
-- cc_prepare_trading. Drei Rechnungen, die dasselbe meinen, laufen
-- auseinander. Genau das war passiert: Die Auto-Freigabe verglich Summen
-- (cursorCopies <= cursorTypes), gepraegt wird aber PRO TYP. Mit genug
-- Fuellschluesseln (count 0) gleichen sich die Summen aus, waehrend ein
-- einzelner Typ auf 500 steht - und 499 Cursor der seltensten Stufe
-- entstehen ohne Freigabe. Nachgerechnet am 17.09.2026: 500 <= 501, und
-- die Vorschau meldet 499x Origin Cursor (secret).
--
-- Ab hier rechnet nur noch diese Funktion, und alle anderen fragen sie.
create or replace function public.cc_import_vorschau(p_save jsonb)
returns table(catalog_id text, name text, rarity text, icon text, stueck integer)
language sql stable security definer set search_path='' as $$
  select e.key, c.name, c.rarity, c.icon,
         least(500, greatest(0, floor((e.value->>'count')::numeric) - 1))::integer
  from jsonb_each(coalesce(p_save->'ownedCursors','{}'::jsonb)) e
  join public.cc_item_catalog c on c.catalog_id = e.key and c.tradable
  -- Der Spielstand gehoert dem Spieler. "count" kann also alles sein:
  -- Text, Komma, null. Nur Zahlen werden angefasst, sonst wirft der Cast
  -- und der ganze Import scheitert mit einer unverstaendlichen Meldung.
  where jsonb_typeof(e.value->'count') = 'number'
    and least(500, greatest(0, floor((e.value->>'count')::numeric) - 1)) > 0;
$$;
revoke all on function public.cc_import_vorschau(jsonb) from public, anon, authenticated;

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
end $$;
revoke all on function public.cc_bootstrap_trading(uuid) from public, anon, authenticated;
grant execute on function public.cc_bootstrap_trading(uuid) to service_role;
