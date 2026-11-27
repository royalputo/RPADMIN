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

  const maxBody = path.startsWith("/rest/") ? 131072 : 32768;
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
      if (body.length > 131072) return fail("Payload too large", 413);
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
