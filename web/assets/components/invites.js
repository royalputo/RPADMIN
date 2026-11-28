import { esc, openModal, roleBadge, timeAgo, toast } from "./ui.js";

async function loadInvites(ctx) {
  try {
    return await ctx.data.myInvites();
  } catch {
    return [];
  }
}

export async function bindInbox(ctx, root) {
  const button = root.querySelector("#inboxBtn");
  if (!button) return;
  const counter = root.querySelector("#inboxCount");

  const invites = await loadInvites(ctx);
  if (counter) {
    counter.textContent = invites.length;
    counter.classList.toggle("hidden", invites.length === 0);
  }

  button.addEventListener("click", () => openInvites(ctx));
}

export async function openInvites(ctx) {
  const invites = await loadInvites(ctx);

  if (!invites.length) {
    openModal({
      title: "Invites",
      body: `<div class="empty"><div class="empty-title">No pending invites</div><div class="empty-hint">When a server owner adds your email, it appears here.</div></div>`,
      actions: [{ label: "Close", tone: "ghost" }],
    });
    return;
  }

  const body = `<p class="muted" style="font-size:12.5px;margin:0 0 12px">Accepting gives you access to that server's panel with the role shown.</p>
    <div class="notice-list" id="inviteRows">
      ${invites
        .map(
          (invite) => `<div class="member-row" data-invite-row="${esc(invite.id)}">
            <div class="grow">
              <strong>${esc(invite.server_name)}</strong>
              <div class="muted" style="font-size:11.5px">Panel /${esc(invite.short_id)} \u00b7 invited ${esc(timeAgo(invite.created_at))}</div>
            </div>
            ${roleBadge(invite.role)}
            <button class="btn sm primary" data-accept-invite="${esc(invite.id)}">Accept</button>
            <button class="btn sm ghost" data-decline-invite="${esc(invite.id)}">Decline</button>
          </div>`
        )
        .join("")}
    </div>`;

  openModal({
    title: "Invites",
    subtitle: "Servers that added you to their staff",
    size: "lg",
    body,
    actions: [{ label: "Close", tone: "ghost" }],
    onMount(root, close) {
      root.addEventListener("click", async (ev) => {
        const accept = ev.target.closest("[data-accept-invite]");
        if (accept && !accept.disabled) {
          accept.disabled = true;
          const result = await ctx.data.acceptInvite(accept.dataset.acceptInvite);
          if (result && result.ok) {
            toast("Invite accepted", "ok");
            close();
            ctx.navigate(`/${result.shortId}`);
          } else {
            toast((result && result.error) || "Could not accept invite", "err");
            accept.disabled = false;
          }
          return;
        }

        const decline = ev.target.closest("[data-decline-invite]");
        if (decline && !decline.disabled) {
          decline.disabled = true;
          const result = await ctx.data.declineInvite(decline.dataset.declineInvite);
          if (result && result.ok) {
            toast("Invite declined", "info");
            const row = decline.closest("[data-invite-row]");
            if (row) row.remove();
            const counter = document.querySelector("#inboxCount");
            if (counter) {
              const left = root.querySelectorAll("[data-invite-row]").length;
              counter.textContent = left;
              counter.classList.toggle("hidden", left === 0);
            }
          } else {
            toast((result && result.error) || "Could not decline invite", "err");
            decline.disabled = false;
          }
        }
      });
    },
  });
}
