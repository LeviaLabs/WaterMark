// English source strings. Every other language must define exactly these keys
// (enforced by the type below and by src/i18n/core.test.ts).
//
// Rules for translators:
// - Keep {placeholders} exactly as written.
// - Never translate numbers, units, source names (NWS, FEMA, FloodNet, NOAA) or warning names
//   quoted from an agency. Those are shown as issued.
// - "No data" must never read as "safe".

export const en = {
  'app.name': 'WaterMark',
  'lang.label': 'Language',
  'lang.pending': '{language} (in review)',
  'lang.translatedNotice': 'Interface text is translated. Official warnings stay in the language they were issued in.',

  'status.loading': 'Loading…',
  'status.error': 'This information did not load. Try again in a moment.',
  'status.retry': 'Try again',
  'status.unknown': 'Unknown',
  'status.noData': 'No data for this place. That does not mean there is no flood risk.',
  'status.noActiveAlerts': 'No active official alerts found here right now. That does not mean the area is safe.',

  'data.officialWarning': 'Official warning',
  'data.forecast': 'Forecast',
  'data.observation': 'Measured',
  'data.scenario': 'Modeled scenario',
  'data.historical': 'Past records',
  'data.source': 'Source: {source}',
  'data.observedAt': 'Measured {time}',
  'data.issuedAt': 'Issued {time}',
  'data.validRange': 'Valid {from} to {to}',
  'data.fetchedAt': 'Fetched {time}',

  'official.asIssued': 'Official text from {source}, shown as issued',
  'official.originalLanguage': 'Original language: {language}',
  'official.unofficialTranslation': 'Unofficial translation',
  'official.translationNote': 'This translation may contain errors. The official text above is the authoritative version.',
  'official.openSource': 'Open the original from {source}',

  'auth.signIn': 'Sign in',
  'auth.signOut': 'Sign out',
  'auth.guest': 'Browsing as a guest',
  'auth.signedInAs': 'Signed in as {name}',
  'auth.loading': 'Checking sign-in…',
  'auth.expired': 'Your sign-in has expired. You can keep using the map, or sign in again.',
  'auth.error': 'Sign-in is not working right now. The map and flood data still work without an account.',
  'auth.optional': 'An account is optional. Everything on the map works without one.',
  'auth.requiredForFeature': 'Sign in to save places and notification choices.',

  'voice.unavailable': 'Spoken guidance is not available in {language} yet. All information is shown on screen.',
  'voice.notice': 'Spoken guidance is an extra. Always check the warnings and sources on screen.',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
