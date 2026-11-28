import { can } from "../../permissions.js";
import { activityRows, badge, dataTable, esc, fmtUptime, initTables, statCard } from "../../components/ui.js";

export async function tab(ctx) {
  const s = ctx.snapshot;
  const server = s.server;
  const players = s.players || [];
  const resources = s.resources || [];
  const running = resources.filter((r) => r.state === "running").length;
  const activeBans = (s.bans || []).filter((b) => b.permanent || b.unbanTime > Date.now());
  const canSay = can(ctx.role, "say");
  const failedResources = resources.filter((r) => /fail/i.test(r.state || ""));
  const dayAgo = Date.now() - 86400000;
  const issues = (s.activity || []).filter(
    (a) => (a.kind === "error" || a.kind === "warn") && new Date(a.createdAt).getTime() >= dayAgo
  );
  const errorCount = issues.filter((i) => i.kind === "error").length;
  const warnCount = issues.length - errorCount;

  const broadcast = canSay
    ? `<div class="card">
        <h3 class="card-title">Broadcast</h3>
        <div class="say-row">
          <input id="sayInput" placeholder="Message to all players..." maxlength="200" />
          <button class="btn primary" id="sayBtn">Send</button>
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">Sends a yellow [Server] message to everyone.</p>
      </div>`
    : `<div class="card">
        <h3 class="card-title">Broadcast</h3>
        <p class="muted" style="font-size:13px;margin:0">Your role cannot broadcast to the server. Ask an Admin or the Owner.</p>
      </div>`;

  const miniPlayers = dataTable({
    columns: [
      { label: "Name", render: (p) => `${esc(p.name)}${p.admin ? ' <span class="badge admin">admin</span>' : ""}`, sortable: true, sortValue: (p) => p.name },
      { label: "Ping", type: "num", sortable: true, render: (p) => `${esc(p.ping)} ms` },
      { label: "Country", sortable: true, render: (p) => esc(p.country) },
      { label: "Account", sortable: true, render: (p) => `<span class="mono">${esc(p.account)}</span>` },
      { label: "Status", render: (p) => `${p.muted ? badge("muted", "warn") : ""}${p.frozen ? badge("frozen", "danger") : ""}${!p.muted && !p.frozen ? badge("ok", "on") : ""}` },
    ],
    rows: players,
    empty: "No players online",
  });

  return {
    title: `${server.name} — Dashboard`,
    html: `<div class="grid cols-4">
        ${statCard("Online players", `${server.playerCount || 0} / ${server.maxPlayers || 0}`, "accent")}
        ${statCard("Uptime", server.online ? fmtUptime(server.uptime) : "\u2014", "success")}
        ${statCard("Resources", `${running} / ${resources.length}`, "warning", "running")}
        ${statCard("Active bans", String(activeBans.length), "danger")}
      </div>

      <div class="card mt-16 ${failedResources.length || errorCount ? "health-alert" : ""}">
        <div class="card-head"><h3 class="card-title">Script health</h3><a class="btn-link" href="/${server.shortId}/activity" data-link>Open activity</a></div>
        <div class="health-stats">
          <div class="health-stat"><span class="h-label">Failed scripts</span><span class="h-value ${failedResources.length ? "danger" : "ok"}">${failedResources.length}</span></div>
          <div class="health-stat"><span class="h-label">Errors 24h</span><span class="h-value ${errorCount ? "danger" : "ok"}">${errorCount}</span></div>
          <div class="health-stat"><span class="h-label">Warnings 24h</span><span class="h-value ${warnCount ? "warn" : "ok"}">${warnCount}</span></div>
        </div>
        ${failedResources.length
          ? failedResources.slice(0, 5).map((r) => `<div class="health-issue"><span class="badge danger">${esc(r.state)}</span><span class="grow mono">${esc(r.name)}</span>${can(ctx.role, "resource.restart") ? `<button class="btn sm" data-quick-restart="${esc(r.name)}">Restart</button>` : ""}</div>`).join("")
          : '<p class="muted" style="font-size:12.5px;margin:0 0 10px">All resources are loaded.</p>'}
        ${issues.slice(0, 4).map((i) => `<div class="health-issue"><span class="badge ${i.kind === "error" ? "danger" : "warn"}">${esc(i.kind)}</span><span class="grow">${i.actor && i.actor !== "server" ? `<span class="mono">${esc(i.actor)}</span> \u2014 ` : ""}${esc(i.text)}</span></div>`).join("")}
        ${!issues.length && failedResources.length ? '<p class="muted" style="font-size:12.5px;margin:8px 0 0">No recent errors or warnings were captured in the last 24 hours.</p>' : ""}
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        ${broadcast}
        <div class="card">
          <div class="card-head"><h3 class="card-title">Recent activity</h3><a class="btn-link" href="/${server.shortId}/activity" data-link>View all</a></div>
          ${activityRows(s.activity, 7)}
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-head"><h3 class="card-title">Players online</h3><a class="btn-link" href="/${server.shortId}/players" data-link>Manage players</a></div>
        ${miniPlayers}
      </div>`,
    onMount(el) {
      initTables(el);

      el.querySelectorAll("[data-quick-restart]").forEach((btn) => {
        btn.addEventListener("click", () => ctx.act("resource", { resource: btn.dataset.quickRestart, op: "restart" }));
      });

      if (!canSay) return;
      const input = el.querySelector("#sayInput");
      const send = async () => {
        const message = input.value.trim();
        if (!message) return;
        const result = await ctx.act("say", { message });
        if (result && result.ok) input.value = "";
      };
      el.querySelector("#sayBtn").addEventListener("click", send);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          send();
        }
      });
    },
  };
}
