// Text a homeowner can save or print. A documentation aid, not a filed NFIP claim.
export const CLAIM_LINKS: readonly { href: string; label: string }[] = [
  { href: 'https://www.fema.gov/flood-insurance', label: 'FEMA: Flood insurance' },
  { href: 'https://www.floodsmart.gov/', label: 'FloodSmart (the NFIP site)' },
  { href: 'https://www.fema.gov/flood-insurance/process', label: 'FEMA: how the flood insurance claims process works' },
  { href: 'https://www.fema.gov/flood-maps', label: 'FEMA flood maps' },
  { href: 'https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3', label: 'OpenFEMA: NFIP redacted claims' },
]

export const CLAIM_CHECKS: readonly { id: string; label: string }[] = [
  { id: 'when', label: 'Date and time water was first seen, and when it receded' },
  { id: 'entry', label: 'Which side water entered, with a photo of that side' },
  { id: 'depth', label: 'Depth against a fixed object, only if it is safe to measure' },
  { id: 'rooms', label: 'Each damaged room and the major items in it' },
  { id: 'moved', label: 'What was moved or thrown away, and when' },
  { id: 'receipts', label: 'Receipts, including temporary housing if any' },
]

export function claimSheetText(input: {
  place: string
  fetchedAt: string
  facts: readonly { label: string; value: string }[]
  checked: readonly string[]
  notes: string
  photoNames: readonly string[]
}): string {
  const checks = CLAIM_CHECKS.map((item) => `${input.checked.includes(item.id) ? '[x]' : '[ ]'} ${item.label}`).join('\n')
  const facts = input.facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n')
  const photos = input.photoNames.length ? input.photoNames.map((name) => `- ${name}`).join('\n') : 'None attached in this browser.'
  return [
    'WaterMark flood documentation aid',
    input.place,
    `Prepared ${input.fetchedAt}`,
    '',
    'This is a checklist and a summary of mapped data. It is not an NFIP claim, not a determination that this building flooded, and not a statement that the property is safe.',
    '',
    'Mapped data',
    facts || 'No mapped facts were loaded.',
    '',
    'Documentation checklist',
    checks,
    '',
    'Notes',
    input.notes.trim() || 'None.',
    '',
    'Photo file names (the files stay on this device)',
    photos,
    '',
    'Official pages',
    ...CLAIM_LINKS.map((link) => `${link.label}: ${link.href}`),
  ].join('\n')
}
