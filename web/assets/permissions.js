export const PERMISSIONS = {
  viewer: ["read"],
  moderator: ["read", "warn", "note", "mute", "freeze", "kick"],
  admin: ["read", "warn", "note", "mute", "freeze", "kick", "say", "ban", "unban", "resource.restart", "bodycam"],
  owner: [
    "read", "warn", "note", "mute", "freeze", "kick", "say", "ban", "unban",
    "resource.restart", "resource.start", "resource.stop",
    "server.settings", "server.shutdown", "staff.manage", "key.rotate", "acl.manage",
  ],
};

export function can(role, permission) {
  return (PERMISSIONS[role] || []).indexOf(permission) !== -1;
}

export const ACTION_PERMISSION = {
  say: "say",
  kick: "kick",
  ban: "ban",
  unban: "unban",
  mute: "mute",
  unmute: "mute",
  freeze: "freeze",
  unfreeze: "freeze",
  warn: "warn",
  note: "note",
  resource: "resource.restart",
  "server-settings": "server.settings",
  shutdown: "server.shutdown",
  "staff-manage": "staff.manage",
  "key-rotate": "key.rotate",
  acl_toggle_right: "acl.manage",
  acl_add_object: "acl.manage",
  acl_remove_object: "acl.manage",
  bodycam_start: "bodycam",
  bodycam_stop: "bodycam",
};

export function canAction(role, action, arg) {
  if (action === "resource") {
    if (arg === "start") return can(role, "resource.start");
    if (arg === "stop") return can(role, "resource.stop");
    return can(role, "resource.restart");
  }
  const perm = ACTION_PERMISSION[action];
  return perm ? can(role, perm) : false;
}
