import { canAction } from "../../permissions.js";
import { badge, esc, emptyState, timeAgo } from "../../components/ui.js";

// Dedicated tab for script errors & warnings: which script is failing, what
// it said last, and the live error/warning feed from the connector.
export async function tab(ctx) {
  const entries = (ctx.snapshot.scriptIssues || []).slice();
  const states = {};
  (ctx.snapshot.resources || []).forEach((r) => { states[r.name] = r.state || "unknown"; });
  const canRestart = canAction(ctx.role, "resource", "restart");

  entries.sort((a, b) => {
    const av = (a.errors || 0) * 1000 + (a.warns || 0);
    const bv = (b.errors || 0) * 1000 + (b.warns || 0);
    if (bv !== av) return bv - av;
    return String(a.name).localeCompare(String(b.name));
  });

  const totalErrors = entries.reduce((sum, e) => sum + (e.errors || 0), 0);
  const totalWarns = entries.reduce((sum, e) => sum + (e.warns || 0), 0);
  const feed = (ctx.snapshot.activity || [])
    .filter((a) => a.kind === "error" || a.kind === "warn")
    .slice(0, 40);

  const issueCard = (e) => {
    const state = states[e.name] || "unknown";
    const stateTone = state === "running" ? "on" : /fail/i.test(state) ? "danger" : "warn";
    return `<div class="card issue-card ${e.errors > 0 ? "issue-error" : "issue-warn"}">
      <div class="card-head">
        <div class="row">
          <strong class="mono" style="font-size:14px">${esc(e.name)}</strong>
          ${badge(state, stateTone)}
          ${e.errors ? badge(`${e.errors} error${e.errors === 1 ? "" : "s"}`, "danger") : ""}
          ${e.warns ? badge(`${e.warns} warn${e.warns === 1 ? "" : "s"}`, "warn") : ""}
        </div>
        <button class="btn sm" data-issue-restart="${esc(e.name)}" ${canRestart ? "" : "disabled"}
          title="Restart this script — resets its error counters">Restart</button>
      </div>
      <div class="code-block"><pre>${esc(e.last || "No message captured")}</pre></div>
      <p class="muted" style="font-size:11.5px;margin:10px 0 0">last event ${e.at ? esc(timeAgo(e.at)) : "recently"} \u00b7 counters reset on restart \u00b7 full history in <a class="btn-link" href="/${ctx.shortId}/activity" data-link>Activity</a></p>
    </div>`;
  };

  const feedRow = (i) => `<div class="log-row">
    <span class="log-time">${esc(i.createdAt ? new Date(i.createdAt).toLocaleTimeString() : "-")}</span>
    <span class="log-kind ${esc(i.kind)}">${esc(i.kind)}</span>
    <span class="log-text">${i.actor && i.actor !== "server" ? `<span class="mono">${esc(i.actor)}</span> \u2014 ` : ""}${esc(i.text)}</span>
  </div>`;

  return {
    title: "Script Errors",
    html: `<div class="page-head">
        <div><h2>Script Errors</h2><p>Errors and warnings captured live from the server while scripts run \u2014 restart a script to reset its counters.</p></div>
        <div class="row">
          <span class="badge danger">${totalErrors} errors</span>
          <span class="badge warn">${totalWarns} warnings</span>
        </div>
      </div>

      ${entries.length
        ? `<div class="grid cols-2">${entries.map(issueCard).join("")}</div>`
        : `<div class="card mt-16">${emptyState(
            "All scripts are clean",
            ctx.snapshot.server && ctx.snapshot.server.online
              ? "No errors or warnings have been captured since the connector started. New errors appear here automatically."
              : "The connector is offline — start your MTA server to capture script errors."
          )}</div>`}

      <div class="card mt-16">
        <div class="card-head">
          <h3 class="card-title">Live error &amp; warning feed</h3>
          <span class="pill">${feed.length}</span>
        </div>
        ${feed.length
          ? `<div class="log-list">${feed.map(feedRow).join("")}</div>`
          : '<p class="muted" style="margin:0">Nothing captured yet. Errors and warnings from onDebugMessage appear here in real time.</p>'}
      </div>`,
    onMount(el) {
      el.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-issue-restart]");
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        await ctx.act("resource", { resource: btn.dataset.issueRestart, op: "restart" });
      });
    },
  };
}
