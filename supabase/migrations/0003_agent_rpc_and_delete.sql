-- RpAdmin — Dev By Royalputo
-- Run after 0001/0002.
-- 1) Agent writes go through POST RPCs (works on MTA builds that cannot PATCH).
-- 2) Owners can delete a server.

create or replace function agent_update_command(
  p_server uuid,
  p_id bigint,
  p_status text,
  p_result jsonb default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := agent_server_id();
begin
  if v_agent is null or v_agent <> p_server then
    raise exception 'forbidden';
  end if;
  if p_status not in ('done', 'failed', 'expired') then
    raise exception 'invalid status';
  end if;

  update commands
     set status = p_status,
         result = p_result,
         error = p_error,
         executed_at = now()
   where id = p_id
     and server_id = p_server
     and status = 'pending';
end;
$$;

create or replace function agent_update_state(
  p_server uuid,
  p_last_seen timestamptz,
  p_snapshot jsonb,
  p_version text default null,
  p_gamemode text default null,
  p_maxplayers int default null,
  p_port int default null,
  p_player_count int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent uuid := agent_server_id();
begin
  if v_agent is null or v_agent <> p_server then
    raise exception 'forbidden';
  end if;

  insert into server_state (
    server_id, last_seen, snapshot, version, gamemode, maxplayers, port, player_count
  )
  values (
    p_server,
    coalesce(p_last_seen, now()),
    coalesce(p_snapshot, '{}'::jsonb),
    p_version,
    p_gamemode,
    p_maxplayers,
    p_port,
    coalesce(p_player_count, 0)
  )
  on conflict (server_id) do update
    set last_seen = excluded.last_seen,
        snapshot = excluded.snapshot,
        version = excluded.version,
        gamemode = excluded.gamemode,
        maxplayers = excluded.maxplayers,
        port = excluded.port,
        player_count = excluded.player_count;
end;
$$;

create or replace function delete_server(p_server uuid)
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

  delete from servers where id = p_server;
end;
$$;

revoke all on function agent_update_command(uuid, bigint, text, jsonb, text) from public;
revoke all on function agent_update_state(uuid, timestamptz, jsonb, text, text, integer, integer, integer) from public;
revoke all on function delete_server(uuid) from public;

grant execute on function agent_update_command(uuid, bigint, text, jsonb, text) to anon;
grant execute on function agent_update_state(uuid, timestamptz, jsonb, text, text, integer, integer, integer) to anon;
grant execute on function delete_server(uuid) to authenticated;
