import { BRAND } from "./config.js";
import { getData } from "./data.js";
import { esc, spinner, toast } from "./components/ui.js";
import { initEffects, pageTransition } from "./effects.js";

const root = document.getElementById("app");
let data = null;
let session = null;
let cleanup = null;

const TABS = ["dashboard", "players", "bodycam", "resources", "bans", "staff", "warnings", "activity", "console", "acl", "settings"];

function parseRoute(pathname) {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (!parts.length) return { name: "landing", params: {} };
  const head = parts[0].toLowerCase();
  if (head === "auth" && (parts[1] || "").toLowerCase() === "callback") {
    return { name: "auth", params: { mode: "callback" } };
  }
  if (head === "login") return { name: "auth", params: { mode: "login" } };
  if (head === "register") return { name: "auth", params: { mode: "register" } };
  if (head === "dashboard") return { name: "dashboard", params: {} };
  if (/^\d+$/.test(head)) {
    const tab = (parts[1] || "dashboard").toLowerCase();
    return { name: "panel", params: { shortId: head, tab: TABS.includes(tab) ? tab : "dashboard" } };
  }
  return { name: "notfound", params: {} };
}

function navigate(path, options) {
  const opts = options || {};
  if (opts.replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  renderRoute();
}

function setTitle(text) {
  document.title = text ? `${text} — ${BRAND.name}` : `${BRAND.name} — ${BRAND.credit}`;
}

function errorView(err) {
  return {
    html: `<div class="view"><div class="card"><div class="empty">
      <div class="empty-title">Something went wrong</div>
      <div class="empty-hint">${esc(err && err.message ? err.message : String(err))}</div>
      <button class="btn primary mt-16" data-retry>Retry</button>
    </div></div></div>`,
    onMount(el) {
      const btn = el.querySelector("[data-retry]");
      if (btn) btn.addEventListener("click", () => renderRoute());
    },
  };
}

async function loadView(route) {
  switch (route.name) {
    case "landing":
      return import("./views/landing.js");
    case "auth":
      return import("./views/auth.js");
    case "dashboard":
      return import("./views/dashboard.js");
    case "panel":
      return import("./views/panel.js");
    default:
      return null;
  }
}

async function renderRoute() {
  const drawer = document.getElementById("consoleDrawer");
  if (drawer) drawer.remove();

  if (typeof cleanup === "function") {
    try { cleanup(); } catch { /* ignore */ }
    cleanup = null;
  }

  const route = parseRoute(location.pathname);
  const needsAuth = route.name === "dashboard" || route.name === "panel";
  const wantsGuest = route.name === "auth" && route.params.mode !== "callback";

  data = data || (await getData());
  try {
    session = await data.getSession();
  } catch {
    session = null;
  }

  if (needsAuth && !session) {
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    return;
  }
  if (wantsGuest && session) {
    navigate("/dashboard", { replace: true });
    return;
  }

  root.innerHTML = `<div class="view">${spinner()}</div>`;

  const ctx = {
    data,
    session,
    params: route.params,
    navigate,
    refresh: () => renderRoute(),
    setTitle,
    onCleanup(fn) { cleanup = fn; },
    toast,
  };

  try {
    if (route.name === "notfound") {
      root.innerHTML = `<div class="view"><div class="card"><div class="empty">
        <div class="empty-title">404 — Page not found</div>
        <div class="empty-hint">The page you are looking for does not exist.</div>
        <a class="btn primary mt-16" href="/" data-link>Back to home</a>
      </div></div></div>`;
      setTitle("Not found");
      return;
    }

    const mod = await loadView(route);
    const result = await mod.view(ctx);
    if (result && result.title) setTitle(result.title);
    root.innerHTML = result.html;
    if (result.onMount) result.onMount(root, ctx);
    initEffects(root);
    pageTransition(root);
  } catch (err) {
    console.error(err);
    const fallback = errorView(err);
    root.innerHTML = fallback.html;
    fallback.onMount(root, ctx);
  }
  window.scrollTo({ top: 0 });
}

document.addEventListener("click", (ev) => {
  const link = ev.target.closest("a[data-link]");
  if (!link) return;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("http")) return;
  ev.preventDefault();
  navigate(href);
});

window.addEventListener("popstate", renderRoute);

renderRoute();
