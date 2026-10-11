begin;
-- Generic account progression. No Toy dependencies. Monday reset uses Asia/Shanghai.
create table if not exists public.club_progress (
 player_id uuid primary key references public.club_profiles(id) on delete cascade,
 activity_points integer not null default 0, total_seconds bigint not null default 0, week date not null default date_trunc('week',now() at time zone 'Asia/Shanghai')::date,
 week_seconds integer not null default 0, week_races integer not null default 0,
 claimed text[] not null default '{}', liveries text[] not null default array['solid','stripes'],
 garage jsonb not null default '{"cars":{}}', last_tick timestamptz not null default now()
);
create table if not exists public.club_progress_receipts (
 player_id uuid references public.club_profiles(id) on delete cascade, batch text not null,
 created_at timestamptz not null default now(), primary key(player_id,batch)
);
alter table public.club_progress enable row level security;
alter table public.club_progress_receipts enable row level security;
revoke all on public.club_progress,public.club_progress_receipts from public,anon,authenticated;
alter table public.club_best_races add column if not exists customization jsonb not null default '{}';
create or replace view public.club_race_leaderboard with (security_invoker=true) as
select p.player_name,b.scene,b.assisted,b.rules_version,b.craft,b.time_ms,b.achieved_at,b.customization
from public.club_best_races b join public.club_profiles p on p.id=b.player_id;

create or replace function public.club_progression(p_token text,p_seconds integer default 0,p_batch text default null,p_claim text default null,p_garage jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; s public.club_progress; w date:=date_trunc('week',now() at time zone 'Asia/Shanghai')::date; earned integer; reward text; k text; c jsonb;
begin
 select player_id into aid from public.club_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if aid is null then raise exception 'Session expired. Sign in again'; end if;
 insert into public.club_progress(player_id) values(aid) on conflict do nothing;
 select * into s from public.club_progress where player_id=aid for update;
 if s.week<>w then s.week:=w;s.week_seconds:=0;s.week_races:=0;s.claimed:='{}';end if;
 if p_seconds is null or p_seconds<0 or p_seconds>60 then raise exception 'Invalid driving time'; end if;
 if p_seconds>0 then
  if p_batch is null or length(p_batch)>64 then raise exception 'Missing progress receipt'; end if;
  insert into public.club_progress_receipts(player_id,batch) values(aid,p_batch) on conflict do nothing;
  if found then
   earned:=least(p_seconds,greatest(0,floor(extract(epoch from now()-s.last_tick))::integer),60);
   s.total_seconds:=s.total_seconds+earned;s.week_seconds:=s.week_seconds+earned;s.last_tick:=now();
  end if;
 end if;
 if p_claim is not null and not(p_claim=any(s.claimed)) then
  reward:=case when p_claim='warmup' and s.week_seconds>=600 then 'ember'
   when p_claim='finisher' and s.week_races>=3 then 'circuit'
   when p_claim='cruiser' and s.week_seconds>=1800 then 'aurora'
   when p_claim='champion' and s.week_seconds>=3600 then 'champion' end;
  if reward is null then raise exception 'Task is not complete';end if;
  s.claimed:=array_append(s.claimed,p_claim);s.activity_points:=s.activity_points+case p_claim when 'warmup' then 20 when 'finisher' then 30 when 'cruiser' then 40 else 60 end;
  if not(reward=any(s.liveries)) then s.liveries:=array_append(s.liveries,reward);end if;
 end if;
 if p_garage is not null then
  if jsonb_typeof(p_garage) is distinct from 'object' or jsonb_typeof(p_garage->'cars') is distinct from 'object' or octet_length(p_garage::text)>8192 then raise exception 'Invalid garage'; end if;
  for k,c in select key,value from jsonb_each(p_garage->'cars') loop
   if k !~ '^[0-5]$' or jsonb_typeof(c)<>'object' or not(coalesce(c->>'livery','solid')=any(s.liveries)) then raise exception 'Livery is not unlocked'; end if;
  end loop;
  s.garage:=p_garage;
 end if;
 update public.club_progress set activity_points=s.activity_points,total_seconds=s.total_seconds,week=s.week,week_seconds=s.week_seconds,week_races=s.week_races,claimed=s.claimed,liveries=s.liveries,garage=s.garage,last_tick=s.last_tick where player_id=aid;
 delete from public.club_progress_receipts where player_id=aid and created_at<now()-interval '8 days';
 return to_jsonb(s)-'player_id'-'last_tick';
end $$;
revoke all on function public.club_progression(text,integer,text,text,jsonb) from public;
grant execute on function public.club_progression(text,integer,text,text,jsonb) to anon,authenticated;
create or replace function public.club_validate_race(
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

revoke all on function public.club_validate_race(text,text,boolean,integer,text,integer,jsonb) from public,anon,authenticated;
drop function public.submit_best_race(text,text,boolean,integer,text,integer,jsonb);
create function public.submit_best_race(p_token text,p_scene text,p_assisted boolean,p_craft integer,p_rules_version text,p_time_ms integer,p_laps jsonb,p_customization jsonb default '{}')
returns boolean language plpgsql security definer set search_path='' as $$
declare aid uuid; improved boolean; s jsonb; required_seconds integer; receipt text;
begin
 s:=public.club_progression(p_token);
 required_seconds:=case p_craft when 0 then 0 when 1 then 0 when 2 then 3600 when 3 then 1800 when 4 then 7200 when 5 then 900 else 2147483647 end;
 if (s->>'total_seconds')::bigint<required_seconds then raise exception 'Car is not unlocked';end if;
 if jsonb_typeof(p_customization)<>'object' or octet_length(p_customization::text)>1024 or not(coalesce(p_customization->>'livery','solid') in (select jsonb_array_elements_text(s->'liveries'))) then raise exception 'Livery is not unlocked';end if;
 improved:=public.club_validate_race(p_token,p_scene,p_assisted,p_craft,p_rules_version,p_time_ms,p_laps);
 select player_id into aid from public.club_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if improved then update public.club_best_races set customization=p_customization where player_id=aid and scene=p_scene and assisted=p_assisted and rules_version=p_rules_version;end if;
 receipt:='race:'||encode(extensions.digest(p_scene||p_craft::text||p_time_ms::text||p_laps::text,'sha256'),'hex');
 insert into public.club_progress_receipts(player_id,batch) values(aid,receipt) on conflict do nothing;
 if found then update public.club_progress set week_races=week_races+1 where player_id=aid;end if;
 return improved;
end $$;
revoke all on function public.submit_best_race(text,text,boolean,integer,text,integer,jsonb,jsonb) from public;
grant execute on function public.submit_best_race(text,text,boolean,integer,text,integer,jsonb,jsonb) to anon,authenticated;

commit;
