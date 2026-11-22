"""
Step 1 of 2 for the stormwater map tiles: download the official NYC Stormwater
Flood Maps collection from NYC Open Data and convert the "Moderate Flood
(2.13 inches per hr) with Current Sea Levels" layer to WGS 84 GeoJSON.

Step 2 is build-tiles.mjs, which cuts that GeoJSON into vector tiles under
public/data/stormwater/. Run both with `npm run tiles:stormwater`.

Needs Python 3.9+ and:  pip install pyogrio shapely pyproj
(the pyogrio wheel bundles GDAL, so no separate GDAL install is needed).

Source: https://data.cityofnewyork.us/d/9i7c-xyvv (NYC Mayor's Office of
Climate and Environmental Justice / DEP). Output: .cache/stormwater.geojson
plus .cache/stormwater.meta.json with the dataset's last-update date.
"""
import io
import json
import os
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely import force_2d, from_wkb, set_precision, transform
from shapely.geometry import mapping

DATASET = "9i7c-xyvv"
VIEW_URL = f"https://data.cityofnewyork.us/api/views/{DATASET}.json"
LAYER_FOLDER = "Moderate Flood (2.13 inches per hr) with Current Sea Levels"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "..", "..", ".cache")
HEADERS = {"User-Agent": "WaterMark-EvoHacks/1.0 (stormwater tile build)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=300) as r:
        return r.read()


def main():
    os.makedirs(CACHE, exist_ok=True)
    view = json.loads(get(VIEW_URL))
    blob = view["blobId"]
    updated = datetime.fromtimestamp(view["rowsUpdatedAt"], tz=timezone.utc).date().isoformat()
    print(f"{view['name']}: last updated {updated}, downloading {view['blobFileSize'] / 1e6:.0f} MB")

    archive = zipfile.ZipFile(io.BytesIO(get(f"https://data.cityofnewyork.us/api/views/{DATASET}/files/{blob}?download=true")))
    members = [n for n in archive.namelist() if LAYER_FOLDER in n and ".gdb/" in n]
    if not members:
        sys.exit(f"Layer folder '{LAYER_FOLDER}' not found in the download; the dataset layout changed.")
    extract_to = os.path.join(CACHE, "gdb")
    for name in members:
        archive.extract(name, extract_to)
    gdb = os.path.join(extract_to, members[0].split(".gdb/")[0] + ".gdb")

    meta, _fids, geoms, fields = pyogrio.raw.read(gdb)
    if str(meta["crs"]) != "EPSG:2263":
        sys.exit(f"Expected EPSG:2263 (NY State Plane, Long Island), got {meta['crs']}.")
    category = fields[list(meta["fields"]).index("Flooding_Category")]
    to_wgs84 = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)

    features = []
    for wkb, cat in zip(geoms, category):
        geom = force_2d(from_wkb(wkb))
        geom = transform(geom, lambda xy: np.column_stack(to_wgs84.transform(xy[:, 0], xy[:, 1])))
        geom = set_precision(geom, 1e-6)  # about 10 cm, far finer than the model's resolution
        features.append({"type": "Feature", "properties": {"Flooding_Category": int(cat)}, "geometry": mapping(geom)})
        print(f"  category {int(cat)}: {len(getattr(geom, 'geoms', [geom]))} polygons")

    with open(os.path.join(CACHE, "stormwater.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, separators=(",", ":"))
    with open(os.path.join(CACHE, "stormwater.meta.json"), "w") as f:
        json.dump({
            "dataset": f"https://data.cityofnewyork.us/d/{DATASET}",
            "layer": f"NYC Stormwater Flood Map - {LAYER_FOLDER}",
            "datasetUpdated": updated,
        }, f, indent=2)
    print("Wrote .cache/stormwater.geojson")


if __name__ == "__main__":
    main()
