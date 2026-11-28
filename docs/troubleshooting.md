# RpAdmin — troubleshooting

**RpAdmin — Dev By Royalputo**

## Panel stays offline / connector logs `key rejected`

1. Check `rp_admin/shared/config.lua`:
   - `url`, `anonKey`, `serverKey`, `serverUuid` must all be filled.
   - Placeholders containing `<` disable the connector by design.
2. Enable `debug = true` and restart the resource.
3. `key rejected (HTTP 401/403)` means the hash of `serverKey` does not match
   any `servers.key_hash`. Rotate the key in **Settings → Rotate server key**,
   paste the new key, restart `rp_admin`.
4. `schema missing (HTTP 404)` means `supabase/migrations/0001_init.sql` has not
   been run in the Supabase SQL Editor.

## TLS / certificate errors (MTA fetchRemote)

Some MTA builds fail HTTPS to certain CAs. Test with a throwaway resource:

```lua
addEventHandler("onResourceStart", resourceRoot, function()
  fetchRemote("https://euwrxmsqbsdkvdqhjdrd.supabase.co/auth/v1/settings", function(data, errno, info)
    outputServerLog(("fetchRemote errno=%s status=%s"):format(tostring(errno), tostring(info and info.statusCode)))
  end, { headers = "apikey: sb_publishable_Ml9v9E6LmCLA3exzAmxPiA_L4NTCCP3\r\n" })
end)
```

If this fails, put a Cloudflare Worker in front of the Supabase project on your
own domain and point `RP_ADMIN.url` at the worker.

## `nested fetchRemote` errors in server.log

MTA forbids calling `fetchRemote` inside its own callback. The agent already
defers every follow-up with `setTimer`. Do not add a `fetchRemote` call inside
`call()`'s callback — use `later(function() ... end)`.

## `new row violates row-level security policy`

- **Agent**: the `X-Server-Key` header must hash to `servers.key_hash`. The
  agent may only update `commands` (`status/result/error/executed_at`), write
  `server_state`, and insert `activity`.
- **Panel member**: the user must have a `server_members` row with a role that
  permits the action. Use the role matrix in **Staff** as the reference.
- **Owner RPCs**: `rotate_server_key`, `invite_server_member`,
  `revoke_server_invite` and `remove_server_member` require the owner role.
- **Invite inbox**: `my_server_invites`, `accept_server_invite` and
  `decline_server_invite` only act on invites whose email matches the caller's
  JWT email.

## A staff invite was created but the person cannot see it

Invites are not mailed. The invitee signs in, clicks the **mail icon** in the
topbar, and accepts or declines. If they already had an account, the owner can
add them directly and they appear in the member list immediately. Pending
invites are also listed under **Staff → Pending invites** for the owner.

## Log errors are not appearing in Script health

- Set `logFile` in `shared/config.lua` to the absolute server log path, then
  restart `rp_admin`.
- Only lines written **after** the resource starts are forwarded, and only
  lines containing `error`, `failed to load`, `failed to start` or `warning`.
- `fileOpen` must be able to read the path; use forward slashes on Windows and
  avoid placeholders (<...> disables it).
- Failed resources still show up even without log tailing, because their state
  comes from `getResourceState` in the snapshot.

## Resources do not start / stop and commands show no result

1. Run `0003_agent_rpc_and_delete.sql` and `0006_command_cleanup.sql`.
   Without 0003 the agent cannot write results or snapshots; without 0006 a
   backlog of expired pending commands can block new ones.
2. `restart rp_admin`; the log must show
   `connector started (agent v2)`. Editing `agent.lua` alone does not reload it.
3. Open **Settings → Connector diagnostics**:
   - `Last poll` shows the HTTP status and how many commands were returned.
   - `Last action` / `Last result` show what the agent executed.
   - `Last error` shows key rejections, HTTP failures or watchdog restarts.
4. Check **ACL** in the panel: `function.startResource`,
   `function.stopResource`, `function.restartResource` must be enabled for the
   `RpAdmin` ACL. If you just edited `acl.xml`, restart the MTA server.
5. Server log lines to look for:
   - `received N command(s)` — the agent fetched commands.
   - `command 42 (kick) -> done` — executed.
   - `poll watchdog: restarting command polling` — a callback stopped the loop
     and the agent restarted it automatically.

The agent now ignores already-expired commands and logs every action, so a
stuck backlog cannot starve new commands.

## Two servers show the same data / a new server never updates

Each MTA server must use **its own** `shared/config.lua`. If you copy the
`rp_admin` folder from another server, you also copy its `serverKey` and
`serverUuid`, so both agents write the same `server_state`/`commands` rows.

1. Panel → open the correct server (`https://rpadmin.mtarg.xyz/<id>`) →
   **Settings**. Compare **Server UUID** and the key hint with that server's
   `rp_admin/shared/config.lua`.
2. If the key was lost, use **Rotate server key** and paste the new key.
3. Never copy `shared/config.lua` between servers.
4. Restart `rp_admin` on both. The log now prints the UUID:
   ```
   connector started (agent v3) for server 2 [<uuid>]
   ```
   The UUIDs must be different.
5. Commands are executed by whichever agent owns that UUID — sharing a UUID
   means actions run on both servers.

## Live updates feel slow

The panel polls every 5s; the agent pushes a snapshot every 20s. Use the topbar
**↻** (snapshot now) or **Resources → Refresh list** for an immediate rescan.
Both require `0008_refresh_commands.sql`, and `Refresh list` needs
`function.refreshResources` in the `RpAdmin` ACL plus a server restart. A newly
added resource folder also has to be started/refreshed in MTA before it exists.

## Errors / warnings are not showing in Activity

- MTA script errors and warnings are captured from `onDebugMessage`; make sure
  `rp_admin` is restarted after updating `events.lua`.
- Server log lines (`ERROR`, `WARNING`, `failed to start`) additionally require
  `logFile` in `shared/config.lua`; only lines written after the resource starts
  are forwarded.
- Events are flushed every 5 seconds, 10 per batch. Activity shows the newest
  300 events.

## Body Cam stays on “waiting” / no frames

1. Run `0005_bodycam.sql` in the Supabase SQL Editor.
2. ACL tab → `function.takePlayerScreenShot` must be **enabled**, then restart
   the MTA server so `acl.xml` is reloaded.
3. `restart rp_admin` and confirm the log says `agent v2`.
4. Watch the server log:
   - `bodycam screenshot request rejected` → ACL right missing.
   - `bodycam frame upload failed (HTTP …)` → the agent cannot reach
     `/rpc/agent_push_frame` (wrong server key or missing SQL).
5. Some client setups block screenshots; try another player.

Frames are intentionally short-lived: only the newest two per player are kept,
with a 10-minute cleanup.

## `permission denied for action: ban` (or similar)

The SQL trigger `commands_before_insert` rejected the command because the
member's role is too low. This is expected for Moderators trying to ban, and
for Admins trying to shut down.

## `invalid ban duration` / `message is empty` / `server name must be 3-60`

Argument validation happens in SQL (`command_arg_error`). Fix the UI input; do
not bypass the trigger.

## Deep links 404

- **Worker:** `wrangler.jsonc` sets
  `not_found_handling: "single-page-application"`, so `/1/players` falls back to
  `index.html`. No `_redirects` file is needed.
- **Pages:** if you deploy with Pages instead, add `web/_redirects` containing
  `/* /index.html 200`.
- Do **not** keep `_redirects` when deploying the Worker: `wrangler` rejects
  `/* /index.html 200` as an infinite loop (error `100324`).

## Console shows no live server output

MTA does not expose stdout through its API. The Console view is a guarded
command runner plus the `commands` action log — it is not a log stream. Real
log tailing would require `fileOpen` on `mods/deathmatch/logs/server.log`.

## Shutdown/restart does nothing

`shutdown` needs the protected `function.shutdown` right for the resource
object. Confirm the `RpAdmin` ACL is attached to `resource.rp_admin` and that
the server was restarted after editing `acl.xml`.

MTA cannot restart itself. "Restart (shutdown)" only shuts down; an external
supervisor (NSSM, Task Scheduler, systemd) must start it again.

## `admin` and `rp_admin` both running

They will fight over ACLs and commands. Set `admin` to `startup="0"` or stop it
(`stop admin`) before starting `rp_admin`.

## Realtime updates not arriving

- The SQL file adds `server_state`, `activity` and `commands` to the Realtime
  publication.
- RLS still applies to Realtime; only members receive rows.
- Free-tier projects can pause after inactivity — wake the project in the
  Supabase dashboard.

## Key rotation did not disconnect the old key

Rotation updates `servers.key_hash` immediately; the next poll from the old key
gets `401/403` and stops. Already-queued commands stay queued and can still be
executed by the old key until it polls again — rotate and restart the resource
promptly.

## Signup says "check your email" but no mail arrives

The project has email confirmation enabled without SMTP. Configure an SMTP
provider (Resend is suggested). Keep confirmation enabled in production: staff
invites are matched by email.

## Can a random player read our database?

No. The browser never receives the Supabase URL or keys — it only talks to
`/api/*` on our domain, and the Pages Function adds the credentials
server-side. Every table is also protected by RLS:

- anonymous `/api` requests can only read/write rows for a server whose
  `X-Server-Key` hashes to `servers.key_hash` (the connector);
- signed-in users only see servers where they have a `server_members` row;
- `profiles` is self-only, `audit`/`notes`/`warnings` are member-only;
- owner RPCs check `member_role(server) = 'owner'`.

Anyone can register an account, but a new account sees an empty dashboard and
no other server's data.

## `/api` returns 500 "Server is not configured"

The Pages Function is missing its environment. In the Pages project →
Settings → Environment variables, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`
for both **Production** and **Preview**, then redeploy. They are only read
server-side.

## Google sign-in errors

The app uses Google Identity Services (GIS) with `GOOGLE_CLIENT_ID` from
`web/assets/config.js`.

### `Error 400: origin_mismatch`

The origin the browser is on is not registered on the Google OAuth client.

1. Copy the exact origin from the address bar (scheme + host, no path):
   `https://rpadmin.mtarg.xyz`.
2. Google Cloud Console → APIs & Services → Credentials → the **Web
   application** client whose ID matches `GOOGLE_CLIENT_ID`.
3. **Authorised JavaScript origins** → add:
   - `https://rpadmin.mtarg.xyz`
   - `http://localhost:4173` and `http://127.0.0.1:4173` (local preview)
   - any `*.workers.dev` / `*.pages.dev` host you test on
   No trailing slash; `http` and `https` are different.
4. Save, wait a few minutes, incognito reload.

### Button missing / “Google sign-in is unavailable”

- `GOOGLE_CLIENT_ID` is empty in `web/assets/config.js`.
- `accounts.google.com/gsi/client` is blocked (CSP or network).
- Supabase → Authentication → Providers → Google uses the **same** Client
  ID/Secret.
- Consent screen **Testing**: add the Google account as a test user (or publish
  the app).

## Local preview shows errors / no data

The SPA no longer falls back to demo data automatically. `node tools/preview.mjs`
reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` from the environment or
`web secret.txt`; without them `/api` returns 500. `npx serve web` has no `/api`
at all — use `?demo=1` for a UI-only preview, or the preview script / Wrangler
for live data.
