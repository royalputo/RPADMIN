import { CONFIG } from "./config.js";

let impl = null;

function forcedMode() {
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") return "demo";
  if (params.get("live") === "1") return "live";
  return null;
}

async function mockLayer(demoFallback) {
  const mock = (await import("./mock.js")).mockApi;
  if (demoFallback) mock.demoFallback = true;
  return mock;
}

export async function getData() {
  if (impl) return impl;

  const mode = forcedMode();
  if (mode === "demo") return (impl = await mockLayer(false));
  if (mode === "live") return (impl = (await import("./api.js")).supabaseApi);
  if (CONFIG.USE_MOCK) return (impl = await mockLayer(false));

  try {
    const live = await import("./api.js");
    if (await live.supabaseApi.schemaReady()) {
      impl = live.supabaseApi;
      return impl;
    }
  } catch {
    /* offline or CDN unavailable — fall through to demo */
  }

  impl = await mockLayer(true);
  return impl;
}
