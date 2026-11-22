import { serverCredential } from "../_shared/config.ts";
import { createTtsBudget, handleTts } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = serverCredential((name) => Deno.env.get(name));
const takeBudget = url && key
  ? createTtsBudget(url, key)
  : () => Promise.resolve("unavailable" as const);
const allowedOrigins = (Deno.env.get("WATERMARK_ALLOWED_ORIGINS") ?? "").split(",").map((s) =>
  s.trim()
).filter(Boolean);

Deno.serve((req) =>
  handleTts(req, {
    apiKey: Deno.env.get("ELEVENLABS_API_KEY"),
    voiceId: Deno.env.get("ELEVENLABS_VOICE_ID"),
    disabled: Deno.env.get("WATERMARK_TTS_DISABLED"),
    allowedOrigins,
    takeBudget,
  })
);
