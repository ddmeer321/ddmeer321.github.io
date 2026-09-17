-- DIE AUTOMATISCHE FREIGABE IST RAUS.
--
-- Sie gab Importe ohne den Owner frei, wenn eine Heuristik zustimmte - und
-- die Heuristik rechnete falsch (Summen statt pro Typ, siehe die Migration
-- import_vorschau_als_einzige_quelle). Reparieren waere moeglich gewesen;
-- streichen ist richtiger, weil die Freigabe kuenftig der EINTRITT ins
-- Trading sein soll. Ein Tuersteher, der manchmal von selbst aufmacht, ist
-- keiner.
--
-- Was bleibt: cc_prepare_trading legt den Antrag an und sagt, wo er steht.
-- Entschieden wird er in admin/ vom Owner.
create or replace function public.cc_prepare_trading(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_player_id text;
  v_request jsonb;
begin
  perform public.cc_assert_active_user(p_user_id);
  select player_id into v_player_id from public.profiles where id=p_user_id;

  insert into public.cc_accounts(user_id,migration_state,migrated_at)
  values(p_user_id,'active',now())
  on conflict(user_id) do update set migration_state='active';

  begin
    v_request := public.cc_request_legacy_migration(p_user_id);
  exception when sqlstate 'P0002' then
    v_request := null;     -- kein Spielstand zum Importieren, das ist ok
  end;

  return jsonb_build_object(
    'status','active',
    'tradingId',v_player_id,
    'importStatus',coalesce(v_request->>'status','not_requested'),
    'importNeedsOwner',coalesce(v_request->>'status'='pending',false)
  );
end $$;
revoke all on function public.cc_prepare_trading(uuid) from public, anon, authenticated;
grant execute on function public.cc_prepare_trading(uuid) to service_role;
