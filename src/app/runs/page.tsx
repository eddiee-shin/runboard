'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import InfographicReport from '@/components/InfographicReport'

type FilterType = 'Today' | 'Weekly' | 'Monthly' | 'All Time'

type Run = {
  id: string
  activity_date: string
  distance_km: number
  duration_sec: number
  pace_sec_per_km: number
  avg_heart_rate: number | null
  calories: number | null
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

type ReportData = {
  month: string
  totalDistance: number
  totalRuns: number
  totalDurationSec: number
  totalCalories: number
  avgPace: number
  avgHeartRate: number
  dailyDistances: { day: number; distance: number }[]
  bestRun: { distance: number; date: string } | null
  displayName: string
  dowData: number[]
  quality: { good: number; normal: number }
  maxStreak: number
  crewRank: number | null
  crewSize: number
  goalPercent: number
}

type Totals = { distance: number; duration: number; pace: number; heartRate: number; runs: number }

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDuration = (seconds: number) => {
  const h = Math.floor((seconds || 0) / 3600)
  const m = Math.floor(((seconds || 0) % 3600) / 60)
  const s = Math.floor((seconds || 0) % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

const parseDuration = (value: string) => {
  const parts = value.trim().split(':').map(Number)
  if (parts.some(part => !Number.isFinite(part) || part < 0)) return NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return NaN
}

const formatPace = (seconds: number) => {
  if (!seconds || !Number.isFinite(seconds)) return '--'
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}'${String(rounded % 60).padStart(2, '0')}"`
}

const sourceNames: Record<number, string> = { 1: 'Nike', 2: 'Garmin', 3: 'Strava', 4: 'Samsung', 5: 'adidas' }
const reportNames = { garmin_csv: 'Garmin CSV', garmin_link: 'Garmin Link', strava: 'Strava Sync' }

export default function RunsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [filter, setFilter] = useState<FilterType>('Weekly')
  const [viewingMonth, setViewingMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [allTimeWindow, setAllTimeWindow] = useState(0)
  const [allTimeTotals, setAllTimeTotals] = useState<Totals>({ distance: 0, duration: 0, pace: 0, heartRate: 0, runs: 0 })
  const [runs, setRuns] = useState<Run[]>([])
  const [reports, setReports] = useState<ImportReport[]>([])
  const [weeklyGoal, setWeeklyGoal] = useState(40)
  const [monthlyGoal, setMonthlyGoal] = useState(150)
  const [comparison, setComparison] = useState<{ distance: number; runs: number; label: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<Run | null>(null)
  const [form, setForm] = useState({ date: '', distance: '', duration: '', heartRate: '', notes: '' })
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const [showInfographic, setShowInfographic] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const loadSequence = useRef(0)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('filter')
    if (requested && ['Today', 'Weekly', 'Monthly', 'All Time'].includes(requested)) setFilter(requested as FilterType)
  }, [])

  const load = async () => {
    const requestId = ++loadSequence.current
    setLoading(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { if (requestId === loadSequence.current) setLoading(false); return }

    const now = new Date()
    let startDate: string | null = null
    let endDate: string | null = null
    if (filter === 'Today') {
      startDate = isoDate(now); endDate = startDate
    } else if (filter === 'Weekly') {
      const monday = new Date(now)
      monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
      startDate = isoDate(monday); endDate = isoDate(now)
    } else if (filter === 'Monthly') {
      startDate = isoDate(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1))
      endDate = isoDate(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 0))
    } else if (filter === 'All Time') {
      const windowEnd = new Date(now.getFullYear(), now.getMonth() - allTimeWindow * 6 + 1, 0)
      const windowStart = new Date(windowEnd.getFullYear(), windowEnd.getMonth() - 5, 1)
      startDate = isoDate(windowStart)
      endDate = isoDate(windowEnd)
    }

    const collected: Run[] = []
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from('run_sessions')
        .select('id, activity_date, distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, calories, notes, source_app_id')
        .eq('profile_id', user.id).eq('status', 'verified')
      if (startDate) query = query.gte('activity_date', startDate)
      if (endDate) query = query.lte('activity_date', endDate)
      const { data, error } = await query.order('activity_date', { ascending: false }).order('id').range(offset, offset + 499)
      if (error) {
        if (requestId === loadSequence.current) { setMessage('기록을 불러오지 못했습니다.'); setLoading(false) }
        return
      }
      collected.push(...((data || []) as Run[]))
      if (!data || data.length < 500) break
    }

    const [{ data: goals }, { data: reportRows }] = await Promise.all([
      supabase.from('running_goals').select('goal_type, goal_value').eq('profile_id', user.id)
        .in('goal_type', ['weekly_distance_km', 'monthly_distance_km']),
      supabase.from('import_reports')
        .select('id, source, label, total_count, imported_count, duplicate_count, skipped_count, error_count, details, created_at')
        .eq('profile_id', user.id).order('created_at', { ascending: false }).limit(12),
    ])
    let nextWeeklyGoal = weeklyGoal
    let nextMonthlyGoal = monthlyGoal
    ;(goals as { goal_type: string; goal_value: number }[] | null)?.forEach(goal => {
      if (goal.goal_type === 'weekly_distance_km') nextWeeklyGoal = Number(goal.goal_value)
      if (goal.goal_type === 'monthly_distance_km') nextMonthlyGoal = Number(goal.goal_value)
    })

    let nextAllTimeTotals = allTimeTotals
    if (filter === 'All Time') {
      const { data, error } = await supabase.rpc('get_my_run_totals')
      if (error) {
        if (requestId === loadSequence.current) { setMessage('전체 누적 합계를 불러오지 못했습니다.'); setLoading(false) }
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      nextAllTimeTotals = {
        distance: Number(row?.total_distance_km || 0),
        runs: Number(row?.total_runs || 0),
        duration: Number(row?.total_duration_sec || 0),
        pace: Number(row?.avg_pace_sec_per_km || 0),
        heartRate: Math.round(Number(row?.avg_heart_rate || 0)),
      }
    }

    let nextComparison: { distance: number; runs: number; label: string } | null = null
    if (filter === 'Monthly') {
      const previousStart = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1)
      const selectedIsCurrent = viewingMonth.getFullYear() === now.getFullYear() && viewingMonth.getMonth() === now.getMonth()
      const previousLastDay = new Date(previousStart.getFullYear(), previousStart.getMonth() + 1, 0).getDate()
      const throughDay = selectedIsCurrent ? Math.min(now.getDate(), previousLastDay) : previousLastDay
      const previousEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), throughDay)
      const previousRuns: { distance_km: number }[] = []
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('run_sessions').select('id, distance_km')
          .eq('profile_id', user.id).eq('status', 'verified')
          .gte('activity_date', isoDate(previousStart)).lte('activity_date', isoDate(previousEnd))
          .order('id').range(offset, offset + 499)
        if (error) break
        previousRuns.push(...(data || []))
        if (!data || data.length < 500) break
      }
      nextComparison = {
        distance: previousRuns.reduce((sum, run) => sum + Number(run.distance_km || 0), 0),
        runs: previousRuns.length,
        label: selectedIsCurrent
          ? `${previousStart.toLocaleString('default', { month: 'short' })} 1–${throughDay}`
          : previousStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
      }
    }

    if (requestId !== loadSequence.current) return
    setRuns(collected)
    setWeeklyGoal(nextWeeklyGoal)
    setMonthlyGoal(nextMonthlyGoal)
    setAllTimeTotals(nextAllTimeTotals)
    if (reportRows) setReports(reportRows as ImportReport[])
    setComparison(nextComparison)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter, viewingMonth, allTimeWindow])

  const totals = useMemo(() => {
    let distance = 0, duration = 0, pacedDistance = 0, pacedDuration = 0, heartRate = 0, heartRateCount = 0
    runs.forEach(run => {
      const runDistance = Number(run.distance_km || 0)
      const runDuration = Number(run.duration_sec || 0)
      distance += runDistance; duration += runDuration
      if (runDistance > 0 && runDuration > 0) { pacedDistance += runDistance; pacedDuration += runDuration }
      if (Number(run.avg_heart_rate) > 0) { heartRate += Number(run.avg_heart_rate); heartRateCount++ }
    })
    return {
      distance, duration,
      pace: pacedDistance > 0 ? pacedDuration / pacedDistance : 0,
      heartRate: heartRateCount ? Math.round(heartRate / heartRateCount) : 0,
    }
  }, [runs])

  const chartData = useMemo(() => {
    if (filter === 'All Time') {
      const months: Record<string, number> = {}
      runs.forEach(run => { const key = run.activity_date.slice(0, 7); months[key] = (months[key] || 0) + Number(run.distance_km || 0) })
      return Object.keys(months).sort().map(key => {
        const [year, month] = key.split('-').map(Number)
        return { label: new Date(year, month - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' }), val: months[key] }
      })
    }
    const days = [0, 0, 0, 0, 0, 0, 0]
    runs.forEach(run => {
      const [year, month, day] = run.activity_date.split('-').map(Number)
      const dow = new Date(year, month - 1, day).getDay()
      days[dow === 0 ? 6 : dow - 1] += Number(run.distance_km || 0)
    })
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => ({ label, val: days[index] }))
  }, [filter, runs])

  const beginEdit = (run: Run) => {
    setEditing(run); setMessage('')
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
    setEditing(null); await load(); setMessage('기록을 수정했습니다.')
  }

  const deleteRun = async (run: Run) => {
    if (!confirm(`${run.activity_date} ${Number(run.distance_km).toFixed(2)}km 기록을 삭제할까요?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('run_sessions').delete().eq('id', run.id).eq('profile_id', user.id)
    if (error) setMessage('기록을 삭제하지 못했습니다.')
    else { await load(); setMessage('기록을 삭제했습니다.') }
  }

  const saveGoal = async () => {
    const value = Number(goalDraft)
    if (!Number.isFinite(value) || value <= 0 || value > 2000) { setMessage('목표는 1~2,000km 사이로 입력해주세요.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const isMonthly = filter === 'Monthly'
    const { error } = await supabase.from('running_goals').upsert({
      profile_id: user.id,
      goal_type: isMonthly ? 'monthly_distance_km' : 'weekly_distance_km',
      goal_value: value,
      unit: 'km', period: isMonthly ? 'monthly' : 'weekly', is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,goal_type' })
    if (error) { setMessage('목표를 저장하지 못했습니다.'); return }
    if (isMonthly) setMonthlyGoal(value); else setWeeklyGoal(value)
    setEditingGoal(false); setMessage('목표를 저장했습니다.')
  }

  const prepareReportData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    const end = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 0)
    const dailyDistances = Array.from({ length: end.getDate() }, (_, index) => ({ day: index + 1, distance: 0 }))
    const dowData = [0, 0, 0, 0, 0, 0, 0]
    let bestRun: Run | null = null, maxStreak = 0, streak = 0, good = 0, normal = 0
    runs.forEach(run => {
      const [year, month, day] = run.activity_date.split('-').map(Number)
      dailyDistances[day - 1].distance += Number(run.distance_km || 0)
      const dow = new Date(year, month - 1, day).getDay()
      dowData[dow === 0 ? 6 : dow - 1]++
      if (!bestRun || Number(run.distance_km) > Number(bestRun.distance_km)) bestRun = run
      if (Number(run.pace_sec_per_km) > 0 && Number(run.pace_sec_per_km) <= 360) good++; else normal++
    })
    dailyDistances.forEach(day => { if (day.distance > 0) { streak++; maxStreak = Math.max(maxStreak, streak) } else streak = 0 })

    const crewRuns: { profile_id: string; distance_km: number }[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions').select('id, profile_id, distance_km')
        .eq('status', 'verified')
        .gte('activity_date', isoDate(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1)))
        .lte('activity_date', isoDate(end)).order('id').range(offset, offset + 499)
      if (error) break
      crewRuns.push(...(data || []))
      if (!data || data.length < 500) break
    }
    const crewTotals = new Map<string, number>()
    crewRuns.forEach(run => crewTotals.set(run.profile_id, (crewTotals.get(run.profile_id) || 0) + Number(run.distance_km || 0)))
    const rankedIds = Array.from(crewTotals.entries()).sort((a, b) => b[1] - a[1]).map(entry => entry[0])

    setReportData({
      month: viewingMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalDistance: totals.distance,
      totalRuns: runs.length,
      totalDurationSec: totals.duration,
      totalCalories: runs.reduce((sum, run) => sum + Number(run.calories || 0), 0),
      avgPace: totals.pace,
      avgHeartRate: totals.heartRate,
      dailyDistances,
      bestRun: bestRun ? { distance: Number((bestRun as Run).distance_km), date: (bestRun as Run).activity_date } : null,
      displayName: profile?.display_name || 'Runner',
      dowData,
      quality: { good, normal },
      maxStreak,
      crewRank: rankedIds.includes(user.id) ? rankedIds.indexOf(user.id) + 1 : null,
      crewSize: rankedIds.length,
      goalPercent: monthlyGoal > 0 ? Math.round((totals.distance / monthlyGoal) * 100) : 0,
    })
    setLoading(false); setShowInfographic(true)
  }

  const renderReport = async () => {
    if (!reportRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(reportRef.current, { scale: 2, backgroundColor: '#F9F9F4' })
  }

  const downloadReport = async () => {
    const canvas = await renderReport()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `RunBoard_Report_${reportData?.month}.png`
    link.href = canvas.toDataURL('image/png'); link.click()
  }

  const shareReport = async () => {
    const canvas = await renderReport()
    if (!canvas) return
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], `RunBoard_${reportData?.month}.png`, { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: `${reportData?.month} RunBoard Report`, files: [file] }) }
      catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error }
    } else await downloadReport()
  }

  const currentMonth = new Date()
  const isCurrentMonth = viewingMonth.getFullYear() === currentMonth.getFullYear() && viewingMonth.getMonth() === currentMonth.getMonth()
  const currentGoal = filter === 'Monthly' ? monthlyGoal : weeklyGoal
  const goalProgress = currentGoal > 0 ? Math.min(100, Math.round((totals.distance / currentGoal) * 100)) : 0
  const comparisonDistance = comparison?.distance ? Math.round(((totals.distance - comparison.distance) / comparison.distance) * 100) : null
  const comparisonRuns = comparison?.runs ? Math.round(((runs.length - comparison.runs) / comparison.runs) * 100) : null
  const maxChart = Math.max(...chartData.map(item => item.val), 10)
  const runDates = new Set(runs.map(run => run.activity_date))
  const displayedTotals = filter === 'All Time' ? allTimeTotals : { ...totals, runs: runs.length }
  const allTimeEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - allTimeWindow * 6 + 1, 0)
  const allTimeStart = new Date(allTimeEnd.getFullYear(), allTimeEnd.getMonth() - 5, 1)
  const allTimeRangeLabel = `${allTimeStart.toLocaleDateString('default', { month: 'short', year: 'numeric' })} – ${allTimeEnd.toLocaleDateString('default', { month: 'short', year: 'numeric' })}`

  return <div className="content active">
    <div className="filter-chips period-filter" aria-label="My Runs period">
      {(['Today', 'Weekly', 'Monthly', 'All Time'] as FilterType[]).map(option =>
        <button type="button" key={option} className={`chip ${filter === option ? 'active' : ''}`}
          onClick={() => { setFilter(option); setEditingGoal(false); setMessage('') }}>{option}</button>)}
    </div>

    {filter === 'Monthly' && <div className="period-nav">
      <button onClick={() => setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1))} aria-label="Previous month">&larr;</button>
      <strong>{viewingMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</strong>
      <button disabled={isCurrentMonth} onClick={() => setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1))} aria-label="Next month">&rarr;</button>
    </div>}

    {filter === 'All Time' && <div className="period-nav">
      <button onClick={() => setAllTimeWindow(allTimeWindow + 1)} aria-label="Previous six months">&larr;</button>
      <strong>{allTimeRangeLabel}</strong>
      <button disabled={allTimeWindow === 0} onClick={() => setAllTimeWindow(Math.max(0, allTimeWindow - 1))} aria-label="Next six months">&rarr;</button>
    </div>}

    {loading ? <div className="loading-state">Loading runs...</div> : <>
      <div className="stats-grid">
        <div className="stat-card main"><div className="stat-label">{filter} Distance</div><div className="stat-number">{displayedTotals.distance.toFixed(1)} <span className="stat-unit">km</span></div></div>
        <div className="stat-card"><div className="stat-label">Runs</div><div className="stat-number">{displayedTotals.runs}</div></div>
        <div className="stat-card"><div className="stat-label">Avg Pace</div><div className="stat-number">{formatPace(displayedTotals.pace)} <span className="stat-unit">/km</span></div></div>
        <div className="stat-card"><div className="stat-label">Avg HR</div><div className="stat-number">{displayedTotals.heartRate || '--'} <span className="stat-unit">bpm</span></div></div>
        <div className="stat-card"><div className="stat-label">Total Time</div><div className="stat-number small-number">{formatDuration(displayedTotals.duration)}</div></div>
      </div>

      {filter === 'Monthly' && comparison && <div className="comparison-card">
        <div className="stat-label">Compared with {comparison.label}</div>
        <div className="comparison-grid">
          <div><div className="muted">Distance</div><div className={`comparison-value ${(comparisonDistance || 0) >= 0 ? 'trend-up' : 'trend-down'}`}>{comparisonDistance === null ? 'New' : `${comparisonDistance >= 0 ? '+' : ''}${comparisonDistance}%`}</div><div className="muted">previous {comparison.distance.toFixed(1)} km</div></div>
          <div><div className="muted">Runs</div><div className={`comparison-value ${(comparisonRuns || 0) >= 0 ? 'trend-up' : 'trend-down'}`}>{comparisonRuns === null ? 'New' : `${comparisonRuns >= 0 ? '+' : ''}${comparisonRuns}%`}</div><div className="muted">previous {comparison.runs} runs</div></div>
        </div>
      </div>}

      {(filter === 'Weekly' || filter === 'All Time') && <section className="chart-section">
        <h2 className="section-title">{filter === 'All Time' ? 'Monthly Distance' : 'Activity by Day'}</h2>
        <div className="chart-scroll"><div className="chart-container" style={{ minWidth: filter === 'All Time' ? `${Math.max(420, chartData.length * 64)}px` : undefined }}>
          {chartData.map((item, index) => <div key={`${item.label}-${index}`} className={`bar ${item.val > 0 ? 'active' : ''}`} style={{ height: `${Math.max(0, item.val / maxChart * 100)}%`, position: 'relative' }} title={`${item.val.toFixed(1)} km`}>
            {item.val > 0 && <span className="bar-value">{item.val >= 10 ? Math.round(item.val) : item.val.toFixed(1)}</span>}
            <span className="bar-label">{item.label}</span>
          </div>)}
        </div></div>
      </section>}

      {(filter === 'Weekly' || filter === 'Monthly') && <section className="chart-section goal-section">
        <h2 className="section-title">Goal Progress</h2>
        <div className="goal-card">
          <div className="goal-heading"><span>{filter} {currentGoal}km Goal</span><span><button className="inline-action" onClick={() => { setGoalDraft(String(currentGoal)); setEditingGoal(true); setMessage('') }}>Edit goal</button> <strong>{goalProgress}%</strong></span></div>
          <div className="challenge-progress"><div style={{ width: `${goalProgress}%` }} /></div>
          {editingGoal && <div className="goal-editor"><input className="form-input" type="number" min="1" max="2000" step="1" value={goalDraft} onChange={event => setGoalDraft(event.target.value)} /><button onClick={saveGoal}>Save</button></div>}
        </div>
      </section>}

      {filter === 'Monthly' && <section className="chart-section">
        <div className="section-heading"><h2 className="section-title">Monthly Calendar</h2><button className="pill-action" onClick={prepareReportData}>{reportData ? 'View Report' : 'Generate Report'}</button></div>
        <div className="calendar-grid">
          {['M','T','W','T','F','S','S'].map((day, index) => <div key={`${day}-${index}`} className="calendar-label">{day}</div>)}
          {Array.from({ length: (new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1).getDay() + 6) % 7 }, (_, index) => <div key={`empty-${index}`} />)}
          {Array.from({ length: new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 0).getDate() }, (_, index) => {
            const day = index + 1
            const date = `${viewingMonth.getFullYear()}-${String(viewingMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const today = date === isoDate(new Date())
            return <div key={date} className={`calendar-day ${runDates.has(date) ? 'has-run' : ''} ${today ? 'today' : ''}`}>{day}</div>
          })}
        </div>
      </section>}
    </>}

    {message && <p className="status-message" role="status">{message}</p>}

    <section className="chart-section">
      <h2 className="section-title">{filter === 'All Time' ? `Runs · ${allTimeRangeLabel}` : `Runs · ${filter}`}</h2>
      {!loading && runs.length === 0 ? <div className="empty-card">이 기간에 등록된 러닝이 없습니다.</div> :
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
      <p className="muted report-help">CSV, Garmin 링크, Strava 동기화 결과가 여기에 남습니다.</p>
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

    {showInfographic && <div className="report-overlay">
      <div className="report-toolbar"><button onClick={() => setShowInfographic(false)}>Close</button><div><button onClick={downloadReport}>Save</button><button className="share" onClick={shareReport}>Share</button></div></div>
      <div ref={reportRef}>{reportData && <InfographicReport key={`${reportData.month}-${reportData.totalRuns}`} data={reportData} />}</div>
    </div>}
  </div>
}
