// RpAdmin — Dev By Royalputo
// Cloudflare Worker entry: /api/* uses the Supabase proxy, everything else is
// served from the static assets in ./web. Security headers are enforced here
// so they apply to API and static responses even if _headers is ignored.

import { handleApi } from "./api.js";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: https://*.googleusercontent.com https://*.gstatic.com",
  "font-src 'self' https://*.gstatic.com",
  "connect-src 'self' https://accounts.google.com",
  "frame-src https://accounts.google.com",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), " +
    "geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), " +
    "picture-in-picture=(), publickey-credentials-get=(self), screen-wake-lock=(), usb=(), " +
    "xr-spatial-tracking=()",
  "Content-Security-Policy": CSP,
};

function harden(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return harden(await handleApi(request, env, url));
    }

    if (!env.ASSETS) {
      return harden(new Response("Static assets binding is missing", { status: 500 }));
    }
    return harden(await env.ASSETS.fetch(request));
  },
};
