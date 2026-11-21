import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '../src/scripting/features.ts'
import { DATA_SOURCES, REQUIRED_SOURCE_IDS } from '../src/scripting/sources.ts'
import { parseStoredTheme, resolveThemeMode, THEME_STORAGE_KEY } from '../src/scripting/themeMode.ts'
import { chooseGridSize, chooseWaterQuality } from '../src/scripting/waterQuality.ts'

describe('theme mode', () => {
  it('uses a stored choice, otherwise the system preference', () => {
    expect(parseStoredTheme('dark')).toBe('dark')
    expect(parseStoredTheme('light')).toBe('light')
    expect(parseStoredTheme('system')).toBeNull()
    expect(resolveThemeMode(null, true)).toBe('dark')
    expect(resolveThemeMode(null, false)).toBe('light')
    expect(resolveThemeMode('light', true)).toBe('light')
  })

  it('matches the inline script storage key', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    expect(html).toContain(THEME_STORAGE_KEY)
    expect(html).toContain('prefers-color-scheme: dark')
  })
})

describe('water quality', () => {
  it('caps the pixel ratio and lowers detail on small or constrained screens', () => {
    expect(
      chooseWaterQuality({
        devicePixelRatio: 3,
        viewportWidth: 1440,
        hardwareConcurrency: 8,
        saveData: false,
      }).pixelRatio,
    ).toBe(1.75)

    const phone = chooseWaterQuality({
      devicePixelRatio: 3,
      viewportWidth: 390,
      hardwareConcurrency: 8,
      saveData: false,
    })
    expect(phone.pixelRatio).toBeLessThanOrEqual(1.15)
    expect(phone.detail).toBeLessThan(0.5)

    const saver = chooseWaterQuality({
      devicePixelRatio: 2,
      viewportWidth: 1440,
      hardwareConcurrency: 8,
      saveData: true,
    })
    expect(saver.pixelRatio).toBe(1)
    expect(saver.detail).toBeLessThanOrEqual(0.35)

    expect(
      chooseWaterQuality({
        devicePixelRatio: 1,
        viewportWidth: 1280,
        hardwareConcurrency: 4,
        saveData: false,
      }).pixelRatio,
    ).toBe(1)

    expect(chooseGridSize(1).cols).toBeGreaterThan(chooseGridSize(0.4).cols)
    expect(chooseGridSize(0.4).rows).toBeLessThan(80)
  })
})

describe('bibliography', () => {
  it('lists the planned providers with real https links', () => {
    const items = DATA_SOURCES.flatMap((group) => group.items)
    const ids = new Set(items.map((item) => item.id))
    for (const id of REQUIRED_SOURCE_IDS) expect(ids.has(id)).toBe(true)
    for (const item of items) {
      expect(item.url.startsWith('https://')).toBe(true)
      expect(item.name.length).toBeGreaterThan(3)
      expect(item.limitation.length).toBeGreaterThan(10)
      expect(item.use.toLowerCase()).not.toContain('flood probability')
    }
    const imerg = items.find((item) => item.id === 'nasa-imerg')
    expect(imerg?.availability).toBe('planned')
  })
})

describe('feature honesty', () => {
  it('keeps Move Your Car in research and avoids safety promises', () => {
    const move = FEATURES.find((feature) => feature.id === 'move-your-car')
    expect(move?.status).toBe('research')
    const blob = FEATURES.map((feature) => `${feature.summary} ${feature.limit}`).join('\n')
    expect(blob.toLowerCase()).not.toContain('will not flood')
    expect(blob).not.toMatch(/\b\d{1,3}%\b/)
    expect(FEATURES.every((feature) => feature.status !== 'in-progress' || feature.limit.length > 0)).toBe(true)
  })
})
