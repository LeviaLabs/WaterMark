// Explicit opt-in: uses only the isolated, network-disabled local PostgreSQL fixture container.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const enabled = process.env.AGENTBOXD_LOCAL_DB_TEST === '1'
const query = async (sql: string) => (await run('docker', ['exec', 'watermark-agentboxd-007', 'psql', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', sql], { timeout: 15_000 })).stdout.trim()

test('PostgreSQL concurrent starts obey the limit; callbacks consume a state once', { skip: !enabled }, async () => {
  const client = 'e'.repeat(64)
  const states = Array.from({ length: 20 }, (_, i) => String(i).padStart(43, 'Q'))
  const results = await Promise.all(states.map((state) => query(`set role service_role; select public.watermark_agentboxd_begin('${state}',repeat('N',43),repeat('C',43),'https://watermark.works/agentboxd-callback.html','${client}',600,10);`)))
  assert.equal(results.filter((x) => x === 't').length, 10)
  const state = states[results.indexOf('t')]
  const callbacks = await Promise.all(Array.from({ length: 6 }, () => query(`set role service_role; select public.watermark_agentboxd_take_attempt('${state}') is not null;`)))
  assert.equal(callbacks.filter((x) => x === 't').length, 1)
})
