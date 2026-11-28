import { CONFIG } from "../../config.js";
import { can } from "../../permissions.js";
import {
  bindCopyButtons, codeBlock, confirmDialog, esc, fmtUptime, kvList, openModal,
} from "../../components/ui.js";

const TOGGLES = [
  { key: "chatLog", label: "Capture chat activity", hint: "Forward player chat to the activity log." },
  { key: "joinQuit", label: "Track joins and quits", hint: "Push join/quit events to the panel." },
  { key: "warnNotify", label: "Notify players on warn", hint: "Send an in-game message when a warning is issued." },
];

function configSnippet(server) {
  return `RP_ADMIN = {
  url = "${CONFIG.PANEL_URL}",
  serverKey = "<paste-your-server-key>",
  serverId = "${server.shortId}",
  serverUuid = "${server.id}",
  panelUrl = "${CONFIG.PANEL_URL}",
  pollInterval = 3000,
  snapshotInterval = 20000,
  eventFlushInterval = 5000,
  logFile = "",
  logTailInterval = 5000,
  logChat = true,
  showStatusLabel = true,
  debug = false,
}`;
}

function toggleState(key) {
  try {
    return localStorage.getItem(`rp_toggle_${key}`) === "1";
  } catch {
    return false;
  }
}

export async function tab(ctx) {
  const server = ctx.snapshot.server;
  const isOwner = can(ctx.role, "key.rotate");
  const canSettings = can(ctx.role, "server.settings");
  const canShutdown = can(ctx.role, "server.shutdown");
  const panelUrl = `${CONFIG.PANEL_URL}/${server.shortId}`;

  return {
    title: "Settings",
    html: `<div class="page-head">
        <div><h2>Settings</h2><p>Server information, connector key, server controls. Settings and shutdown need Admin or Owner.</p></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3 class="card-title">Server information</h3>
          ${kvList([
            ["Server name", esc(server.name)],
            ["Panel id", `<span class="mono">/${esc(server.shortId)}</span>`],
            ["Panel URL", `<span class="mono">${esc(panelUrl)}</span>`],
            ["Server UUID", `<span class="mono">${esc(server.id)}</span>`],
            ["Status", server.online ? '<span class="badge on">online</span>' : '<span class="badge off">offline</span>'],
            ["Gamemode", esc(server.gamemode || "-")],
            ["MTA version", `<span class="mono">${esc(server.version || "-")}</span>`],
            ["Game port", esc(server.port || "-")],
            ["Players", `${server.playerCount || 0} / ${server.maxPlayers || 0}`],
            ["Uptime", server.online ? esc(fmtUptime(server.uptime)) : "\u2014"],
            ["Last seen", server.lastSeen ? esc(new Date(server.lastSeen).toLocaleString()) : "never"],
            ["Key hint", `<span class="mono">${esc(server.keyHint || "-")}</span>`],
          ])}
        </div>

        <div class="card">
          <h3 class="card-title">Connector key</h3>
          <div class="field-label">Key hint</div>
          <div class="key-reveal">${esc(server.keyHint || "rsk_\u2026")}</div>
          <p class="muted" style="font-size:12px;margin:12px 0 14px">The full key is stored only in your server's <span class="mono">shared/config.lua</span>. Rotating issues a new key and immediately invalidates the old one.</p>
          <button class="btn ${isOwner ? "" : "ghost"}" id="rotateKeyBtn" ${isOwner ? "" : "disabled"}>Rotate server key</button>
          ${!isOwner ? '<p class="role-note" style="margin-top:10px">Owner only.</p>' : ""}

          <hr class="divider" />
          <div class="field-label">Connector diagnostics</div>
          ${ctx.snapshot.diag
            ? kvList([
                ["Agent", esc(ctx.snapshot.diag.version || "-")],
                ["Last poll", `${esc(ctx.snapshot.diag.pollStatus)} \u00b7 ${esc(ctx.snapshot.diag.pollCount)} command(s)`],
                ["Polled at", esc(ctx.snapshot.diag.lastPollAt || "-")],
                ["Poll bytes", esc(ctx.snapshot.diag.pollBytes == null ? "-" : ctx.snapshot.diag.pollBytes)],
                ["Poll preview", `<span class="mono" style="word-break:break-all">${esc(ctx.snapshot.diag.pollPreview || "-")}</span>`],
                ["Last action", esc(ctx.snapshot.diag.lastAction || "-")],
                ["Last result", esc(ctx.snapshot.diag.lastResult || "-")],
                ["Command update", esc(ctx.snapshot.diag.lastUpdate || "-")],
                ["Snapshot", esc(ctx.snapshot.diag.lastSnapshot || "-")],
                ["Last error", esc(ctx.snapshot.diag.lastError || "none")],
                ["Body cam", esc(ctx.snapshot.diag.bodycamStatus || "-")],
              ])
            : '<p class="muted" style="font-size:12.5px">Diagnostics not reported yet — restart rp_admin.</p>'}

          <hr class="divider" />
          <div class="field-label">Config snippet</div>
          ${codeBlock(configSnippet(server), "shared/config.lua")}
          <a class="btn block mt-16" href="/rp_admin.zip" download>Download rp_admin.zip</a>
        </div>
      </div>

      <div class="card mt-16">
        <h3 class="card-title">Server settings</h3>
        <form id="serverSettingsForm">
          <div class="field-row">
            <label class="field"><span>Server name</span><input id="setName" value="${esc(server.name)}" maxlength="60" ${canSettings ? "" : "disabled"} /></label>
            <label class="field"><span>Max players</span><input id="setMax" type="number" min="1" max="1000" value="${server.maxPlayers || 32}" ${canSettings ? "" : "disabled"} /></label>
          </div>
          <button class="btn primary" type="submit" ${canSettings ? "" : "disabled"}>Save settings</button>
          ${!canSettings ? '<span class="role-note" style="margin-left:10px">Requires Admin or Owner.</span>' : ""}
        </form>
      </div>

      <div class="card mt-16">
        <h3 class="card-title">Feature toggles</h3>
        <div class="settings-list">
          ${TOGGLES.map(
            (t) => `<div class="settings-row">
              <div class="s-label"><strong>${esc(t.label)}</strong><small>${esc(t.hint)}</small></div>
              <label class="switch"><input type="checkbox" data-toggle="${t.key}" ${toggleState(t.key) ? "checked" : ""} ${canSettings ? "" : "disabled"} /><span></span></label>
            </div>`
          ).join("")}
        </div>
        <p class="role-note" style="margin-top:12px">Toggles are stored with the server settings; the connector applies them on its next poll.</p>
      </div>

      <div class="card mt-16" style="border-color: rgba(239,68,68,0.35)">
        <h3 class="card-title" style="color:#ff9a9a">Danger zone</h3>
        <div class="settings-row">
          <div class="s-label"><strong>Restart server (shutdown)</strong><small>MTA has no self-restart. This announces a countdown then shuts the server down; an external supervisor must start it again.</small></div>
          <button class="btn danger" id="restartBtn" ${canShutdown ? "" : "disabled"}>Restart (shutdown)</button>
        </div>
        <div class="settings-row">
          <div class="s-label"><strong>Shut down server</strong><small>Stops the MTA server immediately after a short countdown. Players are disconnected.</small></div>
          <button class="btn danger" id="shutdownBtn" ${canShutdown ? "" : "disabled"}>Shut down</button>
        </div>
        ${!canShutdown ? '<p class="role-note" style="margin:0">Shutdown requires Admin or Owner.</p>' : ""}
      </div>`,
    onMount(el) {
      bindCopyButtons(el);

      el.querySelector("#serverSettingsForm").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const name = el.querySelector("#setName").value.trim();
        const maxPlayers = Number(el.querySelector("#setMax").value) || 0;
        if (!name) return;
        ctx.act("server-settings", { name, maxPlayers });
      });

      el.querySelectorAll("[data-toggle]").forEach((input) => {
        input.addEventListener("change", () => {
          try { localStorage.setItem(`rp_toggle_${input.dataset.toggle}`, input.checked ? "1" : "0"); } catch { /* ignore */ }
          ctx.toast("Setting saved", "ok");
        });
      });

      const rotate = el.querySelector("#rotateKeyBtn");
      if (rotate) {
        rotate.addEventListener("click", async () => {
          const ok = await confirmDialog({
            title: "Rotate server key?",
            message: "The current key stops working immediately. The connector will go offline until you update config.lua with the new key.",
            confirmLabel: "Rotate key",
            danger: true,
          });
          if (!ok) return;
          try {
            const result = await ctx.data.rotateKey(ctx.shortId);
            if (!result || !result.ok) {
              ctx.toast((result && result.error) || "Key rotation failed", "err");
              return;
            }
            openModal({
              title: "New server key",
              subtitle: "Copy it now \u2014 it will not be shown again.",
              body: `<div class="key-reveal" id="rotatedKey">${esc(result.key)}</div>
                <p class="role-note" style="margin-top:12px">Paste it into <span class="mono">shared/config.lua</span> and restart the resource.</p>`,
              actions: [{ label: "Done", tone: "primary" }],
              onMount(root) {
                const btn = document.createElement("button");
                btn.className = "btn sm mt-16";
                btn.textContent = "Copy key";
                btn.addEventListener("click", () => {
                  const text = root.querySelector("#rotatedKey").textContent;
                  navigator.clipboard.writeText(text).then(() => ctx.toast("Copied", "ok")).catch(() => {});
                });
                root.querySelector(".modal-body").appendChild(btn);
              },
            });
            await ctx.reload();
          } catch (err) {
            ctx.toast(err && err.message ? err.message : "Key rotation failed", "err");
          }
        });
      }

      const doShutdown = (restart) => {
        openModal({
          title: restart ? "Restart server (shutdown)" : "Shut down server",
          subtitle: "This action affects every connected player.",
          body: `<div class="banner danger"><div>${restart ? "The server will shut down after the countdown. It will only come back if an external supervisor (NSSM, Task Scheduler, systemd) restarts it." : "All players will be disconnected after the countdown."}</div></div>
            <p class="confirm-text mt-16" id="countdownText">Starting countdown\u2026</p>`,
          actions: [
            { label: "Cancel", tone: "ghost" },
            {
              label: restart ? "Shut down now" : "Shut down now",
              tone: "danger",
              onClick(close) {
                if (window.__rpCountdown) clearInterval(window.__rpCountdown);
                close();
                ctx.act("shutdown", {});
              },
            },
          ],
          onMount(root, close) {
            let remaining = 10;
            const text = root.querySelector("#countdownText");
            text.textContent = `Shutting down in ${remaining}s\u2026`;
            window.__rpCountdown = setInterval(() => {
              remaining -= 1;
              if (!document.body.contains(text)) {
                clearInterval(window.__rpCountdown);
                return;
              }
              if (remaining <= 0) {
                clearInterval(window.__rpCountdown);
                text.textContent = "Sending shutdown command\u2026";
                close();
                ctx.act("shutdown", {});
                return;
              }
              text.textContent = `Shutting down in ${remaining}s\u2026`;
            }, 1000);
          },
          onClose() {
            if (window.__rpCountdown) {
              clearInterval(window.__rpCountdown);
              window.__rpCountdown = null;
            }
          },
        });
      };

      const restartBtn = el.querySelector("#restartBtn");
      if (restartBtn) restartBtn.addEventListener("click", () => doShutdown(true));
      const shutdownBtn = el.querySelector("#shutdownBtn");
      if (shutdownBtn) shutdownBtn.addEventListener("click", () => doShutdown(false));
    },
  };
}
