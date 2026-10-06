-- Import the exact reviewed save in the same transaction as owner approval.
-- This removes the window in which a player could change the save between
-- approval and activation.
create or replace function public.cc_owner_review_migration(p_owner_id uuid,p_user_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text; v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode='22023'; end if;
  update public.cc_migration_requests set status=p_decision,reviewed_by=p_owner_id,reviewed_at=now(),review_note=left(coalesce(p_note,''),500)
   where user_id=p_user_id and status='pending' returning status into v_status;
  if v_status is null then raise exception 'pending_request_not_found' using errcode='P0002'; end if;
  if p_decision='approved' then
    v_result:=public.cc_bootstrap_trading(p_user_id);
    return jsonb_build_object('status','active','importedItems',v_result->'importedItems');
  end if;
  return jsonb_build_object('status',v_status);
end $$;
revoke all on function public.cc_owner_review_migration(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cc_owner_review_migration(uuid,uuid,text,text) to service_role;
