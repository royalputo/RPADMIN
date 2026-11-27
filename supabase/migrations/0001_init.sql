-- RpAdmin — Dev By Royalputo
-- Single-file backend: schema, RLS, RPCs and Realtime.
-- No service-role key or Edge Functions required.
--
-- Agent authentication = X-Server-Key header matched against servers.key_hash.
-- Panel mutations are validated by triggers + RLS, not by a trusted server.

-- Supabase installs pgcrypto in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------
-- servers
-- ---------------------------------------------------------------
create sequence if not exists servers_short_id_seq start 1;

create table if not exists servers (
  id uuid primary key default gen_random_uuid(),
  short_id int not null unique default nextval('servers_short_id_seq'),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text unique,
  key_hash text not null,
  key_hint text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- agent-writable live state
-- ---------------------------------------------------------------
create table if not exists server_state (
  server_id uuid primary key references servers(id) on delete cascade,
  last_seen timestamptz,
  snapshot jsonb not null default '{}'::jsonb,
  version text,
  gamemode text,
  maxplayers int,
  port int,
  player_count int not null default 0
);

create table if not exists server_members (
  server_id uuid not null references servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator', 'viewer')),
  mta_account text,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table if not exists server_invites (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references servers(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'moderator', 'viewer')),
  mta_account text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists server_invites_email_idx on server_invites (server_id, lower(email));

create table if not exists commands (
  id bigserial primary key,
  server_id uuid not null references servers(id) on delete cascade,
  action text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'expired')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  executed_at timestamptz,
  result jsonb,
  error text
);

create table if not exists activity (
  id bigserial primary key,
  server_id uuid not null references servers(id) on delete cascade,
  kind text,
  actor text,
  text text,
  created_at timestamptz not null default now()
);

create table if not exists warnings (
  id bigserial primary key,
  server_id uuid not null references servers(id) on delete cascade,
  player_name text,
  player_serial text,
  reason text,
  issued_by uuid references auth.users(id) on delete set null,
  issued_by_name text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);

create table if not exists notes (
  id bigserial primary key,
  server_id uuid not null references servers(id) on delete cascade,
  player_name text,
  player_serial text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists audit (
  id bigserial primary key,
  server_id uuid not null references servers(id) on delete cascade,
  actor_user uuid references auth.users(id) on delete set null,
  actor_name text,
  action text,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commands_server_status_idx on commands (server_id, status, id);
create index if not exists activity_server_idx on activity (server_id, id desc);
create index if not exists warnings_server_idx on warnings (server_id, id desc);
create index if not exists notes_server_idx on notes (server_id, id desc);
create index if not exists audit_server_idx on audit (server_id, id desc);
create index if not exists server_members_user_idx on server_members (user_id);
create index if not exists servers_key_hash_idx on servers (key_hash);

-- ---------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------
create or replace function member_role(p_server uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from server_members
  where server_id = p_server and user_id = auth.uid()
  limit 1
$$;

create or replace function is_member(p_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select member_role(p_server) is not null $$;

create or replace function headers_json()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb
$$;

-- Server id whose key_hash matches the X-Server-Key request header.
create or replace function agent_server_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from servers s, headers_json() h
  where nullif(h->>'x-server-key', '') is not null
    and s.key_hash = encode(extensions.digest(h->>'x-server-key', 'sha256'), 'hex')
  limit 1
$$;

create or replace function is_agent(p_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select agent_server_id() = p_server $$;

create or replace function has_perm(p_server uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case member_role(p_server)
    when 'owner' then true
    when 'admin' then p_action in (
      'read', 'warn', 'note', 'mute', 'freeze', 'kick', 'say', 'ban', 'unban',
      'resource.restart', 'warning.revoke'
    )
    when 'moderator' then p_action in ('read', 'warn', 'note', 'mute', 'freeze', 'kick')
    when 'viewer' then p_action = 'read'
    else false
  end
$$;

create or replace function command_permission(p_action text, p_args jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_action = 'say' then 'say'
    when p_action = 'kick' then 'kick'
    when p_action = 'ban' then 'ban'
    when p_action = 'unban' then 'unban'
    when p_action in ('mute', 'unmute') then 'mute'
    when p_action in ('freeze', 'unfreeze') then 'freeze'
    when p_action = 'warn' then 'warn'
    when p_action = 'note' then 'note'
    when p_action = 'resource' then case p_args->>'op'
      when 'start' then 'resource.start'
      when 'stop' then 'resource.stop'
      when 'restart' then 'resource.restart'
      else null
    end
    when p_action = 'server' then 'server.settings'
    when p_action = 'shutdown' then 'server.shutdown'
    else null
  end
$$;

create or replace function command_arg_error(p_action text, p_args jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_player text := coalesce(p_args->>'player', '');
  v_reason text := coalesce(p_args->>'reason', '');
  v_seconds numeric;
begin
  if p_args is null or jsonb_typeof(p_args) <> 'object' then
    return 'args must be an object';
  end if;

  if p_action in ('kick', 'ban', 'mute', 'unmute', 'freeze', 'unfreeze', 'warn', 'note') then
    if char_length(v_player) < 1 or char_length(v_player) > 64 then
      return 'player name must be 1-64 characters';
    end if;
  end if;

  if p_action in ('kick', 'ban') then
    if char_length(v_reason) > 160 then return 'reason must be 160 characters or fewer'; end if;
  end if;

  if p_action = 'ban' then
    v_seconds := coalesce((p_args->>'seconds')::numeric, 0);
    if v_seconds < 0 or v_seconds > 31536000 then return 'invalid ban duration'; end if;
  end if;

  if p_action = 'unban' then
    if coalesce(p_args->>'ip', '') = '' and coalesce(p_args->>'serial', '') = '' then
      return 'ip or serial is required';
    end if;
  end if;

  if p_action = 'say' then
    if char_length(coalesce(p_args->>'message', '')) < 1 then return 'message is empty'; end if;
    if char_length(p_args->>'message') > 200 then return 'message must be 200 characters or fewer'; end if;
  end if;

  if p_action = 'warn' then
    if char_length(v_reason) < 1 then return 'reason is required'; end if;
    if char_length(v_reason) > 300 then return 'reason must be 300 characters or fewer'; end if;
  end if;

  if p_action = 'note' then
    if char_length(coalesce(p_args->>'note', '')) < 1 then return 'note is required'; end if;
    if char_length(p_args->>'note') > 500 then return 'note must be 500 characters or fewer'; end if;
  end if;

  if p_action = 'resource' then
    if char_length(coalesce(p_args->>'resource', '')) < 1 then return 'resource is required'; end if;
    if coalesce(p_args->>'op', '') not in ('start', 'stop', 'restart') then return 'invalid resource operation'; end if;
  end if;

  if p_action = 'server' then
    if char_length(coalesce(p_args->>'name', '')) < 3 or char_length(p_args->>'name') > 60 then
      return 'server name must be 3-60 characters';
    end if;
    if coalesce((p_args->>'maxPlayers')::int, 0) < 1 or (p_args->>'maxPlayers')::int > 1000 then
      return 'max players must be 1-1000';
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table profiles enable row level security;
alter table servers enable row level security;
alter table server_state enable row level security;
alter table server_members enable row level security;
alter table server_invites enable row level security;
alter table commands enable row level security;
alter table activity enable row level security;
alter table warnings enable row level security;
alter table notes enable row level security;
alter table audit enable row level security;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists servers_select on servers;
create policy servers_select on servers for select to authenticated
  using (is_member(id));
drop policy if exists server_state_select on server_state;
create policy server_state_select on server_state for select to authenticated using (is_member(server_id));
drop policy if exists server_state_agent on server_state;
create policy server_state_agent on server_state for all to anon, authenticated
  using (is_agent(server_id)) with check (is_agent(server_id));

drop policy if exists server_members_select on server_members;
create policy server_members_select on server_members for select to authenticated using (is_member(server_id));

drop policy if exists server_invites_select on server_invites;
create policy server_invites_select on server_invites for select to authenticated
  using (member_role(server_id) = 'owner');

drop policy if exists commands_select on commands;
create policy commands_select on commands for select to authenticated
  using (is_member(server_id));
drop policy if exists commands_agent_select on commands;
create policy commands_agent_select on commands for select to anon
  using (is_agent(server_id));
drop policy if exists commands_member_insert on commands;
create policy commands_member_insert on commands for insert to authenticated
  with check (is_member(server_id) and has_perm(server_id, command_permission(action, args)));
drop policy if exists commands_agent_update on commands;
create policy commands_agent_update on commands for update to anon
  using (is_agent(server_id)) with check (is_agent(server_id));

drop policy if exists activity_select on activity;
create policy activity_select on activity for select to authenticated using (is_member(server_id));
drop policy if exists activity_agent_insert on activity;
create policy activity_agent_insert on activity for insert to anon with check (is_agent(server_id));

drop policy if exists warnings_select on warnings;
create policy warnings_select on warnings for select to authenticated using (is_member(server_id));
drop policy if exists warnings_member_insert on warnings;
create policy warnings_member_insert on warnings for insert to authenticated
  with check (is_member(server_id) and has_perm(server_id, 'warn'));
drop policy if exists warnings_member_update on warnings;
create policy warnings_member_update on warnings for update to authenticated
  using (is_member(server_id) and has_perm(server_id, 'warning.revoke'))
  with check (is_member(server_id) and has_perm(server_id, 'warning.revoke'));

drop policy if exists notes_select on notes;
create policy notes_select on notes for select to authenticated using (is_member(server_id));
drop policy if exists notes_member_insert on notes;
create policy notes_member_insert on notes for insert to authenticated
  with check (is_member(server_id) and has_perm(server_id, 'note'));

drop policy if exists audit_select on audit;
create policy audit_select on audit for select to authenticated using (is_member(server_id));

-- Table privileges for this project's tables only (RLS is the boundary).
grant usage on schema public to anon, authenticated;

grant select on profiles to authenticated;
grant update (display_name) on profiles to authenticated;

grant select, insert, update, delete on servers to authenticated;
grant select, insert, update, delete on server_state to authenticated;
grant select, insert, update, delete on server_members to authenticated;
grant select on server_invites to authenticated;
grant select, insert, update, delete on commands to authenticated;
grant select, insert, update, delete on activity to authenticated;
grant select, insert, update, delete on warnings to authenticated;
grant select, insert, update, delete on notes to authenticated;
grant select, insert, update, delete on audit to authenticated;

-- Anon may SELECT servers only for the schema probe; RLS returns zero rows.
grant select on servers to anon;
grant select, insert, update, delete on server_state to anon;
grant select, update on commands to anon;
grant insert on activity to anon;

grant usage, select on sequence servers_short_id_seq to anon, authenticated;
grant usage, select on sequence commands_id_seq to anon, authenticated;
grant usage, select on sequence activity_id_seq to anon, authenticated;
grant usage, select on sequence warnings_id_seq to anon, authenticated;
grant usage, select on sequence notes_id_seq to anon, authenticated;
grant usage, select on sequence audit_id_seq to anon, authenticated;

-- ---------------------------------------------------------------
-- write guards
-- ---------------------------------------------------------------
create or replace function commands_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perm text;
  v_error text;
  v_name text;
begin
  if agent_server_id() is not null then
    raise exception 'the agent may not insert commands';
  end if;
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.created_by := auth.uid();
  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_name from profiles where id = auth.uid();
  new.created_by_name := coalesce(v_name, 'staff');
  new.status := 'pending';
  new.created_at := now();
  new.expires_at := now() + interval '5 minutes';
  new.executed_at := null;
  new.result := null;
  new.error := null;

  v_perm := command_permission(new.action, new.args);
  if v_perm is null then
    raise exception 'unknown action: %', new.action;
  end if;
  if not has_perm(new.server_id, v_perm) then
    raise exception 'permission denied for action: %', new.action;
  end if;
  v_error := command_arg_error(new.action, new.args);
  if v_error is not null then
    raise exception '%', v_error;
  end if;

  return new;
end;
$$;

drop trigger if exists commands_before_insert on commands;
create trigger commands_before_insert
  before insert on commands
  for each row execute function commands_before_insert();

create or replace function commands_agent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_agent(old.server_id) then
    if new.server_id is distinct from old.server_id
       or new.action is distinct from old.action
       or new.args is distinct from old.args
       or new.created_by is distinct from old.created_by
       or new.created_by_name is distinct from old.created_by_name
       or new.created_at is distinct from old.created_at
       or new.expires_at is distinct from old.expires_at then
      raise exception 'agent may only update status, result, error and executed_at';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists commands_agent_guard on commands;
create trigger commands_agent_guard
  before update on commands
  for each row execute function commands_agent_guard();

create or replace function commands_after_insert_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (
    new.server_id,
    new.created_by,
    new.created_by_name,
    new.action,
    coalesce(new.args->>'player', new.args->>'resource', new.args->>'name', new.args->>'ip', ''),
    new.args
  );
  return new;
end;
$$;

drop trigger if exists commands_after_insert_audit on commands;
create trigger commands_after_insert_audit
  after insert on commands
  for each row execute function commands_after_insert_audit();

create or replace function warnings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if agent_server_id() is not null then raise exception 'the agent may not insert warnings'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not has_perm(new.server_id, 'warn') then raise exception 'permission denied'; end if;
  if char_length(coalesce(new.player_name, '')) < 1 or char_length(new.player_name) > 64 then
    raise exception 'invalid player name';
  end if;
  if char_length(coalesce(new.reason, '')) < 1 or char_length(new.reason) > 300 then
    raise exception 'invalid reason';
  end if;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_name from profiles where id = auth.uid();

  new.issued_by := auth.uid();
  new.issued_by_name := coalesce(v_name, 'staff');
  new.created_at := now();
  new.revoked_at := null;
  new.revoked_by := null;
  return new;
end;
$$;

drop trigger if exists warnings_before_insert on warnings;
create trigger warnings_before_insert
  before insert on warnings
  for each row execute function warnings_before_insert();

create or replace function warnings_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if agent_server_id() is not null then raise exception 'the agent may not update warnings'; end if;
  if old.revoked_at is not null then
    raise exception 'warning is already revoked';
  end if;
  if new.player_name is distinct from old.player_name
     or new.player_serial is distinct from old.player_serial
     or new.reason is distinct from old.reason
     or new.issued_by is distinct from old.issued_by
     or new.created_at is distinct from old.created_at then
    raise exception 'only revocation fields may be updated';
  end if;
  if new.revoked_at is null then raise exception 'revoked_at is required'; end if;
  new.revoked_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists warnings_guard_update on warnings;
create trigger warnings_guard_update
  before update on warnings
  for each row execute function warnings_guard_update();

create or replace function notes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if agent_server_id() is not null then raise exception 'the agent may not insert notes'; end if;
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not has_perm(new.server_id, 'note') then raise exception 'permission denied'; end if;
  if char_length(coalesce(new.player_name, '')) < 1 or char_length(new.player_name) > 64 then
    raise exception 'invalid player name';
  end if;
  if char_length(coalesce(new.note, '')) < 1 or char_length(new.note) > 500 then
    raise exception 'invalid note';
  end if;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_name from profiles where id = auth.uid();

  new.created_by := auth.uid();
  new.created_by_name := coalesce(v_name, 'staff');
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists notes_before_insert on notes;
create trigger notes_before_insert
  before insert on notes
  for each row execute function notes_before_insert();

-- ---------------------------------------------------------------
-- RPCs (the only way to create/rotate servers and manage staff)
-- ---------------------------------------------------------------
create or replace function create_server(p_name text, p_key_hash text, p_key_hint text)
returns servers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_server servers;
  v_email text;
  v_name text;
  v_display text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 or char_length(trim(p_name)) > 60 then
    raise exception 'server name must be 3-60 characters';
  end if;
  if coalesce(p_key_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid key hash';
  end if;

  insert into servers (name, owner_id, key_hash, key_hint)
  values (trim(p_name), v_uid, p_key_hash, p_key_hint)
  returning * into v_server;

  insert into server_state (server_id) values (v_server.id);

  select email, coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_email, v_display
  from profiles where id = v_uid;

  insert into server_members (server_id, user_id, role, email, display_name)
  values (v_server.id, v_uid, 'owner', v_email, coalesce(v_display, 'owner'));

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (v_server.id, v_uid, coalesce(v_display, 'owner'), 'server.create', v_server.name,
          jsonb_build_object('shortId', v_server.short_id));

  return v_server;
end;
$$;

create or replace function rotate_server_key(p_server uuid, p_key_hash text, p_key_hint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_display text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if member_role(p_server) <> 'owner' then raise exception 'owner only'; end if;
  if coalesce(p_key_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'invalid key hash'; end if;

  update servers set key_hash = p_key_hash, key_hint = p_key_hint where id = p_server;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_display from profiles where id = v_uid;

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (p_server, v_uid, coalesce(v_display, 'owner'), 'key.rotate', null,
          jsonb_build_object('keyHint', p_key_hint));
end;
$$;

-- Owner-only: add an existing account immediately, or create a pending invite.
create or replace function invite_server_member(p_server uuid, p_email text, p_role text, p_mta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target profiles;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_display text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if member_role(p_server) <> 'owner' then raise exception 'owner only'; end if;
  if p_role not in ('admin', 'moderator', 'viewer') then
    raise exception 'role must be admin, moderator or viewer';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_display from profiles where id = v_uid;

  select * into v_target from profiles where lower(email) = v_email;

  if v_target.id is not null then
    if exists (select 1 from server_members where server_id = p_server and user_id = v_target.id) then
      raise exception 'that account is already a member';
    end if;

    insert into server_members (server_id, user_id, role, mta_account, email, display_name)
    values (p_server, v_target.id, p_role, nullif(trim(coalesce(p_mta, '')), ''),
            v_target.email, coalesce(v_target.display_name, split_part(v_target.email, '@', 1)));

    insert into audit (server_id, actor_user, actor_name, action, target, detail)
    values (p_server, v_uid, coalesce(v_display, 'owner'), 'staff.add', v_email,
            jsonb_build_object('role', p_role, 'mtaAccount', p_mta));

    return jsonb_build_object('status', 'added');
  end if;

  insert into server_invites (server_id, email, role, mta_account, invited_by)
  values (p_server, v_email, p_role, nullif(trim(coalesce(p_mta, '')), ''), v_uid)
  on conflict (server_id, (lower(email))) do update
    set role = excluded.role,
        mta_account = excluded.mta_account,
        invited_by = excluded.invited_by,
        created_at = now();

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (p_server, v_uid, coalesce(v_display, 'owner'), 'staff.invite', v_email,
          jsonb_build_object('role', p_role, 'mtaAccount', p_mta));

  return jsonb_build_object('status', 'invited');
end;
$$;

create or replace function revoke_server_invite(p_server uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target server_invites;
  v_display text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if member_role(p_server) <> 'owner' then raise exception 'owner only'; end if;

  select * into v_target from server_invites where id = p_id and server_id = p_server;
  if v_target.id is null then raise exception 'invite not found'; end if;

  delete from server_invites where id = p_id and server_id = p_server;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_display from profiles where id = v_uid;

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (p_server, v_uid, coalesce(v_display, 'owner'), 'staff.invite_revoke', v_target.email, '{}'::jsonb);
end;
$$;

create or replace function remove_server_member(p_server uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target server_members;
  v_display text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if member_role(p_server) <> 'owner' then raise exception 'owner only'; end if;

  select * into v_target from server_members where server_id = p_server and user_id = p_user;
  if v_target.user_id is null then raise exception 'member not found'; end if;
  if v_target.role = 'owner' then raise exception 'the owner cannot be removed'; end if;

  delete from server_members where server_id = p_server and user_id = p_user;

  select coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_display from profiles where id = v_uid;

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (p_server, v_uid, coalesce(v_display, 'owner'), 'staff.remove', v_target.email,
          jsonb_build_object('removedUserId', p_user));
end;
$$;

-- Invitee inbox: only the matching email can list/accept/decline its invites.
create or replace function my_server_invites()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'server_id', s.id,
        'short_id', s.short_id,
        'server_name', s.name,
        'role', i.role,
        'mta_account', i.mta_account,
        'created_at', i.created_at
      ) order by i.created_at desc
    ),
    '[]'::jsonb
  )
  from server_invites i
  join servers s on s.id = i.server_id
  where lower(i.email) = lower(coalesce(auth.jwt()->>'email', ''))
$$;

create or replace function accept_server_invite(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_invite server_invites;
  v_profile profiles;
  v_short int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_invite from server_invites where id = p_id and lower(email) = v_email;
  if v_invite.id is null then raise exception 'invite not found'; end if;

  select * into v_profile from profiles where id = v_uid;

  insert into server_members (server_id, user_id, role, mta_account, email, display_name)
  values (
    v_invite.server_id, v_uid, v_invite.role, v_invite.mta_account,
    coalesce(v_profile.email, v_email),
    coalesce(v_profile.display_name, split_part(coalesce(v_profile.email, v_email), '@', 1))
  )
  on conflict (server_id, user_id) do nothing;

  delete from server_invites where id = p_id;
  select short_id into v_short from servers where id = v_invite.server_id;

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (v_invite.server_id, v_uid, coalesce(v_profile.display_name, 'member'),
          'staff.accept_invite', v_email, jsonb_build_object('role', v_invite.role));

  return jsonb_build_object(
    'server_id', v_invite.server_id,
    'short_id', v_short,
    'role', v_invite.role
  );
end;
$$;

create or replace function decline_server_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from server_invites where id = p_id and lower(email) = v_email;
  if not found then raise exception 'invite not found'; end if;
end;
$$;

revoke all on function my_server_invites() from public;
revoke all on function accept_server_invite(uuid) from public;
revoke all on function decline_server_invite(uuid) from public;

grant execute on function my_server_invites() to authenticated;
grant execute on function accept_server_invite(uuid) to authenticated;
grant execute on function decline_server_invite(uuid) to authenticated;

revoke all on function create_server(text, text, text) from public;
revoke all on function rotate_server_key(uuid, text, text) from public;
revoke all on function invite_server_member(uuid, text, text, text) from public;
revoke all on function revoke_server_invite(uuid, uuid) from public;
revoke all on function remove_server_member(uuid, uuid) from public;

grant execute on function create_server(text, text, text) to authenticated;
grant execute on function rotate_server_key(uuid, text, text) to authenticated;
grant execute on function invite_server_member(uuid, text, text, text) to authenticated;
grant execute on function revoke_server_invite(uuid, uuid) to authenticated;
grant execute on function remove_server_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table server_state;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table activity;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table commands;
exception when duplicate_object then null;
end $$;
