export const CONFIG = {
  // The browser only talks to this site's /api proxy. Supabase URL and keys
  // live in Cloudflare Pages environment variables (SUPABASE_URL /
  // SUPABASE_ANON_KEY) and are never shipped to the browser or the MTA script.
  USE_MOCK: false,
  AUTO_DETECT_SCHEMA: true,

  PANEL_URL: "https://rpadmin.mtarg.xyz",
  API_BASE: "/api",

  // Public Google OAuth *client id* (not a secret). Leave empty to hide the
  // Google button. Must match the Google provider configured in Supabase.
  GOOGLE_CLIENT_ID: "926518169760-kodch5ttgdjglr994ohstmqubrd5u82a.apps.googleusercontent.com",

  POLL_MS: 5000,
  ONLINE_WINDOW_MS: 30000,
  KEY_PREFIX: "rsk_",
};

export const BRAND = {
  name: "RpAdmin",
  credit: "Dev By Royalputo",
  tagline: "Rp = Royalputo",
  short: "RpAdmin by Royalputo",
};

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  viewer: "Viewer",
};

export const ROLES = ["owner", "admin", "moderator", "viewer"];
