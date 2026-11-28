import { can } from "../../permissions.js";
import { badge, dataTable, esc, initTables } from "../../components/ui.js";

export async function tab(ctx) {
  const allow = can(ctx.role, "bodycam");
  const players = ctx.snapshot.players || [];

  const table = dataTable({
    id: "bodycamPlayers",
    columns: [
      { label: "Player", sortable: true, render: (p) => `<strong>${esc(p.name)}</strong>`, sortValue: (p) => p.name },
      { label: "Account", mono: true, render: (p) => esc(p.account), sortable: true, sortValue: (p) => p.account },
      { label: "Ping", type: "num", sortable: true, render: (p) => `${esc(p.ping)} ms` },
      { label: "Team", render: (p) => esc(p.team) },
      { label: "Status", render: (p) => (p.admin ? badge("staff", "admin") : "") },
      {
        label: "",
        align: "right",
        render: (p) =>
          `<button class="btn sm primary" data-watch="${esc(p.serial)}" data-name="${esc(p.name)}" ${allow ? "" : "disabled"}>Watch</button>`,
      },
    ],
    rows: players,
    empty: "No players online",
  });

  return {
    title: "Body Cam",
    html: `<div class="page-head">
        <div><h2>Body Cam</h2><p>Live low-FPS screen view of a player (about one frame every 1.5s). Admin and Owner only.</p></div>
      </div>

      ${!allow ? '<div class="banner" style="margin-bottom:16px"><div>Your role cannot use the body cam. Ask an Admin or the Owner.</div></div>' : ""}

      <div class="grid cols-2-1">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title" id="camTitle">No feed</h3>
            <span class="pill" id="camStatus">idle</span>
          </div>
          <div class="bodycam-stage" id="camStage">
            <div class="bodycam-placeholder" id="camPlaceholder">Select a player and press Watch.</div>
            <img class="bodycam-frame hidden" id="camFrame" alt="Player screen" />
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn danger" id="camStop" disabled>Stop</button>
            <span class="muted" id="camMeta" style="font-size:12px"></span>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">Players</h3>
            <input class="search" data-filter="bodycamPlayers" placeholder="Search..." />
          </div>
          ${table}
        </div>
      </div>`,
    onMount(el) {
      initTables(el);

      const frame = el.querySelector("#camFrame");
      const placeholder = el.querySelector("#camPlaceholder");
      const status = el.querySelector("#camStatus");
      const title = el.querySelector("#camTitle");
      const stopBtn = el.querySelector("#camStop");
      const meta = el.querySelector("#camMeta");

      let timer = null;
      let serial = null;
      let playerName = null;

      const stopPolling = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };

      const resetView = () => {
        stopPolling();
        serial = null;
        playerName = null;
        frame.classList.add("hidden");
        frame.removeAttribute("src");
        placeholder.classList.remove("hidden");
        placeholder.textContent = "Select a player and press Watch.";
        status.textContent = "idle";
        title.textContent = "No feed";
        stopBtn.disabled = true;
        meta.textContent = "";
      };

      const poll = async () => {
        if (!serial) return;
        try {
          const row = await ctx.data.getFrame(ctx.shortId, serial);
          if (row && row.frame) {
            frame.src = `data:image/jpeg;base64,${row.frame}`;
            frame.classList.remove("hidden");
            placeholder.classList.add("hidden");
            status.textContent = "live";
            meta.textContent = `${playerName} \u00b7 frame ${new Date(row.created_at).toLocaleTimeString()}`;
          } else {
            status.textContent = "waiting";
            meta.textContent = `${playerName} \u00b7 waiting for frames`;
          }
        } catch (err) {
          status.textContent = "error";
          meta.textContent = err && err.message ? err.message : "Frame request failed";
        }
      };

      const start = async (button) => {
        const nextSerial = button.dataset.watch;
        const nextName = button.dataset.name;
        stopPolling();

        const result = await ctx.data.action(ctx.shortId, "bodycam_start", {
          player: nextName,
          serial: nextSerial,
        });
        if (!result || !result.ok) {
          placeholder.textContent = (result && result.error) || "Could not start the body cam.";
          return;
        }

        serial = nextSerial;
        playerName = nextName;
        title.textContent = nextName;
        stopBtn.disabled = false;
        status.textContent = "starting";
        placeholder.textContent = "Starting camera...";
        placeholder.classList.remove("hidden");

        poll();
        timer = setInterval(poll, 1000);
      };

      const stop = async (sendCommand) => {
        const hadSerial = !!serial;
        resetView();
        if (sendCommand && hadSerial) {
          try {
            await ctx.data.action(ctx.shortId, "bodycam_stop", {});
          } catch {
            /* ignore */
          }
        }
      };

      el.addEventListener("click", (ev) => {
        const button = ev.target.closest("[data-watch]");
        if (button && !button.disabled) start(button);
      });

      stopBtn.addEventListener("click", () => stop(true));

      ctx.onCleanup(() => {
        const hadSerial = !!serial;
        stopPolling();
        if (hadSerial) {
          try {
            ctx.data.action(ctx.shortId, "bodycam_stop", {});
          } catch {
            /* ignore */
          }
        }
      });
    },
  };
}
