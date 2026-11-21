// Every dataset the map shows, with publisher and link. Rendered by components/sources/SourcesList.
// Ryan B: import SourcesList on the landing page; it reads this list.

export type SourceId =
  | 'imerg' | 'gdacs' | 'floodnet' | 'stormwater' | 'fema' | 'nws' | 'rain' | 'river' | 'nfip' | 'geocode' | 'basemap'

export interface DataSource {
  id: SourceId
  name: string
  publisher: string
  use: string
  url: string
  /** Fetched live by the browser (true) or static / pre-downloaded (false). */
  live: boolean
}

export const SOURCES: readonly DataSource[] = [
  { id: 'imerg', name: 'IMERG precipitation rate, 30-minute (near real time)',
    publisher: 'NASA Global Precipitation Measurement mission, via NASA GIBS',
    use: 'Where rain and snow are falling worldwide. The newest image is a few hours behind real time.',
    url: 'https://www.earthdata.nasa.gov/data/tools/gibs', live: true },
  { id: 'gdacs', name: 'Global Disaster Alert and Coordination System (GDACS): flood events',
    publisher: 'United Nations and the European Commission Joint Research Centre',
    use: 'Floods reported worldwide in the past 30 days, with alert level and dates.',
    url: 'https://www.gdacs.org/', live: true },
  { id: 'floodnet', name: 'FloodNet NYC: street flooding events and sensor locations',
    publisher: 'FloodNet (NYU, CUNY and NYC agencies), via NYC Open Data',
    use: 'Sensor locations and every street flood each sensor recorded (depth, duration).',
    url: 'https://data.cityofnewyork.us/d/aq7i-eu5q', live: true },
  { id: 'stormwater', name: 'NYC Stormwater Flood Map: moderate flood, current sea levels',
    publisher: "NYC Mayor's Office of Climate and Environmental Justice, NYC DEP",
    use: 'Where heavy rain (2.13 in/hr) is modeled to flood streets 4 inches or deeper. A scenario, not flooding today.',
    url: 'https://data.cityofnewyork.us/d/9i7c-xyvv', live: true },
  { id: 'fema', name: 'National Flood Hazard Layer (NFHL)',
    publisher: 'Federal Emergency Management Agency (FEMA)',
    use: 'Official flood zones (AE, VE, X) used for flood insurance. Not a current warning.',
    url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', live: true },
  { id: 'nws', name: 'Active weather alerts',
    publisher: 'National Weather Service (NOAA), api.weather.gov',
    use: 'Flood, storm and coastal warnings in effect at the selected point.',
    url: 'https://www.weather.gov/documentation/services-web-api', live: true },
  { id: 'rain', name: 'Precipitation forecast', publisher: 'Open-Meteo weather forecast API',
    use: 'Expected rainfall for the next 3 days at the selected point.',
    url: 'https://open-meteo.com/en/docs', live: true },
  { id: 'river', name: 'River discharge forecast (GloFAS v4)',
    publisher: 'Copernicus Emergency Management Service, via the Open-Meteo Flood API',
    use: 'Modeled river flow for the nearest river. Not flood depth, and not meaningful for coastal surge.',
    url: 'https://open-meteo.com/en/docs/flood-api', live: true },
  { id: 'nfip', name: 'FIMA NFIP Redacted Claims', publisher: 'FEMA, OpenFEMA',
    use: 'Past flood insurance claims by ZIP code, pre-downloaded by scripts/watermark_data.py.',
    url: 'https://www.fema.gov/about/openfema/data-sets', live: false },
  { id: 'geocode', name: 'Place search and reverse geocoding', publisher: 'OpenStreetMap contributors, via Nominatim',
    use: 'Turning a typed place or ZIP code into map coordinates.',
    url: 'https://nominatim.org/release-docs/latest/api/Overview/', live: true },
  { id: 'basemap', name: 'Basemap', publisher: 'OpenStreetMap contributors, OpenFreeMap',
    use: 'The background map.', url: 'https://openfreemap.org/', live: false },
]
