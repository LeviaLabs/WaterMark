/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { runAssistant } from '../supabase/functions/assistant/core.mts'

/**
 * Serves the flood assistant at /api/assistant while developing, running the same code as the
 * Supabase Edge Function (supabase/functions/assistant). The key comes from WATERMARK_GEMINI_API_KEY
 * in .env.local, which is git-ignored and, having no VITE_ prefix, never reaches the browser bundle.
 */
function assistantDevRoute(apiKey: string | undefined): Plugin {
  return {
    name: 'watermark-assistant-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/assistant', (req, res) => {
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
          const result = await runAssistant(body, apiKey, fetch, (msg) => server.config.logger.warn(msg))
          if (!result.ok) {
            if (result.retryAfterSeconds) res.setHeader('retry-after', String(result.retryAfterSeconds))
            return send(result.status, { code: result.code })
          }
          send(200, { content: result.content, model: result.model, finishReason: result.finishReason })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    assistantDevRoute(loadEnv(mode, process.cwd(), 'WATERMARK_').WATERMARK_GEMINI_API_KEY),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}))
