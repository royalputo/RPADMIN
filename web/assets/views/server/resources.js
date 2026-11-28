import { canAction } from "../../permissions.js";
import { badge, confirmDialog, dataTable, esc, initTables } from "../../components/ui.js";

function stateBadge(state) {
  if (state === "running") return badge("running", "on");
  if (state === "loaded") return badge("loaded", "warn");
  if (/fail/i.test(state || "")) return badge(state, "danger");
  return badge(state || "stopped", "off");
}

export async function tab(ctx) {
  const resources = (ctx.snapshot.resources || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const running = resources.filter((r) => r.state === "running").length;
  const failed = resources.filter((r) => /fail/i.test(r.state || ""));
  const canAllStart = canAction(ctx.role, "resource", "start");
  const canAllStop = canAction(ctx.role, "resource", "stop");
  const issues = (ctx.snapshot.activity || [])
    .filter((a) => a.kind === "error" || a.kind === "warn")
    .slice(0, 6);
  const recentActions = (ctx.snapshot.commands || [])
    .filter((c) => ["resource", "resources_all_start", "resources_all_stop"].includes(c.action))
    .slice(0, 6);
  const canRestart = canAction(ctx.role, "resource", "restart");
  const canStart = canAction(ctx.role, "resource", "start");
  const canStop = canAction(ctx.role, "resource", "stop");

  const table = dataTable({
    id: "resourcesTable",
    columns: [
      { label: "Resource", mono: true, sortable: true, render: (r) => `<strong>${esc(r.name)}</strong>`, sortValue: (r) => r.name },
      { label: "State", sortable: true, render: (r) => stateBadge(r.state), sortValue: (r) => r.state },
      { label: "Type", sortable: true, render: (r) => esc(r.type || "-") },
      { label: "Author", sortable: true, render: (r) => esc(r.author || "-") },
      { label: "Version", render: (r) => esc(r.version || "-") },
      {
        label: "Actions",
        align: "right",
        render: (r) => {
          const isRunning = r.state === "running";
          const isStopped = r.state === "stopped";
          return `<div class="actions">
            <button class="btn sm" data-raaction="start" data-res="${esc(r.name)}" ${!canStart || isRunning ? "disabled" : ""}>Start</button>
            <button class="btn sm" data-raaction="restart" data-res="${esc(r.name)}" ${canRestart ? "" : "disabled"}>Restart</button>
            <button class="btn sm danger" data-raaction="stop" data-res="${esc(r.name)}" ${!canStop || isStopped ? "disabled" : ""} title="${isRunning ? "Stop resource" : "Try to stop/unload this loaded resource"}">Stop</button>
          </div>`;
        },
      },
    ],
    rows: resources,
    empty: "No resources reported by the connector",
    rowAttrs: (r) => (/fail/i.test(r.state || "") ? 'class="row-error"' : ""),
  });

  const failedNote = failed.length
    ? `<div class="banner danger mt-16"><div><strong>${failed.length} script${failed.length === 1 ? "" : "s"} failed.</strong> ${failed
        .map((r) => `<span class="mono">${esc(r.name)}</span>`)
        .join(", ")} — check the Activity log for captured errors and restart the resource.</div></div>`
    : "";

  const note = !canRestart
    ? `<div class="banner mt-16"><div>Your role can view resources but cannot control them. Restart requires Admin, start/stop requires Owner.</div></div>`
    : "";

  return {
    title: "Resources",
    html: `<div class="page-head">
        <div><h2>Resources</h2><p>${running} of ${resources.length} resources running \u00b7 <span class="mono">rp_admin</span>, <span class="mono">admin</span> and <span class="mono">webadmin</span> are skipped by bulk actions.</p></div>
        <div class="row">
          <button class="btn" id="refreshResourcesBtn" title="Ask MTA to rescan the resources folder">Refresh list</button>
          <button class="btn success" id="startAllBtn" ${canAllStart ? "" : "disabled"}>Start all</button>
          <button class="btn danger" id="stopAllBtn" ${canAllStop ? "" : "disabled"}>Stop all</button>
        </div>
      </div>
      <div class="toolbar">
        <input class="search" data-filter="resourcesTable" placeholder="Search resources..." />
        <span class="pill">${running} running</span>
      </div>
      ${issues.length
        ? `<div class="card" style="margin-bottom:16px">
            <div class="card-head"><h3 class="card-title">Recent script errors &amp; warnings</h3><a class="btn-link" href="/${ctx.shortId}/activity" data-link>Activity</a></div>
            <div class="notice-list">${issues
              .map(
                (i) => `<div class="health-issue"><span class="badge ${i.kind === "error" ? "danger" : "warn"}">${esc(i.kind)}</span><span class="grow">${esc(i.text)}</span></div>`
              )
              .join("")}</div>
          </div>`
        : ""}
      ${failedNote}
      ${recentActions.length
        ? `<div class="card" style="margin:16px 0">
            <div class="card-head"><h3 class="card-title">Recent resource actions</h3><span class="pill">${recentActions.length}</span></div>
            <div class="notice-list">${recentActions
              .map(
                (c) => `<div class="health-issue">
                  <span class="badge ${c.status === "done" ? "on" : c.status === "failed" ? "danger" : "info"}">${esc(c.status)}</span>
                  <span class="grow mono">${esc(c.action)} ${esc(JSON.stringify(c.args || {}))}</span>
                  ${c.error ? `<span style="color:#ff9a9a">${esc(c.error)}</span>` : ""}
                </div>`
              )
              .join("")}</div>
          </div>`
        : ""}
      ${table}${note}`,
    onMount(el) {
      initTables(el);

      const refreshList = el.querySelector("#refreshResourcesBtn");
      if (refreshList) {
        refreshList.addEventListener("click", async () => {
          refreshList.disabled = true;
          const result = await ctx.data.action(ctx.shortId, "resources_refresh", {});
          if (result && result.ok) ctx.toast("Resources rescanned", "ok");
          else ctx.toast((result && result.error) || "Refresh failed", "err");
          setTimeout(() => {
            if (typeof ctx.reload === "function") ctx.reload();
            refreshList.disabled = false;
          }, 1500);
        });
      }

      const startAll = el.querySelector("#startAllBtn");
      if (startAll) {
        startAll.addEventListener("click", () => ctx.act("resources_all_start", {}));
      }

      const stopAll = el.querySelector("#stopAllBtn");
      if (stopAll) {
        stopAll.addEventListener("click", async () => {
          const ok = await confirmDialog({
            title: "Stop all resources?",
            message: "Every running resource except rp_admin, admin and webadmin will be stopped. The game will break until they are started again.",
            confirmLabel: "Stop all",
            danger: true,
          });
          if (ok) ctx.act("resources_all_stop", {});
        });
      }

      el.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-raaction]");
        if (!btn || btn.disabled) return;
        ev.preventDefault();
        const resource = btn.dataset.res;
        const op = btn.dataset.raaction;
        if (op === "stop") {
          const ok = await confirmDialog({ title: `Stop ${resource}?`, message: "Players may be affected while the resource is stopped.", confirmLabel: "Stop resource", danger: true });
          if (!ok) return;
        }
        ctx.act("resource", { resource, op });
      });
    },
  };
}
