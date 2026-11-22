import { Selector, SelectorOption } from '@astryxdesign/core/Selector'
import { LOCALES } from '../scripting/localization/localize.ts'
import { useLocalization } from '../hooks/useLocalization.ts'

interface Props {
  /** Hide the visible label (it stays available to screen readers). */
  hideLabel?: boolean
}

const findLocale = (code: string) => LOCALES.find((l) => l.code === code)

/**
 * Accessible language picker built on the Astryx Selector: labelled combobox, native-select
 * style typeahead, visible focus ring, and a bottom sheet on small screens. Each language
 * name is wrapped in <bdi lang> so screen readers pronounce it in its own language
 * (Astryx components do not accept a lang prop).
 */
export function LanguageSelect({ hideLabel = false }: Props) {
  const { locale, setLocale, t, languageName } = useLocalization()

  const nativeName = (code: string) => <bdi lang={code}>{findLocale(code)?.nativeName ?? code}</bdi>

  return (
    <Selector
      label={t('lang.label')}
      isLabelHidden={hideLabel}
      value={locale}
      onChange={(next) => {
        if (next) setLocale(next)
      }}
      options={LOCALES.map((l) => ({ value: l.code, label: l.nativeName }))}
      renderOption={(option) => (
        <SelectorOption
          label={nativeName(option.value)}
          description={
            findLocale(option.value)?.pending
              ? t('lang.pending', { language: languageName(option.value) })
              : undefined
          }
        />
      )}
      renderValue={(option) => nativeName(option.value)}
      presentation="adaptive"
      size="lg"
    />
  )
}
