/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { Readable } from 'node:stream'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createMemoryBudget, handleAssistant } from '../supabase/functions/assistant/handler.mts'

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    assistantDevRoute(...assistantDevEnv(loadEnv(mode, process.cwd(), 'WATERMARK_'))),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}))
