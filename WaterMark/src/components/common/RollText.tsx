import type { CSSProperties } from 'react'

/**
 * Text whose letters roll up one after another when the surrounding link or
 * button is hovered or focused (a copy of each letter slides in from below).
 * Pure CSS (motion.css), transform only. Screen readers get the plain text.
 */
export function RollText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`roll ${className}`}>
      <span className="visually-hidden">{text}</span>
      <span className="roll-track" aria-hidden="true">
        {Array.from(text).map((char, index) => {
          const glyph = char === ' ' ? ' ' : char
          return (
            <span key={index} className="roll-char" data-char={glyph} style={{ '--i': index } as CSSProperties}>
              {glyph}
            </span>
          )
        })}
      </span>
    </span>
  )
}
