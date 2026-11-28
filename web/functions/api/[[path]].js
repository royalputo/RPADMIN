// RpAdmin — Dev By Royalputo
// Cloudflare Pages Function: keeps the Supabase URL and keys server-side.
// Browser + MTA only ever talk to https://rpadmin.mtarg.xyz/api/*.

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

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return fail("Server is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)", 500);
  }

  const url = new URL(request.url);
  const rawPath = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  const path = "/" + rawPath.replace(/^\/+/, "");

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

  if (path === "/auth/google" && method === "GET") {
    const fallback = `${url.origin}/auth/callback`;
    const requested = url.searchParams.get("redirect") || fallback;
    const redirect = requested.startsWith(`${url.origin}/`) ? requested : fallback;
    const target =
      `${env.SUPABASE_URL}/auth/v1/authorize?provider=google&flow_type=implicit` +
      `&redirect_to=${encodeURIComponent(redirect)}`;
    return Response.redirect(target, 302);
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
