import type { Area, Location } from "./contracts.ts";

export class InputError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("INVALID_INPUT", "Expected an object.");
  }
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new InputError("INVALID_INPUT", "Unexpected field.");
  }
}
function numeric(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InputError("INVALID_INPUT", `${name} must be a finite number.`);
  }
  return value;
}
export function location(value: unknown): Location {
  const v = object(value);
  keys(v, ["lat", "lon"]);
  const lat = numeric(v.lat, "lat"), lon = numeric(v.lon, "lon");
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new InputError("INVALID_COORDINATES", "Coordinates are outside WGS84 bounds.");
  }
  return { lat, lon };
}
export function area(value: unknown): Area {
  const v = object(value);
  if (Object.hasOwn(v, "geometry")) {
    throw new InputError(
      "GEOMETRY_CONTRACT_PENDING",
      "Polygon input awaits the agreed frontend contract. Use center and radiusMeters for this draft.",
    );
  }
  keys(v, ["center", "radiusMeters"]);
  const radiusMeters = numeric(v.radiusMeters, "radiusMeters");
  if (radiusMeters < 100 || radiusMeters > 10000) {
    throw new InputError("INVALID_RADIUS", "Radius must be between 100 and 10000 meters.");
  }
  return { center: location(v.center), radiusMeters };
}
export function query(url: URL, allowed: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (!allowed.includes(key) || Object.hasOwn(values, key)) {
      throw new InputError("INVALID_INPUT", "Unknown or duplicate parameter.");
    }
    values[key] = value;
  }
  return values;
}
export function queryLocation(values: Record<string, string>): Location {
  const parse = (v: string | undefined) =>
    v && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v) ? Number(v) : NaN;
  return location({ lat: parse(values.lat), lon: parse(values.lon) });
}
export async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new InputError("PAYLOAD_TOO_LARGE", "Payload exceeds size limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
