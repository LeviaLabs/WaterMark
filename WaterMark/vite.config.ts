/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createMemoryBudget, handleAssistant } from '../supabase/functions/assistant/handler.mts'
import { runSummary } from '../supabase/functions/outlook-summary/core.mts'

/**
 * Serves the flood assistant at /api/assistant while developing, running the same guard and model
 * proxy as the Supabase Edge Function (supabase/functions/assistant). The key comes from
 * WATERMARK_GEMINI_API_KEY in .env.local, which is git-ignored and, having no VITE_ prefix, never
 * reaches the browser bundle. The dev process keeps its own request budget. Production uses the
 * Postgres budget instead, and refuses to call Gemini when that budget is unavailable.
 */
function assistantDevEnv(env: Record<string, string>): [string | undefined, string | undefined] {
  return [env.WATERMARK_GEMINI_API_KEY, env.WATERMARK_ASSISTANT_DISABLED]
}

function assistantDevRoute(apiKey: string | undefined, disabled: string | undefined): Plugin {
  const budget = createMemoryBudget()
  return {
    name: 'watermark-assistant-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/assistant', (req, res) => {
        void (async () => {
          try {
            const headers = new Headers()
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers.set(key, value)
              else if (Array.isArray(value)) headers.set(key, value.join(', '))
            }
            const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers }
            if (req.method !== 'GET' && req.method !== 'HEAD') {
              init.body = Readable.toWeb(req) as ReadableStream
              init.duplex = 'half'
            }
            const response = await handleAssistant(new Request('http://127.0.0.1/api/assistant', init), {
              apiKey,
              allowedOrigins: [],
              allowAnyOrigin: true,
              disabled,
              takeBudget: (hash) => budget.take(hash),
              fetcher: fetch,
              log: (msg) => server.config.logger.warn(msg),
            })
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch {
            if (res.writableEnded) return
            res.statusCode = 503
            res.setHeader('content-type', 'application/json')
            res.setHeader('cache-control', 'no-store')
            res.end(JSON.stringify({ code: 'NOT_CONFIGURED' }))
          }
        })()
      })
    },
  }
}

/**
 * Serves the flood-outlook summary at /api/outlook-summary while developing, the same core as
 * supabase/functions/outlook-summary. Keys are WATERMARK_SUMMARY_* in .env.local (no VITE_ prefix).
 */
function summaryDevRoute(env: Record<string, string>): Plugin {
  return {
    name: 'watermark-summary-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/outlook-summary', (req, res) => {
        const send = (status: number, body: unknown, retryAfter?: number) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.setHeader('cache-control', 'no-store')
          if (retryAfter) res.setHeader('retry-after', String(retryAfter))
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { code: 'METHOD_NOT_ALLOWED' })
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (c: Buffer) => { size += c.length; if (size <= 200_000) chunks.push(c) })
        req.on('end', () => {
          void (async () => {
            let body: unknown
            try {
              body = size > 200_000 ? null : JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
              return send(400, { code: 'INVALID_REQUEST' })
            }
            const result = await runSummary(body, {
              apiKey: env.WATERMARK_SUMMARY_API_KEY,
              baseUrl: env.WATERMARK_SUMMARY_BASE_URL,
              models: env.WATERMARK_SUMMARY_MODELS,
            }, fetch, (msg) => server.config.logger.warn(msg))
            if (!result.ok) return send(result.status, { code: result.code }, result.retryAfterSeconds)
            send(200, { text: result.text, model: result.model })
          })()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'WATERMARK_')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      assistantDevRoute(...assistantDevEnv(env)),
      summaryDevRoute(env),
    ],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }
})
