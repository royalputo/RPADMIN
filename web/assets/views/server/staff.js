import { can } from "../../permissions.js";
import { badge, confirmDialog, dataTable, esc, initTables, openModal, roleBadge, timeAgo } from "../../components/ui.js";

const ROLE_MATRIX = [
  ["View panels", "yes", "yes", "yes", "yes"],
  ["Warn, note, mute, freeze, kick", "", "yes", "yes", "yes"],
  ["Say, ban, unban, restart resource", "", "", "yes", "yes"],
  ["Start/stop resource, settings, shutdown", "", "", "", "yes"],
  ["Manage staff, rotate key", "", "", "", "yes"],
];

function matrixTable() {
  return `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>Capability</th><th>Viewer</th><th>Moderator</th><th>Admin</th><th>Owner</th></tr></thead>
    <tbody>${ROLE_MATRIX.map(
      (row) => `<tr><td>${esc(row[0])}</td>${row
        .slice(1)
        .map((v) => `<td>${v === "yes" ? '<span class="badge on">yes</span>' : '<span class="muted">\u2014</span>'}</td>`)
        .join("")}</tr>`
    ).join("")}</tbody></table></div>`;
}

export async function tab(ctx) {
  const members = ctx.snapshot.members || [];
  const invites = ctx.snapshot.invites || [];
  const canManage = can(ctx.role, "staff.manage");

  const table = dataTable({
    id: "staffTable",
    columns: [
      {
        label: "Member",
        sortable: true,
        sortValue: (m) => m.name,
        render: (m) => `<div class="row"><span class="avatar" style="width:28px;height:28px;border-radius:7px;font-size:12px">${esc((m.name || "?").charAt(0))}</span><div><strong>${esc(m.name)}</strong><div class="muted" style="font-size:11.5px">${esc(m.email || "")}</div></div></div>`,
      },
      { label: "Role", sortable: true, render: (m) => roleBadge(m.role), sortValue: (m) => m.role },
      { label: "MTA account", mono: true, render: (m) => (m.mtaAccount ? esc(m.mtaAccount) : '<span class="muted">not linked</span>') },
      { label: "Status", render: (m) => (m.online ? badge("in-game", "on") : badge("offline", "off")) },
      {
        label: "Actions",
        align: "right",
        render: (m) => `<button class="btn sm danger" data-remove="${esc(m.userId)}" data-name="${esc(m.name)}" ${!canManage || m.role === "owner" ? "disabled" : ""}>Remove</button>`,
      },
    ],
    rows: members,
    empty: "No staff members",
  });

  return {
    title: "Staff",
    html: `<div class="page-head">
        <div><h2>Staff</h2><p>${members.length} member${members.length === 1 ? "" : "s"} \u00b7 roles map to your MTA ACL tiers.</p></div>
        <button class="btn primary" id="inviteBtn" ${canManage ? "" : "disabled"}>+ Invite member</button>
      </div>
      ${table}
      ${invites.length ? `<div class="card mt-16">
        <div class="card-head"><h3 class="card-title">Pending invites</h3><span class="pill">${invites.length}</span></div>
        <div class="notice-list">${invites
          .map(
            (invite) => `<div class="member-row">
              <span class="avatar">${esc((invite.email || "?").charAt(0))}</span>
              <div class="grow">
                <strong>${esc(invite.email)}</strong>
                <div class="muted" style="font-size:11.5px">waiting for signup \u00b7 ${esc(timeAgo(invite.createdAt))}</div>
              </div>
              ${roleBadge(invite.role)}
              <button class="btn sm danger" data-revoke-invite="${esc(invite.id)}" data-email="${esc(invite.email)}" ${canManage ? "" : "disabled"}>Revoke</button>
            </div>`
          )
          .join("")}</div>
      </div>` : ""}
      <div class="card mt-16">
        <h3 class="card-title">Role permissions</h3>
        ${matrixTable()}
      </div>
      ${!canManage ? `<div class="banner mt-16"><div>Only the Owner can invite or remove staff.</div></div>` : ""}`,
    onMount(el) {
      initTables(el);

      const inviteBtn = el.querySelector("#inviteBtn");
      if (inviteBtn) {
        inviteBtn.addEventListener("click", () => {
          openModal({
            title: "Invite staff member",
            subtitle: "If they do not have an account yet, the invite is saved and applied automatically when they register.",
            body: `<label class="field"><span>Email</span><input id="inviteEmail" type="email" placeholder="moderator@example.com" /></label>
              <label class="field"><span>Role</span><select id="inviteRole">
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select></label>
              <label class="field"><span>MTA account (optional)</span><input id="inviteMta" placeholder="mta_username" /></label>
              <div id="inviteError" class="form-error"></div>`,
            actions: [
              { label: "Cancel", tone: "ghost" },
              {
                label: "Send invite",
                tone: "primary",
                onClick(close) {
                  const email = document.getElementById("inviteEmail").value.trim();
                  const role = document.getElementById("inviteRole").value;
                  const mtaAccount = document.getElementById("inviteMta").value.trim();
                  if (!email) {
                    document.getElementById("inviteError").textContent = "Email is required.";
                    return;
                  }
                  close();
                  ctx.act("add-member", { email, role, mtaAccount });
                },
              },
            ],
          });
        });
      }

      el.addEventListener("click", async (ev) => {
        const inviteBtn = ev.target.closest("[data-revoke-invite]");
        if (inviteBtn && !inviteBtn.disabled) {
          const ok = await confirmDialog({
            title: "Revoke invite?",
            message: `${inviteBtn.dataset.email} will no longer join this server automatically.`,
            confirmLabel: "Revoke",
            danger: true,
          });
          if (ok) ctx.act("revoke-invite", { id: inviteBtn.dataset.revokeInvite });
          return;
        }

        const btn = ev.target.closest("[data-remove]");
        if (!btn || btn.disabled) return;
        const ok = await confirmDialog({
          title: "Remove staff member?",
          message: `${btn.dataset.name} will lose access to this server's panel.`,
          confirmLabel: "Remove",
          danger: true,
        });
        if (ok) ctx.act("remove-member", { userId: btn.dataset.remove });
      });
    },
  };
}
