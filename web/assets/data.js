import { CONFIG } from "./config.js";

let impl = null;

function forcedMode() {
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") return "demo";
  if (params.get("live") === "1") return "live";
  return null;
}

export async function getData() {
  if (impl) return impl;

  const mode = forcedMode();
  const useMock = mode === "demo" || (mode !== "live" && CONFIG.USE_MOCK);
  impl = useMock
    ? (await import("./mock.js")).mockApi
    : (await import("./api.js")).supabaseApi;
  return impl;
}
