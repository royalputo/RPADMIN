import { canAction } from "../../permissions.js";
import { badge, dataTable, esc, fmtDateTime, fmtTime, initTables } from "../../components/ui.js";

const lines = [
  { t: new Date(), kind: "sys", text: "RpAdmin console ready. Type 'help' for the command list." },
];

const HELP = [
  "say <message>",
  "kick <player> [reason]",
  "ban <player> [reason]",
  "unban <ban-id>",
  "mute|unmute|freeze|unfreeze <player>",
  "warn <player> <reason>",
  "note <player> <note>",
  "resource <start|stop|restart> <name>",
  "shutdown",
  "clear",
];

function push(kind, text) {
  lines.push({ t: new Date(), kind, text });
  if (lines.length > 400) lines.splice(0, lines.length - 400);
}

function linesHtml() {
  return lines
    .map((line) => {
      const cls = line.kind === "cmd" ? "cmd" : line.kind === "ok" ? "ok" : line.kind === "err" ? "err" : "sys";
      return `<div class="console-line"><span class="t">${fmtTime(line.t)}</span><span class="${cls}">${esc(line.text)}</span></div>`;
    })
    .join("");
}

function paint() {
  document.querySelectorAll("[data-console-body]").forEach((body) => {
    body.innerHTML = linesHtml();
    body.scrollTop = body.scrollHeight;
  });
}

async function run(ctx, raw) {
  const input = raw.trim();
  if (!input) return;
  push("cmd", `> ${input}`);
  paint();

  const parts = input.split(/\s+/);
  const command = parts[0].toLowerCase();
  const rest = input.slice(parts[0].length).trim();

  const deny = (perm) => {
    push("err", `Permission denied: your role (${ctx.role}) cannot ${perm}.`);
  };

  if (command === "help") {
    HELP.forEach((h) => push("sys", `  ${h}`));
  } else if (command === "clear") {
    lines.length = 0;
    push("sys", "Console cleared.");
  } else if (command === "say") {
    if (!canAction(ctx.role, "say")) deny("broadcast");
    else if (!rest) push("err", "Usage: say <message>");
    else {
      const res = await ctx.act("say", { message: rest });
      push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
    }
  } else if (command === "kick" || command === "ban") {
    if (!canAction(ctx.role, command)) deny(command);
    else {
      const player = parts[1];
      const reason = parts.slice(2).join(" ") || (command === "kick" ? "Kicked by admin" : "Banned by admin");
      if (!player) push("err", `Usage: ${command} <player> [reason]`);
      else {
        const res = await ctx.act(command, command === "ban" ? { player, reason, seconds: 0 } : { player, reason });
        push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
      }
    }
  } else if (command === "unban") {
    if (!canAction(ctx.role, "unban")) deny("unban");
    else if (!parts[1]) push("err", "Usage: unban <ban-id|ip|serial>");
    else {
      const target = parts[1];
      const ban = (ctx.snapshot.bans || []).find(
        (b) => String(b.id) === target || b.ip === target || b.serial === target
      );
      if (!ban) push("err", `Ban not found: ${target}`);
      else {
        const res = await ctx.act("unban", { id: ban.id, ip: ban.ip, serial: ban.serial, nick: ban.nick });
        push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
      }
    }
  } else if (["mute", "unmute", "freeze", "unfreeze"].includes(command)) {
    if (!canAction(ctx.role, command)) deny(command);
    else if (!parts[1]) push("err", `Usage: ${command} <player>`);
    else {
      const res = await ctx.act(command, { player: parts[1] });
      push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
    }
  } else if (command === "warn" || command === "note") {
    if (!canAction(ctx.role, command)) deny(command);
    else {
      const player = parts[1];
      const text = parts.slice(2).join(" ");
      if (!player || !text) push("err", `Usage: ${command} <player> <text>`);
      else {
        const res = await ctx.act(command, command === "warn" ? { player, reason: text } : { player, note: text });
        push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
      }
    }
  } else if (command === "resource") {
    const op = (parts[1] || "").toLowerCase();
    const name = parts[2];
    if (!["start", "stop", "restart"].includes(op) || !name) push("err", "Usage: resource <start|stop|restart> <name>");
    else if (!canAction(ctx.role, "resource", op)) deny(`resource ${op}`);
    else {
      const res = await ctx.act("resource", { resource: name, op });
      push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
    }
  } else if (command === "shutdown") {
    if (!canAction(ctx.role, "shutdown")) deny("shut down the server");
    else {
      const res = await ctx.act("shutdown", {});
      push(res && res.ok ? "ok" : "err", (res && (res.message || res.error)) || "No response");
    }
  } else {
    push("err", `Unknown command: ${command}. Type 'help'.`);
  }

  paint();
}

function commandStatus(status) {
  if (status === "done") return badge("done", "on");
  if (status === "failed") return badge("failed", "danger");
  if (status === "expired") return badge("expired", "warn");
  return badge(status || "pending", "info");
}

export async function tab(ctx) {
  const commands = ctx.snapshot.commands || [];

  const queue = dataTable({
    id: "consoleQueue",
    columns: [
      { label: "#", mono: true, render: (c) => esc(c.id) },
      { label: "Action", render: (c) => `<span class="mono">${esc(c.action)}</span>` },
      { label: "Args", render: (c) => `<span class="mono">${esc(JSON.stringify(c.args || {}))}</span>` },
      { label: "Status", render: (c) => commandStatus(c.status) },
      { label: "By", render: (c) => esc(c.createdByName || "-") },
      { label: "Queued", render: (c) => esc(fmtDateTime(c.createdAt)) },
      { label: "Result", render: (c) => (c.error ? `<span style="color:#ff9a9a">${esc(c.error)}</span>` : '<span class="muted">ok</span>') },
    ],
    rows: commands,
    empty: "No commands queued",
  });

  return {
    title: "Console",
    html: `<div class="page-head">
        <div><h2>Console</h2><p>Queue guarded commands and review the action log.</p></div>
      </div>

      <div class="banner warn"><div><strong>Action log \u2014 MTA stdout is not capturable.</strong> This console shows commands you send and their execution result from the connector. It is not a live server log stream.</div></div>

      <div class="console mt-16">
        <div class="console-head">
          <span class="muted">rp_admin \u00b7 ${esc(ctx.snapshot.server.name)}</span>
          <button class="btn sm ghost" id="clearConsole">Clear</button>
        </div>
        <div class="console-body" data-console-body>${linesHtml()}</div>
        <form class="console-input" id="consoleForm">
          <span class="prompt">&gt;</span>
          <input id="consoleInput" placeholder="say Welcome! \u00b7 type 'help' for commands" autocomplete="off" spellcheck="false" />
          <button class="btn sm primary" type="submit">Run</button>
        </form>
      </div>

      <div class="card mt-16">
        <div class="card-head"><h3 class="card-title">Recent commands</h3><span class="pill">${commands.length}</span></div>
        ${queue}
      </div>`,
    onMount(el) {
      initTables(el);
      paint();
      const form = el.querySelector("#consoleForm");
      const input = el.querySelector("#consoleInput");
      const clear = el.querySelector("#clearConsole");

      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const value = input.value;
        input.value = "";
        await run(ctx, value);
        const fresh = document.getElementById("consoleInput") || document.getElementById("drawerConsoleInput");
        if (fresh) fresh.focus();
      });

      clear.addEventListener("click", () => {
        lines.length = 0;
        push("sys", "Console cleared.");
        paint();
      });

      if (input) input.focus();
    },
  };
}

/**
 * Bottom console available on every panel tab. Shares the same command buffer
 * and guarded executor as the Console tab.
 */
export function openConsole(ctx) {
  const existing = document.getElementById("consoleDrawer");
  if (existing) {
    const input = existing.querySelector("#drawerConsoleInput");
    if (input) input.focus();
    return;
  }

  const el = document.createElement("div");
  el.id = "consoleDrawer";
  el.className = "console-drawer";
  el.innerHTML = `<div class="console-head">
      <span class="muted">rp_admin \u00b7 ${esc(ctx.snapshot.server.name)} \u00b7 quick console</span>
      <div class="row">
        <button class="btn sm ghost" id="drawerClear">Clear</button>
        <button class="btn sm ghost" id="drawerClose">Close</button>
      </div>
    </div>
    <div class="console-body" data-console-body></div>
    <form class="console-input" id="drawerForm">
      <span class="prompt">&gt;</span>
      <input id="drawerConsoleInput" placeholder="say Welcome! \u00b7 type 'help' for commands" autocomplete="off" spellcheck="false" />
      <button class="btn sm primary" type="submit">Run</button>
    </form>`;
  document.body.appendChild(el);
  paint();

  const input = el.querySelector("#drawerConsoleInput");
  el.querySelector("#drawerForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const value = input.value;
    input.value = "";
    await run(ctx, value);
    input.focus();
  });
  el.querySelector("#drawerClear").addEventListener("click", () => {
    lines.length = 0;
    push("sys", "Console cleared.");
    paint();
  });
  el.querySelector("#drawerClose").addEventListener("click", () => el.remove());

  input.focus();
}
