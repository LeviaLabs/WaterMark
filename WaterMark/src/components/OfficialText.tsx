import { useId } from 'react'
import { Blockquote } from '@astryxdesign/core/Blockquote'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { useLocalization } from '../hooks/useLocalization.ts'

export interface OfficialTextTranslation {
  text: string
  /** BCP 47 code of the translation. */
  locale: string
  /** How it was produced. Shown to reviewers in data attributes, not hidden. */
  method: 'machine' | 'human'
}

interface Props {
  /** Official text exactly as the agency issued it. Rendered verbatim, never rewritten. */
  text: string
  /** Agency or feed name, e.g. "National Weather Service". */
  sourceName: string
  sourceUrl?: string
  /** BCP 47 code of the official text, e.g. "en". */
  sourceLanguage: string
  /** ISO 8601 issue time from the source. */
  issuedAt?: string
  /** IANA time zone of the affected area, e.g. "America/New_York". */
  timeZone?: string
  /** Optional translation. Always shown after the original and labeled unofficial. */
  translation?: OfficialTextTranslation
}

/** Keeps the agency's own line breaks without restyling the text. */
const withLineBreaks = (text: string) =>
  text.split('\n').flatMap((line, i) => (i === 0 ? [line] : [<br key={i} />, line]))

/**
 * Shows an official warning so that its meaning cannot be changed by localization:
 * the original text first, in its own language, with source, issue time and link;
 * an optional translation second, clearly marked as unofficial.
 * Language-tagged text uses <bdi lang> because Astryx components do not accept lang.
 */
export function OfficialText({ text, sourceName, sourceUrl, sourceLanguage, issuedAt, timeZone, translation }: Props) {
  const { t, formatDateTime, languageName } = useLocalization()
  const headingId = useId()
  return (
    <VStack as="figure" gap={2} aria-labelledby={headingId}>
      <VStack as="figcaption" id={headingId}>
        <Text weight="semibold">{t('official.asIssued', { source: sourceName })}</Text>
      </VStack>
      <Text as="p" type="supporting" color="secondary">
        {t('official.originalLanguage', { language: languageName(sourceLanguage) })}
        {issuedAt && (
          <>
            {' · '}
            <time dateTime={issuedAt}>{t('data.issuedAt', { time: formatDateTime(issuedAt, timeZone) })}</time>
          </>
        )}
      </Text>
      <Blockquote>
        <bdi lang={sourceLanguage}>{withLineBreaks(text)}</bdi>
      </Blockquote>
      {sourceUrl && (
        <Link href={sourceUrl} isExternalLink isStandalone>
          {t('official.openSource', { source: sourceName })}
        </Link>
      )}
      {translation && (
        <VStack as="section" gap={1} data-method={translation.method}>
          <Divider />
          <Heading level={4}>{t('official.unofficialTranslation')}</Heading>
          <Text as="p">
            <bdi lang={translation.locale}>{withLineBreaks(translation.text)}</bdi>
          </Text>
          <Text as="p" type="supporting" color="secondary">
            {t('official.translationNote')}
          </Text>
        </VStack>
      )}
    </VStack>
  )
}
