import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IngressLimiter, readBounded } from '../../functions/agentboxd-auth/limits.ts'
import { createHandler } from '../../functions/agentboxd-auth/flow.ts'
import { fetchProviderJson, ProviderError } from '../../functions/agentboxd-auth/oidc.ts'
import { createRpcStore, StoreError } from '../../functions/agentboxd-auth/store.ts'

const enc = new TextEncoder()
function endless(chunk: Uint8Array) {
  let pulls = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(c) { pulls++; c.enqueue(chunk) },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 })
  return { body, get pulls() { return pulls }, get cancelled() { return cancelled } }
}

test('request byte cap rejects UTF-8 content without buffering an unbounded stream', async () => {
  const stream = endless(enc.encode('é'.repeat(1024)))
  const req = new Request('https://example.test/start', { method: 'POST', body: stream.body, duplex: 'half' } as RequestInit)
  assert.equal(await readBounded(req, 4096, 100), null)
  assert.equal(stream.pulls, 3)
  assert.equal(stream.cancelled, true)
})

test('declared oversized bodies are cancelled without pulling', async () => {
  const stream = endless(enc.encode('x'))
  assert.equal(await readBounded({ body: stream.body, headers: new Headers({ 'content-length': '4097' }) }, 4096, 100), null)
  assert.equal(stream.pulls, 0)
  assert.equal(stream.cancelled, true)
})

test('stalled body and uncooperative cancellation cannot outlive the deadline', async () => {
  const body = new ReadableStream<Uint8Array>({ pull() {}, cancel: () => new Promise(() => {}) })
  const started = Date.now()
  assert.equal(await readBounded({ body, headers: new Headers() }, 4096, 25), null)
  assert.ok(Date.now() - started < 500)
})

test('split UTF-8 decodes correctly; malformed UTF-8 fails closed', async () => {
  const bytes = enc.encode('é')
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, 1)); c.enqueue(bytes.slice(1)); c.close() } })
  assert.equal(await readBounded({ body, headers: new Headers() }, 2, 100), 'é')
  assert.equal(await readBounded(new Response(new Uint8Array([0xff])), 2, 100), null)
})

test('provider cap cancels oversized streaming responses', async () => {
  const stream = endless(new Uint8Array(32768))
  await assert.rejects(fetchProviderJson(() => Promise.resolve(new Response(stream.body)), 'https://id.agentboxd.com/token', {}, 100), ProviderError)
  assert.equal(stream.pulls, 3)
  assert.equal(stream.cancelled, true)
})

test('provider headers arriving do not end the response-body deadline', async () => {
  await assert.rejects(fetchProviderJson(() => Promise.resolve(new Response(new ReadableStream({ pull() {} }))), 'https://id.agentboxd.com/token', {}, 25), ProviderError)
})

test('RPC response is bounded and cannot turn a failed read into successful void', async () => {
  const stream = endless(new Uint8Array(16385))
  const store = createRpcStore('https://ref.supabase.co', 'fixture', () => Promise.resolve(new Response(stream.body)))
  await assert.rejects(store.endSession('fixture'), StoreError)
  assert.equal(stream.pulls, 1)
  assert.equal(stream.cancelled, true)
  const stalled = createRpcStore('https://ref.supabase.co', 'fixture', () => Promise.resolve(new Response(new ReadableStream({ pull() {} }))), 25)
  await assert.rejects(stalled.endSession('fixture'), StoreError)
})

test('handler rejects a slow request without touching the store or provider', async () => {
  // The store is deliberately unreachable: slow reads fail before any route work.
  const handler = createHandler({ clientId: 'fixture', redirectUris: '', allowedOrigins: 'https://watermark.works', store: {} as never, bodyTimeoutMs: 25 })
  const req = new Request('https://example.test/start', { method: 'POST', headers: { Origin: 'https://watermark.works' }, body: new ReadableStream({ pull() {} }), duplex: 'half' } as RequestInit)
  const res = await handler(req)
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'invalid-request' })
})

test('per-instance ingress memory and aggregate count stay bounded and reset', () => {
  const limiter = new IngressLimiter()
  for (let i = 0; i < 600; i++) assert.equal(limiter.hit(String(i), 100_000), true)
  assert.equal(limiter.hit('next', 100_000), false)
  assert.equal(limiter.hit('next', 160_000), true)
})
