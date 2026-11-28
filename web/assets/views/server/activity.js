import { badge, dataTable, esc, fmtDateTime, fmtTime, initTables } from "../../components/ui.js";

const KINDS = ["all", "issues", "error", "warn", "join", "quit", "say", "kick", "ban", "unban", "note", "mute", "freeze", "resource", "staff", "login", "logout"];

function statusBadge(status) {
  if (status === "done") return badge("done", "on");
  if (status === "failed") return badge("failed", "danger");
  if (status === "expired") return badge("expired", "warn");
  return badge(status || "pending", "info");
}

export async function tab(ctx) {
  const activity = ctx.snapshot.activity || [];
  const commands = ctx.snapshot.commands || [];

  const logRows = activity
    .map(
      (r) => `<div class="log-row" data-kind="${esc(r.kind || "")}" data-text="${esc(`${r.text} ${r.actor || ""}`.toLowerCase())}">
        <span class="log-time">${fmtTime(r.createdAt)}</span>
        <span class="log-kind ${esc(r.kind || "other")}">${esc(r.kind || "event")}</span>
        <span class="log-text">${esc(r.text)}</span>
      </div>`
    )
    .join("");

  const commandTable = dataTable({
    id: "commandsTable",
    columns: [
      { label: "#", mono: true, render: (c) => esc(c.id) },
      { label: "Action", sortable: true, render: (c) => `<span class="mono">${esc(c.action)}</span>`, sortValue: (c) => c.action },
      { label: "Args", render: (c) => `<span class="mono">${esc(JSON.stringify(c.args || {}))}</span>` },
      { label: "Status", sortable: true, render: (c) => statusBadge(c.status), sortValue: (c) => c.status },
      { label: "By", render: (c) => esc(c.createdByName || "-") },
      { label: "Queued", sortable: true, render: (c) => esc(fmtDateTime(c.createdAt)), sortValue: (c) => c.createdAt },
      { label: "Result", render: (c) => (c.error ? `<span style="color:#ff9a9a;white-space:normal">${esc(c.error)}</span>` : '<span class="muted">ok</span>') },
    ],
    rows: commands,
    empty: "No commands queued yet",
  });

  return {
    title: "Activity",
    html: `<div class="page-head">
        <div><h2>Activity &amp; audit</h2><p>Every admin action, join, quit and resource change, newest first.</p></div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="card-title">Event log</h3>
          <div class="row">
            <select class="input" id="kindFilter" style="width:150px;padding:7px 10px">
              ${KINDS.map((k) => `<option value="${k}">${k === "all" ? "All events" : k === "issues" ? "Errors & warnings" : k}</option>`).join("")}
            </select>
            <input class="search" id="activitySearch" placeholder="Filter text..." style="min-width:190px" />
          </div>
        </div>
        <div class="log-list" id="activityLog">${logRows || '<div class="empty"><div class="empty-title">No activity yet</div><div class="empty-hint">Connector events will appear here.</div></div>'}</div>
        <div class="muted" id="activityCount" style="font-size:12px;margin-top:10px"></div>
      </div>

      <div class="card mt-16">
        <div class="card-head"><h3 class="card-title">Command queue</h3><span class="pill">${commands.length} recent</span></div>
        ${commandTable}
      </div>`,
    onMount(el) {
      initTables(el);
      const log = el.querySelector("#activityLog");
      const kindFilter = el.querySelector("#kindFilter");
      const search = el.querySelector("#activitySearch");
      const count = el.querySelector("#activityCount");

      const apply = () => {
        const kind = kindFilter.value;
        const q = search.value.trim().toLowerCase();
        let visible = 0;
        Array.from(log.querySelectorAll(".log-row")).forEach((row) => {
          const okKind =
            kind === "all" ||
            (kind === "issues" ? row.dataset.kind === "error" || row.dataset.kind === "warn" : row.dataset.kind === kind);
          const okText = !q || row.dataset.text.includes(q);
          const show = okKind && okText;
          row.style.display = show ? "" : "none";
          if (show) visible += 1;
        });
        count.textContent = `${visible} of ${activity.length} events shown`;
      };
      kindFilter.addEventListener("change", apply);
      search.addEventListener("input", apply);
      apply();
    },
  };
}
