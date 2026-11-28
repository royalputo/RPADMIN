-- RpAdmin — Dev By Royalputo
-- Admins can now start/stop resources, change server settings and shut the
-- server down from the panel (matching the UI role matrix). Key rotation,
-- staff management and the ACL editor stay owner-only.

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
      'resource.restart', 'resource.start', 'resource.stop',
      'server.settings', 'server.shutdown', 'warning.revoke'
    )
    when 'moderator' then p_action in ('read', 'warn', 'note', 'mute', 'freeze', 'kick')
    when 'viewer' then p_action = 'read'
    else false
  end
$$;
