/// <reference types="node" />
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveVoiceLanguage, speechFallbackText, VOICE_LANGUAGES } from '../voice/contract.ts'
import { detectLocale, formatDateTime, formatMeasurement, formatNumber, matchLocale, translate } from './core.ts'
import { LOCALES } from './locales.ts'
import { MESSAGES, type MessageKey } from './messages/index.ts'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('dictionaries', () => {
  const enKeys = Object.keys(MESSAGES.en).sort()

  for (const { code } of LOCALES) {
    it(`${code} has exactly the English keys`, () => {
      assert.deepEqual(Object.keys(MESSAGES[code]).sort(), enKeys)
    })
    it(`${code} keeps every {placeholder}`, () => {
      for (const key of enKeys as MessageKey[]) {
        assert.deepEqual(placeholders(MESSAGES[code][key]), placeholders(MESSAGES.en[key]), `${code} ${key}`)
      }
    })
    it(`${code} has no empty strings and no markup`, () => {
      for (const [key, value] of Object.entries(MESSAGES[code])) {
        assert.ok(value.trim().length > 0, `${code} ${key} is empty`)
        assert.ok(!/[<>]/.test(value), `${code} ${key} contains < or >`)
      }
    })
  }

  it('no-data and no-alert messages never claim safety in English', () => {
    assert.match(MESSAGES.en['status.noData'], /does not mean/)
    assert.match(MESSAGES.en['status.noActiveAlerts'], /does not mean/)
  })
})

describe('matchLocale and detectLocale', () => {
  it('maps regional tags to supported locales', () => {
    assert.equal(matchLocale('es-US'), 'es')
    assert.equal(matchLocale('ru-RU'), 'ru')
    assert.equal(matchLocale('hi-IN'), 'hi')
    assert.equal(matchLocale('zh-CN'), 'zh-Hans')
    assert.equal(matchLocale('zh-Hans-CN'), 'zh-Hans')
    assert.equal(matchLocale('ZH-HANS'), 'zh-Hans')
  })
  it('does not show Simplified Chinese to Traditional-script readers', () => {
    assert.equal(matchLocale('zh-TW'), null)
    assert.equal(matchLocale('zh-Hant'), null)
    assert.equal(matchLocale('zh-HK'), null)
  })
  it('rejects unknown and junk input', () => {
    for (const bad of ['', null, undefined, 'xx', 'fr', '../en', '<script>']) assert.equal(matchLocale(bad), null)
  })
  it('prefers URL, then saved, then browser, then English', () => {
    assert.equal(detectLocale({ query: 'ru', saved: 'es', browser: ['zh-CN'] }), 'ru')
    assert.equal(detectLocale({ query: 'fr', saved: 'es', browser: ['zh-CN'] }), 'es')
    assert.equal(detectLocale({ browser: ['fr-FR', 'zh-CN'] }), 'zh-Hans')
    assert.equal(detectLocale({ browser: ['fr-FR'] }), 'en')
    assert.equal(detectLocale({}), 'en')
  })
})

describe('translate', () => {
  it('fills variables as plain text', () => {
    assert.equal(translate('en', 'auth.signedInAs', { name: 'Ana' }), 'Signed in as Ana')
    assert.equal(translate('en', 'auth.signedInAs', { name: '<img src=x>' }), 'Signed in as <img src=x>')
  })
  it('leaves a missing variable visible instead of inventing one', () => {
    assert.equal(translate('en', 'auth.signedInAs'), 'Signed in as {name}')
  })
  it('falls back to English, then the key', () => {
    const broken = { ...MESSAGES.es }
    delete (broken as Partial<typeof broken>)['status.retry']
    const original = MESSAGES.es
    MESSAGES.es = broken
    try {
      assert.equal(translate('es', 'status.retry'), 'Try again')
      assert.equal(translate('es', 'no.such.key' as MessageKey), 'no.such.key')
    } finally {
      MESSAGES.es = original
    }
  })
})

describe('number, measurement and date formatting', () => {
  it('formats numbers per locale', () => {
    assert.equal(formatNumber('en', 1234.5), '1,234.5')
    assert.match(formatNumber('es', 1234.5), /1\.?234,5/)
    assert.match(formatNumber('ru', 1234.5), /1\s?234,5/)
  })
  it('keeps units exactly as the source gave them', () => {
    assert.equal(formatMeasurement('en', 2.13, 'in/hr'), '2.13 in/hr')
    assert.equal(formatMeasurement('es', 2.13, 'in/hr'), '2,13 in/hr')
    assert.equal(formatMeasurement('zh-Hans', 150, 'm³/s'), '150 m³/s')
  })
  it('shows Unknown for missing values, never zero', () => {
    for (const v of [null, undefined, Number.NaN, Infinity]) {
      assert.equal(formatMeasurement('en', v, 'ft'), 'Unknown')
      assert.equal(formatNumber('ru', v), 'Неизвестно')
    }
  })
  it('formats dates with a time zone and rejects invalid input', () => {
    const s = formatDateTime('en', '2026-11-21T19:30:00Z', 'America/New_York')
    assert.match(s, /Nov 21, 2026/)
    assert.match(s, /2:30/)
    assert.match(s, /EST/)
    assert.equal(formatDateTime('en', 'not a date'), 'Unknown')
    assert.equal(formatDateTime('es', null), 'Desconocido')
  })
})

describe('voice contract', () => {
  it('covers every locale', () => {
    for (const { code } of LOCALES) assert.ok(VOICE_LANGUAGES[code], code)
  })
  it('keeps speech off until a language is tested', () => {
    for (const { code } of LOCALES) {
      const v = resolveVoiceLanguage(code)
      assert.equal(v.canSpeak, v.support === 'tested')
    }
  })
  it('maps zh-Hans to the provider code zh', () => {
    assert.equal(resolveVoiceLanguage('zh-Hans').voiceLanguage, 'zh')
  })
  it('fallback text keeps official quotes and measurements verbatim', () => {
    const text = speechFallbackText([
      { kind: 'explanation', text: 'Advertencia oficial:' },
      { kind: 'official-quote', text: 'Flash Flood Warning', sourceLanguage: 'en', sourceName: 'NWS' },
      { kind: 'measurement', value: 2.13, unit: 'in/hr', spoken: '2,13 in/hr' },
      { kind: 'place', name: 'Red Hook' },
    ])
    assert.equal(text, 'Advertencia oficial: Flash Flood Warning 2,13 in/hr Red Hook')
  })
})
