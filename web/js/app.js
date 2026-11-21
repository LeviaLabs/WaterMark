// Watermark map app: 2D map, circle-an-area statistics, live flood data, data panel.
import { setupPanel } from "./panel.js";
import { renderSources, markFetched, fmtTime } from "./sources.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const start = {
  lat: parseFloat(params.get("lat")) || 40.5755,
  lon: parseFloat(params.get("lon")) || -73.986,
  z: parseFloat(params.get("z")) || 13,
  label: params.get("label") || "Coney Island",
};

const URLS = {
  style: "https://tiles.openfreemap.org/styles/positron",
  sensors: "https://data.cityofnewyork.us/resource/kb2e-tjy3.geojson?$limit=5000",
  sensorStats: "https://data.cityofnewyork.us/resource/aq7i-eu5q.json?" + new URLSearchParams({
    $select: "sensor_id,count(*) as events,max(max_depth_inches) as max_depth,max(flood_start_time) as last_flood",
    $group: "sensor_id", $limit: "5000",
  }),
  storm: "https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/Moderate_Current_Sea_Levels/FeatureServer/0/query",
  femaTiles: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:28&f=image",
  femaQuery: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
  // NASA IMERG 30-minute rain rate; "default" is GIBS's newest available image.
  imergTiles: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png",
  gdacs: () => {
    const day = (ms) => new Date(Date.now() - ms).toISOString().slice(0, 10);
    return "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?" + new URLSearchParams({
      eventlist: "FL", fromdate: day(30 * 864e5), todate: day(0), alertlevel: "red;orange;green", // GDACS returns nothing without alertlevel
    });
  },
};
const ALERT_COLOR = { Red: "#c2372b", Orange: "#e07b1f", Green: "#3d8b57" };

const ZONE_TEXT = {
  AE: "High risk. A 1% chance of flooding each year; flood insurance is required for most mortgages.",
  A: "High risk. A 1% chance of flooding each year; no detailed flood elevation was mapped.",
  AO: "High risk from shallow flooding (1 to 3 feet).",
  VE: "Highest risk. Coastal flooding with waves of 3 feet or more.",
  X: "Moderate to low risk. Shaded X areas have a 0.2% annual chance; unshaded X is minimal risk.",
};

// ---------- user chip ----------
try {
  const n = localStorage.getItem("wm-name");
  $("user").textContent = n ? `Signed in as ${n} (demo)` : "Demo mode";
} catch { $("user").textContent = "Demo mode"; }

// ---------- panel ----------
const panelCtl = setupPanel({
  panel: $("panel"), handle: $("handle"), stowBtn: $("stow"), closeBtn: $("close"),
  stowTab: $("stow-tab"), reopenBtn: $("reopen"),
});
renderSources($("view-sources"), { open: true });

const tabs = ["area", "alerts", "sources"];
function showTab(name) {
  tabs.forEach((t) => {
    $("tab-" + t).setAttribute("aria-selected", String(t === name));
    $("view-" + t).hidden = t !== name;
  });
}
tabs.forEach((t) => $("tab-" + t).addEventListener("click", () => showTab(t)));

// ---------- helpers ----------
async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (s) => s ? new Date(s).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "none";
const pct = (x) => x < 0.1 && x > 0 ? "under 0.1%" : `${x.toFixed(1)}%`;
const fetchedLine = (src) => `<p class="meta">From ${src}, fetched ${fmtTime(new Date())}</p>`;
const failLine = (what) => `<p class="meta">Couldn't load ${what} right now. The source may be down or blocking requests; try again in a minute.</p>`;

// ---------- map ----------
const map = new maplibregl.Map({
  container: "map",
  style: URLS.style,
  center: [start.lon, start.lat],
  zoom: start.z,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");

let sensors = { type: "FeatureCollection", features: [] };
const EMPTY = { type: "FeatureCollection", features: [] };

map.on("load", async () => {
  markFetched("basemap");

  // Global rain rate (NASA IMERG). Coarse imagery, so only shown at country scale and wider.
  map.addSource("rain", { type: "raster", tiles: [URLS.imergTiles], tileSize: 256, maxzoom: 6,
    attribution: "Rain: NASA GPM IMERG via GIBS" });
  map.addLayer({ id: "rain", type: "raster", source: "rain", maxzoom: 9, paint: { "raster-opacity": 0.75 } });
  markFetched("imerg");

  // FEMA flood zones (raster tiles from FEMA's map service), off by default.
  map.addSource("fema", { type: "raster", tiles: [URLS.femaTiles], tileSize: 256,
    attribution: "Flood zones: FEMA NFHL" });
  map.addLayer({ id: "fema", type: "raster", source: "fema", paint: { "raster-opacity": 0.6 },
    layout: { visibility: "none" } });

  // NYC stormwater flood model, loaded for the visible area when zoomed in.
  map.addSource("storm", { type: "geojson", data: EMPTY, attribution: "Stormwater model: NYC MOCEJ/DEP" });
  map.addLayer({ id: "storm", type: "fill", source: "storm", paint: {
    "fill-color": ["match", ["get", "Flooding_Category"], 2, "#1b5560", "#2c7a86"],
    "fill-opacity": ["match", ["get", "Flooding_Category"], 2, 0.65, 0.4],
  } });

  // Selection circle
  map.addSource("sel", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "sel-fill", type: "fill", source: "sel", paint: { "fill-color": "#f0b81c", "fill-opacity": 0.12 } });
  map.addLayer({ id: "sel-line", type: "line", source: "sel", paint: { "line-color": "#12324a", "line-width": 2, "line-dasharray": [2, 1] } });

  // FloodNet sensors
  map.addSource("sensors", { type: "geojson", data: EMPTY, attribution: "Sensors: FloodNet NYC" });
  map.addLayer({ id: "sensors", type: "circle", source: "sensors", paint: {
    "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "events"], 0], 0, 4, 10, 6, 50, 9, 150, 13],
    "circle-color": ["case", [">", ["coalesce", ["get", "events"], 0], 0], "#c2372b", "#ffffff"],
    "circle-stroke-color": "#12324a", "circle-stroke-width": 1.5,
  } });

  // Floods reported worldwide (GDACS): solid if still active, hollow if ended.
  map.addSource("floods", { type: "geojson", data: EMPTY, attribution: "Floods: GDACS" });
  map.addLayer({ id: "floods", type: "circle", source: "floods", paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 6, 6, 9, 10, 12],
    "circle-color": ["case", ["get", "active"], ["get", "color"], "#ffffff"],
    "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2.5,
  } });
  map.on("click", "floods", (e) => {
    if (drawing) return;
    const p = e.features[0].properties;
    new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setHTML(
      `<strong>${esc(p.name)}</strong><br>${esc(p.alertlevel)} alert, ${p.active ? "still active" : "ended"}<br>
       ${fmtDate(p.fromdate)} to ${fmtDate(p.todate)}<br>
       <a href="${esc(p.report)}" target="_blank" rel="noopener">GDACS report</a>`
    ).addTo(map);
  });
  map.on("mouseenter", "floods", () => { if (!drawing) map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "floods", () => { if (!drawing) map.getCanvas().style.cursor = ""; });

  loadFloods();
  loadSensors();
  loadStorm();
  map.on("moveend", loadStorm);

  map.on("click", "sensors", (e) => {
    if (drawing) return;
    const p = e.features[0].properties;
    new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setHTML(
      `<strong>${esc(p.street_name || p.sensor_name)}</strong><br>
       ${p.events} recorded floods<br>Deepest: ${(+p.max_depth || 0).toFixed(1)} in<br>Last flood: ${fmtDate(p.last_flood)}`
    ).addTo(map);
  });
  map.on("mouseenter", "sensors", () => { if (!drawing) map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "sensors", () => { if (!drawing) map.getCanvas().style.cursor = ""; });

  // Start with a 1 km circle around the chosen place.
  select([start.lon, start.lat], 1, start.label);
});

async function loadSensors() {
  try {
    const [geo, stats] = await Promise.all([getJSON(URLS.sensors), getJSON(URLS.sensorStats)]);
    const byId = Object.fromEntries(stats.map((s) => [s.sensor_id, s]));
    geo.features = geo.features.filter((f) => f.geometry && !f.properties.date_removed);
    geo.features.forEach((f) => {
      const s = byId[f.properties.sensor_id] || {};
      f.properties.events = +s.events || 0;
      f.properties.max_depth = +s.max_depth || 0;
      f.properties.last_flood = s.last_flood || null;
    });
    sensors = geo;
    map.getSource("sensors").setData(geo);
    markFetched("floodnet");
    if (current) renderArea(); // refresh stats once sensors arrive
  } catch (e) {
    console.warn("FloodNet failed", e);
    sensorsFailed = true;
    if (current) renderArea();
  }
}
let sensorsFailed = false;

let floods = null; // null = loading, "error", or a FeatureCollection
async function loadFloods() {
  const note = $("global-note");
  try {
    const fc = await getJSON(URLS.gdacs());
    fc.features = (fc.features || []).filter((f) => f.geometry?.type === "Point").map((f) => {
      const p = f.properties;
      return { type: "Feature", geometry: f.geometry, properties: {
        name: p.name, alertlevel: p.alertlevel, color: ALERT_COLOR[p.alertlevel] || "#3d8b57",
        active: p.iscurrent === "true", fromdate: p.fromdate, todate: p.todate, report: p.url?.report || "https://www.gdacs.org/",
      } };
    });
    floods = fc;
    map.getSource("floods").setData(fc);
    markFetched("gdacs");
    const active = fc.features.filter((f) => f.properties.active).length;
    note.textContent = `${active} active floods worldwide, ${fc.features.length} in the past 30 days. Rain shows the newest NASA image, a few hours old.`;
  } catch (e) {
    floods = "error";
    note.textContent = "Worldwide flood reports didn't load. GDACS may be busy; reload to try again.";
  }
  if (current) renderArea();
}

let stormCtl;
async function loadStorm() {
  const note = $("storm-note");
  if (map.getZoom() < 13) { note.hidden = false; note.textContent = "Zoom in to see the heavy-rain model."; map.getSource("storm").setData(EMPTY); return; }
  const b = map.getBounds();
  stormCtl?.abort(); stormCtl = new AbortController();
  try {
    const q = new URLSearchParams({
      where: "1=1", geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(","),
      geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
      outFields: "Flooding_Category", outSR: "4326", geometryPrecision: "6", f: "geojson",
    });
    const data = await getJSON(`${URLS.storm}?${q}`, { signal: stormCtl.signal });
    map.getSource("storm").setData(data);
    markFetched("stormwater");
    note.hidden = !(data.properties?.exceededTransferLimit);
    note.textContent = "Showing part of the model here. Zoom in for full detail.";
  } catch (e) {
    if (e.name !== "AbortError") { note.hidden = false; note.textContent = "The heavy-rain model didn't load. Try moving the map."; }
  }
}

// Layer toggles
document.querySelectorAll("[data-layer]").forEach((cb) => cb.addEventListener("change", () => {
  if (!map.getLayer(cb.dataset.layer)) return;
  map.setLayoutProperty(cb.dataset.layer, "visibility", cb.checked ? "visible" : "none");
}));

// ---------- search ----------
$("search").addEventListener("submit", async (e) => {
  e.preventDefault();
  const place = $("q").value.trim();
  if (!place) return;
  try {
    const q = /^\d{5}$/.test(place) ? `postalcode=${place}&country=us` : `q=${encodeURIComponent(place)}`;
    const hits = await getJSON(`https://nominatim.openstreetmap.org/search?${q}&format=json&limit=1`);
    markFetched("geocode");
    if (!hits.length) { hint(`Couldn't find "${place}". Try a ZIP code or add the city.`, 4000); return; }
    const c = [+hits[0].lon, +hits[0].lat];
    map.flyTo({ center: c, zoom: 14 });
    select(c, 1, hits[0].display_name.split(",").slice(0, 2).join(","));
  } catch { hint("Place search isn't responding. Try again in a moment.", 4000); }
});

// ---------- circle tool: click the center, then click the edge ----------
let drawing = false, center = null;
function hint(text, ms) {
  const h = $("hint"); h.textContent = text; h.hidden = !text;
  if (ms) setTimeout(() => { if (h.textContent === text) h.hidden = true; }, ms);
}
function setDrawing(on) {
  drawing = on; center = null;
  $("draw").setAttribute("aria-pressed", String(on));
  map.getCanvas().style.cursor = on ? "crosshair" : "";
  hint(on ? "Click the center of the area. Press Esc to cancel." : "");
}
$("draw").addEventListener("click", () => setDrawing(!drawing));
addEventListener("keydown", (e) => { if (e.key === "Escape" && drawing) setDrawing(false); });

map.on("click", (e) => {
  if (!drawing) return;
  const p = [e.lngLat.lng, e.lngLat.lat];
  if (!center) { center = p; hint("Now click the edge of the area."); return; }
  const km = Math.max(0.05, turf.distance(center, p, { units: "kilometers" }));
  const c = center;
  setDrawing(false);
  select(c, km, "Your selected area");
});
map.on("mousemove", (e) => {
  if (!drawing || !center) return;
  const km = Math.max(0.01, turf.distance(center, [e.lngLat.lng, e.lngLat.lat], { units: "kilometers" }));
  map.getSource("sel").setData(turf.circle(center, km, { steps: 64, units: "kilometers" }));
});

// ---------- selection and stats ----------
let current = null;
let summary = null;
fetch("data/summary.json").then((r) => r.ok ? r.json() : null).then((j) => { summary = j; if (current) renderArea(); }).catch(() => {});

async function select(c, km, label) {
  const circle = turf.circle(c, km, { steps: 64, units: "kilometers" });
  map.getSource("sel").setData(circle);
  current = { c, km, label, circle, rain: null, river: null, zone: null, storm: null, zip: null, alerts: null };
  const me = current;
  panelCtl.open();
  $("panel-title").textContent = label;
  renderArea(); renderAlerts();

  const [lon, lat] = c;
  const done = (k, v) => { if (current === me) { me[k] = v; renderArea(); if (k === "alerts") renderAlerts(); } };

  getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=auto&precipitation_unit=inch`)
    .then((j) => { markFetched("rain"); done("rain", j.daily); }).catch(() => done("rain", "error"));
  getJSON(`https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=7`)
    .then((j) => { markFetched("river"); done("river", j.daily); }).catch(() => done("river", "error"));
  getJSON(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { Accept: "application/geo+json" } })
    .then((j) => { markFetched("nws"); done("alerts", j.features || []); }).catch(() => done("alerts", "error"));
  getJSON(`${URLS.femaQuery}?` + new URLSearchParams({ geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "FLD_ZONE,ZONE_SUBTY", returnGeometry: "false", f: "json" }))
    .then((j) => { markFetched("fema"); done("zone", j.features?.[0]?.attributes || "none"); }).catch(() => done("zone", "error"));
  getJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`)
    .then((j) => { markFetched("geocode"); done("zip", j.address?.postcode?.slice(0, 5) || "none"); }).catch(() => done("zip", "error"));
  stormShare(circle).then((v) => done("storm", v)).catch(() => done("storm", "error"));
}

// Share of the circle covered by modeled nuisance (4 in to 1 ft) and deep (1 ft+) flooding.
async function stormShare(circle) {
  const ring = circle.geometry.coordinates[0];
  const body = new URLSearchParams({
    where: "1=1", geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "Flooding_Category", outSR: "4326", geometryPrecision: "6", f: "geojson",
  });
  const fc = await getJSON(URLS.storm, { method: "POST", body });
  markFetched("stormwater");
  const total = turf.area(circle);
  const area = { 1: 0, 2: 0 };
  for (const f of fc.features) {
    try {
      const part = turf.intersect(turf.featureCollection([circle, f]));
      if (part) area[f.properties.Flooding_Category] = (area[f.properties.Flooding_Category] || 0) + turf.area(part);
    } catch { /* skip invalid geometry */ }
  }
  return { nuisance: (area[1] / total) * 100, deep: (area[2] / total) * 100, partial: !!fc.properties?.exceededTransferLimit,
    none: fc.features.length === 0 };
}

function row(k, v) { return `<div class="stat-row"><span>${k}</span><span class="v">${v}</span></div>`; }
const loading = '<p class="meta">Loading…</p>';

function renderArea() {
  const s = current; if (!s) return;
  const r = s.km * 0.621371;
  let h = `<p class="meta">Circle of ${r < 0.5 ? Math.round(r * 5280).toLocaleString() + " ft" : r.toFixed(2) + " mi"} radius around
    ${s.c[1].toFixed(4)}, ${s.c[0].toFixed(4)}</p>`;

  // FloodNet
  h += `<h3>Street flooding measured by sensors</h3>`;
  if (sensorsFailed) h += failLine("FloodNet sensors");
  else if (!sensors.features.length) h += loading;
  else {
    const inside = sensors.features.filter((f) => turf.booleanPointInPolygon(f, s.circle));
    if (!inside.length) h += `<p class="empty">No FloodNet sensors in this area. Sensors only cover parts of NYC, so no sensor does not mean no flooding.</p>`;
    else {
      const ev = inside.reduce((a, f) => a + f.properties.events, 0);
      const deep = Math.max(...inside.map((f) => f.properties.max_depth));
      const last = inside.map((f) => f.properties.last_flood).filter(Boolean).sort().pop();
      const since = inside.map((f) => f.properties.date_installed).filter(Boolean).sort()[0];
      h += row("Sensors in area", inside.length) + row("Monitoring since", fmtDate(since))
        + row("Floods recorded", ev.toLocaleString())
        + row("Deepest flood", ev ? `${deep.toFixed(1)} in` : "none yet") + row("Most recent flood", fmtDate(last));
    }
    h += fetchedLine("FloodNet NYC");
  }

  // Nearest flood reported by GDACS (works anywhere in the world)
  h += `<h3>Nearest reported flood</h3>`;
  if (floods === null) h += loading;
  else if (floods === "error") h += failLine("worldwide flood reports");
  else if (!floods.features.length) h += `<p class="empty">No floods reported worldwide in the past 30 days.</p>`;
  else {
    const near = floods.features.map((f) => ({ f, km: turf.distance(s.c, f.geometry.coordinates, { units: "kilometers" }) }))
      .sort((a, b) => a.km - b.km)[0];
    const p = near.f.properties, mi = near.km * 0.621371;
    h += row("Event", esc(p.name)) + row("Distance", `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`)
      + row("Status", `${esc(p.alertlevel)} alert, ${p.active ? "active" : "ended " + fmtDate(p.todate)}`)
      + `<p class="meta">GDACS lists floods large enough for international notice, so local street flooding won't appear here.
         <a href="${esc(p.report)}" target="_blank" rel="noopener">Read the report</a>.</p>`
      + fetchedLine("GDACS");
  }

  // Stormwater model
  h += `<h3>Heavy-rain flood model</h3>`;
  if (s.storm === null) h += loading;
  else if (s.storm === "error") h += failLine("the NYC stormwater model");
  else if (s.storm.none) h += `<p class="empty">No modeled heavy-rain flooding in this circle. The model covers New York City only.</p>`;
  else {
    h += `<p class="meta">If 2.13 inches of rain fell in an hour, this share of the area is modeled to flood:</p>`
      + row("4 inches to 1 foot deep", pct(s.storm.nuisance)) + row("1 foot or deeper", pct(s.storm.deep));
    if (s.storm.partial) h += `<p class="meta">This area is large, so only part of the model was counted. Draw a smaller circle for an exact figure.</p>`;
    h += fetchedLine("NYC Stormwater Flood Map");
  }

  // FEMA zone
  h += `<h3>FEMA flood zone at the center</h3>`;
  if (s.zone === null) h += loading;
  else if (s.zone === "error") h += failLine("FEMA flood zones");
  else if (s.zone === "none") h += `<p class="empty">No FEMA flood zone is mapped at this point. FEMA maps cover the US only.</p>`;
  else {
    const z = s.zone.FLD_ZONE;
    h += row("Zone", esc(z + (s.zone.ZONE_SUBTY ? ` (${s.zone.ZONE_SUBTY.toLowerCase()})` : "")));
    if (ZONE_TEXT[z]) h += `<p>${ZONE_TEXT[z]}</p>`;
    h += fetchedLine("FEMA NFHL");
  }

  // Rain forecast
  h += `<h3>Rain in the next 3 days</h3>`;
  if (s.rain === null) h += loading;
  else if (s.rain === "error") h += failLine("the rain forecast");
  else {
    const v = s.rain.precipitation_sum, mx = Math.max(1, ...v);
    h += `<div class="bars" aria-hidden="true">${v.map((x) => `<div style="height:${(x / mx) * 100}%"></div>`).join("")}</div>`
      + `<div class="bars-labels" aria-hidden="true">${s.rain.time.map((t) => `<span>${new Date(t + "T12:00").toLocaleDateString([], { weekday: "short" })}</span>`).join("")}</div>`
      + s.rain.time.map((t, i) => row(new Date(t + "T12:00").toLocaleDateString([], { weekday: "long" }),
          `${v[i].toFixed(2)} in, ${s.rain.precipitation_probability_max?.[i] ?? "?"}% chance`)).join("")
      + fetchedLine("Open-Meteo");
  }

  // River discharge (GloFAS)
  h += `<h3>Nearest river, next 7 days</h3>`;
  if (s.river === null) h += loading;
  else if (s.river === "error" || !s.river.river_discharge?.some((x) => x != null)) h += `<p class="empty">No modeled river near this point.</p>`;
  else {
    const q = s.river.river_discharge.filter((x) => x != null);
    h += row("Today", `${q[0].toLocaleString()} m³/s`) + row("7-day peak", `${Math.max(...q).toLocaleString()} m³/s`)
      + `<p class="meta">Modeled flow of the nearest river cell. It does not include coastal surge or street flooding.</p>`
      + fetchedLine("GloFAS via Open-Meteo");
  }

  // Insurance history from summary.json
  h += `<h3>Past flood insurance claims</h3>`;
  const hood = summary && s.zip && Object.entries(summary.neighborhoods).find(([, v]) => v.zip_codes.includes(s.zip));
  if (!summary) h += `<p class="empty">Claim history isn't loaded. Run scripts/watermark_data.py and copy its summary.json into web/data/.</p>`;
  else if (s.zip === null) h += loading;
  else if (!hood) h += `<p class="empty">No claim summary for ZIP ${esc(s.zip)} yet. Add it to NEIGHBORHOODS in the data script.</p>`;
  else {
    const n = hood[1].nfip;
    const top = Object.entries(n.top_events)[0];
    h += row("Neighborhood", esc(hood[0])) + row("Claims since 1978", n.claims.toLocaleString())
      + row("Total paid", "$" + n.total_paid_usd.toLocaleString()) + (top ? row("Biggest event", `${esc(top[0])} (${top[1].toLocaleString()} claims)`) : "")
      + `<p class="meta">Claims only cover insured homes, so a low count can mean few people had flood insurance. Data generated ${fmtDate(summary.generated_at_utc)}.</p>`;
  }

  // Next action
  const high = (s.zone && ["AE", "A", "AO", "VE"].includes(s.zone.FLD_ZONE)) || (s.storm && s.storm.deep > 1);
  const alerts = Array.isArray(s.alerts) && s.alerts.length;
  h += `<h3>What to do</h3>`;
  if (alerts) h += `<div class="alert"><strong>There ${alerts === 1 ? "is an active alert" : `are ${alerts} active alerts`} here.</strong>Open the Alerts tab and follow the National Weather Service instructions.</div>`;
  else if (high) h += `<div class="ok">This area has a mapped flood risk. Check whether your home is covered: renters and owners can buy flood insurance through <a href="https://www.floodsmart.gov" target="_blank" rel="noopener">FloodSmart.gov</a>, and <a href="https://www.floodhelpny.org" target="_blank" rel="noopener">FloodHelpNY</a> explains your options in NYC.</div>`;
  else h += `<p>No active alerts and no high-risk zone found here. Flooding can still happen in heavy rain, so keep drains clear and know your route to higher ground.</p>`;

  $("view-area").innerHTML = h;
}

function renderAlerts() {
  const s = current; const el = $("view-alerts");
  $("tab-alerts").textContent = Array.isArray(s.alerts) && s.alerts.length ? `Alerts (${s.alerts.length})` : "Alerts";
  if (s.alerts === null) { el.innerHTML = loading; return; }
  if (s.alerts === "error") { el.innerHTML = failLine("weather alerts") + `<p class="meta">Alerts cover the US only.</p>`; return; }
  if (!s.alerts.length) { el.innerHTML = `<div class="ok">No active weather alerts at the center of this area.</div>` + fetchedLine("the National Weather Service"); return; }
  el.innerHTML = s.alerts.map((a) => {
    const p = a.properties;
    return `<div class="alert"><strong>${esc(p.event)}</strong>${esc(p.headline || "")}
      <p class="meta">Until ${p.ends || p.expires ? fmtTime(new Date(p.ends || p.expires)) : "further notice"}</p>
      ${p.instruction ? `<p>${esc(p.instruction)}</p>` : ""}</div>`;
  }).join("") + fetchedLine("the National Weather Service");
}
