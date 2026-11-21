import type { AlertGeometry, OfficialAlert } from "./contracts.ts";
import { ProviderError, record, text, timestamp } from "./http.ts";

// NWS event names, not free-text hazard inference. Tropical products carry
// broader hazards and are displayed only as context, not evidence of flooding.
export const FLOOD_EVENTS = new Set([
  "Flash Flood Warning",
  "Flash Flood Watch",
  "Flash Flood Statement",
  "Flood Warning",
  "Flood Watch",
  "Flood Advisory",
  "Flood Statement",
  "Coastal Flood Warning",
  "Coastal Flood Watch",
  "Coastal Flood Advisory",
  "Coastal Flood Statement",
  "Lakeshore Flood Warning",
  "Lakeshore Flood Watch",
  "Lakeshore Flood Advisory",
  "Lakeshore Flood Statement",
  "Storm Surge Warning",
  "Storm Surge Watch",
  "Heavy Rain Warning",
  "Excessive Rainfall Warning",
]);
export const CONTEXT_EVENTS = new Set([
  "Hurricane Warning",
  "Hurricane Watch",
  "Tropical Storm Warning",
  "Tropical Storm Watch",
]);
export const optionalTime = (value: unknown): string | null =>
  value == null ? null : timestamp(value);
const optionalText = (value: unknown, max = 20000): string | null =>
  value == null ? null : text(value, max);

export function alertGeometry(value: unknown): AlertGeometry | null {
  if (value == null) return null;
  const geometry = record(value);
  let count = 0;
  const polygon = (coordinates: unknown): number[][][] => {
    if (!Array.isArray(coordinates) || !coordinates.length) {
      throw new ProviderError("INVALID_ALERT_GEOMETRY");
    }
    return coordinates.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new ProviderError("INVALID_ALERT_GEOMETRY");
      }
      const points = ring.map((point: unknown) => {
        if (
          !Array.isArray(point) || point.length !== 2 || ++count > 10000 ||
          typeof point[0] !== "number" || typeof point[1] !== "number" ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
          Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90
        ) throw new ProviderError("INVALID_ALERT_GEOMETRY");
        return [point[0], point[1]];
      });
      if (points[0][0] !== points.at(-1)?.[0] || points[0][1] !== points.at(-1)?.[1]) {
        throw new ProviderError("INVALID_ALERT_GEOMETRY");
      }
      return points;
    });
  };
  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: polygon(geometry.coordinates) };
  }
  if (
    geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length
  ) {
    return { type: "MultiPolygon", coordinates: geometry.coordinates.map(polygon) };
  }
  throw new ProviderError("INVALID_ALERT_GEOMETRY");
}

export function parseAlert(value: unknown, now: Date): OfficialAlert | null {
  const feature = record(value), p = record(feature.properties);
  const event = text(p.event, 200);
  if (!FLOOD_EVENTS.has(event) && !CONTEXT_EVENTS.has(event)) return null;
  if (!["Actual", "Exercise", "System", "Test", "Draft"].includes(text(p.status, 20))) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  if (
    p.status !== "Actual" || p.messageType === "Cancel" || p.messageType === "Ack" ||
    p.messageType === "Error"
  ) return null;
  if (p.messageType !== "Alert" && p.messageType !== "Update") {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  const sent = optionalTime(p.sent),
    effective = optionalTime(p.effective),
    expires = optionalTime(p.expires);
  const onset = optionalTime(p.onset), ends = optionalTime(p.ends);
  if (expires && Date.parse(expires) <= now.getTime()) return null;
  if (!["Extreme", "Severe", "Moderate", "Minor", "Unknown"].includes(text(p.severity, 20))) {
    throw new ProviderError("INVALID_PROVIDER_RESPONSE");
  }
  const qualityFlags: string[] = [], timingAssumptions: string[] = [];
  const messageStart = effective ?? sent;
  if (!effective && sent) timingAssumptions.push("MESSAGE_EFFECTIVE_DEFAULTS_TO_SENT_CAP_1_2");
  const messageValidity = messageStart && Date.parse(messageStart) > now.getTime()
    ? "upcoming"
    : messageStart && expires
    ? "in_force"
    : "unknown";
  const messageInForce = messageValidity === "in_force"
    ? true
    : messageValidity === "upcoming"
    ? false
    : null;
  const hazardStart = onset ?? messageStart, hazardEnd = ends ?? expires;
  if (!onset && hazardStart) {
    timingAssumptions.push("HAZARD_START_USES_MESSAGE_TIME_NOT_OBSERVATION");
  }
  if (!ends && expires) timingAssumptions.push("HAZARD_END_USES_MESSAGE_EXPIRY_NOT_CONFIRMED_END");
  let hazardTiming: OfficialAlert["hazardTiming"] = "unknown",
    hazardTimingReason = "missing_time_bounds";
  if (onset && ends && ends <= onset) {
    qualityFlags.push("INCONSISTENT_HAZARD_TIMES");
    hazardTimingReason = "inconsistent_bounds";
  } else if (ends && Date.parse(ends) <= now.getTime()) {
    hazardTiming = "ended";
    hazardTimingReason = "hazard_window_ended";
    qualityFlags.push("HAZARD_WINDOW_ENDED");
  } else if (hazardStart && Date.parse(hazardStart) > now.getTime()) {
    hazardTiming = "upcoming";
    hazardTimingReason = "future_hazard_start";
    if (!ends && expires && expires <= hazardStart) {
      timingAssumptions.push("MESSAGE_EXPIRES_BEFORE_HAZARD_START_END_UNKNOWN");
    }
  } else if (hazardStart && hazardEnd && messageInForce === true) {
    hazardTiming = "active";
    hazardTimingReason = "within_official_or_fallback_window";
  }
  if (!sent || !effective || !expires || !onset || !ends) {
    qualityFlags.push("ALERT_TIME_FIELDS_MISSING");
  }
  const sourceLanguage = optionalText(p.language, 60);
  if (sourceLanguage) {
    try {
      Intl.getCanonicalLocales(sourceLanguage);
    } catch {
      throw new ProviderError("INVALID_PROVIDER_RESPONSE");
    }
  } else qualityFlags.push("SOURCE_LANGUAGE_NOT_PROVIDED");
  let geometry: AlertGeometry | null = null;
  try {
    geometry = alertGeometry(feature.geometry);
  } catch {
    qualityFlags.push("ALERT_GEOMETRY_REJECTED");
  }
  const headline = optionalText(p.headline, 2000),
    description = optionalText(p.description),
    instruction = optionalText(p.instruction);
  if (headline === null || description === null || instruction === null) {
    qualityFlags.push("OPTIONAL_ALERT_TEXT_MISSING");
  }
  return {
    id: text(feature.id ?? p.id, 500),
    event,
    severity: text(p.severity, 20),
    urgency: text(p.urgency, 30),
    certainty: text(p.certainty, 30),
    sent,
    effective,
    expires,
    onset,
    ends,
    messageType: p.messageType,
    messageInForce,
    messageValidity,
    hazardTiming,
    hazardTimingReason,
    timingAssumptions,
    floodRelevance: FLOOD_EVENTS.has(event) ? "flood_hazard_notice" : "multi_hazard_context",
    sourceLanguage,
    geometry,
    qualityFlags,
    areaDescription: text(p.areaDesc, 5000),
    headline,
    description,
    instruction,
    severityBasis: "Original NWS CAP severity; expected hazard timing is not a flood observation",
  };
}

// Broad candidate regions only; /points confirms a supported NWS forecast
// point where possible. A failed secondary lookup cannot invalidate a successful
// point-filtered alert response. These are not political or flood boundaries.
export function nwsCandidate({ lat, lon }: { lat: number; lon: number }): boolean {
  return [
    [24, 50, -125, -66],
    [50, 72, -180, -129],
    [50, 55, 170, 180],
    [18, 23, -161, -154],
    [17, 20, -69, -64],
    [13, 21, 144, 147],
    [-15, -10, -174, -168],
  ]
    .some(([south, north, west, east]) =>
      lat >= south && lat <= north && lon >= west && lon <= east
    );
}
