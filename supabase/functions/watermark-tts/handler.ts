// Presentation only: Gemini and the flood tools do not call this endpoint.
export const TTS_LIMITS = {
  textCharacters: 1500,
  bodyBytes: 12_000,
  audioBytes: 2_000_000,
  perClientPerMinute: 6,
  perClientDailyCharacters: 3000,
  globalDailyCharacters: 5000,
  globalMonthlyCharacters: 10_000,
} as const;

export type BudgetResult = "ok" | "limited" | "disabled" | "unavailable";
export interface TtsDeps {
  apiKey: string | undefined;
  voiceId: string | undefined;
  disabled?: string;
  allowedOrigins: readonly string[];
  takeBudget: (client: string, characters: number) => Promise<BudgetResult>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  bodyTimeoutMs?: number;
  now?: () => number;
}

/** The deadline includes fetch AND streamed body reads. Cancellation never waits on the sender. */
async function readBytes(
  source: { body: ReadableStream<Uint8Array> | null; headers: Headers },
  max: number,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(source.headers.get("content-length")) > max || signal.aborted) {
    void source.body?.cancel().catch(() => {});
    throw new Error("BODY_LIMIT");
  }
  if (!source.body) throw new Error("EMPTY_BODY");
  const reader = source.body.getReader();
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error("CANCELLED"));
  });
  signal.addEventListener("abort", rejectAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), aborted]);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > max) throw new Error("BODY_LIMIT");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", rejectAbort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function clientHash(req: Request, now: number): Promise<string> {
  // Address headers are a rate-limit hint, not identity. The global budget remains mandatory.
  const address = (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(
    0,
    64,
  );
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tts|${new Date(now).toISOString().slice(0, 10)}|${address}`),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("").slice(
    0,
    32,
  );
}

export function createTtsBudget(baseUrl: string, key: string, fetcher: typeof fetch = fetch) {
  return async (client: string, characters: number): Promise<BudgetResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
    if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
    try {
      const res = await fetcher(
        `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/watermark_take_tts_budget`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ p_client: client, p_characters: characters }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        void res.body?.cancel().catch(() => {});
        return "unavailable";
      }
      const raw: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          await readBytes(res, 128, controller.signal),
        ),
      );
      return raw === "ok" || raw === "limited" || raw === "disabled" ? raw : "unavailable";
    } catch {
      return "unavailable";
    } finally {
      clearTimeout(timer);
    }
  };
}

export async function handleTts(req: Request, deps: TtsDeps): Promise<Response> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    vary: "Origin",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  const json = (code: string, status: number) =>
    new Response(JSON.stringify({ code }), {
      status,
      headers: {
        ...headers,
        "content-type": "application/json",
        ...(status === 429 ? { "retry-after": "60" } : {}),
      },
    });
  if (!origin || !deps.allowedOrigins.includes(origin)) return json("ORIGIN_NOT_ALLOWED", 403);
  Object.assign(headers, {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
  });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json("METHOD_NOT_ALLOWED", 405);
  if (/^(1|true|yes|on)$/i.test(deps.disabled?.trim() ?? "")) return json("DISABLED", 503);
  if (!deps.apiKey || !/^[a-zA-Z0-9]{20,64}$/.test(deps.voiceId ?? "")) {
    return json("NOT_CONFIGURED", 503);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    return json("INVALID_REQUEST", 400);
  }
  const bodyController = new AbortController();
  const bodyTimer = setTimeout(() => bodyController.abort(), deps.bodyTimeoutMs ?? 5000);
  let text: string;
  try {
    const raw: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readBytes(
          req,
          TTS_LIMITS.bodyBytes,
          AbortSignal.any([req.signal, bodyController.signal]),
        ),
      ),
    );
    if (
      !raw || typeof raw !== "object" || Array.isArray(raw) || !("text" in raw) ||
      typeof raw.text !== "string" || Object.keys(raw).some((key) => key !== "text")
    ) return json("INVALID_REQUEST", 400);
    text = raw.text.trim();
    if (
      !text || text.length > TTS_LIMITS.textCharacters ||
      Array.from(text).some((char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0))
      )
    ) return json("INVALID_REQUEST", 400);
  } catch {
    return json("INVALID_REQUEST", 400);
  } finally {
    clearTimeout(bodyTimer);
  }
  if (req.signal.aborted) return json("CANCELLED", 499);
  let budget: BudgetResult;
  try {
    budget = await deps.takeBudget(await clientHash(req, (deps.now ?? Date.now)()), text.length);
  } catch {
    budget = "unavailable";
  }
  if (budget === "limited") return json("RATE_LIMITED", 429);
  if (budget !== "ok") return json(budget === "disabled" ? "DISABLED" : "BUDGET_UNAVAILABLE", 503);
  if (req.signal.aborted) return json("CANCELLED", 499);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 20_000);
  const signal = AbortSignal.any([controller.signal, req.signal]);
  try {
    // No automatic retries: a timed-out generation may already consume provider credits.
    const response = await (deps.fetcher ?? fetch)(
      `https://api.elevenlabs.io/v1/text-to-speech/${deps.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "xi-api-key": deps.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
      },
    );
    if (
      !response.ok || !/^audio\/mpeg(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")
    ) {
      void response.body?.cancel().catch(() => {});
      return json(
        response.status === 429 ? "PROVIDER_LIMITED" : "PROVIDER_UNAVAILABLE",
        response.status === 429 ? 429 : 502,
      );
    }
    const audio = await readBytes(response, TTS_LIMITS.audioBytes, signal);
    const mp3 = audio.length >= 4 &&
      ((audio[0] === 73 && audio[1] === 68 && audio[2] === 51) ||
        (audio[0] === 255 && (audio[1] & 224) === 224));
    if (!mp3) return json("INVALID_AUDIO", 502);
    return new Response(audio, { headers: { ...headers, "content-type": "audio/mpeg" } });
  } catch {
    return json(
      req.signal.aborted
        ? "CANCELLED"
        : controller.signal.aborted
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_UNAVAILABLE",
      req.signal.aborted ? 499 : controller.signal.aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
}
