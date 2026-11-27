# RpAdmin — install guide

**RpAdmin — Dev By Royalputo** · `Rp` = **R**oyal**p**uto

This guide takes you from a fresh Supabase project to a live panel at
`https://rpadmin.mtarg.xyz/<serverId>` with the `rp_admin` connector running on
your MTA server.

The backend is a **single SQL file**. No service-role key, Edge Functions or
Supabase CLI login is required.

Players/owners never see the Supabase URL or keys:

- The browser talks only to `/api/*` on `https://rpadmin.mtarg.xyz`.
  A Cloudflare Pages Function (`web/functions/api/[[path]].js`) adds the
  Supabase credentials server-side.
- The MTA connector talks only to `https://rpadmin.mtarg.xyz/api/rest/*` with
  its server key in `X-Server-Key`; RLS matches its SHA-256 hash against
  `servers.key_hash`.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are Cloudflare Pages environment
variables, never files the browser or the MTA script can read.

---

## 1. Supabase (database)

Project: `https://euwrxmsqbsdkvdqhjdrd.supabase.co`

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste and run `supabase/migrations/0001_init.sql` (schema, RLS, triggers,
   RPCs, Realtime).
3. Paste and run `supabase/migrations/0002_google_profile_names.sql`
   (Google full-name support). Both are safe to re-run on this project.

Alternative with the CLI (needs the database password):

```bash
supabase link --project-ref euwrxmsqbsdkvdqhjdrd
supabase db push
```

### Auth settings

- `Authentication → Providers → Email`: enabled.
- Configure SMTP (Resend recommended) so signup/password resets are delivered.
- **Keep Confirm email enabled in production.** Staff invites are matched by
  email, so an unconfirmed signup could otherwise claim one. Disable
  confirmation only for local testing.
- The `handle_new_user` trigger creates a `profiles` row automatically.

### Google sign-in

1. Google Cloud Console → **APIs & Services → Credentials** → Create OAuth
   client ID → **Web application**.
2. **Authorized JavaScript origins:**
   - `https://rpadmin.mtarg.xyz`
   - `http://localhost:4173` (local preview)

   No redirect URI is needed for the Google Identity Services button.
3. Supabase → **Authentication → Providers → Google** → enable and paste the
   **same** Client ID + Client Secret.
4. Put the Client ID (public) in `web/assets/config.js`:
   ```js
   GOOGLE_CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com",
   ```
5. Redeploy. The login/register pages show **Continue with Google**. If the
   value is empty the button stays hidden.

How it works: Google returns an ID token to the browser, the browser posts it to
`/api/auth/google`, and the Pages Function exchanges it with Supabase
(`grant_type=id_token`) server-side. The Supabase URL and keys never reach the
browser.

### Verify servers are saved

After creating a server, run in the SQL Editor:

```sql
select short_id, name, owner_id, created_at from servers order by short_id;
select server_id, player_count, last_seen from server_state;
```

Demo mode (`?demo=1`) never writes to Supabase; live mode does.

### Live / demo behaviour

The site auto-detects the schema: if `servers` exists it runs live, otherwise
it shows demo data with a banner. Force a mode with `?live=1` or `?demo=1`.

---

## 2. Cloudflare Pages (web panel + API proxy)

1. Push this repository to GitHub.
2. Cloudflare → Workers & Pages → **Create → Pages → Connect to Git**.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - **Root directory:** `web`
   - Build output directory: `.`
4. Environment variables (Production **and** Preview):

   | Name | Value | Encrypt |
   |---|---|---|
   | `SUPABASE_URL` | `https://euwrxmsqbsdkvdqhjdrd.supabase.co` | no |
   | `SUPABASE_ANON_KEY` | your Supabase publishable/anon key | yes |

5. Deploy. Pages automatically builds the function from
   `web/functions/api/[[path]].js` — it serves `/api/health`, `/api/auth/*`
   and `/api/rest/*`. Nothing else is exposed.
6. Custom domain: `rpadmin.mtarg.xyz` (CNAME to `<project>.pages.dev`).
7. `web/_redirects` already contains `/* /index.html 200` so deep links such as
   `/1/players` work.

Do **not** put the Supabase URL or keys in `web/assets/*`; the client only
knows `PANEL_URL` and `/api`.

---

## 3. MTA server (`rp_admin` resource)

### 3.1 Create the server in the panel

Sign up at `https://rpadmin.mtarg.xyz`, open **Dashboard → Create server**, and
copy:

- the **server key** (`rsk_...`, shown once),
- the generated `config.lua` snippet.

### 3.2 Copy the resource

Copy the `rp_admin` folder into:

```
<MTA server>/mods/deathmatch/resources/[admin]/rp_admin
```

The downloadable `web/rp_admin.zip` contains the same folder.

### 3.3 Edit `shared/config.lua`

Paste the snippet from the panel:

```lua
RP_ADMIN = {
  url = "https://rpadmin.mtarg.xyz",
  serverKey = "rsk_...",
  serverId = "1",
  serverUuid = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  panelUrl = "https://rpadmin.mtarg.xyz",
  pollInterval = 3000,
  snapshotInterval = 20000,
  eventFlushInterval = 5000,
  logFile = "",
  logTailInterval = 5000,
  logChat = true,
  showStatusLabel = true,
  debug = false,
}
```

`logFile` is optional but recommended: set it to the absolute MTA server log
path so ERROR/WARNING lines show up in **Script health** and **Activity**:

- Windows: `D:/MTA/server/mods/deathmatch/logs/server.log`
- Linux: `/home/mta/server/mods/deathmatch/logs/server.log`

Only new lines written after the resource starts are forwarded.

> `serverUuid` is the database id (not the `/1` panel id). Without it the
> connector logs "not configured" and stays offline. There is no agent email
> or agent password — the server key is the only credential.

### 3.4 ACL

This workspace's `acl.xml` already contains the `RpAdmin` group and ACL. For
other servers add:

```xml
<group name="RpAdmin">
    <object name="resource.rp_admin"></object>
    <acl name="RpAdmin"></acl>
</group>
<acl name="RpAdmin">
    <right name="function.kickPlayer" access="true"></right>
    <right name="function.banPlayer" access="true"></right>
    <right name="function.setPlayerMuted" access="true"></right>
    <right name="function.setElementFrozen" access="true"></right>
    <right name="function.startResource" access="true"></right>
    <right name="function.stopResource" access="true"></right>
    <right name="function.restartResource" access="true"></right>
    <right name="function.setServerName" access="true"></right>
    <right name="function.setServerPassword" access="true"></right>
    <right name="function.setMaxPlayers" access="true"></right>
    <right name="function.getBans" access="true"></right>
    <right name="function.removeBan" access="true"></right>
    <right name="function.shutdown" access="true"></right>
</acl>
```

### 3.5 `mtaserver.conf`

Once `rp_admin` is verified, replace the default admin startup:

```xml
<resource src="admin" startup="0" protected="0" />
<resource src="rp_admin" startup="1" protected="1" />
```

Keep the `admin` folder on disk for rollback (see `docs/rollback.md`).

### 3.6 Restart

Restart the MTA server (or `start rp_admin` from the console). Watch the server
console for:

```
[RpAdmin] connector started for server 1 — polling https://... every 3000ms
```

The panel shows **online** within ~10 seconds.

---

## 4. Verification checklist

- [ ] Panel registers/logs in with Supabase Auth.
- [ ] Create server returns a key once and a `config.lua` snippet.
- [ ] Agent polls without `key rejected` / `schema missing` errors.
- [ ] Dashboard shows players/resources/bans from the snapshot.
- [ ] Join/quit updates the player list within ~20s (or immediately after an action).
- [ ] `say`, `warn`, `kick`, `ban` execute in game and appear in Activity.
- [ ] Moderator cannot ban; Admin cannot shutdown; Owner can.
- [ ] `/panel` in game prints the panel URL and connector status.
- [ ] Stop the server → panel shows offline; commands expire after 5 minutes.
- [ ] Owner invites an email → invitee signs in, opens the **mail icon**,
      accepts, and lands on that server's panel.
- [ ] **Console** button in the topbar opens the quick console on any tab.
- [ ] A failed resource is highlighted in **Resources** and **Script health**,
      with a one-click restart.
- [ ] With `logFile` set, new ERROR/WARNING lines appear in Activity.

---

## Security model (short version)

- The browser never receives the Supabase URL or keys; all requests go through
  the same-origin `/api` Pages Function.
- The MTA config contains only the panel URL and the server key — nothing else.
- The server key is the agent credential. It is stored only in
  `shared/config.lua` (gitignored) and hashed in `servers.key_hash`.
- RLS lets the agent read/update only its own `commands`, write its own
  `server_state`, and insert `activity`.
- A trigger rejects any agent change outside `status`, `result`, `error`,
  `executed_at`.
- Panel commands are inserted directly by the authenticated member; a trigger
  validates the action, the role permission and every argument before the row
  reaches the agent.
- Only the owner can rotate the key or manage staff, enforced in SQL RPCs.

## Branding

Every user-visible surface uses **RpAdmin** and **Dev By Royalputo**:
landing page, login card, sidebar footer, page titles, `meta.xml`, `/panel`
output, and this documentation.
