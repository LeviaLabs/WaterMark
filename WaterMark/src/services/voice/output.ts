// One owner for pending fetches, audio elements and browser speech. Late results cannot play.
export type VoiceState = 'idle' | 'loading' | 'elevenlabs' | 'browser' | 'unavailable'
interface Playback { start(): Promise<void>; stop(): void }
export interface VoiceDeps {
  fetchAudio(text: string, signal: AbortSignal): Promise<Blob>
  audio(blob: Blob, ended: () => void, failed: () => void): Playback
  browser(text: string, language: string, ended: () => void): Playback | null
  changed(state: VoiceState): void
}

export function createVoiceOutput(deps: VoiceDeps) {
  let generation = 0
  let controller: AbortController | null = null
  let playback: Playback | null = null
  const cancel = () => {
    generation++
    controller?.abort()
    controller = null
    playback?.stop()
    playback = null
    deps.changed('idle')
  }
  return {
    cancel,
    async speak(text: string, language: string) {
      cancel()
      if (!text.trim()) return
      const current = generation
      const pending = new AbortController()
      controller = pending
      const isCurrent = () => current === generation && !pending.signal.aborted
      const ended = () => { if (isCurrent()) cancel() }
      let fallbackStarted = false
      const fallback = async () => {
        if (!isCurrent() || fallbackStarted) return
        fallbackStarted = true
        playback?.stop()
        playback = deps.browser(text, language, ended)
        if (!playback) { deps.changed('unavailable'); return }
        deps.changed('browser')
        try { await playback.start() } catch { if (isCurrent()) { cancel(); deps.changed('unavailable') } }
      }
      deps.changed('loading')
      try {
        // Long answers stay complete in browser speech; never silently cut a safety disclaimer.
        if (text.length > 1500) { await fallback(); return }
        const blob = await deps.fetchAudio(text, pending.signal)
        if (!isCurrent()) return
        playback = deps.audio(blob, ended, () => { void fallback() })
        deps.changed('elevenlabs')
        await playback.start()
      } catch { await fallback() }
    },
  }
}

/** Only a public endpoint URL reaches the browser, never an ElevenLabs credential. */
export function resolveTtsUrl(configured: unknown): string | null {
  if (typeof configured !== 'string' || !configured.trim()) return null
  try {
    const url = new URL(configured.trim())
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) ? url.href : null
  } catch { return null }
}

export async function fetchVoiceAudio(url: string | null, text: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Blob> {
  if (!url) throw new Error('VOICE_NOT_CONFIGURED')
  const response = await fetcher(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }), signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
  })
  if (!response.ok || !/^audio\/mpeg(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('VOICE_UNAVAILABLE')
  const blob = await response.blob()
  if (!blob.size || blob.size > 2_000_000) throw new Error('INVALID_AUDIO')
  return blob
}

export function browserVoiceDeps(url: string | null, changed: VoiceDeps['changed']): VoiceDeps {
  return {
    fetchAudio: (text, signal) => fetchVoiceAudio(url, text, signal), changed,
    audio(blob, ended, failed) {
      const objectUrl = URL.createObjectURL(blob)
      const audio = new Audio(objectUrl)
      audio.onended = ended
      audio.onerror = failed
      let stopped = false
      return {
        start: () => audio.play(),
        stop() {
          if (stopped) return
          stopped = true
          audio.onended = null
          audio.onerror = null
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
          URL.revokeObjectURL(objectUrl)
        },
      }
    },
    browser(text, language, ended) {
      if (!('speechSynthesis' in window)) return null
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = language
      utterance.onend = ended
      utterance.onerror = ended
      return {
        start() { speechSynthesis.cancel(); speechSynthesis.speak(utterance); return Promise.resolve() },
        stop() { utterance.onend = null; utterance.onerror = null; speechSynthesis.cancel() },
      }
    },
  }
}
