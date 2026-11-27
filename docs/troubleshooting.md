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

## `permission denied for action: ban` (or similar)

The SQL trigger `commands_before_insert` rejected the command because the
member's role is too low. This is expected for Moderators trying to ban, and
for Admins trying to shut down.

## `invalid ban duration` / `message is empty` / `server name must be 3-60`

Argument validation happens in SQL (`command_arg_error`). Fix the UI input; do
not bypass the trigger.

## Deep links 404 on Cloudflare Pages

Ensure `web/_redirects` exists and contains `/* /index.html 200`, and that the
Pages build output directory is `web`.

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

## Local preview shows demo data

`npx serve web` cannot run Pages Functions, so `/api/health` fails and the SPA
falls back to demo. Use `npx wrangler pages dev web --binding ...` (see
`docs/install.md`) or deploy to Pages to test live auth/data.
