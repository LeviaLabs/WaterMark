# Verified backend data sources

Verified on November 21, 2026 using actual HTTP responses and the implemented
adapters. These are informational model/sensor/alert products, not safety guarantees.

| Source | Verified contract and interpretation |
| --- | --- |
| [NWS](https://www.weather.gov/documentation/services-web-api) | Active alerts point query, GeoJSON FeatureCollection, application User-Agent. Preserve original CAP severity, sent/effective/expiry and source update time. Include Actual flood/heavy-rain/excessive-rain event names, exclude expired/canceled/test alerts. Empty does not mean safe. Responses older than 15 minutes are marked stale by the prototype's explicitly chosen display policy. |
| [Open-Meteo Weather](https://open-meteo.com/en/docs) | Hourly precipitation in mm, GMT, three requested days. Preceding-hour sum includes rain/showers/snow. Preserve sampled grid coordinate separately from requested point. Only still-valid intervals are returned. No model issuance time is supplied by this response; it remains null. |
| [Open-Meteo / GloFAS](https://open-meteo.com/en/docs/flood-api) | Daily modeled river discharge, source `m³/s` normalized to `m3/s`, GMT, seven requested days. Approximately 5 km model coverage; nearest modeled river may differ from intended river. Not flood depth, coastal surge or street flooding. Issuance time is not fabricated. |
| [FloodNet sensor metadata](https://data.cityofnewyork.us/d/kb2e-tjy3) and [QC events](https://data.cityofnewyork.us/d/aq7i-eu5q) | Verified SoQL `within_circle`, sensor IDs/coordinates and bounded event query. Column definitions explicitly specify GMT event start/end; peak depth is inches and is multiplied by 25.4 for mm. Dataset describes QC events based on a series exceeding 10 mm. Reported peaks can be rounded and do not reconstruct that series. Historical only; publication can lag. |
| [NYC Stormwater Flood Maps](https://data.cityofnewyork.us/d/9i7c-xyvv) | Verified catalog metadata identifies an official GIS ZIP, not a SoQL feature table. Scenario polygon ingestion/querying is not implemented. NYC results return `insufficient_data`, and outside the NYC envelope `unsupported`; no invented exposure classification. |

Positive live checks: rainfall and NWS at a public Coney Island sensor location;
GloFAS at a Berlin river-model location; FloodNet at a public Rockaway sensor
location. Rockaway returned historical events with explicit truncation at 100.
A Coney Island query returned sensor metadata but no matching recent events:
the adapter correctly returned `insufficient_data` rather than zero hazard.

Open-Meteo's [current terms](https://open-meteo.com/en/terms) restrict its free
service to noncommercial use and publish minute/hour/day limits. Its data
require attribution under CC BY 4.0. The prototype uses the free public endpoints;
no paid plan or API key is assumed. The frontend must visibly credit Open-Meteo,
Copernicus/GloFAS, NWS, and NYC/FloodNet, including unit/time transformations.
Review provider terms and FloodNet's requested publication citation before
public release; this is not a legal-compliance assessment.

All adapters have bounded timeouts and decoded response sizes, reject redirects,
validate expected response shapes/units, and return structured failures without
retry storms. A 429 carries a bounded retry hint. Forecast samples containing
null remain null. Geographic source limitations remain part of every result.
