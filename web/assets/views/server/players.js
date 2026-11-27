import { can, canAction } from "../../permissions.js";
import {
  badge, dataTable, esc, fmtDateTime, initTables, kvList, openDrawer, openModal, timeAgo,
} from "../../components/ui.js";

const BAN_DURATIONS = [
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
  { label: "1 day", value: 1440 },
  { label: "7 days", value: 10080 },
  { label: "Permanent", value: 0 },
];

function statusBadges(p) {
  const out = [];
  if (p.admin) out.push(badge("admin", "admin"));
  if (p.muted) out.push(badge("muted", "warn"));
  if (p.frozen) out.push(badge("frozen", "danger"));
  return out.length ? out.join(" ") : badge("ok", "on");
}

function actionButtons(role, p) {
  const buttons = [];
  buttons.push(`<button class="btn sm ghost" data-paction="details" data-player="${esc(p.name)}">Details</button>`);
  if (canAction(role, p.muted ? "unmute" : "mute")) {
    buttons.push(`<button class="btn sm" data-paction="${p.muted ? "unmute" : "mute"}" data-player="${esc(p.name)}">${p.muted ? "Unmute" : "Mute"}</button>`);
  }
  if (canAction(role, p.frozen ? "unfreeze" : "freeze")) {
    buttons.push(`<button class="btn sm" data-paction="${p.frozen ? "unfreeze" : "freeze"}" data-player="${esc(p.name)}">${p.frozen ? "Unfreeze" : "Freeze"}</button>`);
  }
  if (canAction(role, "kick")) buttons.push(`<button class="btn sm" data-paction="kick" data-player="${esc(p.name)}">Kick</button>`);
  if (canAction(role, "ban")) buttons.push(`<button class="btn sm danger" data-paction="ban" data-player="${esc(p.name)}">Ban</button>`);
  return `<div class="actions">${buttons.join("")}</div>`;
}

function openDetails(ctx, player) {
  const warnings = (ctx.snapshot.warnings || []).filter((w) => w.playerName === player.name && !w.revokedAt);
  const notes = (ctx.snapshot.notes || []).filter((n) => n.playerName === player.name);

  const warningsHtml = warnings.length
    ? `<div class="notice-list">${warnings
        .map((w) => `<div class="warn-item"><div class="w-head"><strong>${esc(w.reason)}</strong><span class="badge warn">active</span></div><div class="w-body">by ${esc(w.issuedByName)} \u00b7 ${esc(fmtDateTime(w.createdAt))}</div></div>`)
        .join("")}</div>`
    : `<p class="muted" style="font-size:13px">No active warnings.</p>`;

  const notesHtml = notes.length
    ? `<div class="notice-list">${notes
        .map((n) => `<div class="warn-item"><div class="w-head"><strong>${esc(n.createdByName)}</strong><span class="muted" style="font-size:11.5px">${esc(timeAgo(n.createdAt))}</span></div><div class="w-body">${esc(n.note)}</div></div>`)
        .join("")}</div>`
    : `<p class="muted" style="font-size:13px">No staff notes yet.</p>`;

  const footer = [
    canAction(ctx.role, "warn") ? `<button class="btn sm" data-daction="warn">Warn</button>` : "",
    canAction(ctx.role, "note") ? `<button class="btn sm" data-daction="note">Add note</button>` : "",
    canAction(ctx.role, "kick") ? `<button class="btn sm" data-daction="kick">Kick</button>` : "",
    canAction(ctx.role, "ban") ? `<button class="btn sm danger" data-daction="ban">Ban</button>` : "",
  ].filter(Boolean).join("");

  openDrawer({
    title: player.name,
    subtitle: `${player.account} \u00b7 ${player.country}`,
    body: `<div class="tag-list" style="margin-bottom:16px">${statusBadges(player)}</div>
      ${kvList([
        ["Serial", `<span class="mono">${esc(player.serial)}</span>`],
        ["IP address", `<span class="mono">${esc(player.ip)}</span>`],
        ["Account", esc(player.account)],
        ["Ping", `${esc(player.ping)} ms`],
        ["Health / Armor", `${esc(player.health)} / ${esc(player.armor)}`],
        ["Team", esc(player.team)],
        ["Joined", esc(timeAgo(player.joinedAt))],
      ])}
      <hr class="divider" />
      <div class="section-title">Warnings (${warnings.length})</div>
      ${warningsHtml}
      <hr class="divider" />
      <div class="section-title">Notes (${notes.length})</div>
      ${notesHtml}`,
    footer,
    onMount(wrap, close) {
      wrap.querySelectorAll("[data-daction]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.daction;
          close();
          runPlayerAction(ctx, action, player);
        });
      });
    },
  });
}

function runPlayerAction(ctx, action, player) {
  if (action === "mute" || action === "unmute" || action === "freeze" || action === "unfreeze") {
    ctx.act(action, { player: player.name });
    return;
  }
  if (action === "kick") {
    openModal({
      title: `Kick ${player.name}`,
      body: `<label class="field"><span>Reason</span><input id="kickReason" value="Kicked by admin" maxlength="120" /></label>`,
      actions: [
        { label: "Cancel", tone: "ghost" },
        { label: "Kick", tone: "danger", onClick(close) {
          const reason = document.getElementById("kickReason").value.trim() || "Kicked by admin";
          close();
          ctx.act("kick", { player: player.name, reason });
        } },
      ],
    });
    return;
  }
  if (action === "ban") {
    openModal({
      title: `Ban ${player.name}`,
      subtitle: "Applies an IP + serial ban.",
      body: `<label class="field"><span>Reason</span><input id="banReason" value="Banned by admin" maxlength="160" /></label>
        <label class="field"><span>Duration</span><select id="banDuration">${BAN_DURATIONS.map((d) => `<option value="${d.value}">${d.label}</option>`).join("")}</select></label>
        <p class="role-note">Bans use the player's IP and serial. Permanent bans can be lifted from the Bans tab.</p>`,
      actions: [
        { label: "Cancel", tone: "ghost" },
        { label: "Ban player", tone: "danger", onClick(close) {
          const reason = document.getElementById("banReason").value.trim() || "Banned by admin";
          const minutes = Number(document.getElementById("banDuration").value) || 0;
          close();
          ctx.act("ban", { player: player.name, reason, seconds: minutes * 60 });
        } },
      ],
    });
    return;
  }
  if (action === "warn") {
    openModal({
      title: `Warn ${player.name}`,
      body: `<label class="field"><span>Reason</span><textarea id="warnReason" placeholder="Explain the rule that was broken..." maxlength="300"></textarea></label>`,
      actions: [
        { label: "Cancel", tone: "ghost" },
        { label: "Issue warning", tone: "primary", onClick(close) {
          const reason = document.getElementById("warnReason").value.trim();
          if (!reason) return;
          close();
          ctx.act("warn", { player: player.name, reason });
        } },
      ],
    });
    return;
  }
  if (action === "note") {
    openModal({
      title: `Note on ${player.name}`,
      body: `<label class="field"><span>Internal note</span><textarea id="noteText" placeholder="Visible to staff only..." maxlength="500"></textarea></label>`,
      actions: [
        { label: "Cancel", tone: "ghost" },
        { label: "Save note", tone: "primary", onClick(close) {
          const note = document.getElementById("noteText").value.trim();
          if (!note) return;
          close();
          ctx.act("note", { player: player.name, note });
        } },
      ],
    });
  }
}

export async function tab(ctx) {
  const players = ctx.snapshot.players || [];
  const searchable = can(ctx.role, "read");

  const table = dataTable({
    id: "playersTable",
    columns: [
      { label: "Name", sortable: true, render: (p) => `<strong>${esc(p.name)}</strong>`, sortValue: (p) => p.name },
      { label: "Ping", type: "num", sortable: true, render: (p) => `${esc(p.ping)} ms` },
      { label: "IP", mono: true, render: (p) => esc(p.ip), sortable: true, sortValue: (p) => p.ip },
      { label: "Country", sortable: true, render: (p) => esc(p.country) },
      { label: "HP", type: "num", sortable: true, render: (p) => esc(p.health) },
      { label: "Armor", type: "num", sortable: true, render: (p) => esc(p.armor) },
      { label: "Team", sortable: true, render: (p) => esc(p.team) },
      { label: "Status", render: (p) => statusBadges(p) },
      { label: "Actions", align: "right", render: (p) => actionButtons(ctx.role, p) },
    ],
    rows: players,
    empty: "No players online",
  });

  return {
    title: "Players",
    html: `<div class="page-head">
        <div><h2>Players</h2><p>${players.length} online \u00b7 click a player for serial, IP, warnings and notes.</p></div>
      </div>
      <div class="toolbar">
        <input class="search" data-filter="playersTable" placeholder="Search name, IP, account, country..." ${searchable ? "" : "disabled"} />
        <span class="pill">${players.length} shown</span>
      </div>
      ${table}`,
    onMount(el) {
      initTables(el);
      el.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-paction]");
        if (!btn) return;
        ev.preventDefault();
        const player = players.find((p) => p.name === btn.dataset.player);
        if (!player) return;
        if (btn.dataset.paction === "details") openDetails(ctx, player);
        else runPlayerAction(ctx, btn.dataset.paction, player);
      });
    },
  };
}
