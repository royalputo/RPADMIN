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
          return `<div class="actions">
            <button class="btn sm" data-raaction="start" data-res="${esc(r.name)}" ${!canStart || isRunning ? "disabled" : ""}>Start</button>
            <button class="btn sm" data-raaction="restart" data-res="${esc(r.name)}" ${canRestart ? "" : "disabled"}>Restart</button>
            <button class="btn sm danger" data-raaction="stop" data-res="${esc(r.name)}" ${!canStop || !isRunning ? "disabled" : ""}>Stop</button>
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
        <div><h2>Resources</h2><p>${running} of ${resources.length} resources running.</p></div>
      </div>
      <div class="toolbar">
        <input class="search" data-filter="resourcesTable" placeholder="Search resources..." />
        <span class="pill">${running} running</span>
      </div>
      ${failedNote}${table}${note}`,
    onMount(el) {
      initTables(el);
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
