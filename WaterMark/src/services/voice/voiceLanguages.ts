// Language contract between localization (Decong) and the voice assistant (Ryan Bergman).
// Types and pure helpers only: this file does NOT call ElevenLabs, uses no ElevenLabs SDK and
// makes no network requests. Ryan B's voice module implements `SpeechSink` and owns the
// ElevenLabs integration.
//
// A language listed by ElevenLabs is not proven to work in our voice flow until someone hears
// it work end to end (AGENTS.md). Speech stays off until an entry is marked 'tested'.

import type { LocaleCode } from '../../scripting/localization/localize.ts'

export interface VoiceLanguage {
  locale: LocaleCode
  /** Language code to send to the speech provider. */
  voiceLanguage: string
  /** 'listed-untested': in ElevenLabs' language list, not yet heard in WaterMark. */
  support: 'tested' | 'listed-untested'
  /** True only when support is 'tested'. When false, show text instead of speaking. */
  canSpeak: boolean
}

// ElevenLabs help centre "What languages do you support?" (checked 2026-11-21) lists English,
// Spanish, Chinese, Russian and Hindi for Multilingual v2, Flash v2.5 and Eleven v3.
// Ryan B: change an entry to 'tested' after you hear it work with the chosen model and voice.
export const VOICE_LANGUAGES: Record<LocaleCode, Pick<VoiceLanguage, 'voiceLanguage' | 'support'>> = {
  en: { voiceLanguage: 'en', support: 'listed-untested' },
  es: { voiceLanguage: 'es', support: 'listed-untested' },
  'zh-Hans': { voiceLanguage: 'zh', support: 'listed-untested' },
  ru: { voiceLanguage: 'ru', support: 'listed-untested' },
  hi: { voiceLanguage: 'hi', support: 'listed-untested' },
}

export function resolveVoiceLanguage(locale: LocaleCode): VoiceLanguage {
  const entry = VOICE_LANGUAGES[locale]
  return { locale, ...entry, canSpeak: entry.support === 'tested' }
}

/**
 * What to say, split by kind so the voice layer treats each part correctly:
 * - explanation: WaterMark's own localized words; speak in the selected language.
 * - official-quote: agency text; speak in its source language (or not at all), never paraphrase.
 * - measurement: number and unit as on screen, plus `spoken`, written out in the selected
 *   language (for example "2.13 inches per hour") so speech matches the screen.
 * - place: a place name; speak as written, do not translate.
 */
export type SpeechSegment =
  | { kind: 'explanation'; text: string }
  | { kind: 'official-quote'; text: string; sourceLanguage: string; sourceName: string }
  | { kind: 'measurement'; value: number; unit: string; spoken: string }
  | { kind: 'place'; name: string }

/** Implemented by Ryan B's voice module (ElevenLabs). WaterMark code calls only this. */
export interface SpeechSink {
  speak(voice: VoiceLanguage, segments: readonly SpeechSegment[]): Promise<void>
  cancel(): void
}

/** Text to show when speech is off, so warnings never depend on audio. */
export function speechFallbackText(segments: readonly SpeechSegment[]): string {
  return segments
    .map((s) => (s.kind === 'measurement' ? s.spoken : s.kind === 'place' ? s.name : s.text))
    .join(' ')
}
