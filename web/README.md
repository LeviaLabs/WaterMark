# Watermark web app

Static site: plain HTML, CSS and JavaScript with MapLibre GL JS. No build step.

- `index.html`: demo sign-in and location search, plus the toggleable data sources section.
- `app.html`: the 2D map, circle-an-area statistics and the data panel (drag it by the yellow gauge strip, stow it with the minus button, close it with the x).
- `js/sources.js`: every data source and citation. Add a source here when you add a dataset.
- `data/summary.json`: optional. Run `python scripts/watermark_data.py` from the repo root, then copy `watermark_data/summary.json` here to show flood insurance claim history.

## Run locally

The pages use ES modules, so open them through a local server, not by double-clicking:

```
cd web
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to Cloudflare Pages

Create a Pages project from this repo with no build command and `web` as the build output directory.

## Live data

The map calls these public APIs from the browser, with no keys: FloodNet and the NYC stormwater flood map (NYC Open Data and ArcGIS), FEMA's National Flood Hazard Layer, the National Weather Service alerts API, Open-Meteo (rain and river forecasts) and Nominatim (place search). Nominatim asks for light use only; if traffic grows, switch to a hosted geocoder.
