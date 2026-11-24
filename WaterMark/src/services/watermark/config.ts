const LOCAL_HOST = /^(localhost|.+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i

/**
 * VITE_WATERMARK_API_URL is the watermark-v1 function base, with no key.
 * Empty or invalid means the map keeps its direct public sources.
 * A production build accepts only HTTPS, and not a loopback host.
 */
export function watermarkApiUrlFromEnv(env: Record<string, unknown>): string | null {
  const raw = typeof env.VITE_WATERMARK_API_URL === 'string' ? env.VITE_WATERMARK_API_URL.trim() : ''
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.search || url.hash || url.username || url.password) return null
  if (env.PROD === true && (url.protocol !== 'https:' || LOCAL_HOST.test(url.hostname))) return null
  return url.href.replace(/\/+$/, '')
}
