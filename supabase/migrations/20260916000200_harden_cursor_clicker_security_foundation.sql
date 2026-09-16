create index if not exists cc_trade_items_item_id_idx on public.cc_trade_items(item_id);

create policy "Security server only" on public.cc_accounts for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_migration_requests for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_inventory_items for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_trades for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_trade_items for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_trade_events for all to anon,authenticated using(false) with check(false);
create policy "Security server only" on public.cc_security_actions for all to anon,authenticated using(false) with check(false);
