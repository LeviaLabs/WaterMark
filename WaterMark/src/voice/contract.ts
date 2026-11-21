// Shared language/voice contract between localization (Decong) and the voice assistant
// (Ryan Bergman). This file holds types and pure helpers only. It does not call ElevenLabs
// and is not a second voice client. Ryan B implements `SpeechSink` in his voice module.
//
// Status discipline (AGENTS.md): a language listed by ElevenLabs is not proven to work in our
// voice flow until someone tests it end to end. Only `support: 'tested'` enables speech.

import type { LocaleCode } from '../i18n/locales.ts'

export type VoiceSupport =
  /** Tested end to end in WaterMark's voice flow. */
  | 'tested'
  /** Listed in ElevenLabs' language docs, not yet tested by us. Speech stays off. */
  | 'listed-untested'
  /** Not supported; show text only. */
  | 'unsupported'

export interface VoiceLanguage {
  locale: LocaleCode
  /** ISO 639-1 code to send to the speech provider, or null if none. */
  voiceLanguage: string | null
  support: VoiceSupport
  /** True only when support is 'tested'. When false, the UI says so and shows text. */
  canSpeak: boolean
}

// ElevenLabs help center "What languages do you support?" (checked 2026-11-21) lists English,
// Spanish, Chinese, Russian and Hindi for Multilingual v2, Flash v2.5 and Eleven v3.
// Ryan B: change an entry to 'tested' after you hear it work with the chosen model and voice.
export const VOICE_LANGUAGES: Record<LocaleCode, { voiceLanguage: string | null; support: VoiceSupport }> = {
  en: { voiceLanguage: 'en', support: 'listed-untested' },
  es: { voiceLanguage: 'es', support: 'listed-untested' },
  'zh-Hans': { voiceLanguage: 'zh', support: 'listed-untested' },
  ru: { voiceLanguage: 'ru', support: 'listed-untested' },
  hi: { voiceLanguage: 'hi', support: 'listed-untested' },
}

export function resolveVoiceLanguage(locale: LocaleCode): VoiceLanguage {
  const entry = VOICE_LANGUAGES[locale] ?? { voiceLanguage: null, support: 'unsupported' as const }
  return { locale, ...entry, canSpeak: entry.support === 'tested' && entry.voiceLanguage !== null }
}

/** Fired on window when the interface language changes. */
export const LOCALE_CHANGE_EVENT = 'watermark:localechange'

export interface LocaleChangeDetail {
  locale: LocaleCode
  voice: VoiceLanguage
}

/**
 * What to say, split by kind so the voice layer can treat each part correctly:
 * - explanation: WaterMark's own localized words; speak in the selected language.
 * - official-quote: agency text; speak in its source language (or not at all), never paraphrase.
 * - measurement: a number with its unit. `spoken` is written out by the caller in the selected
 *   language (for example "2.13 inches per hour"); value and unit are kept for checking that
 *   speech matches the screen.
 * - place: a place name; speak as written, do not translate.
 */
export type SpeechSegment =
  | { kind: 'explanation'; text: string }
  | { kind: 'official-quote'; text: string; sourceLanguage: string; sourceName: string }
  | { kind: 'measurement'; value: number; unit: string; spoken: string }
  | { kind: 'place'; name: string }

export interface LocalizedSpeechRequest {
  voice: VoiceLanguage
  segments: SpeechSegment[]
}

/** Implemented by Ryan B's voice module. WaterMark code calls only this. */
export interface SpeechSink {
  speak(request: LocalizedSpeechRequest): Promise<void>
  cancel(): void
}

/** Text a screen shows when speech is off, so warnings never depend on audio. */
export function speechFallbackText(segments: readonly SpeechSegment[]): string {
  return segments
    .map((s) => (s.kind === 'measurement' ? s.spoken : s.kind === 'place' ? s.name : s.text))
    .join(' ')
}
