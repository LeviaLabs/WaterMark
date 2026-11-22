import { describe, expect, it, vi } from 'vitest'
import { browserVoiceDeps, createVoiceOutput, fetchVoiceAudio, resolveTtsUrl, type VoiceDeps, type VoiceState } from '../src/services/voice/output'

function setup(overrides: Partial<VoiceDeps> = {}) {
  const states: VoiceState[] = []
  const audio = { start: vi.fn(() => Promise.resolve()), stop: vi.fn() }
  const browser = { start: vi.fn(() => Promise.resolve()), stop: vi.fn() }
  const deps: VoiceDeps = {
    fetchAudio: vi.fn(() => Promise.resolve(new Blob(['ID3x'], { type: 'audio/mpeg' }))),
    audio: vi.fn(() => audio), browser: vi.fn(() => browser), changed: (state) => states.push(state), ...overrides,
  }
  return { voice: createVoiceOutput(deps), deps, audio, browser, states }
}

describe('assistant voice output', () => {
  it('plays ElevenLabs first, then stops the previous audio before replacement', async () => {
    const { voice, audio, deps, states } = setup()
    await voice.speak('First', 'en'); await voice.speak('Second', 'en')
    expect(audio.start).toHaveBeenCalledTimes(2)
    expect(audio.stop).toHaveBeenCalledTimes(1)
    expect(deps.browser).not.toHaveBeenCalled()
    expect(states.at(-1)).toBe('elevenlabs')
    voice.cancel()
    expect(audio.stop).toHaveBeenCalledTimes(2)
    expect(states.at(-1)).toBe('idle')
  })

  it('aborts a pending fetch and ignores its late result without browser fallback', async () => {
    let resolve: (blob: Blob) => void = () => {}
    let signal: AbortSignal | undefined
    const { voice, deps } = setup({ fetchAudio: (_text, s) => { signal = s; return new Promise((r) => { resolve = r }) } })
    const pending = voice.speak('Old', 'en')
    voice.cancel(); resolve(new Blob(['late']))
    await pending
    expect(signal?.aborted).toBe(true)
    expect(deps.audio).not.toHaveBeenCalled()
    expect(deps.browser).not.toHaveBeenCalled()
  })

  it('only the latest concurrent request can start playing', async () => {
    let resolve: (blob: Blob) => void = () => {}
    const { voice, audio, deps } = setup()
    vi.mocked(deps.fetchAudio).mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const older = voice.speak('Old', 'en')
    await voice.speak('New', 'en')
    resolve(new Blob(['old'])); await older
    expect(audio.start).toHaveBeenCalledTimes(1)
  })

  it('falls back on provider/rate-limit/network failure and browser autoplay refusal', async () => {
    const one = setup({ fetchAudio: () => Promise.reject(new Error('429')) })
    await one.voice.speak('Warning stays complete', 'es')
    expect(one.browser.start).toHaveBeenCalledOnce()
    expect(one.states.at(-1)).toBe('browser')
    one.voice.cancel(); expect(one.browser.stop).toHaveBeenCalledOnce()
    const two = setup()
    two.audio.start.mockRejectedValue(new Error('NotAllowedError'))
    await two.voice.speak('Check warnings', 'en')
    expect(two.audio.stop).toHaveBeenCalledOnce()
    expect(two.browser.start).toHaveBeenCalledOnce()
  })

  it('long replies stay whole in browser speech without spending TTS credits', async () => {
    const { voice, deps } = setup()
    const long = 'a'.repeat(1501)
    await voice.speak(long, 'en')
    expect(deps.fetchAudio).not.toHaveBeenCalled()
    expect(deps.browser).toHaveBeenCalledWith(long, 'en', expect.any(Function))
  })

  it('handles no browser fallback and releases audio on end', async () => {
    const one = setup({ fetchAudio: () => Promise.reject(), browser: () => null })
    await one.voice.speak('Text remains', 'en')
    expect(one.states.at(-1)).toBe('unavailable')
    const two = setup(); await two.voice.speak('Hi', 'en')
    vi.mocked(two.deps.audio).mock.calls[0][1]()
    expect(two.audio.stop).toHaveBeenCalledOnce()
    expect(two.states.at(-1)).toBe('idle')
  })

  it('starts browser fallback only once when both media error and play rejection fire', async () => {
    const one = setup()
    one.audio.start.mockImplementation(() => {
      vi.mocked(one.deps.audio).mock.calls[0][2]()
      return Promise.reject(new Error('decode failed'))
    })
    await one.voice.speak('Keep this answer', 'en')
    expect(one.browser.start).toHaveBeenCalledOnce()
  })

  it('clears media handlers, pauses, detaches and revokes the audio URL exactly once', async () => {
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(), onended: null, onerror: null }
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const AudioMock = vi.fn(function () { return audio })
    vi.stubGlobal('Audio', AudioMock)
    try {
      const playback = browserVoiceDeps(null, () => {}).audio(new Blob(['audio']), () => {}, () => {})
      await playback.start(); playback.stop(); playback.stop()
      expect(audio.play).toHaveBeenCalledOnce()
      expect(audio.pause).toHaveBeenCalledOnce()
      expect(audio.removeAttribute).toHaveBeenCalledWith('src')
      expect(audio.load).toHaveBeenCalledOnce()
      expect(audio.onended).toBeNull(); expect(audio.onerror).toBeNull()
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test')
    } finally { create.mockRestore(); revoke.mockRestore(); vi.unstubAllGlobals() }
  })

  it('sends only text to the public proxy and validates returned audio', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response('ID3x', { headers: { 'content-type': 'audio/mpeg' } })))
    expect((await fetchVoiceAudio('https://example.test/tts', 'Hi', controller.signal, fetcher)).size).toBe(4)
    expect(fetcher.mock.calls[0][1]?.body).toBe('{"text":"Hi"}')
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ 'content-type': 'application/json' })
    await expect(fetchVoiceAudio(null, 'Hi', controller.signal, fetcher)).rejects.toThrow()
    await expect(fetchVoiceAudio('https://example.test/tts', 'Hi', controller.signal, () => Promise.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } })))).rejects.toThrow()
  })

  it('allows only HTTPS or local development endpoint URLs', () => {
    expect(resolveTtsUrl('https://example.test/tts')).toBe('https://example.test/tts')
    expect(resolveTtsUrl('http://localhost:54321/tts')).not.toBeNull()
    expect(resolveTtsUrl('http://other.test')).toBeNull()
    expect(resolveTtsUrl('javascript:alert(1)')).toBeNull()
    expect(resolveTtsUrl(undefined)).toBeNull()
  })
})
