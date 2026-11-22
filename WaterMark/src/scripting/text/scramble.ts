/**
 * "Decrypt" effect for the last letters of a title: each letter flickers
 * through random glyphs, then locks onto its real character, one after
 * another. Pure and deterministic for a given time so it can be tested;
 * SplitText calls it once per animation frame while the effect runs.
 */

export const SCRAMBLE_GLYPHS = '#%&*+=?/\\<>~^01$@'

export type ScrambleTiming = {
  /** When the first letter starts flickering, ms from the start of the effect. */
  start: number
  /** How long the first letter flickers before it locks. */
  settle: number
  /** Extra time before each following letter locks. */
  stagger: number
  /** How often a flickering letter changes glyph. */
  tick: number
}

export const TITLE_SCRAMBLE: ScrambleTiming = { start: 0, settle: 1000, stagger: 85, tick: 55 }

/** Quicker re-decrypt when the pointer passes over a word. */
export const HOVER_SCRAMBLE: ScrambleTiming = { start: 0, settle: 320, stagger: 45, tick: 45 }

/** Small integer hash, so the same letter at the same tick shows the same glyph. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h ^= h >>> 15
  return Math.abs(h)
}

/** Time at which letter `index` (0-based within the scrambled run) locks. */
export function lockTime(index: number, timing: ScrambleTiming = TITLE_SCRAMBLE): number {
  return timing.start + timing.settle + index * timing.stagger
}

/**
 * The character letter `index` shows `elapsed` ms into the effect: a glyph
 * while it flickers, its real character once locked. Spaces never flicker.
 */
export function scrambledChar(finalChar: string, index: number, elapsed: number, timing: ScrambleTiming = TITLE_SCRAMBLE): string {
  if (finalChar.trim() === '' || elapsed >= lockTime(index, timing)) return finalChar
  const tick = Math.floor(Math.max(0, elapsed) / timing.tick)
  return SCRAMBLE_GLYPHS[hash(index, tick) % SCRAMBLE_GLYPHS.length]
}

/** Total length of the effect for `count` letters. */
export function scrambleDuration(count: number, timing: ScrambleTiming = TITLE_SCRAMBLE): number {
  return count > 0 ? lockTime(count - 1, timing) : 0
}
