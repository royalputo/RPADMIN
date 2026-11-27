# RpAdmin — Dev By Royalputo

`Rp` = **R**oyal**p**uto

A modern MTA:SA admin platform: a dark, sidebar-driven web panel on
`https://rpadmin.mtarg.xyz`, Supabase behind a same-origin `/api` proxy, and
the `rp_admin` connector resource that replaces the default `admin` resource.

**Players never see the Supabase URL or keys.** The browser only calls
`/api/*` on our domain, and the MTA script only knows our domain + its own
server key.

## Repository layout (this folder)

```
resources/[admin]/
  admin/          default MTA admin resource (untouched — rollback)
  rp_admin/       connector resource (fork of admin + connector agent)
  web/            static SPA + Cloudflare Pages Function
    functions/api/[[path]].js   same-origin Supabase proxy
  supabase/
    migrations/0001_init.sql   schema + RLS + triggers + RPCs
  docs/           install, troubleshooting, rollback
  plan.md         implementation plan
```

## How it works

1. The owner signs up on `rpadmin.mtarg.xyz` (Supabase Auth via `/api/auth/*`).
2. **Create server** generates a key client-side (`rsk_...`), stores only its
   SHA-256 hash in `servers.key_hash`, and returns the key once.
3. The owner installs `rp_admin` and pastes `config.lua` — it contains only our
   domain, the server key, and the server id/uuid.
4. The connector polls `https://rpadmin.mtarg.xyz/api/rest/*` with
   `X-Server-Key`. The Pages Function adds the Supabase credentials server-side;
   RLS matches the key hash.
5. Panel actions are inserted into `commands`; a SQL trigger validates the
   action, role and arguments. The agent executes and writes back the result.

No agent auth user, service-role key, Edge Function or exposed Supabase URL is
needed anywhere.

## Quick start

1. **SQL**: Supabase → SQL Editor → run
   `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_google_profile_names.sql`.

2. **Local preview** (UI only, demo data):

   ```bash
   npx serve web
   # http://localhost:3000/?demo=1
   ```

   To run the real API locally you need Wrangler, because `/api` is a Pages
   Function:

   ```bash
   npx wrangler pages dev web \
     --binding SUPABASE_URL=https://euwrxmsqbsdkvdqhjdrd.supabase.co \
     --binding SUPABASE_ANON_KEY=<anon key>
   ```

3. **Deploy**: GitHub → Cloudflare Pages.
   - Root directory: `web`
   - Build command: *(empty)*
   - Output directory: `.`
   - Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (encrypt the key)
   - Custom domain: `rpadmin.mtarg.xyz`

4. **Connector**: follow `docs/install.md` — copy `rp_admin`, paste the config
   from the panel, apply ACL, update `mtaserver.conf`.

## What is already wired

- Email/password **and Google sign-in** (Google Identity Services + Supabase
  `id_token` grant through `/api`; no Supabase URL exposed).
- Full SPA: landing, auth, server list, create-server flow with one-time key,
  per-server panel (dashboard, players + drawer, resources, bans, staff,
  warnings/notes, activity/audit, guarded console, settings).
- Same-origin `/api` proxy so the browser never receives Supabase credentials.
- Role matrix (viewer/moderator/admin/owner) enforced in the UI and in SQL.
- `supabase/migrations/0001_init.sql`: schema, RLS, helper functions, argument
  validation, agent column guard, owner-only RPCs.
- `rp_admin` connector: key-based auth, single-flight poll with `setTimer`
  (no nested `fetchRemote`), corrected IP+serial ban signature, snapshots,
  buffered activity, optional server-log tail, `/panel` command, staff status
  label.
- `RpAdmin` ACL group/rights added to `acl.xml` (additive).
- Owner-only staff management with an in-app invite inbox (mail icon);
  accepting opens that server's panel.
- Quick console drawer on every panel tab.
- Script health: failed resources highlighted with one-click restart; optional
  `logFile` tailing forwards ERROR/WARNING lines into Activity.
- `web/rp_admin.zip` download.

## Remaining steps for you

- Cloudflare Pages project + env vars + `rpadmin.mtarg.xyz` custom domain.
- Switch `mtaserver.conf` to `rp_admin` after creating the first server and
  pasting its key (keeps the default `admin` for rollback).
- SMTP provider for auth emails (Resend suggested), or disable email
  confirmation while testing.

## Branding

Always **RpAdmin** and **Dev By Royalputo**. The product/resource names
(`RpAdmin`, `rp_admin`, `RP_ADMIN`, `rp_admin.zip`) are fixed.
