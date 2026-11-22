import { useEffect, useMemo, useRef, useState } from 'react'
import { CLAIM_CHECKS, CLAIM_LINKS, claimSheetText } from '../../../scripting/audiences/claimSheet'
import { fmtTime, fmtUsd } from '../../../scripting/format'
import { HIGH_RISK_ZONES, ZONE_TEXT } from '../../../scripting/mapTheme'
import { howOften } from '../../../scripting/cells'
import type { CellMeta } from '../../../services/floodHistory'
import type { AreaReport, Selection } from '../../../scripting/types'

const ready = <T,>(value: T | null | 'error' | 'unsupported'): value is T => value !== null && value !== 'error' && value !== 'unsupported'

export function HomeownerView({ selection, place, report, cellMeta }: {
  selection: Selection | null
  place: string
  report: AreaReport
  cellMeta?: CellMeta | null
}) {
  const [checked, setChecked] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([])
  const [photoNote, setPhotoNote] = useState<string | null>(null)
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos })
  useEffect(() => () => { photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)) }, [])

  const facts = useMemo(() => {
    const rows: { label: string; value: string }[] = []
    if (!selection) return rows
    rows.push({ label: 'Place', value: place })
    if (ready(report.elevation) && report.elevation != null) rows.push({ label: 'Ground height', value: `${Math.round(report.elevation)} m above sea level (Copernicus DEM GLO-90, about 90 m cells)` })
    else if (report.elevation === null) rows.push({ label: 'Ground height', value: 'Still loading' })
    else rows.push({ label: 'Ground height', value: 'Unknown. Unknown is not a low height.' })
    if (ready(report.zone)) {
      const code = report.zone.center?.FLD_ZONE
      if (code) {
        const meaning = ZONE_TEXT[code] ?? 'Mapped flood zone. Not a statement about this building today.'
        rows.push({ label: 'FEMA zone at this point', value: `${code}. ${meaning}` })
      } else rows.push({ label: 'FEMA zone at this point', value: 'No zone polygon at this point. That is not a finding of low risk.' })
      if (report.zone.inArea.length) rows.push({ label: 'Zones touching the selected area', value: report.zone.inArea.join(', ') })
    } else if (report.zone === 'unsupported') rows.push({ label: 'FEMA zone', value: 'The National Flood Hazard Layer covers the United States. It was not queried here.' })
    else if (report.zone === null) rows.push({ label: 'FEMA zone', value: 'Still loading' })
    else rows.push({ label: 'FEMA zone', value: 'Could not load. Unknown is not the same as outside a flood zone.' })
    if (ready(report.storm)) {
      rows.push({ label: 'NYC stormwater scenario', value: report.storm.none ? 'None of the selected area is in the moderate-flood scenario. A scenario is not an all-clear.' : `${report.storm.deep.toFixed(0)}% deep (1 ft or more), ${report.storm.nuisance.toFixed(0)}% nuisance (4 in to 1 ft). Moderate flood, current sea level. Not water today.` })
    }
    if (Array.isArray(report.alerts)) {
      const flood = report.alerts.filter((alert) => /flood|surge/i.test(alert.event))
      rows.push({ label: 'Active NWS flood alerts', value: flood.length ? flood.map((alert) => alert.event).join('; ') : 'None found at this point right now. That does not mean the property is safe.' })
    } else if (report.alerts === 'unsupported') rows.push({ label: 'Active NWS flood alerts', value: 'NWS alerts cover the United States. None were requested here.' })
    if (ready(report.claims) && report.claims !== 'none') {
      const claims = report.claims
      rows.push({ label: `NFIP claims in ZIP ${claims.zip}`, value: `${claims.claims.toLocaleString('en-US')} redacted claims${claims.partial ? ' (lower bound, the list was truncated)' : ''}, ${fmtUsd(claims.totalPaidUsd)} paid, ${claims.firstYear ?? 'unknown'}–${claims.lastYear ?? 'unknown'}. ZIP totals are not this building.` })
    } else if (report.claims === 'none') rows.push({ label: 'NFIP claims', value: 'No US ZIP at this point, so no claim total was requested.' })
    if (selection.cell && cellMeta) {
      const years = cellMeta.years[1] - cellMeta.years[0] + 1
      rows.push({ label: `Flood reports in the ${cellMeta.size}° square`, value: `${selection.cell.e.toLocaleString('en-US')} (${howOften(selection.cell.e, years)}), ${cellMeta.years[0]}–${cellMeta.years[1]}. The count is the whole square, not this address.` })
    }
    return rows
  }, [selection, place, report, cellMeta])

  const high = ready(report.zone) && report.zone.inArea.some((zone) => HIGH_RISK_ZONES.has(zone))
  const sheet = () => claimSheetText({
    place: place || 'Selected place',
    fetchedAt: fmtTime(new Date()),
    facts,
    checked,
    notes,
    photoNames: photos.map((photo) => photo.name),
  })
  const download = () => {
    const blob = new Blob([sheet()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'watermark-flood-notes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }
  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const next = [...photos]
    let skipped = 0
    for (const file of files) {
      if (next.length >= 6) { skipped++; continue }
      if (file.size > 8_000_000) { skipped++; continue }
      next.push({ name: file.name, url: URL.createObjectURL(file) })
    }
    setPhotos(next)
    setPhotoNote(skipped ? 'Some files were skipped. Up to 6 photos, 8 MB each. They stay in this browser.' : null)
  }

  if (!selection) {
    return (
      <section className="aud-block">
        <p className="aud-kicker">Homeowner</p>
        <h3 className="aud-title">Property flood record</h3>
        <p>Search for the address or click the building. The summary uses FEMA zones, NFIP claims for the ZIP, and the flood reports in the surrounding square. It does not say whether this house will flood.</p>
      </section>
    )
  }

  return (
    <section className="aud-block">
      <p className="aud-kicker">Homeowner</p>
      <h3 className="aud-title">{high ? 'A high-risk flood zone is mapped in this area' : 'Mapped flood record for this place'}</h3>
      <p className="map-meta">A zone or a past claim is not a forecast for this building. No record is not an all-clear.</p>
      <dl className="aud-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <div className="claim-sheet">
        <h4 className="aud-title">Claim documentation aid</h4>
        <p>Check off what you can record. Photos and notes stay on this device. This does not file a claim with NFIP or an insurer.</p>
        <ul className="aud-checks">
          {CLAIM_CHECKS.map((item) => (
            <li key={item.id}>
              <label>
                <input type="checkbox" checked={checked.includes(item.id)} onChange={() => setChecked((cur) => cur.includes(item.id) ? cur.filter((id) => id !== item.id) : [...cur, item.id])} />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <label className="aud-notes">
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="What happened, which rooms, who you called" />
        </label>
        <label className="aud-text-btn aud-file">
          Add photos
          <input type="file" accept="image/*" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = '' }} />
        </label>
        {photoNote ? <p className="map-meta">{photoNote}</p> : null}
        {photos.length ? (
          <ul className="aud-photos">
            {photos.map((photo) => (
              <li key={photo.url}>
                <img src={photo.url} alt="" />
                <span>{photo.name}</span>
                <button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhotos((cur) => cur.filter((item) => item.url !== photo.url)) }}>Remove</button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="aud-actions">
          <button type="button" className="aud-text-btn" onClick={() => window.print()}>Print summary</button>
          <button type="button" className="aud-text-btn" onClick={download}>Download text</button>
        </p>
        <ul className="aud-links">
          {CLAIM_LINKS.map((link) => (
            <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></li>
          ))}
        </ul>
      </div>
    </section>
  )
}
