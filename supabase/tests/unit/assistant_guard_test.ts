// Abuse controls for the flood assistant. Synthetic fixtures only: no Gemini, no database.
import assert from "node:assert/strict";
import { runAssistant } from "../../functions/assistant/core.mts";
import {
  ASSISTANT_LIMITS,
  clientAddress,
  createAssistantBudgetClient,
  createMemoryBudget,
  dailyClientHash,
  handleAssistant,
  isAssistantDisabled,
  MAX_BODY_BYTES,
  readJsonBody,
  type AssistantDeps,
  type BudgetCode,
} from "../../functions/assistant/handler.mts";

const URL = "https://project.example/functions/v1/assistant";
const ORIGIN = "https://watermark.works";
const ASK = { contents: [{ role: "user", parts: [{ text: "Does Houston flood often?" }] }] };

function geminiReply(text = "Yes.") {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function post(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": "203.0.113.8", ...headers },
    body,
  });
}

function deps(over: Partial<AssistantDeps> & { calls?: string[] } = {}): AssistantDeps & { calls: string[] } {
  const calls = over.calls ?? [];
  return {
    apiKey: "test-key",
    allowedOrigins: [ORIGIN],
    takeBudget: () => Promise.resolve("ok" as BudgetCode),
    fetcher: ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.resolve(geminiReply());
    }) as typeof fetch,
    calls,
    ...over,
    ...(over.fetcher ? { fetcher: over.fetcher } : {}),
  };
}

Deno.test("kill switch returns 503 and does not read a budget or call Gemini", async () => {
  for (const disabled of ["1", "true", " YES ", "on"]) {
    assert.equal(isAssistantDisabled(disabled), true);
  }
  for (const disabled of ["", "0", "false", "off", undefined]) {
    assert.equal(isAssistantDisabled(disabled), false);
  }
  let budgets = 0;
  const calls: string[] = [];
  const res = await handleAssistant(post(JSON.stringify(ASK)), {
    ...deps({ calls }),
    disabled: "1",
    takeBudget: () => {
      budgets += 1;
      return Promise.resolve("ok");
    },
  });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { code: "DISABLED" });
  assert.equal(budgets, 0);
  assert.equal(calls.length, 0);
});

Deno.test("database kill switch and a failed budget check do not call Gemini", async () => {
  for (const [code, status, body] of [
    ["disabled", 503, "DISABLED"],
    ["unavailable", 503, "NOT_CONFIGURED"],
  ] as const) {
    const calls: string[] = [];
    const res = await handleAssistant(post(JSON.stringify(ASK)), {
      ...deps({ calls }),
      takeBudget: () => Promise.resolve(code),
    });
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { code: body });
    assert.equal(calls.length, 0);
  }
  const calls: string[] = [];
  const res = await handleAssistant(post(JSON.stringify(ASK)), {
    ...deps({ calls }),
    takeBudget: () => Promise.reject(new Error("db down")),
  });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { code: "NOT_CONFIGURED" });
  assert.equal(calls.length, 0);
});

Deno.test("per-client budget returns 429 and the next client still passes", async () => {
  let now = Date.parse("2026-11-22T15:00:00Z");
  const budget = createMemoryBudget(() => now);
  const calls: string[] = [];
  const base = deps({ calls });
  const send = (ip: string) =>
    handleAssistant(post(JSON.stringify(ASK), { "x-forwarded-for": ip }), {
      ...base,
      now: () => now,
      takeBudget: (hash) => budget.take(hash),
    });
  for (let i = 0; i < ASSISTANT_LIMITS.perClientPerMinute; i++) {
    const res = await send("203.0.113.8");
    assert.equal(res.status, 200, `request ${i + 1}`);
  }
  const blocked = await send("203.0.113.8");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "60");
  assert.deepEqual(await blocked.json(), { code: "RATE_LIMITED" });
  assert.equal(calls.length, ASSISTANT_LIMITS.perClientPerMinute);

  const other = await send("203.0.113.9");
  assert.equal(other.status, 200);
  assert.equal(calls.length, ASSISTANT_LIMITS.perClientPerMinute + 1);

  now += 61_000;
  const again = await send("203.0.113.8");
  assert.equal(again.status, 200);
});

Deno.test("global daily cap returns 429 with a retry delay past one minute", async () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const budget = createMemoryBudget(() => now, {
    perClientPerMinute: 100,
    perClientPerDay: 100,
    globalPerDay: 2,
  });
  const calls: string[] = [];
  const send = (ip: string) =>
    handleAssistant(post(JSON.stringify(ASK), { "x-forwarded-for": ip }), {
      ...deps({ calls }),
      now: () => now,
      takeBudget: (hash) => budget.take(hash),
    });
  assert.equal((await send("203.0.113.1")).status, 200);
  assert.equal((await send("203.0.113.2")).status, 200);
  const blocked = await send("203.0.113.3");
  assert.equal(blocked.status, 429);
  assert.equal(calls.length, 2);
  const retry = Number(blocked.headers.get("retry-after"));
  assert.ok(retry > 60 && retry <= 86_400);
});

Deno.test("budget key is a daily hash, not the client address", async () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  const address = "203.0.113.50, 10.0.0.4";
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": address })), "203.0.113.50");
  const hash = await dailyClientHash("203.0.113.50", now);
  assert.match(hash, /^[a-f0-9]{32}$/);
  assert.equal(hash.includes("203"), false);
  assert.equal(await dailyClientHash("203.0.113.50", now), hash);
  assert.notEqual(await dailyClientHash("203.0.113.51", now), hash);
  assert.notEqual(await dailyClientHash("203.0.113.50", now + 86_400_000), hash);

  let seen = "";
  const res = await handleAssistant(post(JSON.stringify(ASK), { "x-forwarded-for": "203.0.113.50" }), {
    ...deps(),
    now: () => now,
    takeBudget: (key) => {
      seen = key;
      return Promise.resolve("ok");
    },
  });
  assert.equal(res.status, 200);
  assert.equal(seen, hash);
});

Deno.test("postgres budget client posts the hash and fails closed", async () => {
  const seen = { url: "", body: "", authorization: null as string | null };
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.url = String(input);
    seen.body = String(init?.body);
    seen.authorization = headers.get("authorization");
    return Promise.resolve(new Response(JSON.stringify("daily_limited"), { status: 200 }));
  }) as typeof fetch;
  const client = createAssistantBudgetClient("https://db.example/", "eyJtest", fetcher);
  assert.equal(await client.take("ab".repeat(16)), "daily_limited");
  assert.equal(seen.url, "https://db.example/rest/v1/rpc/watermark_take_assistant_budget");
  assert.deepEqual(JSON.parse(seen.body), { p_client: "ab".repeat(16) });
  assert.equal(seen.authorization, "Bearer eyJtest");

  const secret = createAssistantBudgetClient("https://db.example", "sb_secret_test", fetcher);
  await secret.take("cd".repeat(16));
  assert.equal(seen.authorization, null);

  const hang = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })) as typeof fetch;
  const started = Date.now();
  assert.equal(
    await createAssistantBudgetClient("https://db.example", "k", hang, 40).take("a".repeat(32)),
    "unavailable",
  );
  assert.ok(Date.now() - started < 1_000);

  const down = (() => Promise.resolve(new Response("no", { status: 500 }))) as typeof fetch;
  assert.equal(
    await createAssistantBudgetClient("https://db.example", "k", down, 1_000).take("a".repeat(32)),
    "unavailable",
  );
});

Deno.test("oversized and slow bodies are rejected before the budget and Gemini", async () => {
  let pulled = 0;
  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024));
    },
  });
  assert.deepEqual(await readJsonBody({ body: endless, headers: new Headers() }, 4_096), { ok: false });
  assert.ok(pulled <= 6);

  const declared = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  assert.deepEqual(
    await readJsonBody({
      body: declared,
      headers: new Headers({ "content-length": String(MAX_BODY_BYTES + 1) }),
    }),
    { ok: false },
  );

  const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
  const started = Date.now();
  assert.deepEqual(await readJsonBody({ body: stalled, headers: new Headers() }, 8_192, 30), { ok: false });
  assert.ok(Date.now() - started < 1_000);

  let budgets = 0;
  const calls: string[] = [];
  const tooBig = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8_192));
    },
  });
  const res = await handleAssistant(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: tooBig,
    }),
    {
      ...deps({ calls }),
      maxBodyBytes: 1_024,
      takeBudget: () => {
        budgets += 1;
        return Promise.resolve("ok");
      },
    },
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { code: "INVALID_REQUEST" });
  assert.equal(budgets, 0);
  assert.equal(calls.length, 0);

  const slow = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
  const slowStarted = Date.now();
  const slowRes = await handleAssistant(
    new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: slow,
    }),
    { ...deps(), bodyTimeoutMs: 30, takeBudget: () => Promise.resolve("ok") },
  );
  assert.equal(slowRes.status, 400);
  assert.ok(Date.now() - slowStarted < 1_000);
});

Deno.test("upstream timeout covers a body that never arrives and quota stops the model loop", async () => {
  let calls = 0;
  const hangingBody = (() => {
    calls += 1;
    return Promise.resolve(new Response(
      new ReadableStream({ pull() {} }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
  }) as typeof fetch;
  const started = Date.now();
  const timed = await runAssistant(ASK, "k", hangingBody, () => {}, { timeoutMs: 40 });
  assert.deepEqual(timed, { ok: false, status: 504, code: "MODEL_UNAVAILABLE" });
  assert.equal(calls, 1);
  assert.ok(Date.now() - started < 1_000);

  calls = 0;
  const quota = ((input: RequestInfo | URL) => {
    calls += 1;
    const model = String(input);
    if (model.includes("gemini-3.5-flash")) return Promise.resolve(new Response("", { status: 503 }));
    return Promise.resolve(new Response(
      JSON.stringify({ error: { code: 403, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }),
      { status: 403, headers: { "content-type": "application/json" } },
    ));
  }) as typeof fetch;
  const limited = await runAssistant(ASK, "k", quota);
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.code, "RATE_LIMITED");
  assert.equal(calls, 2);
});
