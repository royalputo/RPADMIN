const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

export function attr(value) {
  return esc(value);
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function fmtUptime(seconds) {
  const sec = Math.max(0, Math.floor(seconds || 0));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function fmtDuration(seconds) {
  const sec = Math.max(0, Math.floor(seconds || 0));
  if (sec === 0) return "Permanent";
  return fmtUptime(sec);
}

export function fmtTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeAgo(value) {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(then)) return "-";
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function isOnline(lastSeen, windowMs) {
  if (!lastSeen) return false;
  const then = new Date(lastSeen).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= (windowMs || 30000);
}

export function badge(text, tone) {
  return `<span class="badge ${tone || "off"}">${esc(text)}</span>`;
}

export function statCard(label, value, tone, sub) {
  return `<div class="card stat">
    <div class="stat-label">${esc(label)}</div>
    <div class="stat-value ${tone || ""}">${value}${sub ? ` <small>${esc(sub)}</small>` : ""}</div>
  </div>`;
}

export function emptyState(title, hint) {
  return `<div class="empty"><div class="empty-title">${esc(title)}</div>${hint ? `<div class="empty-hint">${esc(hint)}</div>` : ""}</div>`;
}

export function codeBlock(code, label) {
  const id = `code-${Math.random().toString(36).slice(2, 9)}`;
  return `<div class="code-block">
    ${label ? `<div class="code-head"><span>${esc(label)}</span><button class="btn sm ghost" data-copy-target="${id}">Copy</button></div>` : ""}
    <pre id="${id}"><code>${esc(code)}</code></pre>
  </div>`;
}

export function kvList(rows) {
  return `<dl class="kv">${rows
    .filter(Boolean)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`)
    .join("")}</dl>`;
}

export function dataTable(options) {
  const id = options.id || `tbl-${Math.random().toString(36).slice(2, 9)}`;
  const columns = options.columns || [];
  const rows = options.rows || [];
  const head = columns
    .map((col) => {
      const cls = [col.align === "right" ? "right" : "", col.align === "center" ? "center" : "", col.sortable ? "sortable" : ""].filter(Boolean).join(" ");
      return `<th class="${cls}" ${col.sortable ? `data-sort-col data-type="${col.type || "text"}"` : ""}>${esc(col.label)}</th>`;
    })
    .join("");

  const body = rows.length
    ? rows
        .map((row) => {
          const cells = columns
            .map((col) => {
              const raw = col.render ? col.render(row) : row[col.key];
              const sortValue = col.sortValue ? col.sortValue(row) : col.type === "num" ? Number(raw) || 0 : String(raw == null ? "" : raw);
              const cls = [col.align === "right" ? "right" : "", col.align === "center" ? "center" : "", col.mono ? "mono" : ""].filter(Boolean).join(" ");
              return `<td class="${cls}" data-sort="${attr(sortValue)}">${raw == null ? "-" : raw}</td>`;
            })
            .join("");
          return `<tr ${options.rowAttrs ? options.rowAttrs(row) : ""}>${cells}</tr>`;
        })
        .join("")
    : `<tr><td class="table-empty" colspan="${columns.length}">${esc(options.empty || "Nothing to show")}</td></tr>`;

  return `<div class="table-wrap"><table class="tbl" id="${id}" data-table>
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function initTables(root) {
  root.querySelectorAll("table[data-table]").forEach((table) => {
    if (table.dataset.bound) return;
    table.dataset.bound = "1";
    const tbody = table.tBodies[0];
    table.tHead.querySelectorAll("th[data-sort-col]").forEach((th, index) => {
      th.addEventListener("click", () => {
        const numeric = th.dataset.type === "num";
        const dir = th.dataset.dir === "asc" ? "desc" : "asc";
        table.tHead.querySelectorAll("th").forEach((h) => {
          delete h.dataset.dir;
          h.classList.remove("sorted-asc", "sorted-desc");
        });
        th.dataset.dir = dir;
        th.classList.add(dir === "asc" ? "sorted-asc" : "sorted-desc");
        const sorted = Array.from(tbody.rows).sort((a, b) => {
          const av = a.cells[index] ? a.cells[index].dataset.sort || "" : "";
          const bv = b.cells[index] ? b.cells[index].dataset.sort || "" : "";
          if (numeric) return dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
          return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        sorted.forEach((row) => tbody.appendChild(row));
      });
    });
  });

  root.querySelectorAll("[data-filter]").forEach((input) => {
    if (input.dataset.bound) return;
    input.dataset.bound = "1";
    input.addEventListener("input", () => {
      const table = root.querySelector(`#${input.dataset.filter}`);
      if (!table) return;
      const q = input.value.trim().toLowerCase();
      Array.from(table.tBodies[0].rows).forEach((row) => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  });
}

/* ---------------- toasts ---------------- */

function toastRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}

export function toast(message, tone) {
  const node = document.createElement("div");
  node.className = `toast show ${tone || "ok"}`;
  node.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
  toastRoot().appendChild(node);
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 220);
  }, 3600);
}

/* ---------------- modal ---------------- */

function modalRoot() {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

export function openModal(options) {
  const root = modalRoot();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const actions = options.actions || [];
  backdrop.innerHTML = `<div class="modal ${options.size === "lg" ? "modal-lg" : ""}" role="dialog" aria-modal="true">
    <div class="modal-head">
      <div><h3>${esc(options.title || "")}</h3>${options.subtitle ? `<p class="muted">${esc(options.subtitle)}</p>` : ""}</div>
      <button class="modal-x" data-close aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">${options.body || ""}</div>
    ${actions.length ? `<div class="modal-foot">${actions
      .map((a, i) => `<button class="btn ${a.tone || ""}" data-modal-action="${i}">${esc(a.label)}</button>`)
      .join("")}</div>` : ""}
  </div>`;
  root.appendChild(backdrop);
  document.body.classList.add("modal-open");

  const close = () => {
    backdrop.remove();
    if (!root.querySelector(".modal-backdrop")) document.body.classList.remove("modal-open");
    options.onClose && options.onClose();
  };

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) close();
    const closer = ev.target.closest("[data-close]");
    if (closer) close();
    const actionEl = ev.target.closest("[data-modal-action]");
    if (actionEl) {
      const action = actions[Number(actionEl.dataset.modalAction)];
      if (action) action.onClick ? action.onClick(close, backdrop) : close();
    }
  });

  const onKey = (ev) => {
    if (ev.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);

  options.onMount && options.onMount(backdrop, close);
  const firstInput = backdrop.querySelector("input, textarea, select");
  if (firstInput) firstInput.focus();
  return close;
}

export function confirmDialog(options) {
  return new Promise((resolve) => {
    // The first settle wins: openModal fires onClose() inside close(), which
    // used to resolve(false) BEFORE the confirm action could resolve(true) —
    // so every confirm dialog silently acted as "Cancel" (deletes and stops
    // never ran). Settle from the button click first, then close.
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const needsType = typeof options.typeToConfirm === "string" && options.typeToConfirm.length > 0;

    openModal({
      title: options.title || "Are you sure?",
      body: `<p class="confirm-text">${esc(options.message || "")}</p>${
        needsType
          ? `<label class="field mt-16"><span>Type <strong>${esc(options.typeToConfirm)}</strong> to confirm</span>
             <input id="confirmTypeInput" autocomplete="off" spellcheck="false" />
             <span class="hint">This action cannot be undone.</span></label>`
          : ""
      }`,
      actions: [
        { label: "Cancel", tone: "ghost", onClick: (close) => { settle(false); close(); } },
        {
          label: options.confirmLabel || "Confirm",
          tone: options.danger ? "danger" : "primary",
          onClick: (close) => {
            if (needsType) {
              const input = document.getElementById("confirmTypeInput");
              if (!input || input.value.trim() !== options.typeToConfirm) return;
            }
            settle(true);
            close();
          },
        },
      ],
      onMount(backdrop, close) {
        if (!needsType) return;
        const confirmBtn = Array.from(backdrop.querySelectorAll("[data-modal-action]")).pop();
        const input = backdrop.querySelector("#confirmTypeInput");
        if (!confirmBtn || !input) return;
        const sync = () => {
          confirmBtn.disabled = input.value.trim() !== options.typeToConfirm;
        };
        sync();
        input.addEventListener("input", sync);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" && input.value.trim() === options.typeToConfirm) {
            settle(true);
            close();
          }
        });
      },
      onClose: () => settle(false),
    });
  });
}

/* ---------------- drawer ---------------- */

export function openDrawer(options) {
  const root = modalRoot();
  const wrap = document.createElement("div");
  wrap.className = "drawer-backdrop";
  wrap.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true">
    <div class="drawer-head">
      <div><h3>${esc(options.title || "")}</h3>${options.subtitle ? `<p class="muted">${esc(options.subtitle)}</p>` : ""}</div>
      <button class="modal-x" data-close aria-label="Close">&times;</button>
    </div>
    <div class="drawer-body">${options.body || ""}</div>
    ${options.footer ? `<div class="drawer-foot">${options.footer}</div>` : ""}
  </aside>`;
  root.appendChild(wrap);
  document.body.classList.add("modal-open");
  const close = () => {
    wrap.remove();
    if (!root.querySelector(".modal-backdrop, .drawer-backdrop")) document.body.classList.remove("modal-open");
  };
  wrap.addEventListener("click", (ev) => {
    if (ev.target === wrap || ev.target.closest("[data-close]")) close();
  });
  options.onMount && options.onMount(wrap, close);
  return close;
}

/* ---------------- misc ---------------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "ok");
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); toast("Copied to clipboard", "ok"); } catch { toast("Copy failed", "err"); }
    area.remove();
    return false;
  }
}

export function bindCopyButtons(root) {
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-copy-target]");
    if (!btn) return;
    const target = root.querySelector(`#${btn.dataset.copyTarget}`) || document.getElementById(btn.dataset.copyTarget);
    if (target) copyText(target.textContent);
  });
}

export function spinner(label) {
  return `<div class="loading"><span class="spinner"></span><span>${esc(label || "Loading...")}</span></div>`;
}

export function activityRows(rows, limit) {
  const list = (rows || []).slice(0, limit || 200);
  if (!list.length) return emptyState("No activity yet", "Events from the connector will appear here.");
  return `<div class="log-list">${list
    .map(
      (r) => `<div class="log-row">
        <span class="log-time">${fmtTime(r.createdAt)}</span>
        <span class="log-kind ${esc(r.kind || "other")}">${esc(r.kind || "event")}</span>
        <span class="log-text">${esc(r.text)}</span>
      </div>`
    )
    .join("")}</div>`;
}

export function banExpiry(ban) {
  if (!ban) return "-";
  if (ban.permanent) return "Permanent";
  const left = (ban.unbanTime || 0) - Date.now();
  if (left <= 0) return "Expired";
  return `${fmtUptime(left / 1000)} left`;
}

export function roleBadge(role) {
  const tone = { owner: "admin", admin: "info", moderator: "warn", viewer: "off" }[role] || "off";
  const label = { owner: "Owner", admin: "Admin", moderator: "Moderator", viewer: "Viewer" }[role] || role;
  return badge(label, tone);
}
