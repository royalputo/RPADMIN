# RpAdmin — rollback

**RpAdmin — Dev By Royalputo**

The default `admin` resource is never modified or deleted. Rollback is a config
change.

## 1. Stop the connector, re-enable the default admin

In `mtaserver.conf`:

```xml
<resource src="admin" startup="1" protected="0" />
<resource src="rp_admin" startup="0" protected="0" />
```

Restart the MTA server, or from the console:

```
stop rp_admin
start admin
```

## 2. (Optional) remove the RpAdmin ACL

Remove these blocks from `acl.xml` if you want a clean uninstall:

```xml
<group name="RpAdmin">
    <object name="resource.rp_admin"></object>
    <acl name="RpAdmin"></acl>
</group>
<acl name="RpAdmin"> ... </acl>
```

The ACL is additive: leaving it in place is harmless.

## 3. (Optional) delete the resource

```
resources/[admin]/rp_admin
```

## 4. Database

Rows are owned by the Supabase project, not the MTA server. To fully remove a server, delete its `servers` row; cascades clear `server_state`, `commands`, `activity`, `warnings`, `notes`, `audit` and `server_members`. The server key hash disappears with the row — there is no separate agent account to delete.

## What is lost on rollback

- Panel history/audit rows stay in Supabase.
- Queued commands expire after 5 minutes.
- In-game `/panel` command disappears (it belongs to `rp_admin`).
- The in-game status label disappears.

The default admin GUI, ACLs, bans and accounts continue to work because
`rp_admin` is a fork and did not alter `admin/`.
