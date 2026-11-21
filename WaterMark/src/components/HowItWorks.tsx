import { useRef } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { useReveal } from '../hooks/useReveal.ts'
import '../styling/steps.css'

const STEPS = [
  {
    n: '01',
    title: 'Select an area',
    text: 'Search a place or draw a circle on the 2D map. The circle is the question, not an answer.',
  },
  {
    n: '02',
    title: 'Read the evidence',
    text: 'Warnings, forecasts, mapped exposure, and history stay in separate rows, each with its source and time.',
  },
  {
    n: '03',
    title: 'Take a careful next step',
    text: 'Use what the sources actually support, then follow official guidance. Unknown stays unknown.',
  },
]

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  return (
    <section className="band reveal" ref={ref} aria-labelledby="steps-title">
      <div className="feature-head">
        <p className="eyebrow">How it works</p>
        <Heading id="steps-title" level={2} textWrap="balance">
          Three moves. No blended risk score.
        </Heading>
      </div>
      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step.n} className="steps__item">
            <span className="steps__n">{step.n}</span>
            <Heading level={3}>{step.title}</Heading>
            <Text as="p" color="secondary">
              {step.text}
            </Text>
          </li>
        ))}
      </ol>
    </section>
  )
}
