import { Fragment, useEffect, useMemo, useRef, type CSSProperties, type PointerEvent } from 'react'
import { HOVER_SCRAMBLE, TITLE_SCRAMBLE, lockTime, scrambleDuration, scrambledChar, type ScrambleTiming } from '../../scripting/text/scramble'
import { splitTitle, type SplitPart } from '../../scripting/text/splitTitle'

export type { SplitPart }

type Props = {
  /** Text pieces; '\n' starts a new line, `{ text, accent: true }` uses the gradient italic. */
  parts: readonly SplitPart[]
  /** Start right away (hero, story steps). Otherwise letters wait for an ancestor `.is-visible` (Reveal). */
  play?: boolean
  /** Extra delay before the first letter, in ms. */
  delay?: number
  /**
   * Decrypt letters as they arrive: 'accent' for every accent letter, or a
   * number for the last that-many letters. Needs `play`.
   */
  scramble?: 'accent' | number
  /** Re-decrypt a word whenever the pointer moves onto it. */
  hoverScramble?: boolean
}

/** Letter stagger in ms; matches the animation-delay step in motion.css. */
const LETTER_STEP = 30
/** Let a letter mostly rise before it starts flickering, so the effect is seen. */
const SCRAMBLE_AFTER_RISE = 420

/**
 * Flicker `chars` through glyphs and lock them in one by one, starting at
 * `begin` (a performance.now() time). Writes text straight into the letters
 * once per frame and puts the real text back at the end. Returns a cancel.
 */
function runScramble(chars: HTMLElement[], begin: number, timing: ScrambleTiming, onDone: () => void): () => void {
  const finals = chars.map((char) => char.dataset.char ?? char.textContent ?? '')
  for (const char of chars) {
    // Hold each letter at its real width so the glyphs do not jostle the line.
    const fontSize = parseFloat(getComputedStyle(char).fontSize) || 16
    char.textContent = char.dataset.char ?? char.textContent
    char.style.width = `${(char.offsetWidth / fontSize).toFixed(3)}em`
    char.classList.add('is-scrambling')
  }
  const total = scrambleDuration(chars.length, timing)
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
      const shown = scrambledChar(finals[i], i, elapsed, timing)
      if (char.textContent !== shown) char.textContent = shown
      if (elapsed >= lockTime(i, timing)) char.classList.remove('is-scrambling')
    })
    if (elapsed < total) {
      frame = requestAnimationFrame(tick)
    } else {
      restore()
      onDone()
    }
  }
  frame = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(frame)
    restore()
  }
}

/**
 * Title that rises in letter by letter, like a waterline lifting the words.
 * Letters stay grouped per word so lines only break between words. Screen
 * readers read the plain text once; the animated letters are hidden from them.
 *
 * `scramble` decrypts letters as they land (glyphs flicker, then lock in one
 * by one) and `hoverScramble` replays that on any word the pointer touches.
 * Glyphs are written straight into the letters, so React never re-renders.
 */
export function SplitText({ parts, play = false, delay = 0, scramble, hoverScramble = false }: Props) {
  const { lines, plain } = useMemo(() => splitTitle(parts), [parts])
  const lettersRef = useRef<HTMLSpanElement>(null)
  const running = useRef(new Map<Element, () => void>())
  const introDone = useRef(!scramble)

  useEffect(() => {
    const root = lettersRef.current
    const runs = running.current
    if (!root || !play || !scramble) {
      introDone.current = true
      return
    }
    const all = [...root.querySelectorAll<HTMLElement>('.split-char')]
    const chars = scramble === 'accent' ? all.filter((char) => char.closest('.split-word--accent')) : all.slice(-scramble)
    if (chars.length === 0) return
    const firstIndex = Number(chars[0].style.getPropertyValue('--i')) || 0
    const begin = performance.now() + delay + firstIndex * LETTER_STEP + SCRAMBLE_AFTER_RISE
    const cancel = runScramble(chars, begin, TITLE_SCRAMBLE, () => {
      runs.delete(root)
      introDone.current = true
    })
    runs.set(root, cancel)
    return () => {
      for (const stop of runs.values()) stop()
      runs.clear()
    }
  }, [lines, play, delay, scramble])

  const onPointerOver = (event: PointerEvent<HTMLSpanElement>) => {
    if (!hoverScramble || !introDone.current || event.pointerType === 'touch') return
    const word = event.target instanceof Element ? event.target.closest('.split-word') : null
    if (!word || running.current.has(word)) return
    const chars = [...word.querySelectorAll<HTMLElement>('.split-char')]
    const stop = runScramble(chars, performance.now(), HOVER_SCRAMBLE, () => running.current.delete(word))
    running.current.set(word, stop)
  }

  return (
    <span className={`split ${play ? 'split--play' : ''}`} style={{ '--split-delay': `${delay}ms` } as CSSProperties}>
      <span className="visually-hidden">{plain}</span>
      <span ref={lettersRef} className="split-letters" aria-hidden="true" onPointerOver={hoverScramble ? onPointerOver : undefined}>
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
                      data-char={c.char}
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
