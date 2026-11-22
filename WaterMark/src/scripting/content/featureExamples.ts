import type {
  AreaSummaryData,
  EnvironmentalResult,
  ForecastData,
  ObservationSeries,
  OfficialAlert,
  Source,
} from '../evidence/contract'

/**
 * EXAMPLE DATA for the landing-page previews of the app's features.
 *
 * Every value in this file is invented to show the layout. None of it is a
 * reading, forecast or warning, and the previews label it "Example" on screen.
 * The shapes match the API contract, so the same components render real
 * results on the map page.
 *
 * Only the place coordinates and the sources (names and URLs) are real.
 */

/** Pilot neighborhoods from the planning doc, plus the two NOAA tide stations it names. */
export const PILOT_PLACES = [
  { id: 'coney-island', label: 'Coney Island', detail: 'Brooklyn, NY', lat: 40.5755, lon: -73.9707 },
  { id: 'rockaway', label: 'Rockaway Beach', detail: 'Queens, NY', lat: 40.586, lon: -73.811 },
  { id: 'red-hook', label: 'Red Hook', detail: 'Brooklyn, NY', lat: 40.6745, lon: -74.011 },
  { id: 'battery', label: 'The Battery', detail: 'Manhattan, NY · NOAA station 8518750', lat: 40.7006, lon: -74.0142 },
  { id: 'sandy-hook', label: 'Sandy Hook', detail: 'New Jersey · NOAA station 8531680', lat: 40.4669, lon: -74.0094 },
] as const

export type PilotPlace = (typeof PILOT_PLACES)[number]

const RED_HOOK = { lat: 40.6745, lon: -74.011 }

/** Example places are in New York, so their times are shown in New York time. */
export const EXAMPLE_TIME_ZONE = 'America/New_York'
const EXAMPLE_FETCHED_AT = '2026-11-21T19:05:00Z'

const NWS: Source = {
  id: 'nws-alerts',
  name: 'National Weather Service',
  url: 'https://www.weather.gov/documentation/services-web-api',
  geographicCoverage: 'United States',
}
const OPEN_METEO: Source = {
  id: 'open-meteo-forecast',
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/en/docs',
  geographicCoverage: 'Global model grid',
}
const NOAA: Source = {
  id: 'noaa-tides',
  name: 'NOAA Tides & Currents',
  url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8518750',
  geographicCoverage: 'One tide station',
}
const AREA_SOURCE: Source = {
  id: 'watermark-area',
  name: 'WaterMark area summary (FloodNet, NYC 311, FEMA NFHL)',
  url: 'https://data.cityofnewyork.us/d/aq7i-eu5q',
  geographicCoverage: 'New York City',
}

const EXAMPLE_ALERT: OfficialAlert = {
  id: 'example-alert',
  event: 'Coastal Flood Advisory',
  severity: 'Minor',
  urgency: 'Expected',
  certainty: 'Likely',
  sent: '2026-11-21T14:12:00Z',
  effective: '2026-11-21T14:12:00Z',
  expires: '2026-11-22T03:00:00Z',
  onset: '2026-11-21T21:00:00Z',
  ends: '2026-11-22T02:00:00Z',
  messageType: 'Alert',
  hazardTiming: 'upcoming',
  floodRelevance: 'flood_hazard_notice',
  areaDescription: 'Kings (Brooklyn), NY (example area)',
  headline: 'Example only: this is how WaterMark shows an NWS advisory, word for word, with its times.',
  instruction: 'In a real alert, the agency’s own instructions appear here unedited.',
  severityBasis: 'Severity, urgency and certainty as issued by the NWS (CAP 1.2).',
}

export const EXAMPLE_ALERTS: EnvironmentalResult<OfficialAlert[]> = {
  status: 'available',
  kind: 'official_alert',
  source: NWS,
  location: RED_HOOK,
  coverage: { method: 'NWS alerts whose area contains the point' },
  observedAt: null,
  forecastIssuedAt: null,
  validFrom: EXAMPLE_ALERT.onset,
  validTo: EXAMPLE_ALERT.ends,
  fetchedAt: EXAMPLE_FETCHED_AT,
  sourceUpdatedAt: '2026-11-21T14:12:00Z',
  units: null,
  data: [EXAMPLE_ALERT],
  qualityFlags: [],
  limitations: ['An alert covers a zone, not a precise depth at any one address.'],
}

export const EXAMPLE_NO_ALERTS: EnvironmentalResult<OfficialAlert[]> = {
  ...EXAMPLE_ALERTS,
  validFrom: null,
  validTo: null,
  data: [],
  limitations: ['No alert returned is not an all-clear. Conditions can change faster than alerts are issued.'],
}

/** Hourly precipitation shaped like a passing storm. */
const RAIN_SHAPE = [0, 0.1, 0.3, 0.8, 2.4, 5.6, 8.9, 6.2, 3.1, 1.4, 0.6, 0.2]

export const EXAMPLE_RAINFALL: EnvironmentalResult<ForecastData> = {
  status: 'available',
  kind: 'forecast_rainfall',
  source: OPEN_METEO,
  location: RED_HOOK,
  coverage: { method: 'Nearest model grid cell', resolution: 'about 1–11 km depending on model' },
  observedAt: null,
  forecastIssuedAt: '2026-11-21T18:00:00Z',
  validFrom: '2026-11-21T20:00:00Z',
  validTo: '2026-11-22T08:00:00Z',
  fetchedAt: EXAMPLE_FETCHED_AT,
  sourceUpdatedAt: null,
  units: 'mm',
  data: {
    model: 'best_match',
    samples: RAIN_SHAPE.map((value, hour) => ({
      validFrom: new Date(Date.UTC(2026, 10, 21, 20 + hour)).toISOString(),
      validTo: new Date(Date.UTC(2026, 10, 21, 21 + hour)).toISOString(),
      value,
    })),
  },
  qualityFlags: [],
  limitations: ['A model forecast for a grid cell. It does not say whether any street will flood.'],
}

const TIDE_SHAPE = [2.1, 2.6, 3.2, 3.9, 4.5, 4.9, 5.1, 5.0, 4.6, 4.0, 3.3, 2.7, 2.2, 1.9, 1.8, 2.0, 2.5, 3.1]

export const EXAMPLE_TIDE: EnvironmentalResult<ObservationSeries> = {
  status: 'available',
  kind: 'observed_water_level',
  source: NOAA,
  location: { lat: 40.7006, lon: -74.0142 },
  coverage: { method: 'Single tide gauge' },
  observedAt: '2026-11-21T19:00:00Z',
  forecastIssuedAt: null,
  validFrom: null,
  validTo: null,
  fetchedAt: EXAMPLE_FETCHED_AT,
  sourceUpdatedAt: '2026-11-21T19:00:00Z',
  units: 'ft above MLLW',
  data: {
    stationId: '8518750',
    stationName: 'The Battery, NY',
    metric: 'Water level',
    points: TIDE_SHAPE.map((value, i) => ({
      observedAt: new Date(Date.UTC(2026, 10, 21, 10, 30 * i)).toISOString(),
      value,
    })),
  },
  qualityFlags: [],
  limitations: ['One station. It is not the water level on every street of the shoreline.'],
}

export const EXAMPLE_AREA: EnvironmentalResult<AreaSummaryData> = {
  status: 'available',
  kind: 'area_summary',
  source: AREA_SOURCE,
  location: RED_HOOK,
  coverage: { method: 'Records whose location falls inside the circle' },
  observedAt: null,
  forecastIssuedAt: null,
  validFrom: null,
  validTo: null,
  fetchedAt: EXAMPLE_FETCHED_AT,
  sourceUpdatedAt: null,
  units: null,
  data: {
    center: RED_HOOK,
    radiusMeters: 800,
    coverageStatus: 'incomplete',
    metrics: [
      { id: 'sensors', label: 'FloodNet sensors inside', value: 4, units: 'sensors', kind: 'observed', isLowerBound: false, note: 'Sensor locations' },
      { id: 'events', label: 'Sensor flood events, last 90 days', value: 7, units: 'events', kind: 'observed', isLowerBound: true, note: 'Cached records, a lower bound' },
      { id: '311', label: 'Street-flooding 311 reports, 5 years', value: 63, units: 'reports', kind: 'historical', isLowerBound: true, note: 'Reports, not verified depths' },
      { id: 'fema', label: 'Area in a FEMA special flood hazard zone', value: null, units: '%', kind: 'reference', isLowerBound: false, note: 'Not loaded for this area yet' },
    ],
  },
  qualityFlags: ['PARTIAL_DATA'],
  limitations: ['Counts cover only records we hold. A small number does not mean a dry block.'],
}

export type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: readonly { label: string; kind: string; url: string }[]
}

export const EXAMPLE_THREAD: readonly AssistantMessage[] = [
  { id: 'q1', role: 'user', text: 'Is anything flooding near Red Hook tonight?' },
  {
    id: 'a1',
    role: 'assistant',
    text: 'The NWS has a Coastal Flood Advisory from 4 PM to 9 PM Eastern. The forecast shows about 30 mm of rain overnight, heaviest around 9 PM. I can’t tell you whether your street will flood. Follow the advisory’s own instructions.',
    citations: [
      { label: 'NWS advisory', kind: 'official', url: 'https://www.weather.gov/documentation/services-web-api' },
      { label: 'Open-Meteo forecast', kind: 'forecast', url: 'https://open-meteo.com/en/docs' },
    ],
  },
  { id: 'q2', role: 'user', text: 'Has it flooded here before?' },
  {
    id: 'a2',
    role: 'assistant',
    text: 'FloodNet sensors inside this circle logged 7 flood events in the last 90 days, and residents filed 63 street-flooding reports to 311 over five years. Those are past records, not tonight’s conditions.',
    citations: [
      { label: 'FloodNet events', kind: 'observed', url: 'https://data.cityofnewyork.us/d/aq7i-eu5q' },
      { label: 'NYC 311', kind: 'historical', url: 'https://data.cityofnewyork.us/d/erm2-nwe9' },
    ],
  },
]

/** Languages from Decong's localization work (en, es, zh-Hans, ru, hi). */
export const DIGEST_LANGUAGES = [
  { code: 'en', name: 'English', subject: 'Flood alert summary for Red Hook', note: 'Summary of an official alert. Always check the original.' },
  { code: 'es', name: 'Español', subject: 'Resumen de alertas de inundación para Red Hook', note: 'Resumen de una alerta oficial. Consulte siempre el original.' },
  { code: 'zh-Hans', name: '中文', subject: 'Red Hook 洪水警报摘要', note: '官方警报的摘要。请务必查看原文。' },
  { code: 'ru', name: 'Русский', subject: 'Сводка предупреждений о наводнении: Red Hook', note: 'Краткое изложение официального предупреждения. Всегда сверяйтесь с оригиналом.' },
  { code: 'hi', name: 'हिन्दी', subject: 'Red Hook के लिए बाढ़ चेतावनी सारांश', note: 'आधिकारिक चेतावनी का सारांश। हमेशा मूल चेतावनी देखें।' },
] as const
