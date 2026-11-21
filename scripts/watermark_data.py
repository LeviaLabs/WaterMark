"""
Watermark starter data pull: FloodNet street-flood events + FEMA flood insurance (NFIP) claims
for Coney Island, Rockaway and Red Hook.

Run:   python watermark_data.py
Needs: Python 3.8+ only (no pip installs). Internet access to data.cityofnewyork.us and fema.gov.
Output (in ./watermark_data/):
  floodnet_sensors.csv   every FloodNet sensor in the target ZIP codes
  floodnet_events.csv    every flood event those sensors recorded
  nfip_claims.csv        every NFIP flood insurance claim in the target ZIP codes
  summary.json           per-neighborhood stats, ready for the app to load
"""

import csv
import json
import os
import time
import urllib.parse
import urllib.request
from collections import defaultdict

# ZIP codes for each neighborhood. Edit to add areas.
NEIGHBORHOODS = {
    "Coney Island": ["11224"],
    "Red Hook": ["11231"],
    "Rockaway": ["11691", "11692", "11693", "11694", "11697"],
}
ZIP_TO_HOOD = {z: hood for hood, zips in NEIGHBORHOODS.items() for z in zips}
ALL_ZIPS = list(ZIP_TO_HOOD)

OUT = "watermark_data"
HEADERS = {"User-Agent": "Watermark-EvoHacks/1.0 (student hackathon project)"}

FLOODNET_SENSORS = "https://data.cityofnewyork.us/resource/kb2e-tjy3.json"
FLOODNET_EVENTS = "https://data.cityofnewyork.us/resource/aq7i-eu5q.json"
# v3 dropped the "Fima" prefix. v2 is frozen as of 06/01/2026 and being retired; used only as a fallback.
NFIP_ENDPOINTS = [
    "https://www.fema.gov/api/open/v3/NfipClaims",
    "https://www.fema.gov/api/open/v2/FimaNfipClaims",
]


def get_json(url, params):
    full = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            req = urllib.request.Request(full, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # network hiccup: retry twice, then give up
            if attempt == 2:
                raise RuntimeError(f"Request failed: {full}\n  {e}") from e
            time.sleep(2 * (attempt + 1))


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def write_csv(path, rows):
    if not rows:
        open(path, "w").close()
        return
    keys = sorted({k for r in rows for k in r})
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow({k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in r.items()})


# ---------- FloodNet ----------
def fetch_floodnet():
    zip_list = ",".join(f"'{z}'" for z in ALL_ZIPS)
    sensors = get_json(FLOODNET_SENSORS, {"$where": f"zipcode in({zip_list})", "$limit": 5000})
    print(f"FloodNet: {len(sensors)} sensors in target ZIPs")
    events = []
    ids = [s["sensor_id"] for s in sensors if s.get("sensor_id")]
    for i in range(0, len(ids), 50):  # chunk to keep URLs short
        chunk = ",".join(f"'{x}'" for x in ids[i:i + 50])
        offset = 0
        while True:
            page = get_json(FLOODNET_EVENTS, {
                "$where": f"sensor_id in({chunk})",
                # skip the bulky per-second depth profile columns
                "$select": "sensor_id,sensor_name,flood_start_time,flood_end_time,max_depth_inches,"
                           "duration_mins,duration_above_4_inches_mins,duration_above_12_inches_mins",
                "$order": "flood_start_time",
                "$limit": 5000, "$offset": offset,
            })
            events += page
            if len(page) < 5000:
                break
            offset += 5000
    print(f"FloodNet: {len(events)} flood events")
    return sensors, events


# ---------- NFIP claims ----------
def fetch_nfip():
    zfilter = " or ".join(f"reportedZipCode eq '{z}'" for z in ALL_ZIPS)
    last_err = None
    for url in NFIP_ENDPOINTS:
        try:
            rows, skip = [], 0
            while True:
                data = get_json(url, {"$filter": f"({zfilter})", "$top": 10000, "$skip": skip,
                                      "$format": "json"})
                key = next((k for k, v in data.items() if isinstance(v, list)), None)
                page = data.get(key, []) if key else []
                rows += page
                if len(page) < 10000:
                    break
                skip += 10000
            print(f"NFIP: {len(rows)} claims from {url}")
            if "v2" in url:
                print("  NOTE: v3 failed, used frozen v2 data (through 06/01/2026). Say so in the demo.")
            return rows, url
        except Exception as e:
            last_err = e
            print(f"NFIP: {url} failed, trying next. ({e})")
    raise RuntimeError(f"All NFIP endpoints failed: {last_err}")


# ---------- Summary for the app ----------
def summarize(sensors, events, claims, nfip_source):
    sensor_hood = {s["sensor_id"]: ZIP_TO_HOOD.get(s.get("zipcode"), "Other") for s in sensors}
    s = {h: {"zip_codes": z,
             "floodnet": {"sensors": 0, "events": 0, "events_over_4in": 0, "max_depth_inches": 0.0,
                          "events_by_year": defaultdict(int)},
             "nfip": {"claims": 0, "total_paid_usd": 0.0, "claims_by_year": defaultdict(int),
                      "paid_by_year_usd": defaultdict(float), "top_events": defaultdict(int)}}
         for h, z in NEIGHBORHOODS.items()}

    for x in sensors:
        h = sensor_hood[x["sensor_id"]]
        if h in s:
            s[h]["floodnet"]["sensors"] += 1
    for e in events:
        h = sensor_hood.get(e.get("sensor_id"))
        if h not in s:
            continue
        f = s[h]["floodnet"]
        d = num(e.get("max_depth_inches"))
        f["events"] += 1
        f["events_over_4in"] += d >= 4
        f["max_depth_inches"] = max(f["max_depth_inches"], d)
        f["events_by_year"][(e.get("flood_start_time") or "")[:4] or "unknown"] += 1
    for c in claims:
        h = ZIP_TO_HOOD.get(str(c.get("reportedZipCode", "")).zfill(5))
        if h not in s:
            continue
        n = s[h]["nfip"]
        paid = (num(c.get("amountPaidOnBuildingClaim")) + num(c.get("amountPaidOnContentsClaim"))
                + num(c.get("amountPaidOnIncreasedCostOfComplianceClaim")))
        yr = str(c.get("yearOfLoss") or (c.get("dateOfLoss") or "")[:4] or "unknown")
        n["claims"] += 1
        n["total_paid_usd"] += paid
        n["claims_by_year"][yr] += 1
        n["paid_by_year_usd"][yr] += paid
        if c.get("floodEvent"):
            n["top_events"][c["floodEvent"]] += 1

    for h in s.values():  # make JSON-friendly and round
        f, n = h["floodnet"], h["nfip"]
        f["events_by_year"] = dict(sorted(f["events_by_year"].items()))
        n["claims_by_year"] = dict(sorted(n["claims_by_year"].items()))
        n["paid_by_year_usd"] = {k: round(v) for k, v in sorted(n["paid_by_year_usd"].items())}
        n["total_paid_usd"] = round(n["total_paid_usd"])
        n["top_events"] = dict(sorted(n["top_events"].items(), key=lambda kv: -kv[1])[:5])

    return {"generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "sources": {"floodnet_sensors": FLOODNET_SENSORS, "floodnet_events": FLOODNET_EVENTS,
                        "nfip_claims": nfip_source},
            "notes": ["FloodNet sensors were installed starting 2020; event counts depend on when each "
                      "sensor went in, so compare years with care.",
                      "NFIP claims only cover insured properties. Few claims can mean low insurance, "
                      "not low flooding."],
            "neighborhoods": s}


def main():
    os.makedirs(OUT, exist_ok=True)
    sensors, events = fetch_floodnet()
    claims, nfip_source = fetch_nfip()
    write_csv(f"{OUT}/floodnet_sensors.csv", sensors)
    write_csv(f"{OUT}/floodnet_events.csv", events)
    write_csv(f"{OUT}/nfip_claims.csv", claims)
    summary = summarize(sensors, events, claims, nfip_source)
    with open(f"{OUT}/summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nSaved to ./{OUT}/")
    for hood, v in summary["neighborhoods"].items():
        print(f"  {hood}: {v['floodnet']['sensors']} sensors, {v['floodnet']['events']} street floods "
              f"(max {v['floodnet']['max_depth_inches']:.1f} in) | {v['nfip']['claims']} NFIP claims, "
              f"${v['nfip']['total_paid_usd']:,} paid")


if __name__ == "__main__":
    main()
