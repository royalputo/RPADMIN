import { can } from "../../permissions.js";
import { badge, dataTable, esc, initTables } from "../../components/ui.js";

export async function tab(ctx) {
  const acl = ctx.snapshot.acl;
  const allow = can(ctx.role, "acl.manage");

  if (!acl) {
    return {
      title: "ACL",
      html: `<div class="page-head"><div><h2>ACL</h2><p>The connector has not reported ACL data yet.</p></div></div>
        <div class="card"><div class="empty"><div class="empty-title">No ACL snapshot</div><div class="empty-hint">Restart rp_admin and wait for the next snapshot.</div></div></div>`,
    };
  }

  const rights = acl.rights || [];
  const objects = acl.objects || [];
  const enabled = rights.filter((r) => r.access).length;
  const accounts = (ctx.snapshot.players || [])
    .filter((p) => p.account && p.account !== "guest")
    .map((p) => ({ account: p.account, name: p.name }));

  const table = dataTable({
    id: "aclRightsTable",
    columns: [
      { label: "Right", mono: true, sortable: true, render: (r) => esc(r.name), sortValue: (r) => r.name },
      {
        label: "Status",
        sortable: true,
        render: (r) => badge(r.access ? "enabled" : "disabled", r.access ? "on" : "off"),
        sortValue: (r) => (r.access ? 1 : 0),
      },
      {
        label: "Action",
        align: "right",
        render: (r) =>
          `<button class="btn sm ${r.access ? "danger" : "success"}" data-acl-toggle="${esc(r.name)}" data-enabled="${r.access ? "0" : "1"}" ${allow ? "" : "disabled"}>${r.access ? "Disable" : "Enable"}</button>`,
      },
    ],
    rows: rights,
    empty: "No rights reported",
  });

  return {
    title: "ACL",
    html: `<div class="page-head">
        <div><h2>ACL</h2><p>Group <span class="mono">${esc(acl.group)}</span> \u00b7 ACL <span class="mono">${esc(acl.acl || "-")}</span> \u00b7 ${objects.length} objects \u00b7 ${enabled}/${rights.length} rights enabled.</p></div>
      </div>

      ${!allow ? `<div class="banner mb-16" style="margin-bottom:16px"><div>Only the <strong>Owner</strong> can edit ACL rights or objects.</div></div>` : ""}

      <div class="grid cols-2">
        <div class="card">
          <h3 class="card-title">Objects in the group</h3>

          <div class="field-label">Add an online player (user.account)</div>
          <div class="say-row" style="margin-bottom:12px">
            <select id="aclPlayerSelect" class="input" ${allow && accounts.length ? "" : "disabled"}>
              ${accounts.length
                ? accounts.map((a) => `<option value="${esc(a.account)}">${esc(a.name)} (${esc(a.account)})</option>`).join("")
                : '<option value="">No registered players online</option>'}
            </select>
            <button class="btn primary" id="aclAddPlayerBtn" ${allow && accounts.length ? "" : "disabled"}>Add player</button>
          </div>

          <div class="field-label">Or add any object</div>
          <form id="aclObjectForm" class="say-row" style="margin-bottom:12px">
            <input id="aclObjectInput" placeholder="user.name or resource.name" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn" type="submit" ${allow ? "" : "disabled"}>Add</button>
          </form>
          ${objects.length
            ? `<div class="notice-list">${objects
                .map(
                  (object) => `<div class="member-row">
                    <span class="mono grow">${esc(object)}</span>
                    <button class="btn sm danger" data-acl-remove="${esc(object)}" ${allow ? "" : "disabled"}>Remove</button>
                  </div>`
                )
                .join("")}</div>`
            : '<p class="muted" style="font-size:13px">No objects.</p>'}
        </div>

        <div class="card">
          <h3 class="card-title">Grant a right</h3>
          <form id="aclRightForm" class="say-row" style="margin-bottom:10px">
            <input id="aclRightInput" placeholder="function.restartResource" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn success" type="submit" ${allow ? "" : "disabled"}>Grant</button>
          </form>
          <p class="role-note">Allowed prefixes: <span class="mono">function.</span>, <span class="mono">command.</span>, <span class="mono">general.</span>, <span class="mono">resource.</span>. Changes apply to the <span class="mono">RpAdmin</span> ACL immediately.</p>
          <hr class="divider" />
          <p class="muted" style="font-size:12.5px;margin:0">Typical rights: <span class="mono">function.startResource</span>, <span class="mono">function.stopResource</span>, <span class="mono">function.restartResource</span>, <span class="mono">function.kickPlayer</span>, <span class="mono">function.shutdown</span>.</p>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <h3 class="card-title">Rights</h3>
          <input class="search" data-filter="aclRightsTable" placeholder="Search rights..." />
        </div>
        ${table}
      </div>`,
    onMount(el) {
      initTables(el);

      const refreshLater = () => {
        setTimeout(() => {
          if (typeof ctx.reload === "function") ctx.reload();
        }, 1500);
      };

      const addPlayerBtn = el.querySelector("#aclAddPlayerBtn");
      if (addPlayerBtn) {
        addPlayerBtn.addEventListener("click", async () => {
          const select = el.querySelector("#aclPlayerSelect");
          const account = select && select.value;
          if (!account) return;
          const result = await ctx.act("acl_add_object", { object: `user.${account}` });
          if (result && result.ok) {
            ctx.toast(`Added user.${account} to RpAdmin`, "ok");
          }
          refreshLater();
        });
      }

      const objectForm = el.querySelector("#aclObjectForm");
      if (objectForm) {
        objectForm.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = el.querySelector("#aclObjectInput");
          const object = input.value.trim();
          if (!object) return;
          const result = await ctx.act("acl_add_object", { object });
          if (result && result.ok) input.value = "";
          refreshLater();
        });
      }

      const rightForm = el.querySelector("#aclRightForm");
      if (rightForm) {
        rightForm.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = el.querySelector("#aclRightInput");
          const right = input.value.trim();
          if (!right) return;
          const result = await ctx.act("acl_toggle_right", { right, enabled: true });
          if (result && result.ok) input.value = "";
          refreshLater();
        });
      }

      el.addEventListener("click", async (ev) => {
        const toggle = ev.target.closest("[data-acl-toggle]");
        if (toggle && !toggle.disabled) {
          toggle.disabled = true;
          await ctx.act("acl_toggle_right", {
            right: toggle.dataset.aclToggle,
            enabled: toggle.dataset.enabled === "1",
          });
          refreshLater();
          return;
        }

        const remove = ev.target.closest("[data-acl-remove]");
        if (remove && !remove.disabled) {
          remove.disabled = true;
          await ctx.act("acl_remove_object", { object: remove.dataset.aclRemove });
          refreshLater();
        }
      });
    },
  };
}
