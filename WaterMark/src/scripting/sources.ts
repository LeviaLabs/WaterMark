// Every dataset the map shows, with publisher and link. Rendered by components/sources/SourcesList.
// Ryan B: import SourcesList on the landing page; it reads this list.

export type SourceId =
  | 'imerg' | 'gdacs' | 'rain-history' | 'elevation' | 'gdacs-history' | 'noaa-storm-events' | 'floodnet' | 'stormwater' | 'fema' | 'nws' | 'rain' | 'river' | 'nfip' | 'geocode' | 'zip' | 'basemap'

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
  { id: 'gdacs-history', name: 'GDACS flood events, 2001 to 2025',
    publisher: 'United Nations and the European Commission Joint Research Centre',
    use: 'Countries on the world map are colored by how many floods GDACS recorded there per year. Totaled by WaterMark from the GDACS event archive; floods large enough for international notice only.',
    url: 'https://www.gdacs.org/', live: false },
  { id: 'noaa-storm-events', name: 'Storm Events Database: flood, flash flood, coastal, storm surge and lakeshore flood episodes, 2016 to 2025',
    publisher: 'NOAA National Centers for Environmental Information',
    use: 'US floods are counted as NOAA flood episodes: the flooding from one weather system, counted once per state, county and square however many reports it produced. Causes come from the event type and the NOAA flood-cause field. Totaled by WaterMark; outlines from the US Census Bureau via us-atlas, countries from Natural Earth.',
    url: 'https://www.ncdc.noaa.gov/stormevents/', live: false },
  { id: 'floodnet', name: 'FloodNet NYC: street flooding events and sensor locations',
    publisher: 'FloodNet (NYU, CUNY and NYC agencies), via NYC Open Data',
    use: 'Sensor locations and every street flood each sensor recorded (depth, duration).',
    url: 'https://data.cityofnewyork.us/d/aq7i-eu5q', live: true },
  { id: 'stormwater', name: 'NYC Stormwater Flood Map: moderate flood, current sea levels',
    publisher: "NYC Mayor's Office of Climate and Environmental Justice, NYC DEP",
    use: 'Where heavy rain (2.13 in/hr) is modeled to flood streets 4 inches or deeper. A scenario, not flooding today. Dataset updated July 3, 2024; served as WaterMark map tiles built from it.',
    url: 'https://data.cityofnewyork.us/d/9i7c-xyvv', live: false },
  { id: 'fema', name: 'National Flood Hazard Layer (NFHL)',
    publisher: 'Federal Emergency Management Agency (FEMA)',
    use: 'Official flood zones (AE, VE, X) used for flood insurance. Not a current warning.',
    url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer', live: true },
  { id: 'nws', name: 'Active weather alerts',
    publisher: 'National Weather Service (NOAA), api.weather.gov',
    use: 'Flood, storm and coastal warnings in effect at the selected point.',
    url: 'https://www.weather.gov/documentation/services-web-api', live: true },
  { id: 'rain', name: 'Precipitation forecast', publisher: 'Open-Meteo weather forecast API',
    use: 'Daily rain for the past 30 days and the next 16 at the selected point, anywhere in the world, on the local calendar days. Past days are model analysis, not gauge readings.',
    url: 'https://open-meteo.com/en/docs', live: true },
  { id: 'rain-history', name: 'Historical weather (ERA5 reanalysis), daily rain since 1991',
    publisher: 'Copernicus Climate Change Service (ECMWF), via the Open-Meteo historical weather API',
    use: 'The heaviest day of rain in each year and how often 50 mm (2 in) days happen at the selected spot, anywhere in the world. A model reconstruction on a roughly 25 km grid, not a rain gauge.',
    url: 'https://open-meteo.com/en/docs/historical-weather-api', live: true },
  { id: 'elevation', name: 'Ground elevation (Copernicus DEM GLO-90)',
    publisher: 'European Space Agency / Copernicus, via the Open-Meteo elevation API',
    use: 'How high the selected spot sits above sea level. Low ground near a coast or river floods more easily, but height alone does not set flood risk.',
    url: 'https://open-meteo.com/en/docs/elevation-api', live: true },
  { id: 'river', name: 'River discharge forecast (GloFAS v4)',
    publisher: 'Copernicus Emergency Management Service, via the Open-Meteo Flood API',
    use: 'Modeled river flow at the nearest GloFAS river cell: the last 60 days and the next 3 months with the forecast spread, and every day since 1984 for comparison. Not flood depth, and not meaningful for coastal surge.',
    url: 'https://open-meteo.com/en/docs/flood-api', live: true },
  { id: 'nfip', name: 'NFIP Redacted Claims (v3)', publisher: 'FEMA, OpenFEMA',
    use: 'Past flood insurance claims for the ZIP code at the center of the selected area, totaled in the browser.',
    url: 'https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3', live: true },
  { id: 'geocode', name: 'Place search', publisher: 'OpenStreetMap contributors, via Photon (komoot)',
    use: 'Search as you type for a ZIP code, neighborhood or address, and find the country at the selected point so only datasets that cover it are asked (US alerts, FEMA zones and claims in the US; the NYC model and sensors in NYC).',
    url: 'https://photon.komoot.io', live: true },
  { id: 'zip', name: 'ZIP Code Tabulation Areas (2020 Census)', publisher: 'US Census Bureau, TIGERweb',
    use: 'The ZIP code at the center of the selected area, for insurance claims.',
    url: 'https://tigerweb.geo.census.gov/', live: true },
  { id: 'basemap', name: 'Basemap', publisher: 'OpenStreetMap contributors, OpenFreeMap',
    use: 'The background map.', url: 'https://openfreemap.org/', live: false },
]
