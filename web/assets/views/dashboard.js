import { BRAND, CONFIG } from "../config.js";
import { bindCopyButtons, codeBlock, emptyState, esc, fmtUptime, openModal, roleBadge, timeAgo } from "../components/ui.js";
import { bindInbox } from "../components/invites.js";

function serverCard(server) {
  const online = server.online;
  return `<div class="card server-card" data-tilt="5">
    <div class="server-card-top">
      <div>
        <h3>${esc(server.name)}</h3>
        <div class="sid">/ ${esc(server.shortId)} \u00b7 ${esc(server.keyHint || "key not set")}</div>
      </div>
      <span class="pill ${online ? "on" : "off"}"><span class="dot"></span>${online ? "online" : "offline"}</span>
    </div>
    <div class="server-meta">
      <span>Players <b>${server.playerCount || 0} / ${server.maxPlayers || 0}</b></span>
      <span>Uptime <b>${online ? fmtUptime(server.uptime) : "\u2014"}</b></span>
      <span>Version <b>${esc(server.version || "-")}</b></span>
      <span>Seen <b>${server.lastSeen ? timeAgo(server.lastSeen) : "never"}</b></span>
    </div>
    <div class="row between">
      <div class="tag-list">${roleBadge(server.role)}<span class="badge off">${esc(server.gamemode || "-")}</span></div>
      <a class="btn sm primary" href="/${server.shortId}" data-link>Open panel</a>
    </div>
  </div>`;
}

function installResult(result) {
  const shortId = result.server.shortId;
  const panelUrl = `${CONFIG.PANEL_URL}/${shortId}`;
  const snippet = result.snippet || "";
  return `<div class="stack">
    <div class="banner warn"><div><strong>Copy the server key now.</strong> It is shown only once. If you lose it, rotate the key from server settings.</div></div>
    <div>
      <div class="field-label">Server key</div>
      <div class="key-reveal" id="newServerKey">${esc(result.key)}</div>
      <button class="btn sm mt-16" data-copy-target="newServerKey">Copy key</button>
    </div>
    <div>
      <div class="field-label">Panel URL</div>
      <div class="key-reveal">${esc(panelUrl)}</div>
    </div>
    <div>
      <div class="field-label">Server UUID (goes into config.lua)</div>
      <div class="key-reveal" id="newServerUuid">${esc(result.server.id)}</div>
      <button class="btn sm mt-16" data-copy-target="newServerUuid">Copy UUID</button>
    </div>
    <div>
      <div class="field-label">shared/config.lua</div>
      ${codeBlock(snippet, "paste into resources/[admin]/rp_admin/shared/config.lua")}
    </div>
    <div class="banner">
      <div>
        <strong>Install steps</strong><br />
        1. Download <span class="mono">rp_admin.zip</span> and extract it to <span class="mono">resources/[admin]/rp_admin</span>.<br />
        2. Paste the config above into <span class="mono">shared/config.lua</span>.<br />
        3. Add the <span class="mono">RpAdmin</span> ACL object and rights (see docs/install.md).<br />
        4. Set <span class="mono">admin</span> to <span class="mono">startup="0"</span> and add <span class="mono">rp_admin startup="1"</span> in <span class="mono">mtaserver.conf</span>.<br />
        5. Restart the server. The panel shows online within ~10 seconds.
      </div>
    </div>
    <a class="btn block" href="/rp_admin.zip" download>Download rp_admin.zip</a>
  </div>`;
}

export async function view(ctx) {
  let servers = [];
  try {
    servers = await ctx.data.listServers();
  } catch (err) {
    servers = [];
  }

  const user = ctx.session.user || {};
  const displayName = (user.user_metadata && user.user_metadata.display_name) || (user.email ? user.email.split("@")[0] : "Owner");
  const onlineCount = servers.filter((s) => s.online).length;

  const body = servers.length
    ? `<div class="grid cols-2">${servers.map(serverCard).join("")}</div>`
    : `<div class="card">${emptyState("No servers yet", "Create your first server to get a key and install the connector.")}</div>`;

  const demoNote = ctx.data.demoFallback
    ? `<div class="banner warn" style="margin-bottom:16px"><div><strong>Demo data.</strong> The Supabase schema was not detected. Open the Supabase project &rarr; SQL Editor, run <span class="mono">supabase/migrations/0001_init.sql</span>, then reload this page.</div></div>`
    : "";

  return {
    title: "Dashboard",
    html: `<div class="app">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" />
          <div class="brand-text"><strong>${BRAND.name}</strong><small>${BRAND.credit}</small></div>
        </div>
        <nav class="nav">
          <div class="nav-label">Account</div>
          <a class="nav-item active" href="/dashboard" data-link><span class="ico">\u25a6</span>Servers</a>
          <a class="nav-item" href="/" data-link><span class="ico">\u2302</span>Landing page</a>
        </nav>
        <div class="sidebar-foot">
          <span class="avatar">${esc(displayName.charAt(0))}</span>
          <div class="who"><strong>${esc(displayName)}</strong><small>${esc(user.email || "")}</small></div>
        </div>
        <div class="sidebar-credit">${BRAND.name} \u2014 ${BRAND.credit}</div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="crumbs">Servers</div>
          <div class="topbar-right">
            <span class="pill ${onlineCount ? "on" : "off"}"><span class="dot"></span>${onlineCount} online</span>
            <span class="pill">${servers.length} total</span>
            <button class="icon-btn inbox-btn" id="inboxBtn" title="Invites">\u2709<span class="inbox-count hidden" id="inboxCount">0</span></button>
            <button class="btn sm primary" id="createServerBtn">+ Create server</button>
            <button class="btn sm ghost" id="logoutBtn">Logout</button>
          </div>
        </header>
        <section class="view">
          <div class="page-head">
            <div>
              <h2>Your servers ${ctx.data.isMock ? '<span class="badge warn">demo data</span>' : ""}</h2>
              <p>Each server has its own panel at <span class="mono">${esc(CONFIG.PANEL_URL)}/&lt;id&gt;</span>.</p>
            </div>
          </div>
          ${demoNote}
          ${body}
        </section>
      </main>
    </div>`,
    onMount(el) {
      bindCopyButtons(el);
      bindInbox(ctx, el);

      el.querySelector("#logoutBtn").addEventListener("click", async () => {
        await ctx.data.signOut();
        ctx.navigate("/login");
      });

      el.querySelector("#createServerBtn").addEventListener("click", () => {
        openModal({
          title: "Create a server",
          subtitle: "You will receive a one-time server key and install snippet.",
          body: `<label class="field"><span>Server name</span><input id="newServerName" placeholder="My Royal Server" maxlength="60" /></label>
                 <div id="createError" class="form-error"></div>`,
          actions: [
            { label: "Cancel", tone: "ghost" },
            {
              label: "Create server",
              tone: "primary",
              async onClick(close) {
                const name = document.getElementById("newServerName").value.trim();
                const errorBox = document.getElementById("createError");
                if (name.length < 3) {
                  errorBox.textContent = "Server name must be at least 3 characters.";
                  return;
                }
                errorBox.textContent = "";
                try {
                  const result = await ctx.data.createServer(name);
                  if (!result || !result.ok) {
                    errorBox.textContent = (result && result.error) || "Could not create server.";
                    return;
                  }
                  close();
                  openModal({
                    title: "Server created",
                    subtitle: `Saved to your RpAdmin database \u00b7 Panel URL: ${CONFIG.PANEL_URL}/${result.server.shortId}`,
                    size: "lg",
                    body: installResult(result),
                    actions: [
                      { label: "Open panel", tone: "primary", onClick: (c) => { c(); ctx.navigate(`/${result.server.shortId}`); } },
                      { label: "Back to dashboard", tone: "ghost", onClick: (c) => { c(); ctx.navigate("/dashboard"); } },
                    ],
                    onMount(root) { bindCopyButtons(root); },
                  });
                } catch (err) {
                  errorBox.textContent = err && err.message ? err.message : "Request failed.";
                }
              },
            },
          ],
        });
      });
    },
  };
}
