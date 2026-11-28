-- RpAdmin — Dev By Royalputo
-- Adds the "Start all" / "Stop all" resource commands (owner-only).

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
    when p_action = 'resources_all_start' then 'resource.start'
    when p_action = 'resources_all_stop' then 'resource.stop'
    when p_action = 'server' then 'server.settings'
    when p_action = 'shutdown' then 'server.shutdown'
    when p_action = 'acl_toggle_right' then 'acl.manage'
    when p_action in ('acl_add_object', 'acl_remove_object') then 'acl.manage'
    when p_action in ('bodycam_start', 'bodycam_stop') then 'bodycam'
    else null
  end
$$;
