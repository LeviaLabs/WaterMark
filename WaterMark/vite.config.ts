/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { runAssistant } from '../supabase/functions/assistant/core.mts'
import { runSummary } from '../supabase/functions/outlook-summary/core.mts'

type Answer = { ok: true; body: unknown } | { ok: false; status: number; code: string; retryAfterSeconds?: number }

/**
 * Serves a Supabase Edge Function's core at `path` while developing, so `npm run dev` runs the same
 * code as production. Keys come from .env.local (WATERMARK_* names), which is git-ignored and,
 * having no VITE_ prefix, never reaches the browser bundle.
 */
function devRoute(name: string, path: string, handle: (body: unknown, warn: (msg: string) => void) => Promise<Answer>): Plugin {
  return {
    name,
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(path, (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { code: 'METHOD_NOT_ALLOWED' })
        const chunks: Buffer[] = []
        let size = 0
        req.on('data', (c: Buffer) => { size += c.length; if (size <= 200_000) chunks.push(c) })
        req.on('end', async () => {
          let body: unknown
          try {
            body = size > 200_000 ? null : JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            return send(400, { code: 'INVALID_REQUEST' })
          }
          const result = await handle(body, (msg) => server.config.logger.warn(msg))
          if (!result.ok) {
            if (result.retryAfterSeconds) res.setHeader('retry-after', String(result.retryAfterSeconds))
            return send(result.status, { code: result.code })
          }
          send(200, result.body)
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
      // The flood assistant (Gemini): supabase/functions/assistant.
      devRoute('watermark-assistant-dev', '/api/assistant', async (body, warn) => {
        const r = await runAssistant(body, env.WATERMARK_GEMINI_API_KEY, fetch, warn)
        return r.ok ? { ok: true, body: { content: r.content, model: r.model, finishReason: r.finishReason } } : r
      }),
      // Flood-outlook summaries (open-weight model): supabase/functions/outlook-summary.
      devRoute('watermark-summary-dev', '/api/outlook-summary', async (body, warn) => {
        const r = await runSummary(body, {
          apiKey: env.WATERMARK_SUMMARY_API_KEY,
          baseUrl: env.WATERMARK_SUMMARY_BASE_URL,
          models: env.WATERMARK_SUMMARY_MODELS,
        }, fetch, warn)
        return r.ok ? { ok: true, body: { text: r.text, model: r.model } } : r
      }),
    ],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }
})
