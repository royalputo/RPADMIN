// RpAdmin — Dev By Royalputo
// Local preview server: serves `web/` and mirrors the Cloudflare Pages Function
// at /api, so Supabase stays server-side during development.
//
// Usage: node tools/preview.mjs
// Secrets are read from the environment, else from "web secret.txt" (gitignored).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "web");
const port = Number(process.env.PORT || 4173);

function loadSecrets() {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    const file = path.join(root, "web secret.txt");
    if (fs.existsSync(file)) {
      const lines = fs
        .readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      url = url || lines[0];
      key = key || lines[1];
    }
  }
  return { url, key };
}

const secrets = loadSecrets();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonc": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function proxy(req, res, url) {
  if (!secrets.url || !secrets.key) {
    return sendJson(res, 500, {
      error: "Server is not configured (SUPABASE_URL / SUPABASE_ANON_KEY)",
    });
  }

  const pathname = url.pathname;

  if (pathname === "/api/health") {
    try {
      const response = await fetch(`${secrets.url}/rest/v1/servers?select=id&limit=1`, {
        headers: { apikey: secrets.key },
      });
      if (response.ok) return sendJson(res, 200, { ok: true, schema: true });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return sendJson(res, 200, { ok: true, schema: false, code: payload && payload.code });
    } catch {
      return sendJson(res, 200, { ok: false, schema: false });
    }
  }

  if (pathname === "/api/auth/google") {
    const fallback = `${url.origin}/auth/callback`;
    const requested = url.searchParams.get("redirect") || fallback;
    const redirect = requested.startsWith(`${url.origin}/`) ? requested : fallback;
    const target =
      `${secrets.url}/auth/v1/authorize?provider=google&flow_type=implicit` +
      `&redirect_to=${encodeURIComponent(redirect)}`;
    res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
    res.end();
    return;
  }

  if (pathname === "/api/auth/google") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    let payload = {};
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      payload = {};
    }
    if (!payload.credential) return sendJson(res, 400, { error: "Google credential is required" });
    try {
      const response = await fetch(`${secrets.url}/auth/v1/token?grant_type=id_token`, {
        method: "POST",
        headers: { apikey: secrets.key, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", id_token: payload.credential }),
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      });
      res.end(buffer);
    } catch {
      sendJson(res, 502, { error: "Upstream request failed" });
    }
    return;
  }

  const authRoutes = {
    "/api/auth/login": "/auth/v1/token?grant_type=password",
    "/api/auth/signup": "/auth/v1/signup",
    "/api/auth/refresh": "/auth/v1/token?grant_type=refresh_token",
    "/api/auth/user": "/auth/v1/user",
    "/api/auth/logout": "/auth/v1/logout",
  };

  let target = null;
  const headers = { apikey: secrets.key };

  if (authRoutes[pathname]) {
    target = `${secrets.url}${authRoutes[pathname]}`;
  } else if (pathname.startsWith("/api/rest/")) {
    target = `${secrets.url}/rest/v1${pathname.slice("/api/rest".length)}${url.search}`;
  } else {
    return sendJson(res, 404, { error: "Not found" });
  }

  const authorization = req.headers.authorization;
  if (authorization) headers.Authorization = authorization;
  const serverKey = req.headers["x-server-key"];
  if (serverKey) headers["X-Server-Key"] = serverKey;
  const contentType = req.headers["content-type"];
  if (contentType) headers["Content-Type"] = contentType;
  const prefer = req.headers.prefer;
  if (prefer) headers.Prefer = prefer;

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await readBody(req);
    if (!body || !body.trim()) body = "{}";
  }

  try {
    const response = await fetch(target, { method: req.method, headers, body });
    const payload = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    res.end(payload);
  } catch {
    sendJson(res, 502, { error: "Upstream request failed" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname.startsWith("/api/")) {
    await proxy(req, res, url);
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = path.normalize(path.join(webRoot, pathname));

  if (!file.startsWith(webRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  // SPA fallback (mirrors _redirects)
  const index = path.join(webRoot, "index.html");
  res.writeHead(200, { "Content-Type": types[".html"], "Cache-Control": "no-store" });
  fs.createReadStream(index).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  const live = secrets.url && secrets.key ? "live API" : "demo only (no secrets found)";
  console.log(`RpAdmin preview: http://localhost:${port}  (${live})`);
});
