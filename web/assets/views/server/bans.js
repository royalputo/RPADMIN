import { can } from "../../permissions.js";
import { banExpiry, confirmDialog, dataTable, esc, fmtDateTime, initTables } from "../../components/ui.js";

export async function tab(ctx) {
  const bans = (ctx.snapshot.bans || []).slice().sort((a, b) => new Date(b.bannedAt) - new Date(a.bannedAt));
  const canUnban = can(ctx.role, "unban");
  const active = bans.filter((b) => b.permanent || b.unbanTime > Date.now());

  const table = dataTable({
    id: "bansTable",
    columns: [
      { label: "IP", mono: true, sortable: true, render: (b) => esc(b.ip || "-"), sortValue: (b) => b.ip || "" },
      { label: "Nickname", sortable: true, render: (b) => esc(b.nick || "-") },
      { label: "Serial", mono: true, render: (b) => esc(b.serial || "-") },
      { label: "Reason", render: (b) => `<span style="white-space:normal">${esc(b.reason || "-")}</span>`, sortable: true, sortValue: (b) => b.reason || "" },
      { label: "By", sortable: true, render: (b) => esc(b.admin || "-") },
      { label: "Banned", sortable: true, render: (b) => esc(fmtDateTime(b.bannedAt)), sortValue: (b) => b.bannedAt || "" },
      { label: "Expires", sortable: true, render: (b) => esc(banExpiry(b)), sortValue: (b) => b.permanent ? 0 : b.unbanTime },
      {
        label: "Actions",
        align: "right",
        render: (b) => `<button class="btn sm danger" data-unban="${esc(b.id)}" data-ip="${esc(b.ip || "")}" data-serial="${esc(b.serial || "")}" data-nick="${esc(b.nick || b.ip)}" ${canUnban ? "" : "disabled"}>Unban</button>`,
      },
    ],
    rows: bans,
    empty: "No bans on this server",
  });

  const note = !canUnban ? `<div class="banner mt-16"><div>Unbanning requires the Admin role or higher.</div></div>` : "";

  return {
    title: "Bans",
    html: `<div class="page-head">
        <div><h2>Bans</h2><p>${active.length} active \u00b7 ${bans.length} total \u00b7 IP + serial bans.</p></div>
      </div>
      <div class="toolbar">
        <input class="search" data-filter="bansTable" placeholder="Search IP, nickname, reason..." />
        <span class="pill">${active.length} active</span>
      </div>
      ${table}${note}`,
    onMount(el) {
      initTables(el);
      el.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-unban]");
        if (!btn || btn.disabled) return;
        const ok = await confirmDialog({
          title: "Remove ban?",
          message: `This will unban ${btn.dataset.nick} and allow them to reconnect.`,
          confirmLabel: "Unban",
          danger: true,
        });
        if (ok) {
          ctx.act("unban", {
            id: btn.dataset.unban,
            ip: btn.dataset.ip,
            serial: btn.dataset.serial,
            nick: btn.dataset.nick,
          });
        }
      });
    },
  };
}
