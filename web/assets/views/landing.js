import { BRAND } from "../config.js";

export async function view(ctx) {
  const signedIn = !!ctx.session;
  const cta = signedIn
    ? `<a class="btn primary lg" href="/dashboard" data-link>Open dashboard</a>`
    : `<a class="btn primary lg" href="/register" data-link>Create your panel</a>`;
  const secondary = signedIn
    ? ""
    : `<a class="btn lg" href="/login" data-link>Sign in</a>`;

  return {
    title: `${BRAND.name} — ${BRAND.credit}`,
    html: `<div class="landing">
      <header class="landing-nav">
        <div class="brand">
          <span class="logo-mark">Rp</span>
          <div class="brand-text"><strong>${BRAND.name}</strong><small>${BRAND.credit}</small></div>
        </div>
        <nav class="landing-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="/login" data-link>Sign in</a>
          <a class="btn sm primary" href="/register" data-link>Get started</a>
        </nav>
      </header>

      <section class="landing-hero">
        <div class="hero-badge"><span class="logo-dot"></span> ${BRAND.name} \u2014 ${BRAND.credit}</div>
        <h1>Your MTA server,<br /><span class="grad">managed from the web.</span></h1>
        <p class="lead">RpAdmin is a modern admin platform for MTA:SA. Create a server, install the connector, and manage players, resources, bans and staff from one clean dashboard \u2014 no inbound ports required.</p>
        <div class="hero-actions">${cta}${secondary}</div>
        <p class="hero-credit">${BRAND.tagline} \u00b7 ${BRAND.credit}</p>
      </section>

      <section class="landing-section" id="features">
        <h2>Everything you need to run your server</h2>
        <p class="section-sub">A modern admin experience, rebuilt for the cloud and branded as RpAdmin.</p>
        <div class="feature-grid">
          <div class="feature"><div class="f-ico">\u25a6</div><h3>Live dashboard</h3><p>Player count, uptime, resource health and recent activity, refreshed in real time.</p></div>
          <div class="feature"><div class="f-ico">\u25c9</div><h3>Player management</h3><p>Kick, ban, mute, freeze and warn players. Inspect serial, IP, account and notes in a side drawer.</p></div>
          <div class="feature"><div class="f-ico">\u2699</div><h3>Resource control</h3><p>Start, restart and stop resources from the panel with role-based permissions.</p></div>
          <div class="feature"><div class="f-ico">\u26a0</div><h3>Bans &amp; warnings</h3><p>IP and serial bans with expiry, plus a warning history and staff notes per player.</p></div>
          <div class="feature"><div class="f-ico">\u2637</div><h3>Staff &amp; roles</h3><p>Owner, Admin, Moderator and Viewer roles. Every destructive action is audited.</p></div>
          <div class="feature"><div class="f-ico">\u25b6</div><h3>Guarded console</h3><p>Broadcast messages and queue server commands with confirmations and a countdown.</p></div>
        </div>
      </section>

      <section class="landing-section" id="how">
        <h2>How it works</h2>
        <p class="section-sub">Three steps from signup to a live panel.</p>
        <div class="steps">
          <div class="step"><div class="n">1</div><h3>Create a server</h3><p>Register, add your server, and receive a one-time server key plus a ready-to-paste <span class="mono">config.lua</span>.</p></div>
          <div class="step"><div class="n">2</div><h3>Install the connector</h3><p>Drop the <span class="mono">rp_admin</span> resource into your MTA server, paste the config, apply the ACL and restart.</p></div>
          <div class="step"><div class="n">3</div><h3>Manage from anywhere</h3><p>The connector polls outbound over HTTPS. Your panel comes online within seconds \u2014 no ports to open.</p></div>
        </div>
      </section>

      <footer class="landing-foot">
        <div class="row"><span class="logo-dot"></span><span>${BRAND.name} \u2014 ${BRAND.credit}</span></div>
        <span>${BRAND.tagline} \u00b7 MTA:SA admin platform</span>
      </footer>
    </div>`,
    onMount() {
      document.querySelectorAll('.landing-links a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          const target = document.querySelector(a.getAttribute("href"));
          if (target) target.scrollIntoView({ behavior: "smooth" });
        });
      });
    },
  };
}
