-- RpAdmin — Dev By Royalputo
-- Prevent expired pending commands from blocking new ones.
-- Run after 0001–0005.

-- One-time backlog cleanup
update commands
   set status = 'expired',
       error = 'Backlog cleanup: expired before the agent could process it'
 where status = 'pending'
   and expires_at < now();

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

  -- A new command supersedes anything already expired for this server.
  update commands
     set status = 'expired',
         error = 'Expired before a newer command was queued'
   where server_id = new.server_id
     and status = 'pending'
     and expires_at < now();

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
