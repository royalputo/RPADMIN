const MODERATOR = ["read", "warn", "note", "mute", "freeze", "kick"];
const ADMIN = [...MODERATOR, "say", "ban", "unban", "resource.restart", "bodycam"];
const OWNER = [
  ...ADMIN,
  "resource.start",
  "resource.stop",
  "server.settings",
  "server.shutdown",
  "staff.manage",
  "key.rotate",
  "acl.manage",
];

export const PERMISSIONS = {
  viewer: ["read"],
  moderator: MODERATOR,
  admin: ADMIN,
  owner: OWNER,
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
  acl_create_group: "acl.manage",
  acl_destroy_group: "acl.manage",
  acl_create_acl: "acl.manage",
  acl_delete_acl: "acl.manage",
  acl_group_add_acl: "acl.manage",
  acl_group_remove_acl: "acl.manage",
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
