export type Status = "available" | "stale" | "insufficient_data" | "unsupported" | "error";
export interface Location {
  lat: number;
  lon: number;
}
export type ApiResponse<T> =
  & { apiVersion: "1.0"; generatedAt: string }
  & (
    { data: T } | { error: { code: string; message: string } }
  );
export interface Area {
  center: Location;
  radiusMeters: number;
}
export interface Source {
  id: string;
  name: string;
  url: string;
  geographicCoverage: string;
}
export interface PointGeometry {
  type: "Point";
  coordinates: [number, number];
}
export type AlertGeometry = { type: "Polygon"; coordinates: number[][][] } | {
  type: "MultiPolygon";
  coordinates: number[][][][];
};
export interface ProviderFailure {
  stage: "nws_point_lookup" | "floodnet_stations" | "floodnet_events";
  code: string;
  httpStatus?: number;
  retryAfterSeconds?: number;
}
export interface EnvironmentalResult<T = unknown> {
  status: Status;
  kind: string;
  source: Source;
  location: Location;
  coverage: { method: string; sampledLocation?: Location; resolution?: string };
  observedAt: string | null;
  forecastIssuedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  sourceLanguage: string | null;
  cacheNewestFetchedAt?: string | null;
  cacheOldestFetchedAt?: string | null;
  diagnostics?: {
    rejectedAlertRecords?: number;
    excludedAlertRecords?: number;
    rejectedStationRecords?: number;
    rejectedEventRecords?: number;
    recordErrors?: { stage: "stations" | "events"; code: string; count: number }[];
    failures?: ProviderFailure[];
  };
  units: string | null;
  data: T | null;
  qualityFlags: string[];
  limitations: string[];
  error?: { code: string; message: string; retryAfterSeconds?: number };
}
export interface Sample {
  validFrom: string;
  validTo: string;
  value: number | null;
}
export interface ForecastData {
  samples: Sample[];
  model: string;
}
export interface OfficialAlert {
  sourceLanguage: string | null;
  id: string;
  event: string;
  severity: string;
  urgency: string;
  certainty: string;
  sent: string | null;
  effective: string | null;
  expires: string | null;
  onset: string | null;
  ends: string | null;
  messageType: "Alert" | "Update";
  messageInForce: boolean | null;
  messageValidity: "in_force" | "upcoming" | "expired" | "unknown";
  hazardTiming: "upcoming" | "active" | "ended" | "unknown";
  hazardTimingReason: string;
  timingAssumptions: string[];
  floodRelevance: "flood_hazard_notice" | "multi_hazard_context";
  geometry: AlertGeometry | null;
  qualityFlags: string[];
  areaDescription: string;
  headline: string | null;
  description: string | null;
  instruction: string | null;
  severityBasis: string;
}
export interface Station {
  id: string;
  name: string;
  location: Location;
  geometry: PointGeometry;
}
export interface FloodEvent {
  stationId: string;
  startedAt: string;
  endedAt: string | null;
  maxDepthMm: number;
  classification: { label: string; basis: string; thresholdMm: number };
}
export interface FloodNetData {
  stations: Station[];
  events: FloodEvent[];
  queryEvidence?: {
    eventSearchCompleted: boolean;
    zeroEventMatchesVerified: boolean;
    windowStart: string | null;
    windowEnd: string;
  };
}
export interface LocationSummary {
  location: Location;
  rainfall: EnvironmentalResult<ForecastData>;
  riverDischarge: EnvironmentalResult<ForecastData>;
  officialAlerts: EnvironmentalResult<OfficialAlert[]>;
  historicalFloods: EnvironmentalResult<FloodNetData>;
  modeledExposure: EnvironmentalResult;
}
export interface ProviderStatus {
  source_id: string;
  status: string;
  checked_at: string | null;
  error_code: string | null;
  scope?: "last_successful_contact";
  globalAvailability?: "unknown";
}
export interface HistoricalMeasurement {
  source_id: string;
  source_name: string;
  source_url: string;
  station_id: string;
  observed_at: string;
  fetched_at: string;
  metric: string;
  value: number;
  units: string;
  quality_flags: string[];
  stale: boolean;
}
export interface BackendStore {
  takeBudget(): Promise<boolean>;
  providerStatus(): Promise<ProviderStatus[]>;
  recordStatus(result: EnvironmentalResult): Promise<void>;
  cacheFloodNet(data: FloodNetData): Promise<void>;
  area(area: Area): Promise<unknown>;
  history(location: Location): Promise<unknown>;
  eventHistory(location: Location): Promise<unknown>;
}
