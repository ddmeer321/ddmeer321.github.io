-- NICHT ANGEWENDET. Siehe README.md in diesem Ordner.
--
-- Die Freigabe ist nicht an das gebunden, was der Owner gesehen hat.
--
-- VORGESCHICHTE: 20260922202148 hat den Hash-Vergleich auf den ROHEN
-- Spielstand entfernt, weil der sich beim Weiterspielen immer aendert und
-- damit jede Freigabe unmoeglich machte (drei Antraege hingen fest). Als
-- Ersatz blieb die Pruefpunkt-Differenz -- und die ist fuer den Import
-- wirkungslos:
--
--   cc_import_vorschau   importiert hoechstens 500 Stueck je Typ,
--                        bei 14 handelbaren Typen also 7.000 Gegenstaende.
--   unusual_cursor_count schlaegt erst ab 100.000 Kopien an.
--
-- Der Alarm liegt vierzehnmal ueber allem, was ueberhaupt importierbar ist.
-- Er kann auf diesem Weg nie ausloesen. Und game_saves ist fuer
-- authenticated direkt beschreibbar (INSERT und UPDATE) -- die Eingabe
-- gehoert also dem Nutzer.
--
-- DIE LOESUNG IST NICHT, den alten Vergleich zurueckzuholen, dann steht die
-- Schlange wieder. Gebunden wird stattdessen an die VORSCHAU: nicht
-- "derselbe Spielstand", sondern "dieselben Gegenstaende in derselben
-- Anzahl". Weiterspielen ohne neue Cursor aendert daran nichts; ein
-- hochgesetzter count aendert sie sofort.
--
-- Dasselbe Muster wie cc_confirm_trade(p_revision): der Aufrufer schickt
-- mit, was er gesehen hat, und wird abgewiesen, wenn sich das inzwischen
-- geaendert hat. Der Owner laedt dann neu und sieht die neue Liste.
--
-- REIHENFOLGE: erst diese SQL, dann 02 deployen, dann admin.js auf main.
-- Zwischen SQL und Deploy schlaegt jede Freigabe fehl ("Vorschau veraltet"),
-- weil die Function den Hash noch nicht mitschickt. Das ist die sichere
-- Richtung -- es geht nichts durch, was nicht geprueft wurde.

create or replace function public.cc_vorschau_hash(p_save jsonb)
returns text language sql stable security definer set search_path='' as $$
  -- 'leer' statt NULL: sonst gaebe es einen Hash, den man nicht von
  -- "gar nicht mitgeschickt" unterscheiden kann.
  select coalesce(md5(string_agg(v.catalog_id || ':' || v.stueck, ',' order by v.catalog_id)), 'leer')
  from public.cc_import_vorschau(p_save) v;
$$;
revoke all on function public.cc_vorschau_hash(jsonb) from public, anon, authenticated;
grant execute on function public.cc_vorschau_hash(jsonb) to service_role;

-- Die Warteschlange liefert den Hash dessen mit, was sie anzeigt.
create or replace function public.cc_owner_migration_queue(p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at),'[]'::jsonb) into v_rows from (
    select r.user_id, p.username, p.player_id, r.summary, r.risk_flags, r.requested_at,
      public.cc_vorschau_hash(s.save_data) as vorschau_hash,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', v.name, 'rarity', v.rarity, 'icon', v.icon, 'stueck', v.stueck)
               order by case v.rarity
                 when 'secret' then 1 when 'mythic' then 2 when 'legendary' then 3
                 when 'epic' then 4 when 'rare' then 5 when 'uncommon' then 6 else 7 end,
                 v.stueck desc)
        from public.cc_import_vorschau(s.save_data) v
      ), '[]'::jsonb) as vorschau
    from public.cc_migration_requests r
    join public.profiles p on p.id = r.user_id
    left join lateral (
      select g.save_data from public.game_saves g
      where g.user_id = r.user_id and g.game_id = 'cursor-clicker'
    ) s on true
    where r.status = 'pending'
  ) x;
  return v_rows;
end $$;

-- Alte Signatur weg, sonst bliebe sie als Weg ohne Hash bestehen.
drop function if exists public.cc_owner_review_migration(uuid,uuid,text,text);

create or replace function public.cc_owner_review_migration(
  p_owner_id uuid, p_user_id uuid, p_decision text,
  p_note text default null, p_vorschau_hash text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status text; v_result jsonb; v_save jsonb; v_hash text;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id and role='owner' and banned=false)
    then raise exception 'owner_required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision' using errcode='22023'; end if;

  if p_decision='approved' then
    -- FOR UPDATE haelt den Spielstand bis zum Ende der Transaktion fest.
    -- cc_bootstrap_trading laeuft weiter unten in DERSELBEN Transaktion und
    -- liest damit garantiert genau das, was hier geprueft wurde -- zwischen
    -- Pruefung und Import passt kein Schreibzugriff mehr.
    select save_data into v_save from public.game_saves
      where user_id=p_user_id and game_id='cursor-clicker' for update;
    v_hash := public.cc_vorschau_hash(v_save);
    -- errcode P0001 und nicht 40001: denselben Hash nochmal zu senden hilft
    -- nicht, der Owner muss die Liste neu ansehen.
    if p_vorschau_hash is null or p_vorschau_hash <> v_hash then
      raise exception 'vorschau_veraltet' using errcode='P0001';
    end if;
  end if;

  update public.cc_migration_requests set status=p_decision,reviewed_by=p_owner_id,reviewed_at=now(),
         review_note=left(coalesce(p_note,''),500)
   where user_id=p_user_id and status='pending' returning status into v_status;
  if v_status is null then raise exception 'pending_request_not_found' using errcode='P0002'; end if;

  if p_decision='approved' then
    insert into public.cc_accounts(user_id,migration_state,migrated_at,trading_freigegeben,freigegeben_von,freigegeben_am)
    values(p_user_id,'active',now(),true,p_owner_id,now())
    on conflict(user_id) do update set trading_freigegeben=true, freigegeben_von=p_owner_id, freigegeben_am=now();
    v_result:=public.cc_bootstrap_trading(p_user_id);
    return jsonb_build_object('status','active','importedItems',v_result->'importedItems');
  end if;
  return jsonb_build_object('status',v_status);
end $$;
revoke all on function public.cc_owner_review_migration(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.cc_owner_review_migration(uuid,uuid,text,text,text) to service_role;

-- Ueberfluessige Tuer aus 20260922201829 wieder zu: cc_ist_freigegeben wird
-- von der Edge Function ueber service_role gerufen und von
-- cc_darf_in_die_lounge() intern. Letztere ist SECURITY DEFINER und braucht
-- den Grant des Aufrufers dafuer nicht. Mit dem Grant konnte dagegen jeder
-- Angemeldete zu jeder beliebigen UUID abfragen, ob sie freigegeben ist.
revoke execute on function public.cc_ist_freigegeben(uuid) from authenticated;
