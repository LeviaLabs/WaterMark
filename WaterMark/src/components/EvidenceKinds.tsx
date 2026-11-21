import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { EVIDENCE_KINDS } from '../scripting/features.ts'
import '../styling/story.css'
import '../styling/features.css'

export function EvidenceKinds() {
  return (
    <section className="band" aria-labelledby="kinds-title">
      <div className="feature-head">
        <p className="eyebrow">Do not mix these</p>
        <Heading id="kinds-title" level={2} textWrap="balance">
          A warning, a forecast, a map, and a history are different things.
        </Heading>
        <Text as="p" color="secondary">
          WaterMark will not fold them into one flood percentage. If a source is missing, the result stays unknown.
        </Text>
      </div>
      <div className="kinds">
        {EVIDENCE_KINDS.map((kind) => (
          <article key={kind.id} className="kind">
            <p className="kind__kicker">{kind.kicker}</p>
            <Heading level={3}>{kind.title}</Heading>
            <Text as="p" color="secondary">
              {kind.text}
            </Text>
          </article>
        ))}
      </div>
    </section>
  )
}
