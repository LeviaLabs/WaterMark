// Supabase Edge Function: POST /functions/v1/assistant. The flood assistant's model calls (core.mts).
//
// Secrets (names only): WATERMARK_GEMINI_API_KEY (Google AI Studio key), WATERMARK_ALLOWED_ORIGINS
// (exact comma-separated frontend origins, shared with watermark-v1). Public, no login: like
// watermark-v1 it runs with verify_jwt = false (config.toml), so CORS limits which sites can call it.
import { runAssistant } from "./core.mts";

const origins = (Deno.env.get("WATERMARK_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Vary": "Origin" };
  if (origin && origins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "content-type, authorization, apikey, x-client-info";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (origin && !origins.includes(origin)) return json({ code: "ORIGIN_NOT_ALLOWED" }, 403, cors);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405, cors);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ code: "INVALID_REQUEST" }, 400, cors);
  }
  const result = await runAssistant(
    body,
    Deno.env.get("WATERMARK_GEMINI_API_KEY"),
    fetch,
    (msg) => console.warn(msg),
  );
  if (!result.ok) {
    const headers = result.retryAfterSeconds
      ? { ...cors, "retry-after": String(result.retryAfterSeconds) }
      : cors;
    return json({ code: result.code }, result.status, headers);
  }
  return json(
    { content: result.content, model: result.model, finishReason: result.finishReason },
    200,
    cors,
  );
});
