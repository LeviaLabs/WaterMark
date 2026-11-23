/**
 * Landing-page copy about the public datasets WaterMark draws from.
 * Mirrors README Section 6 and scripting/sources.ts.
 */

export type EvidenceKind = 'official' | 'forecast' | 'modeled' | 'scenario' | 'observed' | 'historical' | 'reference'

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  official: 'Official warning',
  forecast: 'Forecast',
  modeled: 'Modeled',
  scenario: 'Scenario',
  observed: 'Observed',
  historical: 'Historical',
  reference: 'Reference map',
}

export type DataSource = {
  name: string
  provider: string
  url: string
  kind: EvidenceKind
  coverage: string
}

export const DATA_SOURCES: readonly DataSource[] = [
  { name: 'Active alerts API', provider: 'National Weather Service', url: 'https://www.weather.gov/documentation/services-web-api', kind: 'official', coverage: 'United States' },
  { name: 'Weather API', provider: 'Open-Meteo', url: 'https://open-meteo.com/en/docs', kind: 'forecast', coverage: 'Global' },
  { name: 'Flood API (GloFAS)', provider: 'Open-Meteo / Copernicus', url: 'https://open-meteo.com/en/docs/flood-api', kind: 'modeled', coverage: 'Global rivers' },
  { name: 'IMERG precipitation (GIBS)', provider: 'NASA GPM', url: 'https://www.earthdata.nasa.gov/data/tools/gibs', kind: 'observed', coverage: 'Global' },
  { name: 'Global flood alerts', provider: 'UN / JRC GDACS', url: 'https://www.gdacs.org/', kind: 'historical', coverage: 'Global' },
  { name: 'Storm Events Database', provider: 'NOAA NCEI', url: 'https://www.ncdc.noaa.gov/stormevents/', kind: 'historical', coverage: 'United States' },
  { name: 'Stormwater Flood Maps', provider: 'NYC Open Data', url: 'https://data.cityofnewyork.us/d/9i7c-xyvv', kind: 'scenario', coverage: 'New York City' },
  { name: 'FloodNet event records', provider: 'FloodNet NYC', url: 'https://data.cityofnewyork.us/d/aq7i-eu5q', kind: 'observed', coverage: 'NYC sensor sites' },
  { name: 'FloodNet sensor locations', provider: 'FloodNet NYC', url: 'https://data.cityofnewyork.us/d/kb2e-tjy3', kind: 'observed', coverage: 'NYC sensor sites' },
  { name: 'Tides & Currents API', provider: 'NOAA', url: 'https://api.tidesandcurrents.noaa.gov/api/prod/', kind: 'observed', coverage: 'US tide stations' },
  { name: 'Water Data APIs', provider: 'USGS', url: 'https://api.waterdata.usgs.gov/', kind: 'observed', coverage: 'US stream gauges' },
  { name: '311 service requests', provider: 'NYC Open Data', url: 'https://data.cityofnewyork.us/d/erm2-nwe9', kind: 'historical', coverage: 'New York City' },
  { name: 'National Flood Hazard Layer', provider: 'FEMA', url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', kind: 'reference', coverage: 'United States' },
  { name: 'NFIP redacted claims v3', provider: 'OpenFEMA', url: 'https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3', kind: 'historical', coverage: 'United States' },
  { name: 'Hurricane evacuation zones', provider: 'NYC Emergency Management', url: 'https://www.nyc.gov/site/em/ready/hurricane-evacuation-zones.page', kind: 'reference', coverage: 'New York City' },
  { name: 'Copernicus DEM elevation', provider: 'ESA / Open-Meteo', url: 'https://open-meteo.com/en/docs/elevation-api', kind: 'reference', coverage: 'Global' },
  { name: 'American Community Survey', provider: 'US Census Bureau', url: 'https://www.census.gov/data/developers.html', kind: 'reference', coverage: 'United States' },
]

/** What each kind of evidence is, what it must never be mistaken for, and how WaterMark labels it. */
export const EVIDENCE_RULES: readonly { kind: EvidenceKind; is: string; isNot: string; shownAs: string }[] = [
  {
    kind: 'official',
    is: 'Active NWS warnings, exactly as issued and linked to the agency.',
    isNot: 'A forecast we computed, or an all-clear when no warning exists.',
    shownAs: 'First, in the agency’s own words: severity, urgency and certainty as issued, when it starts and ends, and a link to weather.gov.',
  },
  {
    kind: 'forecast',
    is: 'Predicted rainfall amounts and intensity, with the time the model was issued.',
    isNot: 'An official warning, or flooding that has already happened.',
    shownAs: 'Millimeters per hour for the hours ahead, with the model’s issue time. Missing hours stay blank instead of reading zero.',
  },
  {
    kind: 'modeled',
    is: 'GloFAS river-discharge forecasts at supported river points.',
    isNot: 'Street-level flood depth, coastal surge, or urban rainfall flooding.',
    shownAs: 'River flow at the nearest supported river point, with the model run time and a note that it says nothing about street flooding.',
  },
  {
    kind: 'scenario',
    is: 'NYC stormwater maps showing where a modeled storm could pond water.',
    isNot: 'What is flooding today.',
    shownAs: 'Named by the storm it models (limited, moderate or extreme) and always labeled a scenario, never today’s water.',
  },
  {
    kind: 'observed',
    is: 'Readings from a specific FloodNet sensor, tide station or stream gauge, plus near-real-time satellite rain.',
    isNot: 'A measurement for the whole neighborhood around it.',
    shownAs: 'The exact sensor, station or satellite granule, its reading with units and the time it was taken. Gaps stay gaps.',
  },
  {
    kind: 'historical',
    is: 'NOAA flood episodes, GDACS events, 311 flooding reports and insurance claims from past events.',
    isNot: 'Present conditions, or a statement about any one household.',
    shownAs: 'Counts with their date range and flood causes. Capped counts read “at least”, and missing counts read “Unknown”, never zero.',
  },
  {
    kind: 'reference',
    is: 'FEMA flood zones, evacuation zones, ground elevation and census context for planning.',
    isNot: 'A current warning, a live prediction, or facts about one person.',
    shownAs: 'As a reference layer with its publisher, kept apart from anything that describes right now.',
  },
]
