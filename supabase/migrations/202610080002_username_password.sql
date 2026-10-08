-- Simple player-name/password accounts. Passwords and session tokens are never stored in plaintext.
create extension if not exists pgcrypto with schema extensions;
alter table public.club_profiles drop constraint if exists club_profiles_id_fkey;
alter table public.club_profiles alter column id set default gen_random_uuid();

create table public.club_credentials (
  player_id uuid primary key references public.club_profiles(id) on delete cascade,
  password_hash text not null
);
create table public.club_sessions (
  token_hash text primary key,
  player_id uuid not null references public.club_profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index club_sessions_player on public.club_sessions(player_id);
create table public.club_auth_attempts (
  name_key text primary key,
  failures integer not null default 0,
  started_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.club_credentials enable row level security;
alter table public.club_sessions enable row level security;
alter table public.club_auth_attempts enable row level security;
revoke all on public.club_credentials,public.club_sessions,public.club_auth_attempts from public,anon,authenticated;
revoke all on public.club_profiles from anon,authenticated;
grant select (id,player_name,name_key) on public.club_profiles to anon,authenticated;

create or replace function public.club_register(p_name text,p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid; raw_token text;
begin
  if p_name !~ '^[A-Za-z0-9_-]{3,16}$' then raise exception 'Player name must be 3–16 letters, numbers, _ or -'; end if;
  if p_password is null or length(p_password) < 8 or octet_length(p_password) > 72 then raise exception 'Password must be at least 8 characters and at most 72 bytes'; end if;
  insert into public.club_profiles(player_name) values(p_name) returning id into account_id;
  insert into public.club_credentials(player_id,password_hash)
  values(account_id,extensions.crypt(p_password,extensions.gen_salt('bf',12)));
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.club_sessions(token_hash,player_id,expires_at)
  values(encode(extensions.digest(raw_token,'sha256'),'hex'),account_id,now()+interval '30 days');
  return jsonb_build_object('token',raw_token,'player_name',p_name);
exception when unique_violation then raise exception 'Player name is already taken';
end $$;

create or replace function public.club_login(p_name text,p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account record; attempt record; raw_token text; key text;
begin
  key:=lower(coalesce(p_name,''));
  if key !~ '^[a-z0-9_-]{3,16}$' or p_password is null or octet_length(p_password) > 72 then
    return jsonb_build_object('error','Invalid player name or password');
  end if;
  select * into attempt from public.club_auth_attempts where name_key=key for update;
  if attempt.locked_until>now() then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.'); end if;
  select p.id,p.player_name,c.password_hash into account from public.club_profiles p
  join public.club_credentials c on c.player_id=p.id where p.name_key=key;
  if account.id is null or p_password is null or extensions.crypt(p_password,account.password_hash)<>account.password_hash then
    insert into public.club_auth_attempts(name_key,failures,started_at,locked_until)
    values(key,1,now(),null)
    on conflict (name_key) do update set
      failures=case when public.club_auth_attempts.started_at<now()-interval '15 minutes' then 1 else public.club_auth_attempts.failures+1 end,
      started_at=case when public.club_auth_attempts.started_at<now()-interval '15 minutes' then now() else public.club_auth_attempts.started_at end,
      locked_until=case when public.club_auth_attempts.started_at<now()-interval '15 minutes' then null
        when public.club_auth_attempts.failures+1>=5 then now()+interval '15 minutes' else null end;
    return jsonb_build_object('error','Invalid player name or password');
  end if;
  delete from public.club_auth_attempts where name_key=key;
  raw_token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.club_sessions(token_hash,player_id,expires_at)
  values(encode(extensions.digest(raw_token,'sha256'),'hex'),account.id,now()+interval '30 days');
  return jsonb_build_object('token',raw_token,'player_name',account.player_name);
end $$;

create or replace function public.club_me(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile record;
begin
  if p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select p.id,p.player_name into profile from public.club_sessions s
  join public.club_profiles p on p.id=s.player_id
  where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now();
  if profile.id is null then return null; end if;
  return jsonb_build_object('player_name',profile.player_name);
end $$;

create or replace function public.club_logout(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_token ~ '^[0-9a-f]{64}$' then
    delete from public.club_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  end if;
end $$;

drop function public.submit_best_lap(text,boolean,integer,text,integer,integer[],jsonb);
drop function public.claim_player_name(text);
create or replace function public.submit_best_lap(
  p_token text,p_scene text,p_assisted boolean,p_craft integer,p_rules_version text,
  p_time_ms integer,p_splits_ms integer[],p_samples jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare account_id uuid; previous_ms integer; sample jsonb; last_t numeric := -1; t numeric; x numeric; z numeric; last_x numeric; last_z numeric; sample_count integer;
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Sign in first'; end if;
  select player_id into account_id from public.club_sessions
  where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
  if account_id is null then raise exception 'Session expired. Sign in again'; end if;
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
  values(account_id,p_scene,p_assisted,p_rules_version,p_craft,p_time_ms,p_splits_ms)
  on conflict (player_id,scene,assisted,rules_version) do update
  set craft=excluded.craft,time_ms=excluded.time_ms,splits_ms=excluded.splits_ms,achieved_at=now()
  where public.club_best_laps.time_ms > excluded.time_ms;
  return found;
end $$;

revoke all on function public.club_register(text,text),public.club_login(text,text),public.club_me(text),public.club_logout(text),public.submit_best_lap(text,text,boolean,integer,text,integer,integer[],jsonb) from public;
grant execute on function public.club_register(text,text),public.club_login(text,text),public.club_me(text),public.club_logout(text),public.submit_best_lap(text,text,boolean,integer,text,integer,integer[],jsonb) to anon,authenticated;
