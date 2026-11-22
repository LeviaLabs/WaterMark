import assert from "node:assert/strict";
import {
  createTtsBudget,
  handleTts,
  TTS_LIMITS,
  type TtsDeps,
} from "../../functions/watermark-tts/handler.ts";

const origin = "https://watermark.works";
const mp3 = () =>
  new Response(new Uint8Array([73, 68, 51, 4]), { headers: { "content-type": "audio/mpeg" } });
const post = (body: unknown = { text: "Check official warnings." }, extra: RequestInit = {}) =>
  new Request("https://example.test/tts", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
    ...extra,
  });
function fixture(overrides: Partial<TtsDeps> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const reservations: number[] = [];
  const deps: TtsDeps = {
    apiKey: "test-private-key",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    allowedOrigins: [origin],
    takeBudget: (_client, count) => {
      reservations.push(count);
      return Promise.resolve("ok");
    },
    fetcher: (input, init) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(mp3());
    },
    ...overrides,
  };
  return { deps, calls, reservations };
}

Deno.test("TTS returns bounded MP3; key only in provider header and voice/model fixed on server", async () => {
  const { deps, calls, reservations } = fixture();
  const response = await handleTts(post(), deps);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(new Uint8Array(await response.arrayBuffer()).length, 4);
  assert.deepEqual(reservations, [24]);
  assert.equal(calls.length, 1);
  assert(!calls[0].url.includes("test-private-key"));
  assert.equal(new Headers(calls[0].init?.headers).get("xi-api-key"), "test-private-key");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    text: "Check official warnings.",
    model_id: "eleven_flash_v2_5",
  });
  assert.equal(calls[0].init?.redirect, "error");
});

Deno.test("TTS rejects bad origins, methods, missing configuration and kill switch without provider calls", async () => {
  for (
    const [req, override, expected] of [
      [post({}, { headers: { origin: "https://evil.test" } }), {}, 403],
      [post({}, { headers: {} }), {}, 403],
      [new Request("https://example.test/tts", { method: "GET", headers: { origin } }), {}, 405],
      [post(), { apiKey: undefined }, 503],
      [post(), { voiceId: "../../evil" }, 503],
      [post(), { disabled: "TRUE" }, 503],
    ] satisfies [Request, Partial<TtsDeps>, number][]
  ) {
    const { deps, calls, reservations } = fixture(override);
    assert.equal((await handleTts(req, deps)).status, expected);
    assert.equal(calls.length + reservations.length, 0);
  }
  assert.equal(
    (await handleTts(
      new Request("https://example.test/tts", { method: "OPTIONS", headers: { origin } }),
      fixture().deps,
    )).status,
    204,
  );
});

Deno.test("TTS validates JSON, text and byte size before taking a budget", async () => {
  for (
    const input of [null, [], {}, { text: 5 }, { text: " " }, { text: "a".repeat(1501) }, {
      text: "hi",
      voice_id: "other",
    }, { text: "\u0000" }]
  ) {
    const { deps, calls, reservations } = fixture();
    assert.equal((await handleTts(post(input), deps)).status, 400);
    assert.equal(calls.length + reservations.length, 0);
  }
  for (
    const req of [
      post({}, { body: "{" }),
      post({}, { body: " ".repeat(TTS_LIMITS.bodyBytes + 1) }),
      post({}, { headers: { origin, "content-type": "text/plain" } }),
    ]
  ) {
    assert.equal((await handleTts(req, fixture().deps)).status, 400);
  }
});

Deno.test("TTS budgets fail closed, including thrown database errors", async () => {
  for (
    const [result, status] of [["limited", 429], ["disabled", 503], ["unavailable", 503]] as const
  ) {
    const { deps, calls } = fixture({ takeBudget: () => Promise.resolve(result) });
    const res = await handleTts(post(), deps);
    assert.equal(res.status, status);
    assert.equal(calls.length, 0);
  }
  const { deps, calls } = fixture({
    takeBudget: () => Promise.reject(new Error("private database details")),
  });
  const res = await handleTts(post(), deps);
  assert.equal(res.status, 503);
  assert(!((await res.text()).includes("private")));
  assert.equal(calls.length, 0);
});

Deno.test("TTS isolates quota, provider errors, invalid audio and oversized streamed audio without retry", async () => {
  for (
    const response of [
      new Response("secret diagnostic", { status: 429 }),
      new Response("secret diagnostic", { status: 500 }),
      new Response("not mp3", { headers: { "content-type": "audio/mpeg" } }),
      new Response("bad", { headers: { "content-type": "text/html" } }),
      new Response(new Uint8Array(TTS_LIMITS.audioBytes + 1), {
        headers: { "content-type": "audio/mpeg" },
      }),
    ]
  ) {
    let count = 0;
    const { deps, reservations } = fixture({
      fetcher: () => {
        count++;
        return Promise.resolve(response);
      },
    });
    const res = await handleTts(post(), deps);
    assert.equal(res.status, response.status === 429 ? 429 : 502);
    assert(!((await res.text()).includes("secret")));
    assert.equal(count, 1);
    assert.equal(reservations.length, 1);
  }
});

Deno.test("TTS deadline covers stalled fetch and body; cancellation does not trigger retries", async () => {
  const stalled: typeof fetch = (_input, init) =>
    new Promise((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
    );
  assert.equal(
    (await handleTts(post(), fixture({ timeoutMs: 5, fetcher: stalled }).deps)).status,
    504,
  );
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array([73, 68, 51, 4]));
    },
    cancel() {
      return new Promise(() => {});
    },
  });
  assert.equal(
    (await handleTts(
      post(),
      fixture({
        timeoutMs: 5,
        fetcher: () =>
          Promise.resolve(new Response(stream, { headers: { "content-type": "audio/mpeg" } })),
      }).deps,
    )).status,
    504,
  );
  const controller = new AbortController();
  controller.abort();
  const { deps, calls } = fixture();
  assert.equal((await handleTts(post({}, { signal: controller.signal }), deps)).status, 400);
  assert.equal(calls.length, 0);
});

Deno.test("TTS rejects slow request streams within its body deadline", async () => {
  const request = post({}, {
    body: new ReadableStream({
      cancel() {
        return new Promise(() => {});
      },
    }),
  });
  assert.equal((await handleTts(request, fixture({ bodyTimeoutMs: 5 }).deps)).status, 400);
});

Deno.test("TTS budget RPC sends only hash and count; malformed/failed responses deny calls", async () => {
  for (
    const response of [
      new Response('"ok"'),
      new Response('"limited"'),
      new Response('"disabled"'),
      new Response('"unexpected"'),
      new Response("private error", { status: 403 }),
    ]
  ) {
    const budget = createTtsBudget("https://example.test", "test-key", (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        p_client: "a".repeat(32),
        p_characters: 42,
      });
      return Promise.resolve(response);
    });
    const result = await budget("a".repeat(32), 42);
    assert(["ok", "limited", "disabled", "unavailable"].includes(result));
    if (!response.ok) assert.equal(result, "unavailable");
  }
});
