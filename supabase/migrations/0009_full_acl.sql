-- RpAdmin — Dev By Royalputo
-- Full ACL manager: allows the panel to manage every ACL group / ACL / right
-- (owner-only), not just the RpAdmin group. Replaces command_permission and
-- command_arg_error with the complete action set.

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
    when p_action = 'resources_refresh' then 'server.settings'
    when p_action = 'snapshot_now' then 'read'
    when p_action = 'server' then 'server.settings'
    when p_action = 'shutdown' then 'server.shutdown'
    when p_action in (
      'acl_toggle_right',
      'acl_add_object',
      'acl_remove_object',
      'acl_create_group',
      'acl_destroy_group',
      'acl_create_acl',
      'acl_delete_acl',
      'acl_group_add_acl',
      'acl_group_remove_acl'
    ) then 'acl.manage'
    when p_action in ('bodycam_start', 'bodycam_stop') then 'bodycam'
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

  -- -------- ACL --------
  if p_action = 'acl_toggle_right' then
    if coalesce(p_args->>'right', '') !~ '^(function|general|command|resource)\.[A-Za-z0-9_.-]+$' then
      return 'invalid ACL right name';
    end if;
    if coalesce(jsonb_typeof(p_args->'enabled'), '') <> 'boolean' then
      return 'enabled must be a boolean';
    end if;
    if coalesce(p_args->>'acl', '') <> '' and coalesce(p_args->>'acl', '') !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$' then
      return 'invalid ACL name';
    end if;
  end if;

  if p_action in ('acl_add_object', 'acl_remove_object') then
    if coalesce(p_args->>'object', '') !~ '^(user|resource|map|group)\.[A-Za-z0-9_.-]+$' then
      return 'invalid ACL object (user.name / resource.name / map.name / group.name)';
    end if;
    if coalesce(p_args->>'group', '') <> '' and coalesce(p_args->>'group', '') !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$' then
      return 'invalid ACL group name';
    end if;
  end if;

  if p_action in ('acl_create_group', 'acl_destroy_group') then
    if coalesce(p_args->>'group', '') !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$' then
      return 'invalid ACL group name';
    end if;
  end if;

  if p_action = 'acl_destroy_group' and coalesce(p_args->>'group', '') in ('Admin', 'Console') then
    return 'this ACL group is protected and cannot be removed';
  end if;

  if p_action in ('acl_create_acl', 'acl_delete_acl', 'acl_group_add_acl', 'acl_group_remove_acl') then
    if coalesce(p_args->>'acl', '') !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$' then
      return 'invalid ACL name';
    end if;
    if p_action in ('acl_group_add_acl', 'acl_group_remove_acl')
       and coalesce(p_args->>'group', '') !~ '^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$' then
      return 'invalid ACL group name';
    end if;
  end if;

  if p_action = 'acl_delete_acl' and coalesce(p_args->>'acl', '') in ('Default', 'RpAdmin') then
    return 'this ACL is protected and cannot be removed';
  end if;

  return null;
end;
$$;
