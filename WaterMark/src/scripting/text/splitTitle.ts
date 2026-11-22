export type SplitPart = string | { text: string; accent: true }

export type SplitChar = {
  char: string
  /** Position among all letters, for the stagger delay. */
  index: number
  /** Position within its accent run and that run's length, for the gradient. */
  accentIndex: number | null
  accentLength: number | null
}

export type SplitWord = { accent: boolean; chars: readonly SplitChar[] }

export type SplitLine = readonly SplitWord[]

/**
 * Breaks a title into lines, words and letters for the letter-by-letter
 * entrance. '\n' parts start a new line. Whitespace never becomes a letter.
 */
export function splitTitle(parts: readonly SplitPart[]): { lines: SplitLine[]; plain: string } {
  const lines: SplitWord[][] = [[]]
  let index = 0

  for (const part of parts) {
    if (part === '\n') {
      lines.push([])
      continue
    }
    const text = typeof part === 'string' ? part : part.text
    const accent = typeof part !== 'string'
    const accentLength = accent ? text.replace(/\s/g, '').length : null
    let accentIndex = 0
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const chars = Array.from(word).map((char) => ({
        char,
        index: index++,
        accentIndex: accent ? accentIndex++ : null,
        accentLength,
      }))
      lines[lines.length - 1].push({ accent, chars })
    }
  }

  const plain = lines
    .map((line) => line.map((word) => word.chars.map((c) => c.char).join('')).join(' '))
    .filter(Boolean)
    .join(' ')

  return { lines: lines.filter((line) => line.length > 0), plain }
}
