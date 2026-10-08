create table if not exists public.club_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null,
  name_key text generated always as (lower(player_name)) stored,
  created_at timestamptz not null default now(),
  constraint club_player_name_format check (player_name ~ '^[[:alnum:]_-]{3,16}$'),
  constraint club_player_name_unique unique (name_key)
);
create table if not exists public.club_best_laps (
  player_id uuid not null references public.club_profiles(id) on delete cascade,
  scene text not null check (scene in ('bay','citadel','harbor')),
  assisted boolean not null,
  rules_version text not null,
  craft integer not null check (craft between 0 and 5),
  time_ms integer not null check (time_ms between 15000 and 600000),
  splits_ms integer[] not null,
  achieved_at timestamptz not null default now(),
  primary key (player_id,scene,assisted,rules_version)
);
create index if not exists club_best_laps_rank on public.club_best_laps(scene,assisted,rules_version,time_ms,achieved_at);
alter table public.club_profiles enable row level security;
alter table public.club_best_laps enable row level security;
revoke all on public.club_profiles,public.club_best_laps from anon,authenticated;

create or replace function public.claim_player_name(requested_name text)
returns public.club_profiles language plpgsql security definer set search_path = '' as $$
declare result public.club_profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if requested_name !~ '^[[:alnum:]_-]{3,16}$' then raise exception 'Player name must be 3–16 letters, numbers, _ or -'; end if;
  insert into public.club_profiles(id,player_name) values(auth.uid(),requested_name)
  on conflict (id) do nothing returning * into result;
  if result.id is null then select * into result from public.club_profiles where id=auth.uid(); end if;
  return result;
exception when unique_violation then raise exception 'Player name is already taken';
end $$;

create or replace function public.submit_best_lap(
  p_scene text,p_assisted boolean,p_craft integer,p_rules_version text,
  p_time_ms integer,p_splits_ms integer[],p_samples jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare previous_ms integer; sample jsonb; last_t numeric := -1; t numeric; x numeric; z numeric; last_x numeric; last_z numeric; sample_count integer;
begin
  if auth.uid() is null or not exists(select 1 from public.club_profiles where id=auth.uid()) then raise exception 'Sign in and choose a player name first'; end if;
  if p_scene not in ('bay','citadel','harbor') or p_assisted is null or p_craft not between 0 and 5 or p_rules_version <> 'lap-v1' then raise exception 'Unsupported race rules'; end if;
  if p_time_ms not between 15000 and 600000 or array_length(p_splits_ms,1) <> 6 or p_splits_ms[6] > p_time_ms+100 then raise exception 'Invalid lap time'; end if;
  previous_ms:=0;
  for sample_count in 1..6 loop
    if p_splits_ms[sample_count] <= previous_ms or p_splits_ms[sample_count] > p_time_ms+100 then raise exception 'Invalid sector times'; end if;
    previous_ms:=p_splits_ms[sample_count];
  end loop;
  sample_count:=jsonb_array_length(p_samples);
  if sample_count < 100 or sample_count > 4000 then raise exception 'Invalid lap trace'; end if;
  for sample in select value from jsonb_array_elements(p_samples) loop
    if jsonb_typeof(sample) <> 'array' or jsonb_array_length(sample) <> 5 then raise exception 'Invalid lap trace'; end if;
    t:=(sample->>0)::numeric;x:=(sample->>1)::numeric;z:=(sample->>3)::numeric;
    if t <= last_t or t > p_time_ms/1000.0+0.2 or abs(x)>10000 or abs(z)>10000 then raise exception 'Invalid lap trace'; end if;
    if last_t >= 0 and (x-last_x)^2+(z-last_z)^2 > (900*(t-last_t)+30)^2 then raise exception 'Impossible lap movement'; end if;
    last_t:=t;last_x:=x;last_z:=z;
  end loop;
  if last_t < p_time_ms/1000.0-0.5 then raise exception 'Incomplete lap trace'; end if;
  insert into public.club_best_laps(player_id,scene,assisted,rules_version,craft,time_ms,splits_ms)
  values(auth.uid(),p_scene,p_assisted,p_rules_version,p_craft,p_time_ms,p_splits_ms)
  on conflict (player_id,scene,assisted,rules_version) do update
  set craft=excluded.craft,time_ms=excluded.time_ms,splits_ms=excluded.splits_ms,achieved_at=now()
  where public.club_best_laps.time_ms > excluded.time_ms;
  return found;
end $$;

create or replace view public.club_leaderboard with (security_invoker=true) as
select p.player_name,b.scene,b.assisted,b.rules_version,b.craft,b.time_ms,b.achieved_at
from public.club_best_laps b join public.club_profiles p on p.id=b.player_id;
create policy club_profiles_read on public.club_profiles for select to anon,authenticated using (true);
create policy club_laps_read on public.club_best_laps for select to anon,authenticated using (true);
grant select on public.club_profiles,public.club_best_laps,public.club_leaderboard to anon,authenticated;
revoke all on function public.claim_player_name(text) from public,anon;
revoke all on function public.submit_best_lap(text,boolean,integer,text,integer,integer[],jsonb) from public,anon;
grant execute on function public.claim_player_name(text),public.submit_best_lap(text,boolean,integer,text,integer,integer[],jsonb) to authenticated;
