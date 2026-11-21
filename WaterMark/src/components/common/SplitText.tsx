import { Fragment, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { lockTime, scrambleDuration, scrambledChar } from '../../scripting/text/scramble'
import { splitTitle, type SplitPart } from '../../scripting/text/splitTitle'

export type { SplitPart }

type Props = {
  /** Text pieces; '\n' starts a new line, `{ text, accent: true }` uses the gradient italic. */
  parts: readonly SplitPart[]
  /** Start right away (hero, story steps). Otherwise letters wait for an ancestor `.is-visible` (Reveal). */
  play?: boolean
  /** Extra delay before the first letter, in ms. */
  delay?: number
  /** Decrypt the last this-many letters: they flicker through glyphs, then lock in one by one. Needs `play`. */
  scramble?: number
}

/** Letter stagger in ms; matches the animation-delay step in motion.css. */
const LETTER_STEP = 30

/**
 * Title that rises in letter by letter, like a waterline lifting the words.
 * Letters stay grouped per word so lines only break between words. Screen
 * readers read the plain text once; the animated letters are hidden from them.
 *
 * With `scramble`, the last letters decrypt as they rise. The glyphs are
 * written straight into those letters' text once per frame for about two
 * seconds, then the real text is put back; React never re-renders for it.
 */
export function SplitText({ parts, play = false, delay = 0, scramble = 0 }: Props) {
  const { lines, plain } = useMemo(() => splitTitle(parts), [parts])
  const lettersRef = useRef<HTMLSpanElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const root = lettersRef.current
    if (!root || !play || scramble <= 0 || reducedMotion) return
    const chars = [...root.querySelectorAll<HTMLElement>('.split-char')].slice(-scramble)
    if (chars.length === 0) return
    const finals = chars.map((char) => char.textContent ?? '')

    // Hold each letter at its real width so the glyphs do not jostle the line.
    for (const char of chars) {
      const fontSize = parseFloat(getComputedStyle(char).fontSize) || 16
      char.style.width = `${(char.offsetWidth / fontSize).toFixed(3)}em`
      char.classList.add('is-scrambling')
    }

    const firstIndex = Number(chars[0].style.getPropertyValue('--i')) || 0
    const begin = performance.now() + delay + firstIndex * LETTER_STEP
    const total = scrambleDuration(chars.length)
    let frame = 0

    const restore = () => {
      chars.forEach((char, i) => {
        char.textContent = finals[i]
        char.style.width = ''
        char.classList.remove('is-scrambling')
      })
    }

    const tick = (now: number) => {
      const elapsed = now - begin
      chars.forEach((char, i) => {
        const shown = scrambledChar(finals[i], i, elapsed)
        if (char.textContent !== shown) char.textContent = shown
        if (elapsed >= lockTime(i)) char.classList.remove('is-scrambling')
      })
      if (elapsed < total) frame = requestAnimationFrame(tick)
      else restore()
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      restore()
    }
  }, [lines, play, delay, scramble, reducedMotion])

  return (
    <span className={`split ${play ? 'split--play' : ''}`} style={{ '--split-delay': `${delay}ms` } as CSSProperties}>
      <span className="visually-hidden">{plain}</span>
      <span ref={lettersRef} className="split-letters" aria-hidden="true">
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {line.map((word, wordIndex) => (
              <Fragment key={wordIndex}>
                {wordIndex > 0 && ' '}
                <span className={`split-word ${word.accent ? 'split-word--accent' : ''}`}>
                  {word.chars.map((c) => (
                    <span
                      key={c.index}
                      className="split-char"
                      style={
                        {
                          '--i': c.index,
                          ...(c.accentIndex === null ? null : { '--j': c.accentIndex, '--n': c.accentLength }),
                        } as CSSProperties
                      }
                    >
                      {c.char}
                    </span>
                  ))}
                </span>
              </Fragment>
            ))}
          </Fragment>
        ))}
      </span>
    </span>
  )
}
