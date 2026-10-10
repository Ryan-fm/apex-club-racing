-- Add the new circuit without changing or clearing existing race records.
begin;
alter table public.club_best_races drop constraint club_best_races_scene_check;
alter table public.club_best_races add constraint club_best_races_scene_check check (scene in ('bay','citadel','harbor','canyon'));

create or replace function public.submit_best_race(
  p_token text,p_scene text,p_assisted boolean,p_craft integer,p_rules_version text,
  p_time_ms integer,p_laps jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare account_id uuid; lap jsonb; splits jsonb; samples jsonb; sample jsonb;
  lap_ms integer; lap_times integer[] := '{}'; total_ms integer := 0; previous_ms integer;
  last_t numeric; t numeric; x numeric; z numeric; last_x numeric; last_z numeric;
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Sign in first'; end if;
  select player_id into account_id from public.club_sessions
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
  if account_id is null then raise exception 'Session expired. Sign in again'; end if;
  if p_scene not in ('bay','citadel','harbor','canyon') or p_assisted is null or p_craft not between 0 and 5 or p_rules_version <> 'race-v1' then raise exception 'Unsupported race rules'; end if;
  if p_time_ms not between 45000 and 1800000 or jsonb_typeof(p_laps) <> 'array' or jsonb_array_length(p_laps) <> 3 then raise exception 'Complete three laps first'; end if;
  for lap in select value from jsonb_array_elements(p_laps) loop
    lap_ms := (lap->>'time_ms')::integer;
    splits := lap->'splits_ms'; samples := lap->'samples';
    if lap_ms not between 15000 and 600000 or jsonb_typeof(splits) <> 'array' or jsonb_array_length(splits) <> 6
       or jsonb_typeof(samples) <> 'array' or jsonb_array_length(samples) not between 100 and 4000 then
      raise exception 'Invalid lap data';
    end if;
    previous_ms := 0;
    for sample in select value from jsonb_array_elements(splits) loop
      if (sample #>> '{}')::integer <= previous_ms or (sample #>> '{}')::integer > lap_ms+100 then raise exception 'Invalid sector times'; end if;
      previous_ms := (sample #>> '{}')::integer;
    end loop;
    if abs(previous_ms-lap_ms)>100 then raise exception 'Incomplete lap sectors'; end if;
    last_t := -1;
    for sample in select value from jsonb_array_elements(samples) loop
      if jsonb_typeof(sample) <> 'array' or jsonb_array_length(sample) <> 5 then raise exception 'Invalid lap trace'; end if;
      t := (sample->>0)::numeric; x := (sample->>1)::numeric; z := (sample->>3)::numeric;
      if t <= last_t or t > lap_ms/1000.0+0.2 or abs(x)>10000 or abs(z)>10000 then raise exception 'Invalid lap trace'; end if;
      if last_t >= 0 and (x-last_x)^2+(z-last_z)^2 > (900*(t-last_t)+30)^2 then raise exception 'Impossible lap movement'; end if;
      last_t := t; last_x := x; last_z := z;
    end loop;
    if last_t < lap_ms/1000.0-0.5 then raise exception 'Incomplete lap trace'; end if;
    lap_times := array_append(lap_times,lap_ms); total_ms := total_ms+lap_ms;
  end loop;
  -- The race clock includes the short run from the starting grid to lap one.
  if total_ms > p_time_ms+1000 or p_time_ms-total_ms > 30000 then raise exception 'Race time does not match laps'; end if;
  insert into public.club_best_races(player_id,scene,assisted,rules_version,craft,time_ms,laps_ms)
  values(account_id,p_scene,p_assisted,p_rules_version,p_craft,p_time_ms,lap_times)
  on conflict (player_id,scene,assisted,rules_version) do update
  set craft=excluded.craft,time_ms=excluded.time_ms,laps_ms=excluded.laps_ms,achieved_at=now()
  where public.club_best_races.time_ms > excluded.time_ms;
  return found;
end $$;
revoke all on function public.submit_best_race(text,text,boolean,integer,text,integer,jsonb) from public;
grant execute on function public.submit_best_race(text,text,boolean,integer,text,integer,jsonb) to anon,authenticated;

commit;
