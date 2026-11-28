import { can } from "../../permissions.js";
import { badge, confirmDialog, esc } from "../../components/ui.js";

// Selection survives re-renders (ctx.act reloads the whole tab).
const uiState = {};

function stateFor(shortId) {
  if (!uiState[shortId]) {
    uiState[shortId] = { group: "RpAdmin", expanded: {} };
  }
  return uiState[shortId];
}

// Normalize: the connector sends { groups, acls } (agent v4+); older snapshots
// only had the flat RpAdmin shape.
function normalize(acl) {
  if (!acl) return null;
  const groups = Array.isArray(acl.groups) && acl.groups.length
    ? acl.groups
    : acl.group
      ? [{ name: acl.group, objects: acl.objects || [], acls: acl.acls || [] }]
      : [];
  const acls = Array.isArray(acl.acls) && acl.acls.length
    ? acl.acls
    : acl.acl
      ? [{ name: acl.acl, rights: acl.rights || [] }]
      : [];
  return { groups, acls, active: acl.active || "RpAdmin" };
}

function rightsOf(acls, name) {
  const entry = acls.find((a) => a.name === name);
  return entry ? entry.rights || [] : [];
}

export async function tab(ctx) {
  const acl = normalize(ctx.snapshot.acl);
  const allow = can(ctx.role, "acl.manage");
  const state = stateFor(ctx.shortId);

  if (!acl) {
    return {
      title: "ACL",
      html: `<div class="page-head"><div><h2>ACL</h2><p>The connector has not reported ACL data yet.</p></div></div>
        <div class="card"><div class="empty"><div class="empty-title">No ACL snapshot</div><div class="empty-hint">Restart rp_admin and wait for the next snapshot.</div></div></div>`,
    };
  }

  if (!acl.groups.some((g) => g.name === state.group)) {
    state.group = acl.groups.length ? acl.groups[0].name : "RpAdmin";
  }

  const group = acl.groups.find((g) => g.name === state.group) || { name: state.group, objects: [], acls: [] };
  const totalRights = acl.acls.reduce((sum, a) => sum + (a.rights ? a.rights.length : 0), 0);
  const enabledRights = acl.acls.reduce(
    (sum, a) => sum + (a.rights || []).filter((r) => r.access).length,
    0
  );
  const accounts = (ctx.snapshot.players || [])
    .filter((p) => p.account && p.account !== "guest")
    .map((p) => ({ account: p.account, name: p.name }));

  const PROTECTED_GROUPS = ["Admin", "Console"];

  const groupRow = (g) => {
    const selected = g.name === state.group;
    const protectedGroup = PROTECTED_GROUPS.includes(g.name);
    return `<div class="member-row acl-group-row ${selected ? "selected" : ""}" data-acl-group="${esc(g.name)}">
      <span class="grow"><strong>${esc(g.name)}</strong>
        <small class="muted" style="display:block;font-size:11px">${g.objects.length} objects · ${g.acls.length} ACL${g.acls.length === 1 ? "" : "s"}</small>
      </span>
      ${selected ? badge("selected", "on") : ""}
      <button class="btn sm danger" data-acl-destroy-group="${esc(g.name)}" ${allow && !protectedGroup ? "" : "disabled"}
        title="${protectedGroup ? "Protected group (used by MTA core)" : "Delete this group"}">&times;</button>
    </div>`;
  };

  const objectRow = (object) => `<div class="member-row">
    <span class="mono grow">${esc(object)}</span>
    <button class="btn sm danger" data-acl-remove-object="${esc(object)}" ${allow ? "" : "disabled"}>Remove</button>
  </div>`;

  const groupAclRow = (name) => `<div class="member-row">
    <span class="mono grow">${esc(name)}</span>
    <button class="btn sm" data-acl-expand="${esc(name)}" title="Show rights">Rights</button>
    <button class="btn sm danger" data-acl-ungroup="${esc(name)}" ${allow ? "" : "disabled"}>Remove</button>
  </div>`;

  const aclSection = (entry) => {
    const open = !!state.expanded[entry.name];
    const rights = entry.rights || [];
    const enabled = rights.filter((r) => r.access).length;
    const protectedAcl = entry.name === "Default" || entry.name === "RpAdmin";

    const body = !open
      ? ""
      : `
        <div class="acl-rights">
          <div class="field-label">Grant a right to <span class="mono">${esc(entry.name)}</span></div>
          <form class="say-row" style="margin-bottom:10px" data-acl-right-form="${esc(entry.name)}">
            <input placeholder="function.restartResource" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn success" type="submit" ${allow ? "" : "disabled"}>Grant</button>
          </form>
          ${rights.length
            ? rights
                .map(
                  (r) => `<div class="member-row">
                    <span class="mono grow">${esc(r.name)}</span>
                    ${badge(r.access ? "enabled" : "disabled", r.access ? "on" : "off")}
                    <button class="btn sm ${r.access ? "danger" : "success"}" data-acl-toggle="${esc(r.name)}" data-acl="${esc(entry.name)}" data-enabled="${r.access ? "0" : "1"}" ${allow ? "" : "disabled"}>${r.access ? "Disable" : "Enable"}</button>
                  </div>`
                )
                .join("")
            : '<p class="muted" style="font-size:13px">No rights yet — grant the first one above.</p>'}
        </div>`;

    return `<div class="acl-entry ${open ? "open" : ""}" data-acl-entry="${esc(entry.name)}">
      <div class="acl-entry-head" data-acl-expand="${esc(entry.name)}">
        <span class="acl-caret">${open ? "\u25be" : "\u25b8"}</span>
        <strong class="mono">${esc(entry.name)}</strong>
        <span class="muted" style="font-size:12px">${enabled}/${rights.length} rights enabled</span>
        <span class="grow"></span>
        <button class="btn sm danger" data-acl-delete="${esc(entry.name)}" ${allow && !protectedAcl ? "" : "disabled"}
          title="${protectedAcl ? "Protected ACL" : "Delete this ACL"}">&times;</button>
      </div>
      ${body}
    </div>`;
  };

  return {
    title: "ACL",
    html: `<div class="page-head">
        <div><h2>ACL</h2><p>${acl.groups.length} groups · ${acl.acls.length} ACLs · ${enabledRights}/${totalRights} rights enabled · synced live from <span class="mono">acl.xml</span>.</p></div>
        <div class="row">
          <button class="btn" id="aclRefreshBtn">Refresh from server</button>
        </div>
      </div>

      ${!allow ? `<div class="banner mb-16" style="margin-bottom:16px"><div>Only the <strong>Owner</strong> can edit ACL groups, rights and objects.</div></div>` : ""}

      <div class="grid cols-2">
        <div class="card">
          <h3 class="card-title">ACL groups</h3>
          <form id="aclGroupForm" class="say-row" style="margin-bottom:12px">
            <input id="aclGroupName" placeholder="New group name (e.g. VIP)" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn primary" type="submit" ${allow ? "" : "disabled"}>Create</button>
          </form>
          <div class="notice-list" id="aclGroupList">${acl.groups.map(groupRow).join("")}</div>
          <p class="role-note" style="margin-top:10px">Admin and Console are protected — the panel will not remove them.</p>
        </div>

        <div class="card">
          <h3 class="card-title">Group: <span class="mono">${esc(group.name)}</span></h3>

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

          <div class="field-label">Objects in this group</div>
          <div class="notice-list" style="margin-bottom:14px">
            ${group.objects.length ? group.objects.map(objectRow).join("") : '<p class="muted" style="font-size:13px">No objects.</p>'}
          </div>

          <hr class="divider" />

          <div class="field-label">ACLs attached to this group</div>
          <form id="aclGroupAclForm" class="say-row" style="margin-bottom:12px">
            <input id="aclGroupAclName" placeholder="ACL name to attach (e.g. Default)" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn" type="submit" ${allow ? "" : "disabled"}>Attach</button>
          </form>
          <div class="notice-list">
            ${group.acls.length ? group.acls.map(groupAclRow).join("") : '<p class="muted" style="font-size:13px">No ACLs attached.</p>'}
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head">
          <h3 class="card-title">All ACLs &amp; rights</h3>
          <form id="aclCreateForm" class="say-row">
            <input id="aclCreateName" placeholder="New ACL name (e.g. VIP_ACL)" autocomplete="off" ${allow ? "" : "disabled"} />
            <button class="btn primary" type="submit" ${allow ? "" : "disabled"}>Create ACL</button>
          </form>
        </div>
        <p class="role-note" style="margin:0 0 12px">Click an ACL to open its rights. Allowed right prefixes: <span class="mono">function.</span>, <span class="mono">command.</span>, <span class="mono">general.</span>, <span class="mono">resource.</span>. Changes apply to <span class="mono">acl.xml</span> on the server immediately.</p>
        <div id="aclEntryList">${acl.acls.map(aclSection).join("")}</div>
      </div>`,
    onMount(el) {
      const refreshLater = () => {
        setTimeout(() => {
          if (typeof ctx.reload === "function") ctx.reload();
        }, 1200);
      };

      const refreshBtn = el.querySelector("#aclRefreshBtn");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
          refreshBtn.disabled = true;
          await ctx.act("snapshot_now", {});
          refreshBtn.disabled = false;
        });
      }

      const groupForm = el.querySelector("#aclGroupForm");
      if (groupForm) {
        groupForm.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = el.querySelector("#aclGroupName");
          const name = input.value.trim();
          if (!name) return;
          const result = await ctx.act("acl_create_group", { group: name });
          if (result && result.ok) state.group = name;
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
          const result = await ctx.act("acl_add_object", { object, group: state.group });
          if (result && result.ok) input.value = "";
          refreshLater();
        });
      }

      const addPlayerBtn = el.querySelector("#aclAddPlayerBtn");
      if (addPlayerBtn) {
        addPlayerBtn.addEventListener("click", async () => {
          const select = el.querySelector("#aclPlayerSelect");
          const account = select && select.value;
          if (!account) return;
          await ctx.act("acl_add_object", { object: `user.${account}`, group: state.group });
          refreshLater();
        });
      }

      const groupAclForm = el.querySelector("#aclGroupAclForm");
      if (groupAclForm) {
        groupAclForm.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = el.querySelector("#aclGroupAclName");
          const name = input.value.trim();
          if (!name) return;
          const result = await ctx.act("acl_group_add_acl", { group: state.group, acl: name });
          if (result && result.ok) input.value = "";
          refreshLater();
        });
      }

      const createForm = el.querySelector("#aclCreateForm");
      if (createForm) {
        createForm.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = el.querySelector("#aclCreateName");
          const name = input.value.trim();
          if (!name) return;
          const result = await ctx.act("acl_create_acl", { acl: name });
          if (result && result.ok) {
            input.value = "";
            state.expanded[name] = true;
          }
          refreshLater();
        });
      }

      el.addEventListener("click", async (ev) => {
        // Button actions first — rows/heads are also clickable but their
        // embedded buttons must win.
        const toggle = ev.target.closest("[data-acl-toggle]");
        if (toggle && !toggle.disabled) {
          toggle.disabled = true;
          await ctx.act("acl_toggle_right", {
            right: toggle.dataset.aclToggle,
            acl: toggle.dataset.acl,
            enabled: toggle.dataset.enabled === "1",
          });
          refreshLater();
          return;
        }

        const removeObject = ev.target.closest("[data-acl-remove-object]");
        if (removeObject && !removeObject.disabled) {
          removeObject.disabled = true;
          await ctx.act("acl_remove_object", { object: removeObject.dataset.aclRemoveObject, group: state.group });
          refreshLater();
          return;
        }

        const ungroup = ev.target.closest("[data-acl-ungroup]");
        if (ungroup && !ungroup.disabled) {
          const ok = await confirmDialog({
            title: `Detach ${ungroup.dataset.aclUngroup}?`,
            message: `The ACL "${ungroup.dataset.aclUngroup}" will be removed from group "${state.group}". The ACL itself and its rights stay in acl.xml.`,
            confirmLabel: "Detach ACL",
            danger: true,
          });
          if (!ok) return;
          await ctx.act("acl_group_remove_acl", { group: state.group, acl: ungroup.dataset.aclUngroup });
          refreshLater();
          return;
        }

        const destroyGroup = ev.target.closest("[data-acl-destroy-group]");
        if (destroyGroup && !destroyGroup.disabled) {
          const ok = await confirmDialog({
            title: `Delete group ${destroyGroup.dataset.aclDestroyGroup}?`,
            message: `The ACL group "${destroyGroup.dataset.aclDestroyGroup}" will be removed from acl.xml together with its member links. This cannot be undone.`,
            confirmLabel: "Delete group",
            danger: true,
          });
          if (!ok) return;
          await ctx.act("acl_destroy_group", { group: destroyGroup.dataset.aclDestroyGroup });
          refreshLater();
          return;
        }

        const deleteAcl = ev.target.closest("[data-acl-delete]");
        if (deleteAcl && !deleteAcl.disabled) {
          const ok = await confirmDialog({
            title: `Delete ACL ${deleteAcl.dataset.aclDelete}?`,
            message: `The ACL "${deleteAcl.dataset.aclDelete}" and all of its rights will be removed from acl.xml. This cannot be undone.`,
            confirmLabel: "Delete ACL",
            danger: true,
          });
          if (!ok) return;
          await ctx.act("acl_delete_acl", { acl: deleteAcl.dataset.aclDelete });
          refreshLater();
          return;
        }

        // Row / head toggles (not on buttons).
        const groupRowEl = ev.target.closest("[data-acl-group]");
        if (groupRowEl && !ev.target.closest("button")) {
          state.group = groupRowEl.dataset.aclGroup;
          if (typeof ctx.reload === "function") ctx.reload();
          return;
        }

        const expand = ev.target.closest("[data-acl-expand]");
        if (expand) {
          state.expanded[expand.dataset.aclExpand] = !state.expanded[expand.dataset.aclExpand];
          if (typeof ctx.reload === "function") ctx.reload();
        }
      });

      el.querySelectorAll("[data-acl-right-form]").forEach((form) => {
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const input = form.querySelector("input");
          const right = input ? input.value.trim() : "";
          if (!right) return;
          const result = await ctx.act("acl_toggle_right", { right, acl: form.dataset.aclRightForm, enabled: true });
          if (result && result.ok && input) input.value = "";
          refreshLater();
        });
      });
    },
  };
}
