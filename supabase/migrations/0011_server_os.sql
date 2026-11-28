-- RpAdmin — Dev By Royalputo
-- Servers remember their operating system (windows / linux) so the panel can
-- hand out the correct logFile path in the connector snippet.

alter table servers add column if not exists os text;

create or replace function create_server(p_name text, p_key_hash text, p_key_hint text, p_os text default null)
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
  if p_os is not null and p_os not in ('windows', 'linux') then
    raise exception 'os must be windows or linux';
  end if;

  insert into servers (name, owner_id, key_hash, key_hint, os)
  values (trim(p_name), v_uid, p_key_hash, p_key_hint, p_os)
  returning * into v_server;

  insert into server_state (server_id) values (v_server.id);

  select email, coalesce(display_name, split_part(coalesce(email, 'staff'), '@', 1))
    into v_email, v_display
  from profiles where id = v_uid;

  insert into server_members (server_id, user_id, role, email, display_name)
  values (v_server.id, v_uid, 'owner', v_email, coalesce(v_display, 'owner'));

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (v_server.id, v_uid, coalesce(v_display, 'owner'), 'server.create', v_server.name,
          jsonb_build_object('shortId', v_server.short_id, 'os', p_os));

  return v_server;
end;
$$;

-- Owner can correct the OS later (Settings tab).
create or replace function set_server_os(p_server uuid, p_os text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if member_role(p_server) <> 'owner' then raise exception 'owner only'; end if;
  if p_os not in ('windows', 'linux') then
    raise exception 'os must be windows or linux';
  end if;

  update servers set os = p_os where id = p_server;

  insert into audit (server_id, actor_user, actor_name, action, target, detail)
  values (p_server, v_uid, coalesce((select display_name from profiles where id = v_uid), 'owner'),
          'server.os', (select name from servers where id = p_server), jsonb_build_object('os', p_os));
end;
$$;

revoke all on function create_server(text, text, text) from public, authenticated;
revoke all on function create_server(text, text, text, text) from public;
revoke all on function set_server_os(uuid, text) from public;

grant execute on function create_server(text, text, text, text) to authenticated;
grant execute on function set_server_os(uuid, text) to authenticated;
