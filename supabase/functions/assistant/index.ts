// Supabase Edge Function: POST /functions/v1/assistant.
//
// Secrets (names only): WATERMARK_GEMINI_API_KEY, WATERMARK_ALLOWED_ORIGINS (exact origins, shared
// with watermark-v1), WATERMARK_ASSISTANT_DISABLED (1 / true / yes / on returns 503).
// SUPABASE_URL and the service-role key are injected by Supabase and used only to take the
// Postgres request budget. The Gemini key never leaves this process.
//
// verify_jwt is false (config.toml) because the map is public. CORS does not stop a script or a
// direct HTTP client. watermark_take_assistant_budget is the limit, and a failed budget check
// does not call Gemini.
import { serverCredential } from "../_shared/config.ts";
import { createAssistantBudgetClient, handleAssistant } from "./handler.mts";

const origins = (Deno.env.get("WATERMARK_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim())
  .filter(Boolean);
const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
const serviceKey = serverCredential((name) => Deno.env.get(name));
const budget = supabaseUrl && serviceKey ? createAssistantBudgetClient(supabaseUrl, serviceKey) : null;

Deno.serve((req) =>
  handleAssistant(req, {
    apiKey: Deno.env.get("WATERMARK_GEMINI_API_KEY"),
    allowedOrigins: origins,
    disabled: Deno.env.get("WATERMARK_ASSISTANT_DISABLED"),
    // Missing database credentials fail closed: Gemini is not called without a shared budget.
    takeBudget: budget ? (hash) => budget.take(hash) : () => Promise.resolve("unavailable"),
    fetcher: fetch,
    log: (msg) => console.warn(msg),
  })
);
