// Which official alerts count as happening now.
//
// A record that already carries watermark-v1's hazardTiming, messageValidity and
// floodRelevance is classified from those fields. The map still reads NWS CAP
// directly, so the same distinctions are derived from status, messageType and the
// alert clock when the backend fields are absent. Upcoming, ended, expired and
// unknown timing are never counted as an active flood.

import type { WeatherAlert } from './types'

export const HAZARD_TIMINGS = ['upcoming', 'active', 'ended', 'unknown'] as const
export type HazardTiming = (typeof HAZARD_TIMINGS)[number]
export const MESSAGE_VALIDITIES = ['in_force', 'upcoming', 'expired', 'unknown'] as const
export type MessageValidity = (typeof MESSAGE_VALIDITIES)[number]
export const FLOOD_RELEVANCE = ['flood_hazard_notice', 'multi_hazard_context'] as const
export type FloodRelevance = (typeof FLOOD_RELEVANCE)[number]

/** NWS event names that are flood or coastal-flood products. Hurricane products are not in this set. */
export const FLOOD_EVENTS = new Set([
  'Flash Flood Warning',
  'Flash Flood Watch',
  'Flash Flood Statement',
  'Flood Warning',
  'Flood Watch',
  'Flood Advisory',
  'Flood Statement',
  'Coastal Flood Warning',
  'Coastal Flood Watch',
  'Coastal Flood Advisory',
  'Coastal Flood Statement',
  'Lakeshore Flood Warning',
  'Lakeshore Flood Watch',
  'Lakeshore Flood Advisory',
  'Lakeshore Flood Statement',
  'Storm Surge Warning',
  'Storm Surge Watch',
  'Heavy Rain Warning',
  'Excessive Rainfall Warning',
])

const TIMING = new Set<string>(HAZARD_TIMINGS)
const VALIDITY = new Set<string>(MESSAGE_VALIDITIES)
const RELEVANCE = new Set<string>(FLOOD_RELEVANCE)

function oneOf<T extends string>(value: unknown, allowed: ReadonlySet<string>): T | null {
  return typeof value === 'string' && allowed.has(value) ? value as T : null
}

function text(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Pulls the fields the panel needs out of an NWS feature's properties, or a watermark-v1 alert. */
export function readWeatherAlert(properties: unknown): WeatherAlert | null {
  if (!properties || typeof properties !== 'object') return null
  const record = properties as Record<string, unknown>
  if (typeof record.event !== 'string' || record.event.length === 0) return null
  const hazardTiming = oneOf<HazardTiming>(record.hazardTiming, TIMING)
  const messageValidity = oneOf<MessageValidity>(record.messageValidity, VALIDITY)
  const floodRelevance = oneOf<FloodRelevance>(record.floodRelevance, RELEVANCE)
  const alert: WeatherAlert = {
    event: record.event,
    headline: text(record, 'headline'),
    instruction: text(record, 'instruction'),
    severity: text(record, 'severity'),
    status: text(record, 'status'),
    messageType: text(record, 'messageType'),
    onset: text(record, 'onset'),
    effective: text(record, 'effective'),
    ends: text(record, 'ends'),
    expires: text(record, 'expires'),
  }
  if (hazardTiming && messageValidity && floodRelevance) {
    alert.hazardTiming = hazardTiming
    alert.messageValidity = messageValidity
    alert.floodRelevance = floodRelevance
  }
  return alert
}

function timeMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Flood products, plus names that say flood, hydrologic, surge or excessive rain. Other events stay context. */
export function floodRelevanceOf(event: string): FloodRelevance {
  if (FLOOD_EVENTS.has(event)) return 'flood_hazard_notice'
  if (/flood|hydrologic|storm surge|heavy rain|excessive rainfall/i.test(event)) return 'flood_hazard_notice'
  return 'multi_hazard_context'
}

export interface ClassifiedAlert {
  alert: WeatherAlert
  hazardTiming: HazardTiming
  messageValidity: MessageValidity
  floodRelevance: FloodRelevance
  /** Kept in the list. Test, Cancel, expired and ended messages are dropped. */
  shown: boolean
  /** Counts as happening now. Upcoming, ended, expired and unknown do not. */
  active: boolean
}

function hidden(alert: WeatherAlert, floodRelevance: FloodRelevance, hazardTiming: HazardTiming = 'unknown', messageValidity: MessageValidity = 'unknown'): ClassifiedAlert {
  return { alert, hazardTiming, messageValidity, floodRelevance, shown: false, active: false }
}

export function classifyAlert(alert: WeatherAlert, now = new Date()): ClassifiedAlert {
  if (alert.hazardTiming && alert.messageValidity && alert.floodRelevance) {
    const shown = alert.messageValidity !== 'expired' && alert.hazardTiming !== 'ended'
    const active = shown && alert.hazardTiming === 'active' && alert.messageValidity === 'in_force'
    return {
      alert,
      hazardTiming: alert.hazardTiming,
      messageValidity: alert.messageValidity,
      floodRelevance: alert.floodRelevance,
      shown,
      active,
    }
  }

  const floodRelevance = floodRelevanceOf(alert.event)
  const status = alert.status ?? null
  const messageType = alert.messageType ?? null
  if ((status !== null && status !== 'Actual') || messageType === 'Cancel' || messageType === 'Ack' || messageType === 'Error') {
    return hidden(alert, floodRelevance)
  }

  const nowMs = now.getTime()
  const onset = timeMs(alert.onset)
  const effective = timeMs(alert.effective)
  const ends = timeMs(alert.ends)
  const expires = timeMs(alert.expires)

  if (expires !== null && expires <= nowMs) {
    const hazardTiming: HazardTiming = ends !== null && ends <= nowMs ? 'ended' : 'unknown'
    return hidden(alert, floodRelevance, hazardTiming, 'expired')
  }
  if (ends !== null && ends <= nowMs) {
    return hidden(alert, floodRelevance, 'ended', 'in_force')
  }
  if ((onset !== null && onset > nowMs) || (effective !== null && effective > nowMs)) {
    return { alert, hazardTiming: 'upcoming', messageValidity: 'upcoming', floodRelevance, shown: true, active: false }
  }

  // Untimed Actual messages stay visible. Hiding them would drop a warning whose clock failed to parse.
  // A future onset or effective time is already classified as upcoming above.
  const started = (onset !== null && onset <= nowMs) || (effective !== null && effective <= nowMs)
  const openUntilExpiry = expires !== null && expires > nowMs
  if (started || openUntilExpiry || (onset === null && effective === null && ends === null && expires === null)) {
    return { alert, hazardTiming: 'active', messageValidity: 'in_force', floodRelevance, shown: true, active: true }
  }
  return { alert, hazardTiming: 'unknown', messageValidity: 'unknown', floodRelevance, shown: true, active: false }
}

export function classifyAlerts(alerts: readonly WeatherAlert[], now = new Date()): ClassifiedAlert[] {
  return alerts.map((alert) => classifyAlert(alert, now))
}

export function shownAlerts(alerts: readonly WeatherAlert[], now = new Date()): ClassifiedAlert[] {
  return classifyAlerts(alerts, now).filter((row) => row.shown)
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

export interface AlertHeadline {
  activeFlood: number
  activeOther: number
  upcomingFlood: number
  upcomingOther: number
  /** Joined count, e.g. "1 active flood alert · 1 other alert". Null when nothing is shown. */
  text: string | null
  hasActiveFlood: boolean
}

export function alertHeadline(alerts: readonly WeatherAlert[], now = new Date()): AlertHeadline {
  const rows = shownAlerts(alerts, now)
  const activeFlood = rows.filter((row) => row.active && row.floodRelevance === 'flood_hazard_notice').length
  const activeOther = rows.filter((row) => row.active && row.floodRelevance !== 'flood_hazard_notice').length
  const upcomingFlood = rows.filter((row) => !row.active && row.hazardTiming === 'upcoming' && row.floodRelevance === 'flood_hazard_notice').length
  const upcomingOther = rows.filter((row) => !row.active && row.hazardTiming === 'upcoming' && row.floodRelevance !== 'flood_hazard_notice').length
  const unknownFlood = rows.filter((row) => !row.active && row.hazardTiming !== 'upcoming' && row.floodRelevance === 'flood_hazard_notice').length
  const unknownOther = rows.filter((row) => !row.active && row.hazardTiming !== 'upcoming' && row.floodRelevance !== 'flood_hazard_notice').length
  const parts: string[] = []
  if (activeFlood) parts.push(countLabel(activeFlood, 'active flood alert'))
  if (activeOther) parts.push(countLabel(activeOther, 'other alert'))
  if (upcomingFlood) parts.push(countLabel(upcomingFlood, 'upcoming flood alert'))
  if (upcomingOther) parts.push(countLabel(upcomingOther, 'upcoming other alert'))
  if (unknownFlood) parts.push(countLabel(unknownFlood, 'flood alert with unknown timing'))
  if (unknownOther) parts.push(countLabel(unknownOther, 'other alert with unknown timing'))
  return {
    activeFlood,
    activeOther,
    upcomingFlood,
    upcomingOther,
    text: parts.length ? parts.join(' · ') : null,
    hasActiveFlood: activeFlood > 0,
  }
}

/** Local clock label for an alert timestamp. Null when the source omitted it or it does not parse. */
export function alertTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
