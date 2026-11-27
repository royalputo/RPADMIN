import { BRAND, CONFIG } from "../config.js";
import { esc, fmtUptime, roleBadge, toast } from "../components/ui.js";
import { bindInbox } from "../components/invites.js";
import { openConsole } from "./server/console.js";

const TABS = {
  dashboard: { label: "Dashboard", ico: "\u25a6", group: "Overview" },
  players: { label: "Players", ico: "\u25cf", group: "Management" },
  resources: { label: "Resources", ico: "\u2699", group: "Management" },
  bans: { label: "Bans", ico: "\u26d4", group: "Management" },
  staff: { label: "Staff", ico: "\u2605", group: "Community" },
  warnings: { label: "Warnings & Notes", ico: "\u26a0", group: "Community" },
  activity: { label: "Activity", ico: "\u2637", group: "System" },
  console: { label: "Console", ico: "\u25b6", group: "System" },
  settings: { label: "Settings", ico: "\u2699", group: "System" },
};

const LOADERS = {
  dashboard: () => import("./server/dashboard.js"),
  players: () => import("./server/players.js"),
  resources: () => import("./server/resources.js"),
  bans: () => import("./server/bans.js"),
  staff: () => import("./server/staff.js"),
  warnings: () => import("./server/warnings.js"),
  activity: () => import("./server/activity.js"),
  console: () => import("./server/console.js"),
  settings: () => import("./server/settings.js"),
};

const AUTO_REFRESH = new Set(["dashboard", "players", "resources", "bans", "activity"]);

function sidebar(activeTab, snapshot, user) {
  const groups = [];
  Object.entries(TABS).forEach(([key, meta]) => {
    if (!groups.includes(meta.group)) groups.push(meta.group);
  });

  const nav = groups
    .map((group) => {
      const items = Object.entries(TABS)
        .filter(([, meta]) => meta.group === group)
        .map(([key, meta]) => {
          const count = key === "players" ? snapshot.players.length : key === "bans" ? snapshot.bans.length : "";
          return `<a class="nav-item ${key === activeTab ? "active" : ""}" href="/${snapshot.server.shortId}/${key}" data-link>
            <span class="ico">${meta.ico}</span>${esc(meta.label)}${count !== "" ? `<span class="count">${count}</span>` : ""}
          </a>`;
        })
        .join("");
      return `<div class="nav-label">${esc(group)}</div>${items}`;
    })
    .join("");

  const displayName = user.displayName || (user.email ? user.email.split("@")[0] : "User");

  return `<aside class="sidebar" id="sidebar">
    <div class="brand">
      <img class="brand-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" />
      <div class="brand-text"><strong>${BRAND.name}</strong><small>${BRAND.credit}</small></div>
    </div>
    <nav class="nav">
      <a class="nav-item" href="/dashboard" data-link><span class="ico">\u2302</span>All servers</a>
      ${nav}
    </nav>
    <div class="sidebar-foot">
      <span class="avatar">${esc(displayName.charAt(0))}</span>
      <div class="who"><strong>${esc(displayName)}</strong><small>${esc(user.email || "")}</small></div>
      <button class="icon-btn" id="logoutBtn" title="Sign out">\u23fb</button>
    </div>
    <div class="sidebar-credit">${BRAND.name} \u2014 ${BRAND.credit}</div>
  </aside>`;
}

function topbar(snapshot, activeTab, isMock) {
  const s = snapshot.server;
  const online = s.online;
  return `<header class="topbar">
    <div class="row" style="min-width:0">
      <button class="icon-btn mobile-only" id="menuBtn" aria-label="Menu">\u2630</button>
      <div class="crumbs">
        <span class="crumb-server">${esc(s.name)}</span>
        <span class="sep">/</span>
        <span>${esc(TABS[activeTab].label)}</span>
      </div>
    </div>
    <div class="topbar-right">
      <span class="pill ${online ? "on" : "off"}" id="pillOnline"><span class="dot"></span>${online ? "online" : "offline"}</span>
      <span class="pill" id="pillPlayers">${s.playerCount || 0} / ${s.maxPlayers || 0} players</span>
      <span class="pill" id="pillUptime">uptime ${online ? fmtUptime(s.uptime) : "\u2014"}</span>
      ${isMock ? '<span class="pill">demo</span>' : ""}
      <button class="btn sm" id="consoleBtn" title="Open console">\u25b6 Console</button>
      <button class="icon-btn inbox-btn" id="inboxBtn" title="Invites">\u2709<span class="inbox-count hidden" id="inboxCount">0</span></button>
      ${roleBadge(snapshot.role)}
    </div>
  </header>`;
}

function updateTopbar(el, snapshot) {
  const s = snapshot.server;
  const online = s.online;
  const pill = el.querySelector("#pillOnline");
  if (pill) {
    pill.className = `pill ${online ? "on" : "off"}`;
    pill.innerHTML = `<span class="dot"></span>${online ? "online" : "offline"}`;
  }
  const players = el.querySelector("#pillPlayers");
  if (players) players.textContent = `${s.playerCount || 0} / ${s.maxPlayers || 0} players`;
  const uptime = el.querySelector("#pillUptime");
  if (uptime) uptime.textContent = `uptime ${online ? fmtUptime(s.uptime) : "\u2014"}`;
}

function isTyping() {
  const active = document.activeElement;
  return active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
}

export async function view(ctx) {
  const shortId = ctx.params.shortId;
  let snapshot;
  try {
    snapshot = await ctx.data.getSnapshot(shortId);
  } catch (err) {
    snapshot = { error: err && err.message ? err.message : "load_failed" };
  }

  if (!snapshot || snapshot.error === "not_found") {
    return {
      title: "Server not found",
      html: `<div class="view"><div class="card">${`<div class="empty"><div class="empty-title">Server not found</div><div class="empty-hint">No server exists with the id /${esc(shortId)}.</div><a class="btn primary mt-16" href="/dashboard" data-link>Back to dashboard</a></div>`}</div></div>`,
    };
  }
  if (snapshot.error === "forbidden") {
    return {
      title: "Access denied",
      html: `<div class="view"><div class="card"><div class="empty">
        <div class="empty-title">403 \u2014 Access denied</div>
        <div class="empty-hint">Your account is not a member of this server.</div>
        <a class="btn primary mt-16" href="/dashboard" data-link>Back to dashboard</a>
      </div></div></div>`,
    };
  }
  if (snapshot.error) {
    return {
      title: "Error",
      html: `<div class="view"><div class="card"><div class="empty"><div class="empty-title">Could not load server</div><div class="empty-hint">${esc(snapshot.error)}</div><a class="btn primary mt-16" href="/dashboard" data-link>Back</a></div></div></div>`,
    };
  }

  let activeTab = ctx.params.tab;
  const user = ctx.session.user || {};
  const displayName = (user.user_metadata && user.user_metadata.display_name) || (user.email ? user.email.split("@")[0] : "User");
  const userCtx = { ...user, displayName };

  const tabCtx = () => ({
    data: ctx.data,
    session: ctx.session,
    shortId,
    snapshot,
    role: snapshot.role,
    navigate: ctx.navigate,
    toast,
    act,
    reload,
  });

  async function act(action, args) {
    let result;
    try {
      result = await ctx.data.action(shortId, action, args || {});
    } catch (err) {
      toast(err && err.message ? err.message : "Action failed", "err");
      return { ok: false, error: err && err.message };
    }
    if (result && result.ok) toast(result.message || "Done", "ok");
    else toast((result && result.error) || "Action failed", "err");
    await reload();
    return result;
  }

  async function reload() {
    try {
      const next = await ctx.data.getSnapshot(shortId);
      if (!next || next.error) return;
      snapshot = next;
      updateTopbar(root, snapshot);
      await renderTab();
    } catch {
      /* keep current state */
    }
  }

  let root;
  let tabModule = null;
  let tabResult = null;

  async function renderTab() {
    const container = root.querySelector("#panel-view");
    if (!container) return;
    tabModule = await LOADERS[activeTab]();
    tabResult = await tabModule.tab(tabCtx());
    container.innerHTML = tabResult.html;
    if (tabResult.onMount) tabResult.onMount(container, tabCtx());
  }

  const shellHtml = `<div class="app">
    ${sidebar(activeTab, snapshot, userCtx)}
    <main class="main">
      ${topbar(snapshot, activeTab, ctx.data.isMock)}
      <section id="panel-view" class="view"></section>
    </main>
  </div>`;

  return {
    title: `${snapshot.server.name}`,
    html: shellHtml,
    onMount(el) {
      root = el;

      renderTab();

      bindInbox(ctx, el);

      const consoleBtn = el.querySelector("#consoleBtn");
      if (consoleBtn) {
        consoleBtn.addEventListener("click", () => openConsole(tabCtx()));
      }

      const logout = el.querySelector("#logoutBtn");
      if (logout) {
        logout.addEventListener("click", async () => {
          await ctx.data.signOut();
          ctx.navigate("/login");
        });
      }

      const menuBtn = el.querySelector("#menuBtn");
      const sidebarEl = el.querySelector("#sidebar");
      if (menuBtn && sidebarEl) {
        menuBtn.addEventListener("click", () => sidebarEl.classList.toggle("open"));
        el.addEventListener("click", (ev) => {
          if (ev.target.closest(".sidebar a[data-link]")) sidebarEl.classList.remove("open");
        });
      }

      const poll = async () => {
        try {
          const next = await ctx.data.getSnapshot(shortId);
          if (!next || next.error) return;
          snapshot = next;
          updateTopbar(root, snapshot);
          if (AUTO_REFRESH.has(activeTab) && !document.querySelector(".modal-backdrop, .drawer-backdrop") && !isTyping()) {
            await renderTab();
          }
        } catch {
          /* ignore transient poll errors */
        }
      };

      const timer = setInterval(poll, CONFIG.POLL_MS);

      let unsubscribe = () => {};
      if (ctx.data.subscribe) {
        Promise.resolve(ctx.data.subscribe(shortId, poll)).then((fn) => {
          if (typeof fn === "function") unsubscribe = fn;
        }).catch(() => {});
      }

      ctx.onCleanup(() => {
        clearInterval(timer);
        try { unsubscribe(); } catch { /* ignore */ }
      });
    },
  };
}
