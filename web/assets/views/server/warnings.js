import { can } from "../../permissions.js";
import { badge, confirmDialog, esc, fmtDateTime, openModal, timeAgo } from "../../components/ui.js";

function warningItem(w, canRevoke) {
  return `<div class="warn-item ${w.revokedAt ? "revoked" : ""}">
    <div class="w-head">
      <div class="row">
        <strong>${esc(w.playerName)}</strong>
        ${w.revokedAt ? badge("revoked", "off") : badge("active", "warn")}
      </div>
      ${!w.revokedAt && canRevoke ? `<button class="btn sm ghost" data-revoke="${esc(w.id)}" data-name="${esc(w.playerName)}">Revoke</button>` : ""}
    </div>
    <div class="w-body">${esc(w.reason)}</div>
    <div class="w-body muted" style="font-size:11.5px;margin-top:5px">
      ${esc(w.issuedByName || "staff")} \u00b7 ${esc(fmtDateTime(w.createdAt))}${w.revokedAt ? ` \u00b7 revoked ${esc(timeAgo(w.revokedAt))}` : ""}
      ${w.playerSerial ? ` \u00b7 <span class="mono">${esc(w.playerSerial)}</span>` : ""}
    </div>
  </div>`;
}

function noteItem(n) {
  return `<div class="warn-item">
    <div class="w-head"><div class="row"><strong>${esc(n.playerName)}</strong></div><span class="muted" style="font-size:11.5px">${esc(timeAgo(n.createdAt))}</span></div>
    <div class="w-body">${esc(n.note)}</div>
    <div class="w-body muted" style="font-size:11.5px;margin-top:5px">${esc(n.createdByName || "staff")}${n.playerSerial ? ` \u00b7 <span class="mono">${esc(n.playerSerial)}</span>` : ""}</div>
  </div>`;
}

export async function tab(ctx) {
  const warnings = ctx.snapshot.warnings || [];
  const notes = ctx.snapshot.notes || [];
  const canWarn = can(ctx.role, "warn");
  const canNote = can(ctx.role, "note");
  const active = warnings.filter((w) => !w.revokedAt);

  return {
    title: "Warnings & Notes",
    html: `<div class="page-head">
        <div><h2>Warnings &amp; Notes</h2><p>${active.length} active warnings \u00b7 ${notes.length} staff notes.</p></div>
        <div class="row">
          ${canWarn ? `<button class="btn" id="addWarningBtn">+ Add warning</button>` : ""}
          ${canNote ? `<button class="btn primary" id="addNoteBtn">+ Add note</button>` : ""}
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3 class="card-title">Warnings</h3>
          ${warnings.length ? `<div class="notice-list">${warnings.map((w) => warningItem(w, canWarn)).join("")}</div>` : '<div class="empty"><div class="empty-title">No warnings</div><div class="empty-hint">Warnings issued from the panel or in-game appear here.</div></div>'}
        </div>
        <div class="card">
          <h3 class="card-title">Staff notes</h3>
          ${notes.length ? `<div class="notice-list">${notes.map(noteItem).join("")}</div>` : '<div class="empty"><div class="empty-title">No notes</div><div class="empty-hint">Internal notes are visible to staff only.</div></div>'}
        </div>
      </div>`,
    onMount(el) {
      const addWarningBtn = el.querySelector("#addWarningBtn");
      if (addWarningBtn) {
        addWarningBtn.addEventListener("click", () => {
          openModal({
            title: "Add warning",
            body: `<label class="field"><span>Player name</span><input id="warnPlayer" placeholder="exact in-game name" /></label>
              <label class="field"><span>Reason</span><textarea id="warnReason" placeholder="Rule broken..."></textarea></label>
              <div id="warnError" class="form-error"></div>`,
            actions: [
              { label: "Cancel", tone: "ghost" },
              {
                label: "Issue warning",
                tone: "primary",
                onClick(close) {
                  const player = document.getElementById("warnPlayer").value.trim();
                  const reason = document.getElementById("warnReason").value.trim();
                  if (!player || !reason) {
                    document.getElementById("warnError").textContent = "Player and reason are required.";
                    return;
                  }
                  close();
                  ctx.act("warn", { player, reason });
                },
              },
            ],
          });
        });
      }

      const addNoteBtn = el.querySelector("#addNoteBtn");
      if (addNoteBtn) {
        addNoteBtn.addEventListener("click", () => {
          openModal({
            title: "Add staff note",
            body: `<label class="field"><span>Player name</span><input id="notePlayer" placeholder="exact in-game name" /></label>
              <label class="field"><span>Note</span><textarea id="noteText" placeholder="Internal note..."></textarea></label>
              <div id="noteError" class="form-error"></div>`,
            actions: [
              { label: "Cancel", tone: "ghost" },
              {
                label: "Save note",
                tone: "primary",
                onClick(close) {
                  const player = document.getElementById("notePlayer").value.trim();
                  const note = document.getElementById("noteText").value.trim();
                  if (!player || !note) {
                    document.getElementById("noteError").textContent = "Player and note are required.";
                    return;
                  }
                  close();
                  ctx.act("note", { player, note });
                },
              },
            ],
          });
        });
      }

      el.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-revoke]");
        if (!btn) return;
        const ok = await confirmDialog({
          title: "Revoke warning?",
          message: `Revoke the warning for ${btn.dataset.name}? This is recorded in the audit log.`,
          confirmLabel: "Revoke",
        });
        if (ok) ctx.act("revoke-warning", { id: btn.dataset.revoke });
      });
    },
  };
}
