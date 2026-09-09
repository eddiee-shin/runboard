'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Run = {
  id: string
  activity_date: string
  distance_km: number
  duration_sec: number
  pace_sec_per_km: number
  avg_heart_rate: number | null
  notes: string | null
  source_app_id: number | null
}

type ImportReport = {
  id: string
  source: 'garmin_csv' | 'garmin_link' | 'strava'
  label: string | null
  total_count: number
  imported_count: number
  duplicate_count: number
  skipped_count: number
  error_count: number
  details: { distance_km?: number; activity_date?: string } | null
  created_at: string
}

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDuration = (seconds: number) => {
  const h = Math.floor((seconds || 0) / 3600)
  const m = Math.floor(((seconds || 0) % 3600) / 60)
  const s = (seconds || 0) % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const parseDuration = (value: string) => {
  const parts = value.trim().split(':').map(Number)
  if (parts.some(value => !Number.isFinite(value) || value < 0)) return NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return NaN
}

const formatPace = (seconds: number) => {
  if (!seconds) return '--'
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}'${String(rounded % 60).padStart(2, '0')}"`
}

const sourceNames: Record<number, string> = { 1: 'Nike', 2: 'Garmin', 3: 'Strava', 4: 'Samsung', 5: 'adidas' }
const reportNames = { garmin_csv: 'Garmin CSV', garmin_link: 'Garmin Link', strava: 'Strava Sync' }

export default function RunsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [runs, setRuns] = useState<Run[]>([])
  const [reports, setReports] = useState<ImportReport[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Run | null>(null)
  const [form, setForm] = useState({ date: '', distance: '', duration: '', heartRate: '', notes: '' })

  const load = async () => {
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const collected: Run[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions')
        .select('id, activity_date, distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, notes, source_app_id')
        .eq('profile_id', user.id).eq('status', 'verified')
        .gte('activity_date', isoDate(start)).lte('activity_date', isoDate(end))
        .order('activity_date', { ascending: false }).order('id').range(offset, offset + 499)
      if (error) { setMessage('기록을 불러오지 못했습니다.'); break }
      collected.push(...((data || []) as Run[]))
      if (!data || data.length < 500) break
    }
    setRuns(collected)
    const { data: reportData, error: reportError } = await supabase.from('import_reports')
      .select('id, source, label, total_count, imported_count, duplicate_count, skipped_count, error_count, details, created_at')
      .eq('profile_id', user.id).order('created_at', { ascending: false }).limit(12)
    if (!reportError) setReports((reportData || []) as ImportReport[])
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const beginEdit = (run: Run) => {
    setEditing(run)
    setMessage('')
    setForm({
      date: run.activity_date,
      distance: Number(run.distance_km).toFixed(2),
      duration: formatDuration(run.duration_sec),
      heartRate: run.avg_heart_rate?.toString() || '',
      notes: run.notes || '',
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    const distance = Number(form.distance)
    const duration = parseDuration(form.duration)
    const heartRate = form.heartRate ? Number(form.heartRate) : null
    if (!form.date || !Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration)) {
      setMessage('날짜, 거리, 운동 시간을 확인해주세요.'); return
    }
    if (heartRate !== null && (!Number.isFinite(heartRate) || heartRate < 30 || heartRate > 250)) {
      setMessage('평균 심박수는 30~250 사이로 입력해주세요.'); return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('run_sessions').update({
      activity_date: form.date,
      distance_km: Number(distance.toFixed(2)),
      duration_sec: duration,
      pace_sec_per_km: duration > 0 ? Math.round(duration / distance) : 0,
      avg_heart_rate: heartRate,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editing.id).eq('profile_id', user.id)
    if (error) { setMessage('수정 내용을 저장하지 못했습니다.'); return }
    setEditing(null)
    await load()
    setMessage('기록을 수정했습니다.')
  }

  const deleteRun = async (run: Run) => {
    if (!confirm(`${run.activity_date} ${Number(run.distance_km).toFixed(2)}km 기록을 삭제할까요?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('run_sessions').delete().eq('id', run.id).eq('profile_id', user.id)
    if (error) setMessage('기록을 삭제하지 못했습니다.')
    else { await load(); setMessage('기록을 삭제했습니다.') }
  }

  const totalDistance = runs.reduce((sum, run) => sum + Number(run.distance_km || 0), 0)
  const totalDuration = runs.reduce((sum, run) => sum + Number(run.duration_sec || 0), 0)
  const currentMonth = new Date()
  const isCurrentMonth = month.getFullYear() === currentMonth.getFullYear() && month.getMonth() === currentMonth.getMonth()

  return <div className="content active">
    <div className="period-nav">
      <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">&larr;</button>
      <strong>{month.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</strong>
      <button disabled={isCurrentMonth} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">&rarr;</button>
    </div>

    <div className="stats-grid compact-stats">
      <div className="stat-card main"><div className="stat-label">Monthly Distance</div><div className="stat-number">{totalDistance.toFixed(1)} <span className="stat-unit">km</span></div></div>
      <div className="stat-card"><div className="stat-label">Runs</div><div className="stat-number">{runs.length}</div></div>
      <div className="stat-card"><div className="stat-label">Time</div><div className="stat-number small-number">{formatDuration(totalDuration)}</div></div>
    </div>

    {message && <p className="status-message" role="status">{message}</p>}

    <section className="chart-section">
      <h2 className="section-title">My Runs</h2>
      {loading ? <p className="muted">Loading runs...</p> : runs.length === 0 ? <div className="empty-card">이 달에 등록된 러닝이 없습니다.</div> :
        <div className="run-list">{runs.map(run => <article className="run-card" key={run.id}>
          <div>
            <div className="muted run-date">{run.activity_date} · {sourceNames[run.source_app_id || 0] || 'Manual'}</div>
            <strong>{Number(run.distance_km).toFixed(2)} km</strong>
            <div className="muted">{formatDuration(run.duration_sec)} · {formatPace(run.pace_sec_per_km)}/km{run.avg_heart_rate ? ` · ${run.avg_heart_rate} bpm` : ''}</div>
            {run.notes && <div className="run-note">{run.notes}</div>}
          </div>
          <div className="run-actions"><button onClick={() => beginEdit(run)}>Edit</button><button className="danger" onClick={() => deleteRun(run)}>Delete</button></div>
        </article>)}</div>}
    </section>

    <section className="chart-section">
      <h2 className="section-title">Import Reports</h2>
      <p className="muted report-help">앞으로 CSV, Garmin 링크, Strava 동기화 결과가 여기에 남습니다.</p>
      {reports.length === 0 ? <div className="empty-card">아직 저장된 가져오기 보고서가 없습니다.</div> :
        <div className="report-list">{reports.map(report => <article className="report-card" key={report.id}>
          <div className="report-heading"><strong>{reportNames[report.source]}</strong><time>{new Date(report.created_at).toLocaleString()}</time></div>
          <div className="report-label">{report.label || 'Import'}</div>
          <div className="report-counts"><span>{report.total_count} scanned</span><span className="success">+{report.imported_count} added</span><span>{report.duplicate_count} duplicate</span><span>{report.skipped_count} skipped</span>{report.error_count > 0 && <span className="danger-text">{report.error_count} error</span>}</div>
        </article>)}</div>}
    </section>

    {editing && <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setEditing(null) }}>
      <div className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-run-title">
        <div className="dialog-title"><h2 id="edit-run-title">Edit Run</h2><button aria-label="Close" onClick={() => setEditing(null)}>×</button></div>
        <label className="form-label">Date<input className="form-input" type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
        <label className="form-label">Distance (km)<input className="form-input" type="number" min="0.01" step="0.01" value={form.distance} onChange={event => setForm({ ...form, distance: event.target.value })} /></label>
        <label className="form-label">Duration (H:MM:SS)<input className="form-input" value={form.duration} onChange={event => setForm({ ...form, duration: event.target.value })} /></label>
        <label className="form-label">Average heart rate<input className="form-input" type="number" min="30" max="250" value={form.heartRate} onChange={event => setForm({ ...form, heartRate: event.target.value })} /></label>
        <label className="form-label">Notes<textarea className="form-input" rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
        <button className="action-btn" onClick={saveEdit}>Save Changes</button>
      </div>
    </div>}
  </div>
}
