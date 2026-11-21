import { createHandler } from "../_shared/handler.ts";
import { createStore } from "../_shared/store.ts";
import { serverCredential } from "../_shared/config.ts";

const baseUrl = Deno.env.get("SUPABASE_URL");
const key = serverCredential((name) => Deno.env.get(name));
const origins = (Deno.env.get("WATERMARK_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim())
  .filter(Boolean);
Deno.serve(createHandler({
  store: baseUrl && key ? createStore(baseUrl, key) : null,
  origins,
  userAgent: Deno.env.get("WATERMARK_NWS_USER_AGENT") ?? "",
}));
