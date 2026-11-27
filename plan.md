# RpAdmin — MTA SaaS Admin Panel Implementation Plan

## Goal

Build **RpAdmin**, a modern admin platform for MTA:SA where a server owner registers on `rpadmin.mtarg.xyz`, creates a server, gets a **server key + connector resource**, installs it on their MTA server (`config.lua`), and then manages that server from a **per-server panel** at `rpadmin.mtarg.xyz/<id>` (e.g. `/1`). The connector also replaces the default `admin` resource on the MTA side.

> **Branding:** the product is **RpAdmin** everywhere (UI titles, docs, resource name `rp_admin`, filenames). Do not use "txAdmin" as a product name.
>
> **UI style:** keep the **txAdmin-style** look and feel (dark theme, left sidebar with Dashboard/Players/Resources/Bans/Staff/Activity/Console/Settings, stat cards, data tables, player drawer, toasts, guarded console) — "txAdmin style" is used only as a visual/UX reference, never as branding.
>
> **Brand meaning:** `Rp` = **R**oyal**p**uto. Tagline/credit line shown in the UI footer, login card, docs, `meta.xml`, and install guide: **"RpAdmin — Dev By Royalputo"**. Short form: "RpAdmin by Royalputo".

## Branding & copy (single source of truth)

| Place | Text |
|---|---|
| Product name | **RpAdmin** |
| Meaning | `Rp` = **R**oyal**p**uto |
| Credit / attribution | **Dev By Royalputo** |
| Full lockup (login card, sidebar, footer, docs header) | `RpAdmin` + `Dev By Royalputo` |
| Page `<title>` | `RpAdmin — <server name>` / `RpAdmin — Dev By Royalputo` on landing |
| MTA `meta.xml` | `author="Royalputo"`, `description="RpAdmin — Dev By Royalputo"` |
| In-game `/panel` output | `RpAdmin (Dev By Royalputo) — panel: <url>` |
| Install zip name | `rp_admin.zip` |

Rules: never label the product "txAdmin" (style reference only); keep the credit line visible on landing, login, sidebar footer, and the in-game command output.

## Locked decisions (from user)

| Topic | Decision |
|---|---|
| Scope | Complete/extend the existing panel into RpAdmin; not a separate Node clone |
| Permissions | ACL tiers mapped to panel roles (Moderator / SuperModerator→Admin / Admin→Owner) |
| Console | Guarded command console + server control (shutdown/restart) with confirm + countdown |
| Persistence | DB-backed (Supabase Postgres — supersedes earlier SQLite answer) |
| Web stack | GitHub repo + Supabase (Auth/Postgres/RLS/Realtime/Edge Functions) |
| Frontend hosting | Cloudflare Pages + custom domain `rpadmin.mtarg.xyz` (clean paths) |
| Agent connectivity | Outbound short-poll from MTA → Supabase (no inbound port needed) |
| MTA resource | New `rp_admin` resource that **replaces** the default `admin` resource |
| Identity | Supabase Auth accounts; only server owners/staff log in (no player accounts) |

## Architecture

```
Browser (owner/staff)
  rpadmin.mtarg.xyz  ── Cloudflare Pages (static SPA, vanilla JS + Supabase JS v2)
    /                 landing + login/register
    /dashboard        server list, create server, install guide
    /:shortId         per-server RpAdmin panel
        │
        ├── Supabase Auth (email/password; 1 agent auth-user per server)
        ├── PostgREST reads (RLS by membership)
        ├── Realtime (server_state, activity, commands)
        └── Edge Functions (JWT): server-create, panel-action, member-add, key-rotate
                                   │
                                   ▼
                              Supabase Postgres
                                   ▲
                                   │ HTTPS outbound only (fetchRemote)
MTA server: resources/[admin]/rp_admin
  shared/config.lua  → PANEL_URL, ANON_KEY, AGENT_EMAIL, SERVER_KEY, intervals
  server/agent.lua   → auth token → poll commands → execute → push results
  server/actions.lua → allowlisted action executor (kick/ban/mute/freeze/...)
  server/events.lua  → chat/join/quit/resource events → activity
```

**Why agent polling via PostgREST (not an Edge Function):** Supabase free tier limits Edge Function invocations (~500k/mo). A 3s poll through a function would exhaust that with ~1 server. PostgREST requests are not invocation-limited. The agent authenticates as its own Supabase Auth user (email = agent email, password = server key) and uses RLS.

**Action flow:** Panel → `panel-action` (JWT, role check) → insert `commands` row `pending` → agent polls pending → executes → PATCH `commands` (done/failed + result) + inserts `activity`/`warnings` → panel receives Realtime update.

## Repository layout (GitHub monorepo)

```
royal-panel/
  web/                      # Cloudflare Pages root (no build step)
    index.html
    _redirects              # /*  /index.html  200
    assets/config.js        # PANEL_URL, ANON_KEY (public)
    assets/app.css          # RpAdmin theme (txAdmin-style; port tokens from existing panel/app.css)
    assets/app.js           # router + auth + boot
    assets/api.js           # supabase client + PostgREST helpers
    assets/components/*.js  # table, modal, drawer, toast, badge, stat-card
    assets/views/*.js       # dashboard, players, resources, bans, staff, warnings, activity, console, settings
    assets/mock.js          # mock data for Phase 1
  supabase/
    migrations/             # SQL schema + RLS + functions
    functions/
      server-create/index.ts
      panel-action/index.ts
      member-add/index.ts
      key-rotate/index.ts
      _shared/permissions.ts
      _shared/cors.ts
  agent/                    # MTA resource (copied into server resources/[admin]/rp_admin)
    meta.xml
    shared/config.lua.example
    shared/config.lua       # gitignored
    server/agent.lua
    server/actions.lua
    server/events.lua
    ... (forked admin files)
  docs/
    install.md
    troubleshooting.md
    rollback.md
```

## Phase 1 — RpAdmin UI shell (txAdmin style, mock data)

**Visual direction:** replicate the txAdmin layout and interaction style (dark shell, persistent left sidebar, dense data tables, right-side player drawer, bottom console drawer, top status bar). Branding text is RpAdmin only — the footer shows "RpAdmin — Dev By Royalputo".

1. Create `web/` SPA: hash-free router reading `location.pathname`; routes `/`, `/login`, `/register`, `/dashboard`, `/:shortId`, `/:shortId/:tab`.
2. Port visual tokens from `resources/[admin]/admin/server/http/panel/app.css` (dark `#0e1017`, accent `#4f7cff`, cards/tables/badges/toasts). Add sidebar (Dashboard, Players, Resources, Bans, Staff, Warnings, Activity, Console, Settings), topbar (server name, online pill, uptime, account menu). Sidebar logo = "RpAdmin" + small "Dev By Royalputo" subtext.
3. Build components: stat cards, data table (sortable, search), modal, confirm dialog, side drawer (player details), toast, status badges.
4. Implement every view against `mock.js`:
   - Dashboard: player count, uptime, resources running, bans, broadcast box, recent activity, players mini-table.
   - Players: search/filter, action buttons, player drawer (serial/IP/account/warnings/notes).
   - Resources: state/type/author, start/restart/stop.
   - Bans: IP/nick/reason/expiry, unban.
   - Staff: members + roles + MTA account link, invite.
   - Warnings/Notes: list + create/revoke.
   - Activity/Audit: filterable log.
   - Console: command input + action log (label clearly: "Action log — MTA stdout is not capturable").
   - Settings: server info, key rotation, install snippet, feature toggles.
5. Add `_redirects` and verify deep links locally with a static server.
6. Branding pass: login card logo lockup (`RpAdmin` + `Dev By Royalputo`), sidebar footer credit, browser titles, empty states. No "txAdmin" text anywhere in the UI.

**Deliverable:** clickable RpAdmin panel with mock data, no backend.

## Phase 2 — Systems (Supabase)

### 2.1 Schema (migrations)

```sql
-- profiles (1:1 auth.users)
create table profiles (id uuid primary key references auth.users on delete cascade,
  display_name text, created_at timestamptz default now());

-- servers
create sequence servers_short_id_seq start 1;
create table servers (
  id uuid primary key default gen_random_uuid(),
  short_id int not null unique default nextval('servers_short_id_seq'),
  name text not null,
  owner_id uuid not null references auth.users,
  slug text unique,
  agent_email text not null unique,
  key_hash text not null,
  key_hint text,
  created_at timestamptz default now());

-- agent-writable live state (separate table so agent cannot touch servers)
create table server_state (
  server_id uuid primary key references servers on delete cascade,
  last_seen timestamptz, snapshot jsonb, version text, gamemode text,
  maxplayers int, port int, player_count int default 0);

create table server_members (
  server_id uuid references servers on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','admin','moderator','viewer')),
  mta_account text, created_at timestamptz default now(),
  primary key (server_id, user_id));

create table commands (
  id bigserial primary key, server_id uuid references servers on delete cascade,
  action text not null, args jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','done','failed','expired')),
  created_by uuid references auth.users, created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '5 minutes',
  executed_at timestamptz, result jsonb, error text);

create table activity (id bigserial primary key, server_id uuid references servers on delete cascade,
  kind text, actor text, text text, created_at timestamptz default now());
create table warnings (id bigserial primary key, server_id uuid references servers on delete cascade,
  player_name text, player_serial text, reason text, issued_by uuid, issued_by_name text,
  created_at timestamptz default now(), revoked_at timestamptz, revoked_by uuid);
create table notes (id bigserial primary key, server_id uuid references servers on delete cascade,
  player_name text, player_serial text, note text, created_by uuid, created_at timestamptz default now());
create table audit (id bigserial primary key, server_id uuid references servers on delete cascade,
  actor_user uuid, actor_name text, action text, target text, detail jsonb, created_at timestamptz default now());
```

Helper SQL functions (security definer): `is_member(server_id)`, `member_role(server_id)`, `is_agent(server_id)` (matches `auth.jwt()->>'email'` to `servers.agent_email`), `has_perm(server_id, action)`.

RLS:
- `profiles`: select/update self.
- `servers`: select if member; no client insert/update/delete (functions only).
- `server_state`: select if member; insert/update only if agent (column changes restricted by a `BEFORE UPDATE` trigger).
- `server_members`: select if member; mutations via function.
- `commands`: select if member; select+update (`status`,`result`,`executed_at` only) if agent; insert only via function (agent must NOT insert commands).
- `activity`: select if member; insert if agent.
- `warnings`: select if member; insert if agent (warn action) or via function.
- `notes`/`audit`: select if member; insert via function.
- Enable Realtime publication on `server_state`, `activity`, `commands`; RLS applies.

### 2.2 Edge Functions

`server-create` (JWT): validate name → generate key `rsk_<40 hex>` → `auth.admin.createUser({email: agent_email, password: key, email_confirm:true})` → insert `servers` (store `key_hash`, `key_hint`) + `server_state` + owner member → return `{server, key, snippet}` (key returned once).
`panel-action` (JWT): resolve member role → permission matrix check → validate args → insert `commands` (pending) → audit. Owner-only actions enforced here.
`member-add` (JWT, owner/admin): add existing account by email or create invite token; role + optional `mta_account`.
`key-rotate` (JWT, owner): new key → update agent auth password + `key_hash`/`key_hint`.

Shared `permissions.ts`:

| Action | viewer | moderator | admin | owner |
|---|---|---|---|---|
| read views | ✓ | ✓ | ✓ | ✓ |
| warn, note, mute, freeze, kick | | ✓ | ✓ | ✓ |
| say, ban, unban | | | ✓ | ✓ |
| resource restart | | | ✓ | ✓ |
| resource start/stop, server settings, shutdown/restart | | | | ✓ |
| staff manage, key rotate | | | | ✓ |

CORS allow `https://rpadmin.mtarg.xyz`; all functions use `SUPABASE_SERVICE_ROLE_KEY` from env only.

### 2.3 Wire the SPA

Replace `mock.js` with `api.js` calls: auth session, server list (`servers?select=*,server_state(*)`), server detail, members, warnings, notes, activity, commands. Subscribe to Realtime for `server_state`, `activity`, `commands` filtered by `server_id`. Mutations call `panel-action`; show toast + optimistic "queued" state.

## Phase 3 — Signup, code generation, install flow

1. Landing page: hero (**RpAdmin — Dev By Royalputo**), features, "how it works" (3 steps), CTA, footer credit.
2. Register/login/reset (Supabase Auth). Only owners/staff have accounts.
3. `/dashboard`: list servers with online badge (`last_seen < 30s`), player count, "Create server".
4. Create-server modal → `server-create` → result screen:
   - Server key (copy button, shown once),
   - full `config.lua` snippet,
   - download link for the `rp_admin` zip,
   - numbered install steps (copy resource, edit config, ACL, mtaserver.conf, restart),
   - panel URL `https://rpadmin.mtarg.xyz/<short_id>`.
5. `/:shortId` route: membership guard (403 view), 404 for unknown, redirect to `/login` when signed out.

## Phase 4 — MTA `rp_admin` resource

1. Copy `resources/[admin]/admin` → `resources/[admin]/rp_admin`; rebrand `meta.xml` (`author="Royalputo"`, `version`, `description="RpAdmin — Dev By Royalputo"`); keep existing ACL/ban/account/GUI logic.
2. Add `shared/config.lua` (gitignored) + `shared/config.lua.example`:

```lua
RP_ADMIN = {
  url = "https://<project-ref>.supabase.co",
  anonKey = "<anon key>",
  agentEmail = "agent+1@royalputo.local",
  serverKey = "rsk_...",
  pollInterval = 3000,
  snapshotInterval = 20000,
  eventFlushInterval = 5000,
  debug = false,
}
```

3. `server/agent.lua`:
   - Auth: `POST /auth/v1/token?grant_type=password` (apikey header); store access/refresh token; refresh before expiry; exponential backoff on failure; log status to console + a global for the in-game GUI.
   - Poll: `GET /rest/v1/commands?server_id=eq.<id>&status=eq.pending&select=id,action,args&order=id.asc&limit=10`; **single-flight**, and schedule the next poll with `setTimer` (never call `fetchRemote` inside its own callback — MTA forbids nested calls).
   - Execute each via `actions.lua`; `PATCH /rest/v1/commands?id=eq.<id>` `{status,result,executed_at}`; mark stale (`created_at` older than `expires_at`) as `expired`.
   - Snapshot: `PATCH /rest/v1/server_state?server_id=eq.<id>` with `{snapshot,last_seen,version,gamemode,maxplayers,port,player_count}` every `snapshotInterval` and immediately on join/quit/resource change.
   - Events: buffer chat/join/quit/admin/resource events; `POST /rest/v1/activity` every `eventFlushInterval`.
4. `server/actions.lua` — allowlist with validators and structured results:
   `say`, `kick`, `ban` (correct signature: `banPlayer(player, true, false, true, root, reason, seconds)` — IP+serial; the old `admin_webapi.lua` call was wrong), `unban`, `mute`/`unmute`, `freeze`/`unfreeze`, `warn` (insert warnings row + notify), `note`, `resource` (start/stop/restart), `server` (set_name/set_password/set_maxplayers), `shutdown` (owner-only, announce countdown, then `shutdown(reason)`).
   Resolve players by exact then partial name; never execute unknown actions.
5. `server/events.lua`: `onPlayerChat`, `onPlayerJoin`, `onPlayerQuit`, `onResourceStart/Stop`, and admin actions → activity.
6. In-game GUI: keep existing themed GUI; add a small "Panel: online/offline • last sync" label and `/panel` command that prints `RpAdmin (Dev By Royalputo) — panel: <url>` plus masked key status.
7. ACL + config:
   - Add `<object name="resource.rp_admin">` to a dedicated `RpAdmin` ACL with: `general.http`, `function.kickPlayer`, `function.banPlayer`, `function.setPlayerMuted`, `function.setElementFrozen`, `function.startResource`, `function.stopResource`, `function.restartResource`, `function.setServerName`, `function.setServerPassword`, `function.setMaxPlayers`, `function.getBans`, `function.removeBan`, `function.shutdown` (protected; resource object only).
   - `mtaserver.conf`: `admin` → `startup="0"`, add `<resource src="rp_admin" startup="1" protected="1" />`.
   - Keep the `admin` folder for rollback.
8. Verify no external dependency on the `admin` resource (already checked in this workspace: no `exports.admin` / `getResourceFromName("admin")` usage).

## Phase 5 — Hardening, deployment, validation

### Security
- Server key only in `config.lua` (gitignored); show once; rotation supported.
- All mutations via `panel-action`; RLS blocks direct command inserts; agent cannot touch `servers`/`server_members`.
- Validate every action arg server-side (player name length, reason length, seconds range, resource name exists).
- Audit every mutation (who/what/when/result).
- Guard `shutdown` behind owner + confirm + countdown; rate-limit login (Supabase) and actions (per-user throttle in `panel-action`).
- HTTPS everywhere (Cloudflare Pages + Supabase); CORS restricted to the panel domain.

### Deployment
1. GitHub repo → Cloudflare Pages project (root `web`, no build, output `/`); custom domain `rpadmin.mtarg.xyz` (CNAME to `<project>.pages.dev`).
2. Supabase: `supabase db push`; `supabase functions deploy server-create panel-action member-add key-rotate`; set secrets; configure SMTP (Resend) for invites/password reset.
3. MTA host: copy `rp_admin`, edit `config.lua`, apply ACL, update `mtaserver.conf`, restart.
4. Free-tier tuning: keep command poll at 3s (tiny GET), snapshot 20s, batch events; monitor egress/invocations.

### Validation checklist
- Register → create server → key shown once → copy config → install → agent online within ~10s (online badge).
- Panel shows players/resources/bans from snapshot; Realtime updates on join/quit.
- Each action end-to-end: say, warn, note, mute, freeze, kick, ban (IP+serial), unban, resource start/restart/stop, set name/password/maxplayers, shutdown countdown.
- Role enforcement: moderator cannot ban or stop resources; admin cannot shutdown; owner can.
- Offline behavior: stop server → panel offline badge; commands queue then expire; start server → queued commands execute or expire cleanly.
- Wrong key / revoked key → agent logs auth failure, panel stays offline, no crash loop.
- RLS: second account cannot read another server's rows; direct `commands` insert with a member JWT is rejected.
- Token refresh after >1h uptime; no nested `fetchRemote` errors in `server.log`.
- Rollback: re-enable `admin`, stop `rp_admin`.

## Risks / open items

- **MTA TLS/CA:** some MTA builds fail HTTPS to certain CAs. Verify `fetchRemote` to the Supabase domain early; fallback = Cloudflare Worker proxy on the custom domain.
- **Supabase free tier:** egress and Edge Function limits; if many servers, raise intervals or move to a paid tier.
- **Server restart:** MTA has no self-restart; `shutdown` only. Real restart needs a host supervisor (NSSM/Task Scheduler on Windows, systemd on Linux). Document and label the panel action "Restart (shutdown)".
- **Console:** MTA stdout cannot be read via API; the console view is command echo + activity. Optional later: tail `mods/deathmatch/logs/server.log` with `fileOpen` (absolute path) for real log lines.
- **Replacing default admin:** no in-repo dependents found, but external scripts may rely on its exports/events; keep rollback.
- **Prerequisites to confirm before implementation:** Supabase project ref/region, GitHub repo, Cloudflare zone for `qzz.io`, SMTP provider, and whether the MTA host has a process supervisor.

## Out of scope for v1

Player-facing website accounts, public server listing, billing/subscriptions, screenshots/reports/maps modules, Discord webhooks, 2FA, multi-region.

## Handoff

Implementation requires source edits, SQL migrations, function deploys, and MTA config/ACL changes — switch to an implementation-capable agent (Code mode). Plan mode cannot edit source files or run mutating commands.
