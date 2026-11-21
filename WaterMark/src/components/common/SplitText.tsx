import { Fragment, useMemo, type CSSProperties } from 'react'
import { splitTitle, type SplitPart } from '../../scripting/text/splitTitle'

export type { SplitPart }

type Props = {
  /** Text pieces; '\n' starts a new line, `{ text, accent: true }` uses the gradient italic. */
  parts: readonly SplitPart[]
  /** Start right away (hero, story steps). Otherwise letters wait for an ancestor `.is-visible` (Reveal). */
  play?: boolean
  /** Extra delay before the first letter, in ms. */
  delay?: number
}

/**
 * Title that rises in letter by letter, like a waterline lifting the words.
 * Letters stay grouped per word so lines only break between words. Screen
 * readers read the plain text once; the animated letters are hidden from them.
 */
export function SplitText({ parts, play = false, delay = 0 }: Props) {
  const { lines, plain } = useMemo(() => splitTitle(parts), [parts])

  return (
    <span className={`split ${play ? 'split--play' : ''}`} style={{ '--split-delay': `${delay}ms` } as CSSProperties}>
      <span className="visually-hidden">{plain}</span>
      <span className="split-letters" aria-hidden="true">
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
