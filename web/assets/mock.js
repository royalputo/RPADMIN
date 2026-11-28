const SESSION_KEY = "rp_mock_session";
const now = () => Date.now();
const iso = (msAgo) => new Date(now() - (msAgo || 0)).toISOString();

const USER = { id: "u-1", email: "owner@royalputo.dev", displayName: "Royalputo", role: "owner" };

const servers = [
  {
    id: "srv-1",
    shortId: 1,
    name: "Royal Freeroam",
    slug: "royal-freeroam",
    keyHint: "rsk_\u2026 9f3a",
    createdAt: iso(1000 * 60 * 60 * 24 * 34),
    online: true,
    lastSeen: iso(4000),
    playerCount: 10,
    maxPlayers: 100,
    uptime: 63 * 3600 + 14 * 60,
    version: "1.6.0-9.24149.0",
    gamemode: "freeroam",
    port: 22003,
    httpPort: 22005,
  },
  {
    id: "srv-2",
    shortId: 2,
    name: "Royal Roleplay",
    slug: "royal-roleplay",
    keyHint: "rsk_\u2026 2c81",
    createdAt: iso(1000 * 60 * 60 * 24 * 12),
    online: false,
    lastSeen: iso(1000 * 60 * 132),
    playerCount: 0,
    maxPlayers: 200,
    uptime: 0,
    version: "1.6.0-9.24149.0",
    gamemode: "roleplay",
    port: 22013,
    httpPort: 22015,
  },
];

const playersByServer = {
  1: [
    { id: "p1", name: "Royalputo", ip: "41.102.18.44", serial: "A1B2C3D4E5F6", account: "royalputo", ping: 32, country: "Morocco", health: 98, armor: 45, team: "Staff", admin: true, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 63) },
    { id: "p2", name: "DarkWolf", ip: "197.230.44.12", serial: "9F8E7D6C5B4A", account: "darkwolf", ping: 58, country: "Egypt", health: 100, armor: 0, team: "Grove", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 42) },
    { id: "p3", name: "SniperKing", ip: "102.44.9.201", serial: "112233445566", account: "guest", ping: 74, country: "Tunisia", health: 22, armor: 0, team: "Ballas", admin: false, muted: true, frozen: false, joinedAt: iso(1000 * 60 * 31) },
    { id: "p4", name: "Layla", ip: "81.199.7.55", serial: "AABBCCDDEEFF", account: "layla", ping: 41, country: "Algeria", health: 100, armor: 80, team: "Grove", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 27) },
    { id: "p5", name: "xX_Killer_Xx", ip: "154.121.3.9", serial: "DEADBEEF0001", account: "guest", ping: 120, country: "Libya", health: 61, armor: 12, team: "Vagos", admin: false, muted: false, frozen: true, joinedAt: iso(1000 * 60 * 19) },
    { id: "p6", name: "Mohamed", ip: "41.251.88.3", serial: "0F0E0D0C0B0A", account: "mohamed", ping: 48, country: "Morocco", health: 87, armor: 30, team: "Grove", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 15) },
    { id: "p7", name: "Ghost", ip: "196.75.14.88", serial: "555544443333", account: "ghost", ping: 66, country: "Egypt", health: 100, armor: 0, team: "Aztecas", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 11) },
    { id: "p8", name: "Nova", ip: "105.66.31.7", serial: "ABCDEF123456", account: "nova", ping: 39, country: "Tunisia", health: 94, armor: 55, team: "Ballas", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 7) },
    { id: "p9", name: "Rami", ip: "41.98.2.14", serial: "66778899AABB", account: "guest", ping: 88, country: "Morocco", health: 100, armor: 0, team: "Vagos", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 4) },
    { id: "p10", name: "Zed", ip: "197.44.62.9", serial: "CCDDEEFF0011", account: "zed", ping: 51, country: "Egypt", health: 72, armor: 20, team: "Aztecas", admin: false, muted: false, frozen: false, joinedAt: iso(1000 * 60 * 2) },
  ],
  2: [],
};

const resourcesByServer = {
  1: [
    { name: "freeroam", state: "running", type: "gamemode", author: "MTA Team", version: "1.6.0" },
    { name: "rp_admin", state: "running", type: "misc", author: "Royalputo", version: "1.0.0" },
    { name: "admin", state: "loaded", type: "misc", author: "lil_Toady", version: "1.7.0" },
    { name: "scoreboard", state: "running", type: "misc", author: "MTA Team", version: "1.0.0" },
    { name: "spawnmanager", state: "running", type: "misc", author: "MTA Team", version: "1.0.0" },
    { name: "play", state: "running", type: "misc", author: "MTA Team", version: "1.0.0" },
    { name: "deathpickups", state: "running", type: "misc", author: "MTA Team", version: "1.0.0" },
    { name: "ip2c", state: "running", type: "misc", author: "MTA Team", version: "1.0.0" },
    { name: "Royal_core", state: "running", type: "misc", author: "Royalputo", version: "2.1.4" },
    { name: "vehicle-shop", state: "stopped", type: "misc", author: "Royalputo", version: "0.9.2" },
    { name: "bank-system", state: "running", type: "misc", author: "Royalputo", version: "1.4.0" },
    { name: "hud", state: "running", type: "misc", author: "Royalputo", version: "1.0.3" },
    { name: "webadmin", state: "stopped", type: "misc", author: "MTA Team", version: "1.5.9" },
    { name: "reports", state: "running", type: "misc", author: "Royalputo", version: "1.0.0" },
  ],
  2: [
    { name: "roleplay", state: "stopped", type: "gamemode", author: "Royalputo", version: "0.4.0" },
    { name: "rp_admin", state: "stopped", type: "misc", author: "Royalputo", version: "1.0.0" },
  ],
};

const bansByServer = {
  1: [
    { id: "b1", ip: "154.121.3.9", serial: "DEADBEEF0001", nick: "xX_Killer_Xx", reason: "Aimbot / silent aim detected", admin: "Royalputo", bannedAt: iso(1000 * 60 * 60 * 6), unbanTime: 0, permanent: true },
    { id: "b2", ip: "102.44.9.201", serial: "112233445566", nick: "SniperKing", reason: "Spamming chat after warnings", admin: "Royalputo", bannedAt: iso(1000 * 60 * 60 * 22), unbanTime: now() + 1000 * 60 * 60 * 26, permanent: false },
    { id: "b3", ip: "197.230.44.12", serial: "9F8E7D6C5B4A", nick: "DarkWolf", reason: "Exploiting vehicle duping", admin: "Layla", bannedAt: iso(1000 * 60 * 60 * 48), unbanTime: now() + 1000 * 60 * 60 * 120, permanent: false },
    { id: "b4", ip: "81.199.7.55", serial: "AABBCCDDEEFF", nick: "Layla", reason: "Ban evasion (linked serial)", admin: "Royalputo", bannedAt: iso(1000 * 60 * 60 * 72), unbanTime: 0, permanent: true },
  ],
  2: [],
};

const membersByServer = {
  1: [
    { userId: "u-1", name: "Royalputo", email: "owner@royalputo.dev", role: "owner", mtaAccount: "royalputo", online: true },
    { userId: "u-2", name: "Layla", email: "layla@royalputo.dev", role: "admin", mtaAccount: "layla", online: false },
    { userId: "u-3", name: "DarkWolf", email: "darkwolf@royalputo.dev", role: "moderator", mtaAccount: "darkwolf", online: false },
    { userId: "u-4", name: "Observer", email: "observer@royalputo.dev", role: "viewer", mtaAccount: null, online: false },
  ],
  2: [],
};

const invitesByServer = {
  1: [],
  2: [],
};

const warningsByServer = {
  1: [
    { id: "w1", playerName: "xX_Killer_Xx", playerSerial: "DEADBEEF0001", reason: "Toxic behaviour in chat", issuedByName: "Layla", createdAt: iso(1000 * 60 * 60 * 9), revokedAt: null },
    { id: "w2", playerName: "SniperKing", playerSerial: "112233445566", reason: "Repeated chat spam", issuedByName: "DarkWolf", createdAt: iso(1000 * 60 * 60 * 26), revokedAt: null },
    { id: "w3", playerName: "Ghost", playerSerial: "555544443333", reason: "Team killing on purpose", issuedByName: "Layla", createdAt: iso(1000 * 60 * 60 * 40), revokedAt: null },
    { id: "w4", playerName: "Nova", playerSerial: "ABCDEF123456", reason: "Ignoring admin instructions", issuedByName: "Royalputo", createdAt: iso(1000 * 60 * 60 * 55), revokedAt: null },
    { id: "w5", playerName: "Rami", playerSerial: "66778899AABB", reason: "Advertising another server", issuedByName: "Royalputo", createdAt: iso(1000 * 60 * 60 * 80), revokedAt: iso(1000 * 60 * 60 * 70) },
  ],
  2: [],
};

const notesByServer = {
  1: [
    { id: "n1", playerName: "xX_Killer_Xx", playerSerial: "DEADBEEF0001", note: "Suspected ban evasion alt of serial DEADBEEF0000. Keep an eye on.", createdByName: "Royalputo", createdAt: iso(1000 * 60 * 60 * 7) },
    { id: "n2", playerName: "Mohamed", playerSerial: "0F0E0D0C0B0A", note: "Long-time regular, helpful in reports. Trusted.", createdByName: "Layla", createdAt: iso(1000 * 60 * 60 * 30) },
    { id: "n3", playerName: "Ghost", playerSerial: "555544443333", note: "Requested unban appeal via Discord, pending review.", createdByName: "DarkWolf", createdAt: iso(1000 * 60 * 60 * 52) },
  ],
  2: [],
};

const activityByServer = {
  1: [
    { id: 32, kind: "error", actor: "vehicle-shop", text: "attempt to index a nil value (global 'shopConfig') (server/main.lua:42)", createdAt: iso(1000 * 60 * 1) },
    { id: 31, kind: "warn", actor: "bank-system", text: "deprecated function: getAccountData with root element (server/bank.lua:118)", createdAt: iso(1000 * 60 * 3) },
    { id: 30, kind: "join", actor: "Zed", text: "Zed joined the server", createdAt: iso(1000 * 60 * 2) },
    { id: 29, kind: "join", actor: "Rami", text: "Rami joined the server", createdAt: iso(1000 * 60 * 4) },
    { id: 28, kind: "say", actor: "Royalputo", text: "Welcome to Royal Freeroam! Event starts in 10 minutes.", createdAt: iso(1000 * 60 * 6) },
    { id: 27, kind: "join", actor: "Nova", text: "Nova joined the server", createdAt: iso(1000 * 60 * 7) },
    { id: 26, kind: "kick", actor: "Layla", text: "Layla kicked AFK_Gamer - AFK 20 minutes", createdAt: iso(1000 * 60 * 9) },
    { id: 25, kind: "freeze", actor: "DarkWolf", text: "DarkWolf froze xX_Killer_Xx", createdAt: iso(1000 * 60 * 11) },
    { id: 24, kind: "resource", actor: "Royalputo", text: "Royalputo restarted resource vehicle-shop", createdAt: iso(1000 * 60 * 14) },
    { id: 23, kind: "warn", actor: "Layla", text: "Layla warned xX_Killer_Xx - Toxic behaviour in chat", createdAt: iso(1000 * 60 * 17) },
    { id: 22, kind: "join", actor: "Ghost", text: "Ghost joined the server", createdAt: iso(1000 * 60 * 21) },
    { id: 21, kind: "mute", actor: "DarkWolf", text: "DarkWolf muted SniperKing", createdAt: iso(1000 * 60 * 26) },
    { id: 20, kind: "ban", actor: "Royalputo", text: "Royalputo banned xX_Killer_Xx - Aimbot / silent aim detected", createdAt: iso(1000 * 60 * 60 * 6) },
    { id: 19, kind: "login", actor: "Royalputo", text: "Royalputo signed in to the panel", createdAt: iso(1000 * 60 * 60 * 6 + 1000 * 60 * 4) },
    { id: 18, kind: "note", actor: "Royalputo", text: "Royalputo added a note on xX_Killer_Xx", createdAt: iso(1000 * 60 * 60 * 7) },
    { id: 17, kind: "resource", actor: "Royalputo", text: "Royalputo stopped resource vehicle-shop", createdAt: iso(1000 * 60 * 60 * 9) },
    { id: 16, kind: "staff", actor: "Royalputo", text: "Royalputo invited DarkWolf as Moderator", createdAt: iso(1000 * 60 * 60 * 20) },
    { id: 15, kind: "ban", actor: "Royalputo", text: "Royalputo banned SniperKing - Spamming chat after warnings", createdAt: iso(1000 * 60 * 60 * 22) },
    { id: 14, kind: "quit", actor: "Ali", text: "Ali left the server", createdAt: iso(1000 * 60 * 60 * 24) },
    { id: 13, kind: "warn", actor: "DarkWolf", text: "DarkWolf warned SniperKing - Repeated chat spam", createdAt: iso(1000 * 60 * 60 * 26) },
    { id: 12, kind: "say", actor: "Layla", text: "Server restart in 5 minutes, save your progress.", createdAt: iso(1000 * 60 * 60 * 30) },
    { id: 11, kind: "staff", actor: "Royalputo", text: "Royalputo invited Layla as Admin", createdAt: iso(1000 * 60 * 60 * 33) },
    { id: 10, kind: "join", actor: "Mohamed", text: "Mohamed joined the server", createdAt: iso(1000 * 60 * 60 * 34) },
    { id: 9, kind: "resource", actor: "Royalputo", text: "Royalputo started resource rp_admin", createdAt: iso(1000 * 60 * 60 * 35) },
    { id: 8, kind: "login", actor: "Layla", text: "Layla signed in to the panel", createdAt: iso(1000 * 60 * 60 * 36) },
    { id: 7, kind: "warn", actor: "Layla", text: "Layla warned Ghost - Team killing on purpose", createdAt: iso(1000 * 60 * 60 * 40) },
    { id: 6, kind: "ban", actor: "Layla", text: "Layla banned DarkWolf - Exploiting vehicle duping", createdAt: iso(1000 * 60 * 60 * 48) },
    { id: 5, kind: "note", actor: "DarkWolf", text: "DarkWolf added a note on Ghost", createdAt: iso(1000 * 60 * 60 * 52) },
    { id: 4, kind: "warn", actor: "Royalputo", text: "Royalputo warned Nova - Ignoring admin instructions", createdAt: iso(1000 * 60 * 60 * 55) },
    { id: 3, kind: "logout", actor: "Layla", text: "Layla signed out of the panel", createdAt: iso(1000 * 60 * 60 * 60) },
    { id: 2, kind: "ban", actor: "Royalputo", text: "Royalputo banned Layla - Ban evasion (linked serial)", createdAt: iso(1000 * 60 * 60 * 72) },
    { id: 1, kind: "warn", actor: "Royalputo", text: "Royalputo warned Rami - Advertising another server", createdAt: iso(1000 * 60 * 60 * 80) },
  ],
  2: [
    { id: 2, kind: "login", actor: "Royalputo", text: "Royalputo signed in to the panel", createdAt: iso(1000 * 60 * 180) },
    { id: 1, kind: "resource", actor: "Royalputo", text: "Royalputo stopped resource roleplay", createdAt: iso(1000 * 60 * 132) },
  ],
};

const commandsByServer = {
  1: [
    { id: 501, action: "say", args: { message: "Welcome to Royal Freeroam! Event starts in 10 minutes." }, status: "done", createdByName: "Royalputo", createdAt: iso(1000 * 60 * 6), executedAt: iso(1000 * 60 * 6 - 1200), result: { ok: true }, error: null },
    { id: 500, action: "kick", args: { player: "AFK_Gamer", reason: "AFK 20 minutes" }, status: "done", createdByName: "Layla", createdAt: iso(1000 * 60 * 9), executedAt: iso(1000 * 60 * 9 - 900), result: { ok: true }, error: null },
    { id: 499, action: "resource", args: { resource: "vehicle-shop", op: "restart" }, status: "done", createdByName: "Royalputo", createdAt: iso(1000 * 60 * 14), executedAt: iso(1000 * 60 * 14 - 1500), result: { ok: true }, error: null },
    { id: 498, action: "warn", args: { player: "xX_Killer_Xx", reason: "Toxic behaviour in chat" }, status: "done", createdByName: "Layla", createdAt: iso(1000 * 60 * 17), executedAt: iso(1000 * 60 * 17 - 800), result: { ok: true }, error: null },
    { id: 497, action: "ban", args: { player: "xX_Killer_Xx", reason: "Aimbot / silent aim detected", seconds: 0 }, status: "done", createdByName: "Royalputo", createdAt: iso(1000 * 60 * 60 * 6), executedAt: iso(1000 * 60 * 60 * 6 - 1100), result: { ok: true }, error: null },
    { id: 496, action: "mute", args: { player: "SniperKing" }, status: "failed", createdByName: "DarkWolf", createdAt: iso(1000 * 60 * 60 * 26), executedAt: iso(1000 * 60 * 60 * 26 - 30000), result: null, error: "Player left before command executed" },
  ],
  2: [],
};

const rpAdminRights = [
  { name: "function.aclGetGroup", access: true },
  { name: "function.aclList", access: true },
  { name: "function.aclGroupListObjects", access: true },
  { name: "function.aclGroupListACL", access: true },
  { name: "function.aclListRights", access: true },
  { name: "function.aclGetRight", access: true },
  { name: "function.aclSetRight", access: true },
  { name: "function.aclGroupAddObject", access: true },
  { name: "function.aclGroupRemoveObject", access: true },
  { name: "function.banPlayer", access: true },
  { name: "function.kickPlayer", access: true },
  { name: "function.refreshResources", access: true },
  { name: "function.setServerName", access: true },
  { name: "function.shutdown", access: true },
  { name: "function.startResource", access: true },
  { name: "function.stopResource", access: true },
  { name: "function.restartResource", access: true },
];

const aclByServer = {
  1: {
    active: "RpAdmin",
    groups: [
      { name: "Admin", objects: ["resource.admin", "user.royalputo"], acls: ["Admin", "Default"] },
      { name: "Moderator", objects: ["user.darkwolf"], acls: ["Moderator"] },
      { name: "RpAdmin", objects: ["resource.rp_admin", "user.royalputo"], acls: ["RpAdmin"] },
      { name: "SuperModerator", objects: ["user.layla"], acls: ["SuperModerator", "Default"] },
    ],
    acls: [
      { name: "Default", rights: [{ name: "general.ModifyOtherObjects", access: false }] },
      { name: "Admin", rights: [{ name: "command.ban", access: true }, { name: "command.kick", access: true }, { name: "function.kickPlayer", access: true }] },
      { name: "Moderator", rights: [{ name: "command.mute", access: true }] },
      { name: "RpAdmin", rights: rpAdminRights },
      { name: "SuperModerator", rights: [{ name: "command.ban", access: true }] },
    ],
    // legacy fields
    group: "RpAdmin",
    acl: "RpAdmin",
    objects: ["resource.rp_admin", "user.royalputo"],
    rights: rpAdminRights,
  },
  2: {
    active: "RpAdmin",
    groups: [{ name: "RpAdmin", objects: ["resource.rp_admin"], acls: ["RpAdmin"] }],
    acls: [{ name: "RpAdmin", rights: [] }],
    group: "RpAdmin",
    acl: "RpAdmin",
    objects: ["resource.rp_admin"],
    rights: [],
  },
};

const serverKey = (shortId) => `rsk_${String(shortId).padStart(2, "0")}${Math.random().toString(16).slice(2, 14)}${Math.random().toString(16).slice(2, 14)}`;

const delay = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms == null ? 140 : ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

function mockAclSkeleton() {
  return {
    active: "RpAdmin",
    groups: [{ name: "RpAdmin", objects: ["resource.rp_admin"], acls: ["RpAdmin"] }],
    acls: [{ name: "RpAdmin", rights: [] }],
    group: "RpAdmin",
    acl: "RpAdmin",
    objects: ["resource.rp_admin"],
    rights: [],
  };
}

let nextId = 900;
const pushActivity = (shortId, kind, actor, text) => {
  const list = activityByServer[shortId] || (activityByServer[shortId] = []);
  list.unshift({ id: nextId++, kind, actor, text, createdAt: new Date().toISOString() });
  if (list.length > 300) list.length = 300;
};
const findServer = (shortId) => servers.find((s) => String(s.shortId) === String(shortId));
const findPlayer = (shortId, name) =>
  (playersByServer[shortId] || []).find((p) => p.name === name) ||
  (playersByServer[shortId] || []).find((p) => p.name.toLowerCase().includes(String(name).toLowerCase()));

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function roleFor(shortId) {
  const members = membersByServer[shortId] || [];
  const member = members.find((m) => m.userId === USER.id);
  return member ? member.role : null;
}

export const mockApi = {
  isMock: true,

  async getSession() {
    return delay(readSession());
  },

  async signIn(email, password) {
    if (!email || !password) return delay({ error: "Email and password are required." });
    const session = { user: { ...USER, email: email.trim() } };
    writeSession(session);
    return delay({ session });
  },

  async signUp(email, password, displayName) {
    if (!email || !password) return delay({ error: "Email and password are required." });
    if (password.length < 8) return delay({ error: "Password must be at least 8 characters." });
    const session = { user: { ...USER, email: email.trim(), displayName: displayName || "Owner" } };
    writeSession(session);
    return delay({ session });
  },

  async signOut() {
    writeSession(null);
    return delay(true);
  },

  async listServers() {
    return delay(
      servers
        .filter((s) => roleFor(s.shortId))
        .map((s) => ({
          ...clone(s),
          role: roleFor(s.shortId),
        }))
    );
  },

  async getSnapshot(shortId) {
    const server = findServer(shortId);
    if (!server) return delay({ error: "not_found" });
    const role = roleFor(shortId);
    if (!role) return delay({ error: "forbidden" });
    if (server.online) server.lastSeen = iso(0);
    const fresh = server.online && now() - new Date(server.lastSeen).getTime() < 30000;
    return delay({
      server: clone({ ...server, online: fresh }),
      role,
      players: clone(playersByServer[shortId] || []),
      resources: clone(resourcesByServer[shortId] || []),
      scriptIssues: String(shortId) === "1"
        ? [
            { name: "vehicle-shop", errors: 3, warns: 1, last: "attempt to index a nil value (global 'shopConfig') (server/main.lua:42)", lastKind: "error", at: new Date().toISOString() },
            { name: "bank-system", errors: 0, warns: 2, last: "deprecated function: getAccountData with root element (server/bank.lua:118)", lastKind: "warn", at: new Date().toISOString() },
          ]
        : [],
      acl: clone(aclByServer[shortId] || null),
      diag: { version: "demo", pollStatus: 200, pollCount: 0, lastPollAt: new Date().toISOString(), lastAction: null, lastResult: null, lastUpdate: 200, lastSnapshot: 200, lastError: null },
      bans: clone(bansByServer[shortId] || []),
      members: clone(membersByServer[shortId] || []),
      invites: clone(invitesByServer[shortId] || []),
      warnings: clone(warningsByServer[shortId] || []),
      notes: clone(notesByServer[shortId] || []),
      activity: clone(activityByServer[shortId] || []),
      commands: clone(commandsByServer[shortId] || []),
    });
  },

  async action(shortId, action, args) {
    const server = findServer(shortId);
    if (!server) return delay({ ok: false, error: "Server not found" });
    args = args || {};
    const actor = USER.displayName;
    const label = args.player || args.resource || args.ip || args.name || "";

    switch (action) {
      case "say": {
        if (!args.message) return delay({ ok: false, error: "Message is empty" });
        pushActivity(shortId, "say", actor, `${actor}: ${args.message}`);
        return delay({ ok: true, message: "Broadcast sent to all players" });
      }
      case "kick": {
        const player = findPlayer(shortId, args.player);
        if (!player) return delay({ ok: false, error: "Player not found" });
        playersByServer[shortId] = (playersByServer[shortId] || []).filter((p) => p !== player);
        server.playerCount = Math.max(0, (server.playerCount || 1) - 1);
        pushActivity(shortId, "kick", actor, `${actor} kicked ${player.name} - ${args.reason || "no reason"}`);
        return delay({ ok: true, message: `Kicked ${player.name}` });
      }
      case "ban": {
        const player = findPlayer(shortId, args.player);
        if (!player) return delay({ ok: false, error: "Player not found" });
        const seconds = Number(args.seconds) || 0;
        playersByServer[shortId] = (playersByServer[shortId] || []).filter((p) => p !== player);
        server.playerCount = Math.max(0, (server.playerCount || 1) - 1);
        (bansByServer[shortId] || (bansByServer[shortId] = [])).unshift({
          id: `b${nextId++}`,
          ip: player.ip,
          serial: player.serial,
          nick: player.name,
          reason: args.reason || "Banned by admin",
          admin: actor,
          bannedAt: new Date().toISOString(),
          unbanTime: seconds ? now() + seconds * 1000 : 0,
          permanent: !seconds,
        });
        pushActivity(shortId, "ban", actor, `${actor} banned ${player.name} - ${args.reason || "no reason"}`);
        return delay({ ok: true, message: `Banned ${player.name} (IP + serial)` });
      }
      case "unban": {
        const bans = bansByServer[shortId] || [];
        const index = bans.findIndex((b) => b.id === args.id || b.ip === args.ip);
        if (index === -1) return delay({ ok: false, error: "Ban not found" });
        const [removed] = bans.splice(index, 1);
        pushActivity(shortId, "unban", actor, `${actor} unbanned ${removed.nick} (${removed.ip})`);
        return delay({ ok: true, message: `Unbanned ${removed.nick}` });
      }
      case "mute":
      case "unmute":
      case "freeze":
      case "unfreeze": {
        const player = findPlayer(shortId, args.player);
        if (!player) return delay({ ok: false, error: "Player not found" });
        if (action === "mute") player.muted = true;
        if (action === "unmute") player.muted = false;
        if (action === "freeze") player.frozen = true;
        if (action === "unfreeze") player.frozen = false;
        pushActivity(shortId, action.replace("un", ""), actor, `${actor} ${action} ${player.name}`);
        return delay({ ok: true, message: `${action[0].toUpperCase()}${action.slice(1)} ${player.name}` });
      }
      case "warn": {
        if (!args.player || !args.reason) return delay({ ok: false, error: "Player and reason are required" });
        (warningsByServer[shortId] || (warningsByServer[shortId] = [])).unshift({
          id: `w${nextId++}`,
          playerName: args.player,
          playerSerial: (findPlayer(shortId, args.player) || {}).serial || "",
          reason: args.reason,
          issuedByName: actor,
          createdAt: new Date().toISOString(),
          revokedAt: null,
        });
        pushActivity(shortId, "warn", actor, `${actor} warned ${args.player} - ${args.reason}`);
        return delay({ ok: true, message: `Warned ${args.player}` });
      }
      case "note": {
        if (!args.player || !args.note) return delay({ ok: false, error: "Player and note are required" });
        (notesByServer[shortId] || (notesByServer[shortId] = [])).unshift({
          id: `n${nextId++}`,
          playerName: args.player,
          playerSerial: (findPlayer(shortId, args.player) || {}).serial || "",
          note: args.note,
          createdByName: actor,
          createdAt: new Date().toISOString(),
        });
        pushActivity(shortId, "note", actor, `${actor} added a note on ${args.player}`);
        return delay({ ok: true, message: `Note saved for ${args.player}` });
      }
      case "resource": {
        const resource = (resourcesByServer[shortId] || []).find((r) => r.name === args.resource);
        if (!resource) return delay({ ok: false, error: "Resource not found" });
        if (args.op === "start") resource.state = "running";
        if (args.op === "stop") resource.state = "stopped";
        if (args.op === "restart") resource.state = "running";
        pushActivity(shortId, "resource", actor, `${actor} ${args.op}ed resource ${args.resource}`);
        return delay({ ok: true, message: `${args.op} ${args.resource}` });
      }
      case "resources_refresh":
        return delay({ ok: true, message: "Resources rescanned" });
      case "snapshot_now":
        return delay({ ok: true, message: "Snapshot requested" });
      case "resources_all_start": {
        let started = 0;
        (resourcesByServer[shortId] || []).forEach((resource) => {
          if (resource.state !== "running") {
            resource.state = "running";
            started += 1;
          }
        });
        pushActivity(shortId, "resource", actor, `${actor} started all resources (${started})`);
        return delay({ ok: true, message: `Started ${started} resource(s)` });
      }
      case "resources_all_stop": {
        let stopped = 0;
        (resourcesByServer[shortId] || []).forEach((resource) => {
          if (resource.state === "running" && !["rp_admin", "admin", "webadmin"].includes(resource.name)) {
            resource.state = "stopped";
            stopped += 1;
          }
        });
        pushActivity(shortId, "resource", actor, `${actor} stopped all resources (${stopped})`);
        return delay({ ok: true, message: `Stopped ${stopped} resource(s)` });
      }
      case "server-settings": {
        if (args.name) server.name = args.name;
        if (args.maxPlayers) server.maxPlayers = Number(args.maxPlayers);
        pushActivity(shortId, "staff", actor, `${actor} updated server settings`);
        return delay({ ok: true, message: "Server settings updated" });
      }
      case "shutdown": {
        server.online = false;
        server.playerCount = 0;
        server.lastSeen = iso(0);
        playersByServer[shortId] = [];
        pushActivity(shortId, "resource", actor, `${actor} shut down the server`);
        return delay({ ok: true, message: "Shutdown command queued (countdown 10s)" });
      }
      case "acl_toggle_right": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const right = String(args.right || "");
        const aclName = String(args.acl || "RpAdmin");
        if (!/^(function|general|command|resource)\.[A-Za-z0-9_.-]+$/.test(right)) {
          return delay({ ok: false, error: "Invalid right name" });
        }
        const acl = aclByServer[shortId] || (aclByServer[shortId] = mockAclSkeleton());
        let entry = (acl.acls || []).find((a) => a.name === aclName);
        if (!entry) {
          entry = { name: aclName, rights: [] };
          acl.acls.push(entry);
          acl.acls.sort((a, b) => a.name.localeCompare(b.name));
        }
        let rightEntry = entry.rights.find((r) => r.name === right);
        if (!rightEntry) {
          rightEntry = { name: right, access: false };
          entry.rights.push(rightEntry);
          entry.rights.sort((a, b) => a.name.localeCompare(b.name));
        }
        rightEntry.access = args.enabled === true;
        pushActivity(shortId, "staff", actor, `${actor} ${rightEntry.access ? "enabled" : "disabled"} ACL right ${right} on ${aclName}`);
        return delay({ ok: true, message: `${rightEntry.access ? "Enabled" : "Disabled"} ${right}` });
      }
      case "acl_add_object": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const object = String(args.object || "");
        const groupName = String(args.group || "RpAdmin");
        if (!/^(user|resource|map|group)\.[A-Za-z0-9_.-]+$/.test(object)) {
          return delay({ ok: false, error: "Invalid ACL object" });
        }
        const acl = aclByServer[shortId] || (aclByServer[shortId] = mockAclSkeleton());
        let group = acl.groups.find((g) => g.name === groupName);
        if (!group) {
          group = { name: groupName, objects: [], acls: [] };
          acl.groups.push(group);
          acl.groups.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (!group.objects.includes(object)) group.objects.push(object);
        group.objects.sort();
        pushActivity(shortId, "staff", actor, `${actor} added ${object} to ACL group ${groupName}`);
        return delay({ ok: true, message: `Added ${object} to ${groupName}` });
      }
      case "acl_remove_object": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const object = String(args.object || "");
        const groupName = String(args.group || "RpAdmin");
        const acl = aclByServer[shortId];
        const group = acl && acl.groups.find((g) => g.name === groupName);
        if (!group || !group.objects.includes(object)) return delay({ ok: false, error: "Object not found" });
        group.objects = group.objects.filter((entry) => entry !== object);
        pushActivity(shortId, "staff", actor, `${actor} removed ${object} from ACL group ${groupName}`);
        return delay({ ok: true, message: `Removed ${object}` });
      }
      case "acl_create_group": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const groupName = String(args.group || "");
        if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(groupName)) return delay({ ok: false, error: "Invalid group name" });
        const acl = aclByServer[shortId] || (aclByServer[shortId] = mockAclSkeleton());
        if (acl.groups.some((g) => g.name === groupName)) return delay({ ok: false, error: "Group already exists" });
        acl.groups.push({ name: groupName, objects: [], acls: [] });
        acl.groups.sort((a, b) => a.name.localeCompare(b.name));
        pushActivity(shortId, "staff", actor, `${actor} created ACL group ${groupName}`);
        return delay({ ok: true, message: `Created group ${groupName}` });
      }
      case "acl_destroy_group": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const groupName = String(args.group || "");
        const acl = aclByServer[shortId];
        if (!acl || !acl.groups.some((g) => g.name === groupName)) return delay({ ok: false, error: "Group not found" });
        if (["Admin", "Console"].includes(groupName)) return delay({ ok: false, error: "This group is protected" });
        acl.groups = acl.groups.filter((g) => g.name !== groupName);
        pushActivity(shortId, "staff", actor, `${actor} deleted ACL group ${groupName}`);
        return delay({ ok: true, message: `Deleted group ${groupName}` });
      }
      case "acl_create_acl": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const aclName = String(args.acl || "");
        if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(aclName)) return delay({ ok: false, error: "Invalid ACL name" });
        const acl = aclByServer[shortId] || (aclByServer[shortId] = mockAclSkeleton());
        if (acl.acls.some((a) => a.name === aclName)) return delay({ ok: false, error: "ACL already exists" });
        acl.acls.push({ name: aclName, rights: [] });
        acl.acls.sort((a, b) => a.name.localeCompare(b.name));
        pushActivity(shortId, "staff", actor, `${actor} created ACL ${aclName}`);
        return delay({ ok: true, message: `Created ACL ${aclName}` });
      }
      case "acl_delete_acl": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const aclName = String(args.acl || "");
        const acl = aclByServer[shortId];
        if (!acl || !acl.acls.some((a) => a.name === aclName)) return delay({ ok: false, error: "ACL not found" });
        if (["Default", "RpAdmin"].includes(aclName)) return delay({ ok: false, error: "This ACL is protected" });
        acl.acls = acl.acls.filter((a) => a.name !== aclName);
        acl.groups.forEach((g) => { g.acls = g.acls.filter((name) => name !== aclName); });
        pushActivity(shortId, "staff", actor, `${actor} deleted ACL ${aclName}`);
        return delay({ ok: true, message: `Deleted ACL ${aclName}` });
      }
      case "acl_group_add_acl": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const aclName = String(args.acl || "");
        const groupName = String(args.group || "RpAdmin");
        const acl = aclByServer[shortId];
        const group = acl && acl.groups.find((g) => g.name === groupName);
        if (!group) return delay({ ok: false, error: "Group not found" });
        if (!acl.acls.some((a) => a.name === aclName)) return delay({ ok: false, error: "ACL not found" });
        if (!group.acls.includes(aclName)) group.acls.push(aclName);
        pushActivity(shortId, "staff", actor, `${actor} attached ACL ${aclName} to group ${groupName}`);
        return delay({ ok: true, message: `Attached ${aclName} to ${groupName}` });
      }
      case "acl_group_remove_acl": {
        if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
        const aclName = String(args.acl || "");
        const groupName = String(args.group || "RpAdmin");
        const acl = aclByServer[shortId];
        const group = acl && acl.groups.find((g) => g.name === groupName);
        if (!group || !group.acls.includes(aclName)) return delay({ ok: false, error: "ACL is not attached to this group" });
        group.acls = group.acls.filter((name) => name !== aclName);
        pushActivity(shortId, "staff", actor, `${actor} detached ACL ${aclName} from group ${groupName}`);
        return delay({ ok: true, message: `Detached ${aclName} from ${groupName}` });
      }
      case "bodycam_start": {
        const player = findPlayer(shortId, args.player);
        if (!player) return delay({ ok: false, error: "Player not found" });
        return delay({ ok: true, message: `Body cam started for ${player.name}` });
      }
      case "bodycam_stop":
        return delay({ ok: true, message: "Body cam stopped" });
      case "revoke-warning": {
        const warning = (warningsByServer[shortId] || []).find((w) => w.id === args.id);
        if (!warning) return delay({ ok: false, error: "Warning not found" });
        warning.revokedAt = new Date().toISOString();
        pushActivity(shortId, "warn", actor, `${actor} revoked a warning for ${warning.playerName}`);
        return delay({ ok: true, message: "Warning revoked" });
      }
      case "add-member": {
        if (!args.email || !args.role) return delay({ ok: false, error: "Email and role are required" });
        const email = args.email.toLowerCase();
        const existing = (membersByServer[shortId] || []).find((m) => (m.email || "").toLowerCase() === email);
        if (existing) return delay({ ok: false, error: "That account is already a member" });
        (invitesByServer[shortId] || (invitesByServer[shortId] = [])).unshift({
          id: `inv-${nextId++}`,
          email,
          role: args.role,
          mtaAccount: args.mtaAccount || null,
          createdAt: new Date().toISOString(),
        });
        pushActivity(shortId, "staff", actor, `${actor} invited ${email} as ${args.role}`);
        return delay({ ok: true, message: `Invite saved for ${email}` });
      }
      case "revoke-invite": {
        const list = invitesByServer[shortId] || [];
        const index = list.findIndex((i) => i.id === args.id);
        if (index === -1) return delay({ ok: false, error: "Invite not found" });
        const [removed] = list.splice(index, 1);
        pushActivity(shortId, "staff", actor, `${actor} revoked the invite for ${removed.email}`);
        return delay({ ok: true, message: "Invite revoked" });
      }
      case "remove-member": {
        const members = membersByServer[shortId] || [];
        const index = members.findIndex((m) => m.userId === args.userId);
        if (index === -1) return delay({ ok: false, error: "Member not found" });
        if (members[index].role === "owner") return delay({ ok: false, error: "Cannot remove the owner" });
        const [removed] = members.splice(index, 1);
        pushActivity(shortId, "staff", actor, `${actor} removed ${removed.email} from staff`);
        return delay({ ok: true, message: `Removed ${removed.email}` });
      }
      default:
        return delay({ ok: false, error: `Unknown action: ${action} (${label})` });
    }
  },

  async createServer(name) {
    if (!name || name.trim().length < 3) return delay({ ok: false, error: "Server name must be at least 3 characters" });
    const shortId = Math.max(...servers.map((s) => s.shortId)) + 1;
    const server = {
      id: `srv-${nextId++}`,
      shortId,
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      keyHint: "rsk_\u2026 new",
      createdAt: new Date().toISOString(),
      online: false,
      lastSeen: null,
      playerCount: 0,
      maxPlayers: 32,
      uptime: 0,
      version: "-",
      gamemode: "-",
      port: 22003 + shortId * 10,
      httpPort: 22005 + shortId * 10,
    };
    servers.push(server);
    playersByServer[shortId] = [];
    resourcesByServer[shortId] = [];
    bansByServer[shortId] = [];
    warningsByServer[shortId] = [];
    invitesByServer[shortId] = [];
    aclByServer[shortId] = mockAclSkeleton();
    notesByServer[shortId] = [];
    activityByServer[shortId] = [];
    commandsByServer[shortId] = [];
    membersByServer[shortId] = [{ userId: USER.id, name: USER.displayName, email: USER.email, role: "owner", mtaAccount: null, online: false }];
    const key = serverKey(shortId);
    return delay({ ok: true, server: clone(server), key, snippet: mockSnippet(shortId, key, server.id) });
  },

  async rotateKey(shortId) {
    const server = findServer(shortId);
    if (!server) return delay({ ok: false, error: "Server not found" });
    const key = serverKey(shortId);
    server.keyHint = `rsk_\u2026 ${key.slice(-4)}`;
    pushActivity(shortId, "staff", USER.displayName, `${USER.displayName} rotated the server key`);
    return delay({ ok: true, key });
  },

  async getFrame() {
    return delay(null, 30);
  },

  async myInvites() {
    const out = [];
    Object.entries(invitesByServer).forEach(([shortId, list]) => {
      const server = findServer(shortId);
      if (!server) return;
      list.forEach((invite) => {
        if (String(invite.email).toLowerCase() !== String(USER.email).toLowerCase()) return;
        out.push({
          id: invite.id,
          server_id: server.id,
          short_id: server.shortId,
          server_name: server.name,
          role: invite.role,
          mta_account: invite.mtaAccount,
          created_at: invite.createdAt,
        });
      });
    });
    return delay(out);
  },

  async acceptInvite(id) {
    const entries = Object.entries(invitesByServer);
    for (let i = 0; i < entries.length; i += 1) {
      const shortId = entries[i][0];
      const list = entries[i][1];
      const index = list.findIndex(
        (invite) => invite.id === id && String(invite.email).toLowerCase() === String(USER.email).toLowerCase()
      );
      if (index !== -1) {
        const invite = list.splice(index, 1)[0];
        (membersByServer[shortId] || (membersByServer[shortId] = [])).push({
          userId: USER.id,
          name: USER.displayName,
          email: USER.email,
          role: invite.role,
          mtaAccount: invite.mtaAccount || null,
          online: false,
        });
        pushActivity(shortId, "staff", USER.displayName, `${USER.displayName} accepted an invite as ${invite.role}`);
        return delay({ ok: true, shortId: Number(shortId), role: invite.role });
      }
    }
    return delay({ ok: false, error: "Invite not found" });
  },

  signInWithGoogle() {
    return { ok: false, error: "Google sign-in needs live mode" };
  },

  async completeOAuth() {
    return { ok: false, error: "Google sign-in needs live mode" };
  },

  async declineInvite(id) {
    const entries = Object.entries(invitesByServer);
    for (let i = 0; i < entries.length; i += 1) {
      const list = entries[i][1];
      const index = list.findIndex(
        (invite) => invite.id === id && String(invite.email).toLowerCase() === String(USER.email).toLowerCase()
      );
      if (index !== -1) {
        list.splice(index, 1);
        return delay({ ok: true });
      }
    }
    return delay({ ok: false, error: "Invite not found" });
  },

  async deleteServer(shortId) {
    if (roleFor(shortId) !== "owner") return delay({ ok: false, error: "Owner only" });
    const index = servers.findIndex((server) => String(server.shortId) === String(shortId));
    if (index === -1) return delay({ ok: false, error: "Server not found" });
    const [removed] = servers.splice(index, 1);
    delete playersByServer[shortId];
    delete resourcesByServer[shortId];
    delete bansByServer[shortId];
    delete membersByServer[shortId];
    delete invitesByServer[shortId];
    delete warningsByServer[shortId];
    delete notesByServer[shortId];
    delete activityByServer[shortId];
    delete commandsByServer[shortId];
    delete aclByServer[shortId];
    return delay({ ok: true, message: `Deleted ${removed.name}` });
  },

  subscribe() {
    return () => {};
  },
};

export function mockSnippet(shortId, key, serverUuid) {
  return `RP_ADMIN = {
  url = "https://rpadmin.mtarg.xyz",
  serverKey = "${key}",
  serverId = "${shortId}",
  serverUuid = "${serverUuid || "00000000-0000-0000-0000-000000000000"}",
  panelUrl = "https://rpadmin.mtarg.xyz",
  pollInterval = 3000,
  snapshotInterval = 20000,
  eventFlushInterval = 5000,
  logChat = true,
  showStatusLabel = true,
  debug = false,
}`;
}
