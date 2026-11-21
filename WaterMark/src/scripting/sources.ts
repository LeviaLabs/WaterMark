/**
 * Bibliography content for the landing page.
 * Owner: Ryan Lin (resources / data / bibliography).
 * Ryan Bergman only mounts <Bibliography />. Edit this file to change sources.
 * Nothing here is a live reading. Connectors are not shipped on this page.
 */

export type SourceAvailability = 'cataloged' | 'planned'

export type SourceRecord = {
  id: string
  name: string
  url: string
  dataType: string
  use: string
  limitation: string
  availability: SourceAvailability
}

export type SourceGroup = {
  id: string
  title: string
  summary: string
  items: SourceRecord[]
}

export const DATA_SOURCES: SourceGroup[] = [
  {
    id: 'alerts',
    title: 'Official alerts',
    summary: 'Warnings an agency has actually issued. A quiet map is not proof of safety.',
    items: [
      {
        id: 'nws-alerts',
        name: 'NWS Alerts API',
        url: 'https://www.weather.gov/documentation/services-web-api',
        dataType: 'Official warning',
        use: 'Active US alerts for a point, including flood and flash-flood products when the National Weather Service has issued them.',
        limitation:
          'Covers an alert area and a time window, not water depth at a doorway. Requests need a User-Agent. No key. This page does not call the API.',
        availability: 'cataloged',
      },
    ],
  },
  {
    id: 'nyc-streets',
    title: 'NYC street flooding',
    summary: 'Sensor records and public reports. A sensor speaks for its own location.',
    items: [
      {
        id: 'floodnet-events',
        name: 'NYC FloodNet street flood events',
        url: 'https://data.cityofnewyork.us/d/aq7i-eu5q',
        dataType: 'Observation',
        use: 'Recorded street-flood events from FloodNet sensors in New York City.',
        limitation:
          'A reading is the sensor’s place and time, not the whole neighborhood. Update frequency has to be checked before anyone calls it live.',
        availability: 'cataloged',
      },
      {
        id: 'floodnet-sensors',
        name: 'NYC FloodNet sensor locations',
        url: 'https://data.cityofnewyork.us/d/kb2e-tjy3',
        dataType: 'Observation context',
        use: 'Where the street-flood sensors sit, so a reading can be tied to a point.',
        limitation: 'Locations are not measurements. The sensor network does not cover every block.',
        availability: 'cataloged',
      },
      {
        id: 'floodnet-dashboard',
        name: 'FloodNet dashboard',
        url: 'https://dataviz.floodnet.nyc/',
        dataType: 'Observation cross-check',
        use: 'A visual cross-check for FloodNet sensor reports.',
        limitation: 'A dashboard is not, by itself, a feed WaterMark has wired up.',
        availability: 'cataloged',
      },
      {
        id: 'nyc-311',
        name: 'NYC 311 service requests',
        url: 'https://data.cityofnewyork.us/d/erm2-nwe9',
        dataType: 'Historical report',
        use: 'Public street-flooding complaints, useful as a history of where people reported water.',
        limitation: 'A complaint is not a verified depth. Counts describe reports, not present conditions.',
        availability: 'cataloged',
      },
    ],
  },
  {
    id: 'rain-scenarios',
    title: 'Heavy-rain scenarios',
    summary: 'Modeled maps of where heavy rain could pond. They are scenarios, not today’s flood.',
    items: [
      {
        id: 'nyc-stormwater',
        name: 'NYC Stormwater Flood Maps',
        url: 'https://data.cityofnewyork.us/d/9i7c-xyvv',
        dataType: 'Scenario map',
        use: 'Areas modeled to flood at least about a quarter acre by 4 inches or more under moderate and extreme rain scenarios.',
        limitation: 'A scenario is not an observation of flooding right now, and it is not a forecast for this afternoon.',
        availability: 'cataloged',
      },
    ],
  },
  {
    id: 'coastal',
    title: 'Coastal flooding and storm surge',
    summary: 'Mapped coastal hazard, tide gauges, and evacuation planning zones.',
    items: [
      {
        id: 'fema-nfhl',
        name: 'FEMA National Flood Hazard Layer',
        url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
        dataType: 'Regulatory map',
        use: 'Official flood-hazard zones such as AE, VE, and X.',
        limitation: 'A flood zone is a mapped designation, not a live warning and not a short-term forecast.',
        availability: 'cataloged',
      },
      {
        id: 'noaa-tides',
        name: 'NOAA Tides and Currents',
        url: 'https://api.tidesandcurrents.noaa.gov/api/prod/',
        dataType: 'Observation',
        use: 'Water levels at tide stations. Nearby NYC references include The Battery (8518750) and Sandy Hook (8531680).',
        limitation: 'A gauge is one station. It is not a property-level surge forecast.',
        availability: 'cataloged',
      },
      {
        id: 'nyc-evacuation-zones',
        name: 'NYC Hurricane Evacuation Zones',
        url: 'https://www.nyc.gov/site/em/ready/hurricane-evacuation-zones.page',
        dataType: 'Official planning map',
        use: 'The city’s coastal evacuation zones for hurricane planning.',
        limitation: 'A zone is a planning boundary, not a real-time inundation map and not an order issued by WaterMark.',
        availability: 'cataloged',
      },
    ],
  },
  {
    id: 'history',
    title: 'History and the insurance gap',
    summary: 'Past claims, policies, and neighborhood statistics. Aggregate only.',
    items: [
      {
        id: 'openfema-nfip-claims',
        name: 'OpenFEMA NFIP redacted claims (v3)',
        url: 'https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3',
        dataType: 'Historical record',
        use: 'Redacted National Flood Insurance Program claims. Version 3 is the current set. The older v2 endpoint is frozen.',
        limitation: 'Claims are historical and aggregated with privacy limits. They do not describe a household today.',
        availability: 'cataloged',
      },
      {
        id: 'openfema-datasets',
        name: 'OpenFEMA policies, declarations, and penetration rates',
        url: 'https://www.fema.gov/about/openfema/data-sets',
        dataType: 'Historical record',
        use: 'NFIP policy counts, disaster declarations, and residential flood-insurance penetration rates.',
        limitation: 'A tract or community rate is not an individual’s policy. WaterMark must not infer who is insured.',
        availability: 'cataloged',
      },
      {
        id: 'census-acs',
        name: 'Census American Community Survey',
        url: 'https://www.census.gov/data/developers.html',
        dataType: 'Neighborhood context',
        use: 'Optional aggregate context such as median income by census tract. The Census API uses a free key.',
        limitation: 'Estimates describe areas, not a person, and they are not a flood measurement.',
        availability: 'cataloged',
      },
    ],
  },
  {
    id: 'rivers-world',
    title: 'Rivers, rainfall, and the rest of the map',
    summary: 'Global and US baselines. River models do not stand in for coastal surge.',
    items: [
      {
        id: 'open-meteo-flood',
        name: 'Open-Meteo Flood API (GloFAS)',
        url: 'https://open-meteo.com/en/docs/flood-api',
        dataType: 'River forecast',
        use: 'Modeled river discharge, with a historical range and months of forecast, at supported river locations.',
        limitation: 'Rivers only. Not street flooding, not coastal storm surge, and not a depth on a block.',
        availability: 'cataloged',
      },
      {
        id: 'open-meteo-weather',
        name: 'Open-Meteo weather and historical weather',
        url: 'https://open-meteo.com/en/docs',
        dataType: 'Rainfall forecast',
        use: 'Forecast and past precipitation from weather models and reanalysis.',
        limitation: 'A rainfall total is not a statement that a particular street will flood.',
        availability: 'cataloged',
      },
      {
        id: 'usgs-water',
        name: 'USGS Water Data',
        url: 'https://api.waterdata.usgs.gov/',
        dataType: 'Observation',
        use: 'Selected US stream-gauge measurements. The current API is api.waterdata.usgs.gov. The older waterservices host is being retired.',
        limitation: 'Availability depends on the gauge. A river stage upstream is not a coastal flood observation.',
        availability: 'cataloged',
      },
      {
        id: 'nasa-imerg',
        name: 'NASA GPM IMERG',
        url: 'https://gpm.nasa.gov/data/imerg',
        dataType: 'Satellite rainfall',
        use: 'Satellite precipitation estimates, planned if there is time. Access needs an Earthdata login.',
        limitation: 'Not connected. Satellite rain can be delayed and is not a street-level flood map.',
        availability: 'planned',
      },
    ],
  },
]

export const REQUIRED_SOURCE_IDS = [
  'nws-alerts',
  'floodnet-events',
  'nyc-311',
  'nyc-stormwater',
  'fema-nfhl',
  'noaa-tides',
  'nyc-evacuation-zones',
  'openfema-nfip-claims',
  'census-acs',
  'open-meteo-flood',
  'open-meteo-weather',
  'usgs-water',
  'nasa-imerg',
] as const
