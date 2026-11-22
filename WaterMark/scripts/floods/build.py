"""Builds the flood-history choropleth files the map opens with (npm run data:floods).

Like the stormwater tiles, these are static files built once from official archives, so the
browser downloads a small pre-totalled file instead of thousands of records:

  public/data/floods/countries.json      every country: GDACS flood events per year, 2001-2025
  public/data/floods/us-states.json      every US state: NOAA Storm Events flood episodes per year, and their causes
  public/data/floods/counties/SS.json    the counties of one state (SS = state FIPS), loaded on click
  public/data/floods/admin1/XXX.json     the provinces, regions or departments of one country (ISO3), on click
  public/data/floods/cells-us.json       0.5-degree squares over the US: NOAA flood episodes at their reported points
  public/data/floods/cells-world.json    1-degree squares elsewhere: GDACS flood events at their event point
  public/data/floods/index.json          sources, years and build date

Besides counts, regions carry what the sources record about harm and severity:
  US (NOAA)        deaths, injuries, property and crop damage (USD) per year
  world (GDACS)    serious floods (orange or red alert) per year, and the largest flood magnitude

Sources (all public):
  GDACS event list API, eventlist=FL (UN / European Commission JRC)       per-country counts
  NOAA NCEI Storm Events Database, details files                          per-state and per-county counts
  Natural Earth 1:50m admin-0 countries (public domain)                   country outlines
  Natural Earth 1:10m admin-1 states and provinces (public domain)        subdivisions of every country
  US Census Bureau cartographic boundaries via us-atlas (counties-10m)    state and county outlines

Downloads are cached in .cache/floods so a rebuild only fetches what is missing.
"""
import csv
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'data', 'floods')
CACHE = os.path.join(ROOT, '.cache', 'floods')
UA = {'User-Agent': 'WaterMark flood-history build (hackathon prototype)'}

GDACS_YEARS = range(2001, 2026)
NOAA_YEARS = range(2016, 2026)
# NOAA event types that are floods. Coastal and lakeshore floods are often reported per forecast
# zone rather than per county, so they count toward the state but not always a county.
# Storm surge is NOAA's own event type, separate from Coastal Flood; a seiche is a surge on a large lake.
NOAA_FLOOD_TYPES = {'Flood', 'Flash Flood', 'Coastal Flood', 'Lakeshore Flood', 'Storm Surge/Tide', 'Seiche'}

NE_COUNTRIES = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson'
NE_ADMIN1 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson'
US_ATLAS = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json'
GDACS = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH'
NOAA_DIR = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'


def fetch(url, name=None, retries=4):
    """Bytes at url, cached on disk under name (no cache when name is None)."""
    path = os.path.join(CACHE, name) if name else None
    if path and os.path.exists(path):
        with open(path, 'rb') as f:
            return f.read()
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                data = r.read()
            break
        except Exception as e:  # noqa: BLE001 - retried, then raised
            if attempt == retries - 1:
                raise
            print(f'  retry {url}: {e}', file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)
    return data


# ---------- geometry helpers ----------

def simplify(pts, tol):
    """Douglas-Peucker line simplification (degrees). Keeps the first and last point."""
    if tol <= 0 or len(pts) < 5:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm if (dx or dy) else ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def round_ring(ring, nd, tol=0.0):
    out = []
    for x, y in simplify(ring, tol):
        p = [round(x, nd), round(y, nd)]
        if not out or out[-1] != p:
            out.append(p)
    if len(out) >= 3 and out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def round_geom(g, nd, tol=0.0):
    if g['type'] == 'Polygon':
        rings = [r for r in (round_ring(r, nd, tol) for r in g['coordinates']) if r]
        return {'type': 'Polygon', 'coordinates': rings} if rings else None
    if g['type'] == 'MultiPolygon':
        polys = []
        for poly in g['coordinates']:
            rings = [r for r in (round_ring(r, nd, tol) for r in poly) if r]
            if rings:
                polys.append(rings)
        return {'type': 'MultiPolygon', 'coordinates': polys} if polys else None
    return None


def ring_area(r):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(r, r[1:]))) / 2


def bbox(g):
    """Bounds to fly to. A shape split by the antimeridian (Russia, Alaska, Fiji) would span the
    whole world, so then only its largest piece counts."""
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]

    def box(ps):
        xs = [x for poly in ps for x, _ in poly[0]]
        ys = [y for poly in ps for _, y in poly[0]]
        return [round(min(xs), 3), round(min(ys), 3), round(max(xs), 3), round(max(ys), 3)]

    if len(polys) == 1:
        return box(polys)
    main = max(polys, key=lambda poly: ring_area(poly[0]))
    mb = box([main])
    pad = max(2.0, 0.5 * max(mb[2] - mb[0], mb[3] - mb[1]))
    near = [poly for poly in polys if bboxes_touch(box([poly]), mb, pad)]
    b = box(near)
    return b if b[2] - b[0] <= 180 else mb


def bboxes_touch(a, b, pad):
    return a[0] <= b[2] + pad and a[2] >= b[0] - pad and a[1] <= b[3] + pad and a[3] >= b[1] - pad


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def point_in_geom(x, y, g):
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        if point_in_ring(x, y, poly[0]) and not any(point_in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


# Quantiles of the non-zero values where each class starts. Narrower toward the top, so the few
# places with by far the most floods stand apart instead of sharing a class with the median.
QUANTILES = (0.25, 0.5, 0.7, 0.85, 0.95)


def breaks(values):
    """Five class breaks over the non-zero values (zero is its own class)."""
    v = sorted(x for x in values if x > 0)
    if not v:
        return [0] * len(QUANTILES)
    return [float(f'{v[min(len(v) - 1, int(len(v) * q))]:.2g}') for q in QUANTILES]


def topo_features(topo, obj):
    """Decodes one object of a quantized TopoJSON file into GeoJSON features."""
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    arcs = []
    for arc in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append([x * sx + tx, y * sy + ty])
        arcs.append(pts)

    def ring(indexes):
        pts = []
        for i in indexes:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    feats = []
    for g in topo['objects'][obj]['geometries']:
        if g['type'] == 'Polygon':
            geom = {'type': 'Polygon', 'coordinates': [ring(r) for r in g['arcs']]}
        elif g['type'] == 'MultiPolygon':
            geom = {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['arcs']]}
        else:
            continue
        feats.append({'id': g.get('id'), 'name': (g.get('properties') or {}).get('name'), 'geometry': geom})
    return feats


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), ensure_ascii=False)
    print(f'  wrote {os.path.relpath(path, ROOT)} ({os.path.getsize(path) // 1024} kB)')


# ---------- GDACS: floods per country ----------

def gdacs_events():
    events = {}
    for y in GDACS_YEARS:
        page = 1
        while True:
            q = f'?eventlist=FL&fromdate={y}-01-01&todate={y}-12-31&alertlevel=red;orange;green&pagesize=100&pagenumber={page}'
            raw = fetch(GDACS + q, f'gdacs/{y}-{page}.json')
            try:
                feats = json.loads(raw).get('features') or []
            except ValueError:
                feats = []  # GDACS answers past the last page with an empty body
            for f in feats:
                p = f.get('properties') or {}
                start = str(p.get('fromdate', ''))[:4]
                if not start.isdigit() or int(start) != y:
                    continue
                isos = {c.get('iso3') for c in (p.get('affectedcountries') or []) if c.get('iso3')}
                if not isos and p.get('iso3'):
                    isos = {p['iso3']}
                coords = (f.get('geometry') or {}).get('coordinates') or [None, None]
                month = str(p.get('fromdate', ''))[5:7]
                level = str(p.get('alertlevel') or '').upper()
                mag = (p.get('severitydata') or {}).get('severity')
                day = str(p.get('fromdate', ''))[:10]
                events[p.get('eventid')] = (int(start), isos, coords[0], coords[1], int(month) if month.isdigit() else 0,
                                            level in ('ORANGE', 'RED'), float(mag) if isinstance(mag, (int, float)) else 0.0,
                                            day if len(day) == 10 else '')
            if len(feats) < 100:
                break
            page += 1
        print(f'  GDACS {y}: {sum(1 for v in events.values() if v[0] == y)} floods')
    return events


def build_countries():
    print('Countries (GDACS + Natural Earth)')
    events = gdacs_events()
    by_country = defaultdict(Counter)
    months = defaultdict(Counter)
    majors = defaultdict(Counter)
    top_mag = defaultdict(float)
    last = {}
    for year, isos, _x, _y, month, major, mag, day in events.values():
        for iso in isos:
            iso = iso.upper()
            by_country[iso][year] += 1
            if day > last.get(iso, ''):
                last[iso] = day
            if major:
                majors[iso][year] += 1
            top_mag[iso] = max(top_mag[iso], mag)
            if month:
                months[iso][month] += 1
    ne = json.loads(fetch(NE_COUNTRIES, 'ne_50m_admin_0_countries.geojson'))
    years = list(GDACS_YEARS)
    feats = []
    for f in ne['features']:
        p = f['properties']
        iso = next((c for c in (p.get('ISO_A3_EH'), p.get('ISO_A3'), p.get('ADM0_A3')) if c and c != '-99'), None)
        # About 3 km of tolerance: invisible at the world and country zooms these colors show at.
        geom = round_geom(f['geometry'], 2, 0.03)
        if not iso or not geom:
            continue
        counts = by_country.get(iso, Counter())
        total = sum(counts[y] for y in years)
        feats.append({'type': 'Feature', 'properties': {
            'k': iso, 'n': p.get('NAME_EN') or p.get('NAME'), 'e': total, 'py': round(total / len(years), 2),
            'y': [counts[y] for y in years], 'b': bbox(geom),
            'm': [months[iso][m] for m in range(1, 13)],
            'x': [majors[iso][y] for y in years], 'g': round(top_mag[iso], 1),
            **({'l': last[iso]} if iso in last else {}),
        }, 'geometry': geom})
    write(os.path.join(OUT, 'countries.json'), {'type': 'FeatureCollection', 'features': feats})
    adm0_to_key = {}
    for f in ne['features']:
        p = f['properties']
        iso = next((c for c in (p.get('ISO_A3_EH'), p.get('ISO_A3'), p.get('ADM0_A3')) if c and c != '-99'), None)
        if iso:
            adm0_to_key[p.get('ADM0_A3')] = iso
    admin1_breaks = build_admin1(events, adm0_to_key, {f['properties']['k']: f['properties']['n'] for f in feats})
    pts = [(x, y, year, 1 if major else 0, mag, eid, None) for eid, (year, isos, x, y, month, major, mag, _day) in events.items()
           if x is not None and y is not None and not ({i.upper() for i in isos} <= {'USA'} and isos)]
    world_cells = build_cells(pts, WORLD_CELL, 'cells-world.json', years, us=False)  # (all years, one year)
    return len(events), breaks([f['properties']['py'] for f in feats]), admin1_breaks, world_cells


def build_admin1(events, adm0_to_key, country_names):
    """Every country's first-level subdivisions, each with the GDACS floods whose event point falls in it."""
    print('Provinces and regions worldwide (Natural Earth admin-1 + GDACS event points)')
    ne = json.loads(fetch(NE_ADMIN1, 'ne_10m_admin_1_states_provinces.geojson'))
    years = list(GDACS_YEARS)
    by_country = defaultdict(list)
    for f in ne['features']:
        p = f['properties']
        key = adm0_to_key.get(p.get('adm0_a3'), p.get('adm0_a3'))
        if not key or key == 'USA':  # the US uses NOAA states and counties instead
            continue
        geom = round_geom(f['geometry'], 3, 0.01)
        if not geom:
            continue
        by_country[key].append({'p': p, 'g': geom, 'b': bbox(geom), 'y': Counter(), 'm': Counter(), 'x': Counter(), 'mag': 0.0, 'l': ''})
    placed = missed = 0
    for year, isos, x, y, month, major, mag, day in events.values():
        if x is None or y is None:
            continue
        for iso in isos:
            areas = by_country.get(iso.upper())
            if not areas:
                continue
            hit = next((a for a in areas if a['b'][0] <= x <= a['b'][2] and a['b'][1] <= y <= a['b'][3]
                        and point_in_geom(x, y, a['g'])), None)
            if hit is None:
                # GDACS puts one point per event, sometimes just offshore: use the nearest subdivision.
                hit = min(areas, key=lambda a: ((a['b'][0] + a['b'][2]) / 2 - x) ** 2 + ((a['b'][1] + a['b'][3]) / 2 - y) ** 2)
                missed += 1
            hit['y'][year] += 1
            if major:
                hit['x'][year] += 1
            hit['mag'] = max(hit['mag'], mag)
            hit['l'] = max(hit['l'], day)
            if month:
                hit['m'][month] += 1
            placed += 1
    print(f'  placed {placed} country-event points ({missed} by nearest subdivision)')
    all_py = []
    for key, areas in by_country.items():
        feats = []
        for i, a in enumerate(areas):
            p = a['p']
            total = sum(a['y'][y] for y in years)
            py = round(total / len(years), 2)
            all_py.append(py)
            feats.append({'type': 'Feature', 'properties': {
                'k': p.get('iso_3166_2') or p.get('adm1_code') or f'{key}-{i}',
                'n': p.get('name_en') or p.get('name') or p.get('gn_name') or 'Unnamed area',
                's': country_names.get(key, ''), 't': p.get('type_en') or '',
                'e': total, 'py': py, 'y': [a['y'][y] for y in years], 'm': [a['m'][m] for m in range(1, 13)], 'b': a['b'],
                'x': [a['x'][y] for y in years], 'g': round(a['mag'], 1),
                **({'l': a['l']} if a['l'] else {}),
            }, 'geometry': a['g']})
        write(os.path.join(OUT, 'admin1', f'{key}.json'), {'type': 'FeatureCollection', 'features': feats})
    return breaks(all_py)


# ---------- NOAA: flood episodes per US state and county ----------
#
# NOAA files one row per event: each county or zone a storm flooded, and often several flash-flood
# reports in one county. Counting rows counts the same storm many times (Missouri 2016-2025: 3,486
# rows from 582 episodes). So a flood here is an EPISODE_ID, NOAA's id for one weather system's
# flooding: counted once in a state, once in each county it touched, once in each grid square.
# Deaths, injuries and damage are recorded per row, without repeats, so they are summed over rows.

# What caused a flood, from NOAA's event type and its FLOOD_CAUSE field.
CAUSES = [
    ('rain', 'Flash floods from heavy rain'),
    ('river', 'Rivers and slow-rising water'),
    ('tropical', 'Tropical storms and hurricanes'),
    ('snowmelt', 'Rain with snowmelt'),
    ('burn', 'Rain on wildfire burn scars'),
    ('ice', 'Ice jams'),
    ('dam', 'Dams and levees'),
    ('sea', 'The sea: storm surge and high tides'),
    ('lake', 'Lakes: Great Lakes and large lakes'),
]
CAUSE_INDEX = {k: i for i, (k, _) in enumerate(CAUSES)}


def cause_of(row):
    kind, cause = row.get('EVENT_TYPE'), row.get('FLOOD_CAUSE') or ''
    if kind in ('Coastal Flood', 'Storm Surge/Tide'):
        return 'sea'
    if kind in ('Lakeshore Flood', 'Seiche'):
        return 'lake'
    for word, key in (('Tropical', 'tropical'), ('Snow Melt', 'snowmelt'), ('Burn', 'burn'), ('Ice Jam', 'ice'),
                      ('Dam', 'dam'), ('Levee', 'dam')):
        if word in cause:
            return key
    return 'rain' if kind == 'Flash Flood' else 'river'


def noaa_counts():
    listing = fetch(NOAA_DIR, None).decode('utf-8', 'replace')
    files = {}
    for m in re.finditer(r'(StormEvents_details-ftp_v1\.0_d(\d{4})_c\d+\.csv\.gz)', listing):
        files[int(m.group(2))] = m.group(1)
    states, counties = defaultdict(Counter), defaultdict(Counter)
    state_months = defaultdict(Counter)  # state and county key -> month -> episodes
    last = {}  # state and county key -> latest episode start, YYYY-MM-DD
    harm = defaultdict(lambda: {'d': Counter(), 'i': Counter(), '$': Counter()})
    causes = defaultdict(lambda: defaultdict(set))  # region key -> cause -> episodes
    seen = set()  # (region key, episode): each episode counts once per state and per county
    points = []
    for y in NOAA_YEARS:
        name = files[y]
        raw = gzip.decompress(fetch(NOAA_DIR + name, f'noaa/{name}'))
        n = 0
        for row in csv.DictReader(io.StringIO(raw.decode('latin-1'))):
            if row.get('EVENT_TYPE') not in NOAA_FLOOD_TYPES:
                continue
            st = (row.get('STATE_FIPS') or '').zfill(2)
            if not st.strip('0'):
                continue
            ep = row.get('EPISODE_ID') or f"event-{row.get('EVENT_ID')}"
            cause = cause_of(row)
            county = st + row['CZ_FIPS'].zfill(3) if row.get('CZ_TYPE') == 'C' and row.get('CZ_FIPS') else None
            ym, dd = row.get('BEGIN_YEARMONTH') or '', (row.get('BEGIN_DAY') or '').zfill(2)
            month = int(ym[4:]) if len(ym) == 6 and ym[4:].isdigit() else 0
            day = f'{ym[:4]}-{ym[4:]}-{dd}' if month and dd.isdigit() else ''
            for key in [st] + ([county] if county else []):
                causes[key][cause].add(ep)
                if day > last.get(key, ''):
                    last[key] = day
                if (key, ep) not in seen:
                    seen.add((key, ep))
                    (states if key == st else counties)[key][y] += 1
                    if month:
                        state_months[key][month] += 1
            dead = num(row.get('DEATHS_DIRECT')) + num(row.get('DEATHS_INDIRECT'))
            hurt = num(row.get('INJURIES_DIRECT')) + num(row.get('INJURIES_INDIRECT'))
            usd = damage_usd(row.get('DAMAGE_PROPERTY')) + damage_usd(row.get('DAMAGE_CROPS'))
            keys = [st] + ([st + row['CZ_FIPS'].zfill(3)] if row.get('CZ_TYPE') == 'C' and row.get('CZ_FIPS') else [])
            for key in keys:
                harm[key]['d'][y] += dead
                harm[key]['i'][y] += hurt
                harm[key]['$'][y] += usd
            lat, lon = num(row.get('BEGIN_LAT'), None), num(row.get('BEGIN_LON'), None)
            if lat is not None and lon is not None and -90 < lat < 90 and -180 < lon < 180 and (lat or lon):
                points.append((lon, lat, y, dead, usd, ep, cause))
            n += 1
        print(f'  NOAA {y}: {n} flood rows')
    print(f'  NOAA: {sum(sum(c.values()) for c in states.values())} state flood episodes')
    return states, counties, state_months, harm, points, causes, last


def num(v, default=0):
    try:
        return float(v) if v not in (None, '') else default
    except ValueError:
        return default


def damage_usd(v):
    """NOAA damage text such as '10.00K', '1.5M' or '2B' in dollars."""
    v = (v or '').strip().upper()
    if not v:
        return 0
    mult = {'K': 1e3, 'M': 1e6, 'B': 1e9}.get(v[-1], 1)
    return num(v[:-1] if v[-1] in 'KMB' else v) * mult


def build_us():
    print('US states and counties (NOAA Storm Events + Census via us-atlas)')
    states, counties, state_months, harm, points, causes, last = noaa_counts()
    topo = json.loads(fetch(US_ATLAS, 'us-atlas-counties-10m.json'))
    years = list(NOAA_YEARS)

    def props(key, name, counts):
        total = sum(counts[y] for y in years)
        h = harm.get(key)
        out = {'k': key, 'n': name, 'e': total, 'py': round(total / len(years), 2), 'y': [counts[y] for y in years]}
        if key in last:
            out['l'] = last[key]
        out['m'] = [state_months[key][m] for m in range(1, 13)]
        c = causes.get(key)
        if c:
            out['c'] = {k: len(c[k]) for k, _ in CAUSES if c.get(k)}
        if h:
            out['d'] = [int(h['d'][y]) for y in years]
            out['i'] = [int(h['i'][y]) for y in years]
            out['$'] = [int(round(h['$'][y])) for y in years]
        return out

    state_feats = []
    for f in topo_features(topo, 'states'):
        geom = round_geom(f['geometry'], 2, 0.01)
        if geom:
            p = props(f['id'], f['name'], states.get(f['id'], Counter()))
            p['b'] = bbox(geom)
            state_feats.append({'type': 'Feature', 'properties': p, 'geometry': geom})
    write(os.path.join(OUT, 'us-states.json'), {'type': 'FeatureCollection', 'features': state_feats})
    all_counties = []

    names = {f['id']: f['name'] for f in topo_features(topo, 'states')}
    per_state = defaultdict(list)
    for f in topo_features(topo, 'counties'):
        geom = round_geom(f['geometry'], 3)
        if not geom or not f['id']:
            continue
        p = props(f['id'], f['name'], counties.get(f['id'], Counter()))
        p['b'] = bbox(geom)
        p['s'] = names.get(f['id'][:2], '')
        per_state[f['id'][:2]].append({'type': 'Feature', 'properties': p, 'geometry': geom})
        all_counties.append(p['py'])
    for st, feats in per_state.items():
        write(os.path.join(OUT, 'counties', f'{st}.json'), {'type': 'FeatureCollection', 'features': feats})
    us_cells, us_year = build_cells(points, US_CELL, 'cells-us.json', years, us=True)
    return breaks([f['properties']['py'] for f in state_feats]), breaks(all_counties), (us_cells, us_year)


US_CELL = 0.5
WORLD_CELL = 1.0


def cell_of(x, y, size):
    return int((x + 180) // size), int((y + 90) // size)


def build_cells(points, size, name, years, us):
    """Squares of `size` degrees, each with the floods whose reported point falls in it, each flood
    (NOAA episode, GDACS event) counted once per square however many reports it has there.
    points: (lon, lat, year, deaths, usd, episode, cause) for the US;
            (lon, lat, year, major, magnitude, event, None) elsewhere."""
    cells = defaultdict(lambda: {'y': Counter(), 'a': 0.0, 'b': 0.0, 'seen': set(), 'c': defaultdict(set)})
    for x, y, year, a, b, key, cause in points:
        c = cells[cell_of(x, y, size)]
        if key not in c['seen']:
            c['seen'].add(key)
            c['y'][year] += 1
        if cause:
            c['c'][cause].add(key)
        c['a'] += a
        c['b'] = c['b'] + b if us else max(c['b'], b)
    # Compact rows; the browser rebuilds each square from its column and row (scripting/cells.ts):
    # [column, row, records, years with any, worst year, records that year, deaths | serious, USD | magnitude,
    #  [year offset, records, year offset, records, ...],   (the time slider: only years with records)
    #  [cause index, floods, cause index, floods, ...]]      (US only: CAUSES; a flood can have two)
    rows = []
    per_year = []
    for (i, j), c in sorted(cells.items()):
        worst = max(years, key=lambda yr: (c['y'][yr], yr))
        by_year = []
        for k, yr in enumerate(years):
            if c['y'][yr]:
                by_year += [k, c['y'][yr]]
                per_year.append(c['y'][yr])
        rows.append([i, j, sum(c['y'].values()), sum(1 for yr in years if c['y'][yr]), worst, c['y'][worst],
                     int(c['a']), int(round(c['b'])) if us else round(c['b'], 1), by_year,
                     [v for k, eps in sorted(c['c'].items(), key=lambda kv: CAUSE_INDEX[kv[0]])
                      for v in (CAUSE_INDEX[k], len(eps))]])
    write(os.path.join(OUT, name), {'size': size, 'years': [years[0], years[-1]], 'us': us, 'rows': rows})
    # One color scale for every single year, so years compare fairly on the slider.
    return breaks([r[2] for r in rows]), breaks(per_year)


def main():
    gdacs_n, country_breaks, admin1_breaks, world_cells = build_countries()
    state_breaks, county_breaks, us_cells = build_us()
    write(os.path.join(OUT, 'index.json'), {
        'builtAt': date.today().isoformat(),
        'countries': {'source': 'GDACS flood events (UN / European Commission JRC)', 'url': 'https://www.gdacs.org/',
                      'years': [GDACS_YEARS[0], GDACS_YEARS[-1]], 'events': gdacs_n, 'breaks': country_breaks,
                      'unit': 'flood events per year (GDACS lists floods large enough for international notice)'},
        'states': {'source': 'NOAA NCEI Storm Events Database', 'url': 'https://www.ncdc.noaa.gov/stormevents/',
                   'years': [NOAA_YEARS[0], NOAA_YEARS[-1]], 'types': sorted(NOAA_FLOOD_TYPES),
                   'breaks': state_breaks, 'countyBreaks': county_breaks,
                   'unit': 'flood episodes per year (NOAA: one weather system flooding the area, however many reports it has)',
                   'causes': [list(c) for c in CAUSES]},
        'admin1': {'source': 'GDACS flood events placed in Natural Earth provinces and regions', 'url': 'https://www.gdacs.org/',
                   'years': [GDACS_YEARS[0], GDACS_YEARS[-1]], 'breaks': admin1_breaks,
                   'unit': 'flood events per year whose GDACS event point falls in the area'},
        'cells': {'us': {'size': US_CELL, 'breaks': us_cells[0], 'yearBreaks': us_cells[1], 'years': [NOAA_YEARS[0], NOAA_YEARS[-1]],
                         'source': 'NOAA NCEI Storm Events Database', 'url': 'https://www.ncdc.noaa.gov/stormevents/',
                         'unit': 'flood episodes with a reported point in the square'},
                  'world': {'size': WORLD_CELL, 'breaks': world_cells[0], 'yearBreaks': world_cells[1], 'years': [GDACS_YEARS[0], GDACS_YEARS[-1]],
                            'source': 'GDACS flood events (UN / European Commission JRC)', 'url': 'https://www.gdacs.org/',
                            'unit': 'flood events whose GDACS event point is in the square'}},
        'outlines': 'Natural Earth 1:50m (public domain); US Census Bureau cartographic boundaries via us-atlas',
    })


if __name__ == '__main__':
    main()
