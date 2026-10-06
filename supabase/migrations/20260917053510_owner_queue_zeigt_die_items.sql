-- Die Warteschlange zeigte "9 Cursor · 1.206,9 Coins · Warnungen: Keine".
-- Entschieden wird aber, ob diese ITEMS entstehen duerfen - und die sah man
-- nicht. Ein praeparierter Spielstand mit 499 Origin-Cursorn (seltenste
-- Stufe) erschien als sauberer Eintrag, weil die Warnschwellen bei einer
-- Billion Coins liegen.
--
-- Jetzt liefert die Warteschlange dieselbe Vorschau mit, aus der auch
-- gepraegt wird - nach Seltenheit sortiert, damit das Auffaellige oben steht.
create or replace function public.cc_owner_migration_queue(p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at),'[]'::jsonb) into v_rows from (
    select r.user_id, p.username, p.player_id, r.summary, r.risk_flags, r.requested_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', v.name, 'rarity', v.rarity, 'icon', v.icon, 'stueck', v.stueck)
               order by case v.rarity
                 when 'secret' then 1 when 'mythic' then 2 when 'legendary' then 3
                 when 'epic' then 4 when 'rare' then 5 when 'uncommon' then 6 else 7 end,
                 v.stueck desc)
        from public.cc_import_vorschau(
               (select save_data from public.game_saves
                where user_id = r.user_id and game_id = 'cursor-clicker')) v
      ), '[]'::jsonb) as vorschau
    from public.cc_migration_requests r
    join public.profiles p on p.id = r.user_id
    where r.status = 'pending'
  ) x;
  return v_rows;
end $$;
revoke all on function public.cc_owner_migration_queue(uuid) from public, anon, authenticated;
grant execute on function public.cc_owner_migration_queue(uuid) to service_role;
