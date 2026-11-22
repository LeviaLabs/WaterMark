// Upstream endpoints. All are public and keyless; when the team adds Supabase Edge Function
// adapters, point these at the adapter routes instead and keep the result types in scripting/types.ts.

export const ENDPOINTS = {
  sensors: 'https://data.cityofnewyork.us/resource/kb2e-tjy3.geojson?$limit=5000',
  sensorStats: 'https://data.cityofnewyork.us/resource/aq7i-eu5q.json?' + new URLSearchParams({
    $select: 'sensor_id,count(*) as events,max(max_depth_inches) as max_depth,max(flood_start_time) as last_flood',
    $group: 'sensor_id',
    $limit: '5000',
  }),
  // Our own static vector tiles of the official NYC layer (built by `npm run tiles:stormwater`).
  stormIndex: '/data/stormwater/index.json',
  stormTiles: '/data/stormwater',
  femaTiles: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:28&f=image',
  femaQuery: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query',
  // NASA IMERG 30-minute rain rate. "default" asks GIBS for its newest available image.
  imergTiles: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
  gdacs: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  flood: 'https://flood-api.open-meteo.com/v1/flood',
  nwsAlerts: 'https://api.weather.gov/alerts/active',
  // Photon (OpenStreetMap data): forward search lives in services/geocoding/photon.ts.
  photonReverse: 'https://photon.komoot.io/reverse',
  nfipClaims: 'https://www.fema.gov/api/open/v3/NfipClaims',
} as const
