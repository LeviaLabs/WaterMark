/** An https URL safe to put in an href, or null when the value is missing or not https. */
export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  return url.href
}
