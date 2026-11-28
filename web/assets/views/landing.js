import { BRAND } from "../config.js";

// Falling-photo rain over the hero + 3D gallery shots.
const PHOTOS = [
  { src: "/assets/img/photos/photo-dashboard.svg", label: "Live dashboard", alt: "RpAdmin dashboard preview" },
  { src: "/assets/img/photos/photo-players.svg", label: "Player management", alt: "RpAdmin players preview" },
  { src: "/assets/img/photos/photo-console.svg", label: "Guarded console", alt: "RpAdmin console preview" },
  { src: "/assets/img/photos/photo-resources.svg", label: "Resource control", alt: "RpAdmin resources preview" },
  { src: "/assets/img/photos/photo-bans.svg", label: "Bans &amp; warnings", alt: "RpAdmin bans preview" },
  { src: "/assets/img/photos/photo-acl.svg", label: "ACL manager", alt: "RpAdmin ACL preview" },
];

// Deterministic "rain": left position, size, fall duration, delay, 3D spin.
const RAIN = [
  { p: 0, x: 4, w: 150, dur: 17, delay: 0, spin: 7, dx: 60 },
  { p: 1, x: 16, w: 120, dur: 21, delay: 4.5, spin: 9, dx: -50 },
  { p: 2, x: 27, w: 100, dur: 15, delay: 8, spin: 8, dx: 44 },
  { p: 3, x: 38, w: 140, dur: 23, delay: 1.8, spin: 11, dx: -66 },
  { p: 4, x: 50, w: 110, dur: 18, delay: 10.5, spin: 7, dx: 52 },
  { p: 5, x: 61, w: 150, dur: 20, delay: 6.2, spin: 10, dx: -58 },
  { p: 0, x: 72, w: 100, dur: 16, delay: 2.6, spin: 8, dx: 48 },
  { p: 1, x: 82, w: 135, dur: 24, delay: 7.5, spin: 9, dx: -62 },
  { p: 3, x: 92, w: 115, dur: 19, delay: 12, spin: 7, dx: 56 },
  { p: 4, x: 33, w: 96, dur: 26, delay: 14, spin: 10, dx: -40 },
  { p: 5, x: 68, w: 105, dur: 22, delay: 3.4, spin: 8, dx: 64 },
  { p: 2, x: 12, w: 88, dur: 25, delay: 16, spin: 9, dx: 40 },
];

function photoRain() {
  const items = RAIN.map((r) => {
    const photo = PHOTOS[r.p];
    return `<div class="pr" style="--x:${r.x}%; --w:${r.w}px; --dur:${r.dur}s; --delay:-${r.delay}s; --spin:${r.spin}s; --dx:${r.dx}px">
      <div class="pr-inner"><img src="${photo.src}" alt="" loading="lazy" /></div>
    </div>`;
  }).join("");
  return `<div class="photo-rain" aria-hidden="true">${items}</div>`;
}

function gallery() {
  return `<section class="landing-section" id="shots">
    <h2>Inside the panel</h2>
    <p class="section-sub">Everything runs in 3D — hover the cards, they move with your cursor.</p>
    <div class="gallery3d">
      ${PHOTOS.map((p) => `<figure class="shot" data-tilt="9">
        <img src="${p.src}" alt="${p.alt}" loading="lazy" />
        <figcaption>${p.label}</figcaption>
      </figure>`).join("")}
    </div>
  </section>`;
}

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
          <img class="brand-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" />
          <div class="brand-text"><strong>${BRAND.name}</strong><small>${BRAND.credit}</small></div>
        </div>
        <nav class="landing-links">
          <a href="#features">Features</a>
          <a href="#shots">Screens</a>
          <a href="#how">How it works</a>
          <a href="/login" data-link>Sign in</a>
          <a class="btn sm primary" href="/register" data-link>Get started</a>
        </nav>
      </header>

      <section class="landing-hero">
        ${photoRain()}
        <span class="orb orb-1"></span>
        <span class="orb orb-2"></span>
        <div class="hero-inner">
          <div class="hero-logo-wrap">
            <span class="hero-ring"></span>
            <img class="hero-logo" src="/assets/img/logo.gif" alt="RpAdmin logo" />
          </div>
          <div class="hero-badge"><span class="logo-dot"></span> ${BRAND.name} \u2014 ${BRAND.credit}</div>
          <h1>Your MTA server,<br /><span class="grad">managed from the web.</span></h1>
          <p class="lead">RpAdmin is a modern admin platform for MTA:SA. Create a server, install the connector, and manage players, resources, bans and staff from one clean dashboard \u2014 no inbound ports required.</p>
          <div class="hero-actions">${cta}${secondary}</div>
          <p class="hero-credit">${BRAND.tagline} \u00b7 ${BRAND.credit}</p>
        </div>
      </section>

      <section class="landing-section reveal" id="features">
        <h2>Everything you need to run your server</h2>
        <p class="section-sub">A modern admin experience, rebuilt for the cloud and branded as RpAdmin.</p>
        <div class="feature-grid">
          <div class="feature" data-tilt="7"><div class="f-ico">\u25a6</div><h3>Live dashboard</h3><p>Player count, uptime, resource health and recent activity, refreshed in real time.</p></div>
          <div class="feature" data-tilt="7"><div class="f-ico">\u25c9</div><h3>Player management</h3><p>Kick, ban, mute, freeze and warn players. Inspect serial, IP, account and notes in a side drawer.</p></div>
          <div class="feature" data-tilt="7"><div class="f-ico">\u2699</div><h3>Resource control</h3><p>Start, restart and stop resources from the panel \u2014 new resources show up after a one-click rescan.</p></div>
          <div class="feature" data-tilt="7"><div class="f-ico">\u26a0</div><h3>Bans &amp; warnings</h3><p>IP and serial bans with expiry, plus a warning history and staff notes per player.</p></div>
          <div class="feature" data-tilt="7"><div class="f-ico">\u2637</div><h3>Staff &amp; roles</h3><p>Owner, Admin, Moderator and Viewer roles. Every destructive action is audited.</p></div>
          <div class="feature" data-tilt="7"><div class="f-ico">\u26bf</div><h3>Full ACL manager</h3><p>Edit every ACL group, right and object from the web \u2014 synced live with your server's acl.xml.</p></div>
        </div>
      </section>

      ${gallery()}

      <section class="landing-section reveal" id="how">
        <h2>How it works</h2>
        <p class="section-sub">Three steps from signup to a live panel.</p>
        <div class="steps">
          <div class="step" data-tilt="6"><div class="n">1</div><h3>Create a server</h3><p>Register, add your server, and receive a one-time server key plus a ready-to-paste <span class="mono">config.lua</span>.</p></div>
          <div class="step" data-tilt="6"><div class="n">2</div><h3>Install the connector</h3><p>Drop the <span class="mono">rp_admin</span> resource into your MTA server, paste the config, apply the ACL and restart.</p></div>
          <div class="step" data-tilt="6"><div class="n">3</div><h3>Manage from anywhere</h3><p>The connector polls outbound over HTTPS. Your panel comes online within seconds \u2014 no ports to open.</p></div>
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
