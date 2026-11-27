import { CONFIG } from "./config.js";

const API = CONFIG.API_BASE || "/api";
const SESSION_KEY = "rp_session";

let session = null;
const serverCache = new Map();

function loadSession() {
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    session = null;
  }
}

function storeSession(value) {
  session = value;
  try {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

function sessionValid() {
  return !!(session && session.access_token && (session.expires_at || 0) > Date.now() + 5000);
}

function normalizeAuth(data) {
  const expires = Number(data.expires_in) || 3600;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || (session && session.refresh_token),
    expires_at: Date.now() + expires * 1000 - 60000,
    user: data.user || (session && session.user) || null,
  };
}

async function refresh() {
  loadSession();
  if (!session || !session.refresh_token) return false;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) {
      storeSession(null);
      return false;
    }
    storeSession(normalizeAuth(await res.json()));
    return true;
  } catch {
    storeSession(null);
    return false;
  }
}

async function ensureSession() {
  loadSession();
  if (!session) throw new Error("Not signed in");
  if (sessionValid()) return;
  const ok = await refresh();
  if (!ok) throw new Error("Session expired — sign in again");
}

async function http(path, options = {}) {
  const { method = "GET", body, auth = true, retry = true, headers = {} } = options;
  if (auth) await ensureSession();

  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (auth && session && session.access_token) {
    requestHeaders.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && auth && retry) {
    const ok = await refresh();
    if (ok) return http(path, { ...options, retry: false });
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error_description || data.msg || data.message || data.error || message;
    } catch {
      /* keep status message */
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  return res.text();
}

const rest = (path, options) => http(`/rest${path}`, options);
const rpc = (name, args) => rest(`/rpc/${name}`, { method: "POST", body: args || {} });

function fail(error) {
  return { ok: false, error: error && error.message ? error.message : String(error) };
}

function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeServerKey() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return CONFIG.KEY_PREFIX + hex(bytes);
}

async function hashKey(key) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
}

function keyHint(key) {
  return `rsk_\u2026 ${key.slice(-4)}`;
}

function buildSnippet(server, key) {
  return `RP_ADMIN = {
  url = "${CONFIG.PANEL_URL}",
  serverKey = "${key}",
  serverId = "${server.shortId ?? server.short_id}",
  serverUuid = "${server.id}",
  panelUrl = "${CONFIG.PANEL_URL}",
  pollInterval = 3000,
  snapshotInterval = 20000,
  eventFlushInterval = 5000,
  logFile = "",
  logTailInterval = 5000,
  logChat = true,
  showStatusLabel = true,
  debug = false,
}`;
}

function mapServer(row) {
  const state = Array.isArray(row.server_state) ? row.server_state[0] : row.server_state || {};
  const member = Array.isArray(row.server_members) ? row.server_members[0] : row.server_members || {};
  const lastSeen = state.last_seen || null;
  const snapshot = state.snapshot || {};
  return {
    id: row.id,
    shortId: row.short_id,
    name: row.name,
    slug: row.slug,
    keyHint: row.key_hint,
    createdAt: row.created_at,
    online: !!lastSeen && Date.now() - new Date(lastSeen).getTime() <= CONFIG.ONLINE_WINDOW_MS,
    lastSeen,
    playerCount: state.player_count || 0,
    maxPlayers: state.maxplayers || 0,
    uptime: snapshot.uptime || 0,
    version: state.version || "-",
    gamemode: state.gamemode || "-",
    port: state.port || 0,
    httpPort: snapshot.httpPort || 0,
    role: member.role || "viewer",
  };
}

function quote(value) {
  return encodeURIComponent(String(value));
}

async function currentUser() {
  await ensureSession();
  return session.user;
}

async function resolveServer(shortId) {
  const key = String(shortId);
  if (serverCache.has(key)) return serverCache.get(key);
  const user = await currentUser();
  if (!user) return null;
  const rows = await rest(
    `/servers?select=id,short_id,name,slug,key_hint,created_at,server_state(*),server_members!inner(role,user_id)` +
      `&short_id=eq.${Number(shortId)}&server_members.user_id=eq.${quote(user.id)}`
  );
  if (!rows.length) return null;
  const mapped = mapServer(rows[0]);
  serverCache.set(key, mapped);
  return mapped;
}

export const supabaseApi = {
  isMock: false,
  demoFallback: false,

  async schemaReady() {
    try {
      const res = await fetch(`${API}/health`);
      if (!res.ok) return false;
      const data = await res.json();
      return !!(data && data.ok && data.schema);
    } catch {
      return false;
    }
  },

  async getSession() {
    loadSession();
    if (!session) return null;
    if (!sessionValid()) {
      const ok = await refresh();
      if (!ok) return null;
    }
    return { user: session.user, session };
  },

  async signIn(email, password) {
    try {
      const data = await http("/auth/login", { method: "POST", auth: false, body: { email, password } });
      storeSession(normalizeAuth(data));
      return { session };
    } catch (err) {
      return { error: err.message };
    }
  },

  async signUp(email, password, displayName) {
    try {
      const data = await http("/auth/signup", {
        method: "POST",
        auth: false,
        body: { email, password, displayName },
      });
      if (data && data.access_token) {
        storeSession(normalizeAuth(data));
        return { session };
      }
      return { needsConfirmation: true };
    } catch (err) {
      return { error: err.message };
    }
  },

  async googleSignIn(credential) {
    const data = await http("/auth/google", { method: "POST", auth: false, body: { credential } });
    storeSession(normalizeAuth(data));
    return { session };
  },

  async signOut() {
    try {
      if (session) await http("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    storeSession(null);
    serverCache.clear();
    return true;
  },

  async listServers() {
    const user = await currentUser();
    if (!user) return [];
    const rows = await rest(
      `/servers?select=id,short_id,name,slug,key_hint,created_at,server_state(*),server_members!inner(role,user_id)` +
        `&server_members.user_id=eq.${quote(user.id)}&order=short_id.asc`
    );
    return rows.map((row) => {
      const mapped = mapServer(row);
      serverCache.set(String(mapped.shortId), mapped);
      return mapped;
    });
  },

  async getSnapshot(shortId) {
    const server = await resolveServer(shortId);
    if (!server) return { error: "not_found" };
    const filter = `server_id=eq.${server.id}`;
    const [stateRows, activity, warnings, notes, members, invites, commands] = await Promise.all([
      rest(`/server_state?select=*&${filter}`),
      rest(`/activity?select=*&${filter}&order=id.desc&limit=300`),
      rest(`/warnings?select=*&${filter}&order=id.desc&limit=200`),
      rest(`/notes?select=*&${filter}&order=id.desc&limit=200`),
      rest(`/server_members?select=*&${filter}`),
      rest(`/server_invites?select=*&${filter}&order=created_at.desc`),
      rest(`/commands?select=*&${filter}&order=id.desc&limit=60`),
    ]);

    const state = stateRows[0] || null;
    const snapshot = (state && state.snapshot) || {};
    const lastSeen = state && state.last_seen;
    const onlineAccounts = new Set((snapshot.players || []).map((p) => p.account).filter(Boolean));

    return {
      server: {
        ...server,
        online: !!lastSeen && Date.now() - new Date(lastSeen).getTime() <= CONFIG.ONLINE_WINDOW_MS,
        lastSeen,
        playerCount: (state && state.player_count) || 0,
        maxPlayers: (state && state.maxplayers) || server.maxPlayers,
        uptime: snapshot.uptime || 0,
        version: (state && state.version) || server.version,
        gamemode: (state && state.gamemode) || server.gamemode,
        port: (state && state.port) || server.port,
      },
      role: server.role,
      players: (snapshot.players || []).map((p, i) => ({ id: p.serial || `p${i}`, ...p })),
      resources: snapshot.resources || [],
      bans: (snapshot.bans || []).map((b, i) => ({
        id: b.id || `ban-${i}`,
        ip: b.ip,
        serial: b.serial,
        nick: b.nick,
        reason: b.reason,
        admin: b.admin,
        bannedAt: b.bannedAt,
        unbanTime: b.unbanTime || 0,
        permanent: !b.unbanTime,
      })),
      members: members.map((m) => ({
        userId: m.user_id,
        name: m.display_name || m.mta_account || "member",
        email: m.email || "",
        role: m.role,
        mtaAccount: m.mta_account,
        online: !!m.mta_account && onlineAccounts.has(m.mta_account),
      })),
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        mtaAccount: i.mta_account,
        createdAt: i.created_at,
      })),
      warnings: warnings.map((w) => ({
        id: w.id,
        playerName: w.player_name,
        playerSerial: w.player_serial,
        reason: w.reason,
        issuedByName: w.issued_by_name,
        createdAt: w.created_at,
        revokedAt: w.revoked_at,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        playerName: n.player_name,
        playerSerial: n.player_serial,
        note: n.note,
        createdByName: n.created_by_name,
        createdAt: n.created_at,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        kind: a.kind,
        actor: a.actor,
        text: a.text,
        createdAt: a.created_at,
      })),
      commands: commands.map((c) => ({
        id: c.id,
        action: c.action,
        args: c.args,
        status: c.status,
        createdByName: c.created_by_name,
        createdAt: c.created_at,
        executedAt: c.executed_at,
        result: c.result,
        error: c.error,
      })),
    };
  },

  async action(shortId, action, args) {
    args = args || {};
    const server = await resolveServer(shortId);
    if (!server) return { ok: false, error: "Server not found" };

    try {
      if (action === "revoke-warning") {
        await rest(`/warnings?id=eq.${Number(args.id)}&server_id=eq.${server.id}`, {
          method: "PATCH",
          body: { revoked_at: new Date().toISOString() },
          headers: { Prefer: "return=minimal" },
        });
        return { ok: true, message: "Warning revoked" };
      }

      if (action === "note") {
        await rest("/notes", {
          method: "POST",
          body: { server_id: server.id, player_name: args.player, note: args.note },
          headers: { Prefer: "return=minimal" },
        });
        return { ok: true, message: `Note saved for ${args.player}` };
      }

      if (action === "warn") {
        await rest("/warnings", {
          method: "POST",
          body: { server_id: server.id, player_name: args.player, reason: args.reason },
          headers: { Prefer: "return=minimal" },
        });
        await rest("/commands", {
          method: "POST",
          body: {
            server_id: server.id,
            action: "warn",
            args: { player: args.player, reason: args.reason },
          },
          headers: { Prefer: "return=minimal" },
        });
        return { ok: true, message: `Warned ${args.player}` };
      }

      if (action === "add-member") {
        const data = await rpc("invite_server_member", {
          p_server: server.id,
          p_email: args.email,
          p_role: args.role,
          p_mta: args.mtaAccount || "",
        });
        const status = data && data.status;
        return {
          ok: true,
          message: status === "invited" ? `Invite saved for ${args.email}` : `Added ${args.email}`,
        };
      }

      if (action === "revoke-invite") {
        await rpc("revoke_server_invite", { p_server: server.id, p_id: args.id });
        return { ok: true, message: "Invite revoked" };
      }

      if (action === "remove-member") {
        await rpc("remove_server_member", { p_server: server.id, p_user: args.userId });
        return { ok: true, message: "Member removed" };
      }

      const commandAction = action === "server-settings" ? "server" : action;
      const commandArgs = action === "server-settings"
        ? { name: args.name, maxPlayers: args.maxPlayers }
        : args;

      await rest("/commands", {
        method: "POST",
        body: { server_id: server.id, action: commandAction, args: commandArgs },
        headers: { Prefer: "return=minimal" },
      });
      return { ok: true, message: "Command queued" };
    } catch (err) {
      return fail(err);
    }
  },

  async createServer(name) {
    try {
      const key = makeServerKey();
      const hash = await hashKey(key);
      const hint = keyHint(key);
      const data = await rpc("create_server", { p_name: name, p_key_hash: hash, p_key_hint: hint });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { ok: false, error: "Server creation returned no data" };
      serverCache.clear();
      const server = {
        id: row.id,
        shortId: row.short_id,
        name: row.name,
        keyHint: row.key_hint,
        createdAt: row.created_at,
      };
      return { ok: true, server, key, snippet: buildSnippet(server, key) };
    } catch (err) {
      return fail(err);
    }
  },

  async rotateKey(shortId) {
    const server = await resolveServer(shortId);
    if (!server) return { ok: false, error: "Server not found" };
    try {
      const key = makeServerKey();
      const hash = await hashKey(key);
      const hint = keyHint(key);
      await rpc("rotate_server_key", { p_server: server.id, p_key_hash: hash, p_key_hint: hint });
      serverCache.delete(String(shortId));
      return { ok: true, key, keyHint: hint, message: "Key rotated" };
    } catch (err) {
      return fail(err);
    }
  },

  async myInvites() {
    try {
      const data = await rpc("my_server_invites", {});
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async acceptInvite(id) {
    try {
      const data = await rpc("accept_server_invite", { p_id: id });
      serverCache.clear();
      return { ok: true, shortId: data && data.short_id, role: data && data.role };
    } catch (err) {
      return fail(err);
    }
  },

  async declineInvite(id) {
    try {
      await rpc("decline_server_invite", { p_id: id });
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  },

  async deleteServer(shortId) {
    const server = await resolveServer(shortId);
    if (!server) return { ok: false, error: "Server not found" };
    try {
      await rpc("delete_server", { p_server: server.id });
      serverCache.clear();
      return { ok: true, message: `Deleted ${server.name}` };
    } catch (err) {
      return fail(err);
    }
  },

  async subscribe() {
    // Realtime is intentionally disabled: the panel polls through /api, and the
    // Supabase URL/keys are never exposed to the browser.
    return () => {};
  },
};
