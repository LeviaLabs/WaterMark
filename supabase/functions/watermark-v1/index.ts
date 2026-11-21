import { createHandler } from "../_shared/handler.ts";
import { createStore } from "../_shared/store.ts";

const baseUrl = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const origins = (Deno.env.get("WATERMARK_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim())
  .filter(Boolean);
Deno.serve(createHandler({
  store: baseUrl && key ? createStore(baseUrl, key) : null,
  origins,
  userAgent: Deno.env.get("WATERMARK_NWS_USER_AGENT") ??
    "WaterMark/0.1 (https://github.com/LeviaLabs/WaterMark)",
}));
