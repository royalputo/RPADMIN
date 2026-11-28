// RpAdmin — Dev By Royalputo
// Shared API logic for the Cloudflare Worker deployment.
// Keep in sync with web/functions/api/[[path]].js (Pages deployment).

const NO_STORE = "no-store";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": NO_STORE },
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}

function sbHeaders(env, token, extra) {
  const headers = { apikey: env.SUPABASE_ANON_KEY, ...(extra || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function passthrough(response) {
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": NO_STORE,
    },
  });
}

function bearer(request) {
  const header = request.headers.get("Authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return part.slice(index + 1).trim();
  }
  return "";
}

function base64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  normalized += "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function secureSuffix(url) {
  return url.protocol === "https:" ? "; Secure" : "";
}

function redirectTo(url, target, headers) {
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": NO_STORE, ...(headers || {}) },
  });
}

// Per-isolate best-effort limiter. Add Cloudflare WAF rate limiting for a
// global guarantee.
const buckets = new Map();

function rateLimited(request, scope, limit) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown";
  const now = Date.now();
  const key = `${ip}:${scope}`;
  let entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + 60000 };
    buckets.set(key, entry);
  }
  entry.count += 1;

  if (buckets.size > 4000) {
    for (const [k, value] of buckets) {
      if (value.reset < now) buckets.delete(k);
    }
  }
  return entry.count > limit;
}

function payloadTooLarge(request, max) {
  return Number(request.headers.get("content-length") || 0) > max;
}

export async function handleApi(request, env, url) {
  const method = request.method.toUpperCase();

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return fail("Server is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)", 500);
  }

  const path = "/" + url.pathname.slice("/api".length).replace(/^\/+/, "");

  const scope = path.startsWith("/auth/") ? "auth" : path.startsWith("/rest/") ? "rest" : "general";
  const limit = scope === "auth" ? 30 : scope === "rest" ? 300 : 120;
  if (rateLimited(request, scope, limit)) {
    return fail("Too many requests — try again shortly", 429);
  }

  // /rest must accept the full connector snapshot (all resources + the whole
  // ACL tree) — 512 KB.
  const maxBody = path.startsWith("/rest/") ? 524288 : 32768;
  if (payloadTooLarge(request, maxBody)) {
    return fail("Payload too large", 413);
  }

  if (path === "/health" && method === "GET") {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/servers?select=id&limit=1`, {
        headers: sbHeaders(env),
      });
      if (res.ok) return json({ ok: true, schema: true });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      return json({ ok: true, schema: false, code: payload && payload.code ? payload.code : null });
    } catch {
      return json({ ok: false, schema: false });
    }
  }

  if (path === "/auth/signup" && method === "POST") {
    const body = await readJson(request);
    if (!body || !body.email || !body.password) return fail("Email and password are required");
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: sbHeaders(env, null, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        data: { display_name: body.displayName || String(body.email).split("@")[0] },
      }),
    });
    return passthrough(res);
  }

  if (path === "/auth/login" && method === "POST") {
    const body = await readJson(request);
    if (!body || !body.email || !body.password) return fail("Email and password are required");
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: sbHeaders(env, null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
    return passthrough(res);
  }

  if (path === "/auth/refresh" && method === "POST") {
    const body = await readJson(request);
    if (!body || !body.refresh_token) return fail("refresh_token is required");
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: sbHeaders(env, null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ refresh_token: body.refresh_token }),
    });
    return passthrough(res);
  }

  if (path === "/auth/user" && method === "GET") {
    const token = bearer(request);
    if (!token) return fail("Missing bearer token", 401);
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: sbHeaders(env, token),
    });
    return passthrough(res);
  }

  if (path === "/auth/logout" && method === "POST") {
    const token = bearer(request);
    if (!token) return new Response(null, { status: 204, headers: { "Cache-Control": NO_STORE } });
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: sbHeaders(env, token),
    });
    return passthrough(res);
  }

  if (path === "/auth/google" && method === "POST") {
    const body = await readJson(request);
    if (!body || !body.credential) return fail("Google credential is required");
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: "POST",
      headers: sbHeaders(env, null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ provider: "google", id_token: body.credential }),
    });
    return passthrough(res);
  }
  // Google OAuth (server-side authorization code flow). No JavaScript origin
  // or Supabase URL is exposed to the browser.
  if (path === "/auth/google/start" && method === "GET") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return redirectTo(
        url,
        `${url.origin}/login?error=${encodeURIComponent("Google sign-in is not configured on the server")}`
      );
    }
    const state = crypto.randomUUID();
    const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", `${url.origin}/api/auth/google/callback`);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "openid email profile");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("prompt", "select_account");

    return redirectTo(url, authorize.toString(), {
      "Set-Cookie": `rp_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=600${secureSuffix(url)}`,
    });
  }

  if (path === "/auth/google/callback" && method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = readCookie(request, "rp_oauth_state");

    if (!code || !state || !cookieState || state !== cookieState) {
      return redirectTo(
        url,
        `${url.origin}/login?error=${encodeURIComponent("Google state check failed — try again")}`
      );
    }

    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !token || !token.id_token) {
      return redirectTo(
        url,
        `${url.origin}/login?error=${encodeURIComponent("Google token exchange failed")}`
      );
    }

    const sbRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: "POST",
      headers: sbHeaders(env, null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ provider: "google", id_token: token.id_token }),
    });
    const session = await sbRes.json().catch(() => null);
    if (!sbRes.ok || !session || !session.access_token) {
      return redirectTo(
        url,
        `${url.origin}/login?error=${encodeURIComponent("Supabase rejected the Google token")}`
      );
    }

    const payload = base64urlEncode(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        user: session.user,
      })
    );

    return redirectTo(url, `${url.origin}/auth/callback`, {
      "Set-Cookie": `rp_oauth_session=${payload}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=120${secureSuffix(url)}`,
    });
  }

  if (path === "/auth/oauth/claim" && method === "POST") {
    const raw = readCookie(request, "rp_oauth_session");
    if (!raw) return fail("No pending Google session", 401);
    let data;
    try {
      data = JSON.parse(base64urlDecode(raw));
    } catch {
      return fail("Invalid Google session", 401);
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": NO_STORE,
        "Set-Cookie": `rp_oauth_session=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0${secureSuffix(url)}`,
      },
    });
  }

  if (path.startsWith("/rest/")) {
    const restPath = path.slice("/rest".length);
    if (!["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(method)) {
      return fail("Method not allowed", 405);
    }
    if (restPath.includes("..") || restPath.includes("//")) {
      return fail("Invalid path", 400);
    }
    const target = `${env.SUPABASE_URL}/rest/v1${restPath}${url.search}`;

    const token = bearer(request);
    const headers = sbHeaders(env, token || null);
    const serverKey = request.headers.get("X-Server-Key");
    if (serverKey) headers["X-Server-Key"] = serverKey;
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers["Content-Type"] = contentType;
    const prefer = request.headers.get("Prefer");
    if (prefer) headers.Prefer = prefer;
    const accept = request.headers.get("Accept");
    if (accept) headers.Accept = accept;
    const range = request.headers.get("Range");
    if (range) headers.Range = range;

    const init = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      const body = await request.text();
      if (body.length > 524288) return fail("Payload too large", 413);
      init.body = body && body.trim() ? body : "{}";
    }

    let res;
    try {
      res = await fetch(target, init);
    } catch {
      return fail("Upstream request failed", 502);
    }

    const outHeaders = new Headers();
    for (const name of ["content-type", "content-range", "preference-applied", "location"]) {
      const value = res.headers.get(name);
      if (value) outHeaders.set(name, value);
    }
    outHeaders.set("Cache-Control", NO_STORE);

    return new Response(res.body, { status: res.status, headers: outHeaders });
  }

  return fail("Not found", 404);
}
