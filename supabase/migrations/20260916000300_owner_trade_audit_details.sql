create or replace function public.cc_owner_trade_history(p_owner_id uuid,p_limit integer default 50,p_before timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
 then raise exception 'owner_required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_rows from (
  select tr.id,tr.initiator_username,tr.initiator_player_id,tr.recipient_username,tr.recipient_player_id,
   tr.status,tr.revision,tr.expires_at,tr.completed_at,tr.failure_code,tr.created_at,tr.updated_at,
   (select coalesce(jsonb_agg(jsonb_build_object(
     'itemId',ti.item_id,'offeredBy',ti.offered_by,'snapshot',ti.item_snapshot,'addedAt',ti.added_at
    ) order by ti.added_at),'[]'::jsonb) from public.cc_trade_items ti where ti.trade_id=tr.id) as items,
   (select coalesce(jsonb_agg(jsonb_build_object(
     'id',ev.id,'actorId',ev.actor_id,'type',ev.event_type,'data',ev.event_data,'createdAt',ev.created_at
    ) order by ev.id),'[]'::jsonb) from public.cc_trade_events ev where ev.trade_id=tr.id) as events
  from public.cc_trades tr where p_before is null or tr.created_at<p_before
  order by tr.created_at desc limit least(greatest(coalesce(p_limit,50),1),100)
 ) t;
 return v_rows;
end $$;
revoke all on function public.cc_owner_trade_history(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.cc_owner_trade_history(uuid,integer,timestamptz) to service_role;
