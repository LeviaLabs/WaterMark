/**
 * Resources and bibliography for the landing page.
 * Owner: Ryan Lin. Content lives in src/scripting/sources.ts.
 * The landing page mounts this component and does not own the source list.
 */
import { Badge } from '@astryxdesign/core/Badge'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { DATA_SOURCES, type SourceGroup } from '../scripting/sources.ts'
import '../styling/sources.css'

export function Bibliography({ sources = DATA_SOURCES }: { sources?: SourceGroup[] }) {
  return (
    <section id="sources" className="band" aria-labelledby="sources-title">
      <div className="sources-head">
        <p className="eyebrow">Sources and bibliography</p>
        <Heading id="sources-title" level={2} textWrap="balance">
          Official data, with the limits written next to the name.
        </Heading>
        <Text as="p" color="secondary">
          These are the datasets the team plans to use. This page does not fetch them, so there is no observation time to show. When a number appears on the map, it needs the provider, the units, and a timestamp that is separate from when WaterMark asked for it.
        </Text>
        <Text as="p" type="supporting" color="secondary">
          Links open the provider’s site in a new tab. Cataloged means the source is chosen. Planned means it is not in the demo path yet.
        </Text>
      </div>
      <div className="ledger">
        {sources.map((group) => (
          <Collapsible
            key={group.id}
            className="ledger__item"
            defaultIsOpen={group.id === 'alerts'}
            trigger={
              <span className="source-trigger">
                <span className="source-trigger__title">{group.title}</span>
                <Badge label={String(group.items.length)} />
              </span>
            }
          >
            <p className="source-summary">{group.summary}</p>
            <List hasDividers density="spacious">
              {group.items.map((item) => (
                <ListItem
                  key={item.id}
                  label={item.name}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  description={
                    <Text as="span" type="supporting" color="secondary">
                      {item.dataType}. {item.use} {item.limitation}
                    </Text>
                  }
                  endContent={
                    <Text type="label" weight="bold">
                      {item.availability === 'planned' ? 'Planned' : 'Cataloged'}
                    </Text>
                  }
                />
              ))}
            </List>
          </Collapsible>
        ))}
      </div>
    </section>
  )
}
