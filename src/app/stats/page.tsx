'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import InfographicReport from './components/InfographicReport'

// Helper: Format seconds per km to M'SS"
const formatPace = (sec: number) => {
  if (!sec || isNaN(sec)) return `0'00"`
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}'${s.toString().padStart(2, '0')}"`
}

const formatDuration = (sec: number) => {
  if (!sec || isNaN(sec)) return `0h 0m`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

type FilterType = 'Today' | 'Weekly' | 'Monthly' | 'All Time'

export default function StatsPage() {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('Weekly')
  
  // Stats
  const [filteredDistance, setFilteredDistance] = useState(0)
  const [filteredRuns, setFilteredRuns] = useState(0)
  const [filteredDuration, setFilteredDuration] = useState(0)
  const [avgPace, setAvgPace] = useState(0)
  const [avgHeartRate, setAvgHeartRate] = useState(0)
  const [chartData, setChartData] = useState<{label: string, val: number}[]>([])
  const [recentRuns, setRecentRuns] = useState<any[]>([])
  const [allVerifiedRuns, setAllVerifiedRuns] = useState<any[]>([])
  const [userName, setUserName] = useState('')
  
  // Infographic state
  const [showInfographic, setShowInfographic] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const [reportData, setReportData] = useState<any>(null)

  // Goals
  const [weeklyGoal, setWeeklyGoal] = useState(40) // Default 40
  const [monthlyGoal, setMonthlyGoal] = useState(150) // Default 150
  const [viewingDate, setViewingDate] = useState(new Date())
  const [comparison, setComparison] = useState<{ distance: number; runs: number; label: string } | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const [goalMessage, setGoalMessage] = useState('')

  useEffect(() => {
    fetchStats()
  }, [filter, viewingDate])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('filter') === 'Monthly') {
      setFilter('Monthly')
    }
  }, [])

  const fetchStats = async () => {
    setIsLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsLoading(false)
      return
    }

    // Get user profile name
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    if (profile) setUserName(profile.display_name || 'Anonymous')

    // 1. Fetch Goals
    const { data: goals } = await supabase
      .from('running_goals')
      .select('goal_type, goal_value')
      .eq('profile_id', user.id)
      .in('goal_type', ['weekly_distance_km', 'monthly_distance_km'])

    if (goals) {
      goals.forEach((g: any) => {
        if (g.goal_type === 'weekly_distance_km') setWeeklyGoal(Number(g.goal_value))
        if (g.goal_type === 'monthly_distance_km') setMonthlyGoal(Number(g.goal_value))
      })
    }

    // 2. Date Helpers
    const getLocalISODate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const now = new Date()
    let startDate: string | null = null
    let endDate: string | null = null
    if (filter === 'Today') {
      const todayStr = getLocalISODate(now)
      startDate = todayStr
      endDate = todayStr
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
      startDate = getLocalISODate(startOfWeek)
      endDate = getLocalISODate(now)
    } else if (filter === 'Monthly') {
      const startOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1)
      const endOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0)
      startDate = getLocalISODate(startOfMonth)
      endDate = getLocalISODate(endOfMonth)
    }
    // Supabase projects commonly cap a response at 1,000 rows. Page through the
    // complete range so All Time never becomes a partial total.
    const runs: any[] = []
    for (let offset = 0; ; offset += 500) {
      let pageQuery = supabase.from('run_sessions')
        .select('id, distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, activity_date')
        .eq('profile_id', user.id).eq('status', 'verified')
      if (startDate) pageQuery = pageQuery.gte('activity_date', startDate)
      if (endDate) pageQuery = pageQuery.lte('activity_date', endDate)
      const { data, error } = await pageQuery.order('activity_date').order('id').range(offset, offset + 499)
      if (error) { console.error('Error fetching stats', error); setIsLoading(false); return }
      runs.push(...(data || []))
      if (!data || data.length < 500) break
    }

    let fDist = 0, fRuns = 0, fDur = 0, pacedDistance = 0, pacedDuration = 0, totHr = 0, hrCount = 0
    const daysMap = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 0:0 }

    runs?.forEach((r: any) => {
      const dist = parseFloat(r.distance_km || 0)
      fDist += dist
      fRuns++
      fDur += parseInt(r.duration_sec || 0)
      const duration = parseInt(r.duration_sec || 0)
      if (duration > 0 && dist > 0) { pacedDuration += duration; pacedDistance += dist }
      const hr = parseInt(r.avg_heart_rate || 0)
      if (hr > 0) { totHr += hr; hrCount++ }

      const runDate = new Date(r.activity_date)
      daysMap[runDate.getDay() as keyof typeof daysMap] += dist
    })

    setFilteredDistance(fDist)
    setFilteredRuns(fRuns)
    setFilteredDuration(fDur)
    setAvgPace(pacedDistance > 0 ? pacedDuration / pacedDistance : 0)
    setAvgHeartRate(hrCount > 0 ? Math.round(totHr / hrCount) : 0)

    if (filter === 'Monthly') {
      const previousStart = new Date(viewingDate.getFullYear(), viewingDate.getMonth() - 1, 1)
      const selectedIsCurrent = viewingDate.getFullYear() === now.getFullYear() && viewingDate.getMonth() === now.getMonth()
      const previousLastDay = new Date(previousStart.getFullYear(), previousStart.getMonth() + 1, 0).getDate()
      const throughDay = selectedIsCurrent ? Math.min(now.getDate(), previousLastDay) : previousLastDay
      const previousEnd = new Date(previousStart.getFullYear(), previousStart.getMonth(), throughDay)
      const previousRuns: { distance_km: number }[] = []
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('run_sessions').select('id, distance_km')
          .eq('profile_id', user.id).eq('status', 'verified')
          .gte('activity_date', getLocalISODate(previousStart)).lte('activity_date', getLocalISODate(previousEnd))
          .order('id').range(offset, offset + 499)
        if (error) break
        previousRuns.push(...(data || []))
        if (!data || data.length < 500) break
      }
      setComparison({
        distance: previousRuns.reduce((sum, run) => sum + Number(run.distance_km || 0), 0),
        runs: previousRuns.length,
        label: selectedIsCurrent
          ? `${previousStart.toLocaleString('default', { month: 'short' })} 1–${throughDay}`
          : previousStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
      })
    } else {
      setComparison(null)
    }

    if (filter === 'All Time') {
      // Show every month that contributes to the All Time total.
      const monthlyMap: Record<string, number> = {}
      runs?.forEach((r: any) => {
        const key = r.activity_date.slice(0, 7)
        monthlyMap[key] = (monthlyMap[key] || 0) + parseFloat(r.distance_km || 0)
      })

      const keys = Object.keys(monthlyMap).sort()
      setChartData(keys.map(k => {
        const [year, month] = k.split('-').map(Number)
        return { label: new Date(year, month - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' }), val: monthlyMap[k] }
      }))
    } else {
      // Weekly chart
      setChartData([
        { label: 'M', val: daysMap[1] },
        { label: 'T', val: daysMap[2] },
        { label: 'W', val: daysMap[3] },
        { label: 'T', val: daysMap[4] },
        { label: 'F', val: daysMap[5] },
        { label: 'S', val: daysMap[6] },
        { label: 'S', val: daysMap[0] }
      ])
    }

    // 3. Fetch Recent 5 Runs (All Time)
    const { data: recent } = await supabase
      .from('run_sessions')
      .select('id, activity_date, distance_km, duration_sec, source_app_id')
      .eq('profile_id', user.id)
      .eq('status', 'verified')
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)

    if (recent) {
      setRecentRuns(recent)
    }

    // 4. Fetch All Verified Runs for Calendar
    const allRuns: { activity_date: string }[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions').select('id, activity_date')
        .eq('profile_id', user.id).eq('status', 'verified').order('id').range(offset, offset + 499)
      if (error) { console.error('Error fetching run calendar', error); break }
      allRuns.push(...(data || []))
      if (!data || data.length < 500) break
    }
    setAllVerifiedRuns(allRuns)

    setIsLoading(false)
  }

  const prepareReportData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setIsLoading(true)

    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    
    const getLocalISODate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const startOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1)
    const endOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0)
    const daysInMonth = endOfMonth.getDate()
    
    const dailyMap: Record<number, number> = {}
    for (let i = 1; i <= daysInMonth; i++) dailyMap[i] = 0
    
    const thisMonthRuns: any[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions').select('*')
        .eq('profile_id', user.id).eq('status', 'verified')
        .gte('activity_date', getLocalISODate(startOfMonth)).lte('activity_date', getLocalISODate(endOfMonth))
        .order('id').range(offset, offset + 499)
      if (error) break
      thisMonthRuns.push(...(data || []))
      if (!data || data.length < 500) break
    }

    let mDist = 0, mRuns = 0, mDur = 0, mPacedDuration = 0, mPacedDistance = 0, mHrTot = 0, mHrCount = 0, mCal = 0
    let bestR: any = null
    const dowMap: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }
    let qualityGood = 0, qualityNormal = 0

    thisMonthRuns.forEach((r: any) => {
        const parts = r.activity_date.split('-')
        const runD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        const d = runD.getDate()
        const dow = runD.getDay()
        
        dowMap[dow]++
        const dist = parseFloat(r.distance_km || 0)
        dailyMap[d] += dist
        mDist += dist
        mRuns++
        mDur += parseInt(r.duration_sec || 0)
        mCal += parseInt(r.calories || 0)
        const p = parseInt(r.pace_sec_per_km || 0)
        if (p > 0 && dist > 0) { mPacedDuration += parseInt(r.duration_sec || 0); mPacedDistance += dist }
        const hr = parseInt(r.avg_heart_rate || 0)
        if (hr > 0) { mHrTot += hr; mHrCount++ }
        if (!bestR || dist > parseFloat(bestR.distance_km)) bestR = r
        if (p > 0 && p <= 360) qualityGood++
        else qualityNormal++
    })


    let maxStrk = 0, currStrk = 0
    for (let i = 1; i <= daysInMonth; i++) {
      if (dailyMap[i] > 0) { currStrk++; if (currStrk > maxStrk) maxStrk = currStrk }
      else currStrk = 0
    }

    const crewRuns: { profile_id: string; distance_km: number }[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions').select('id, profile_id, distance_km')
        .eq('status', 'verified').gte('activity_date', getLocalISODate(startOfMonth)).lte('activity_date', getLocalISODate(endOfMonth))
        .order('id').range(offset, offset + 499)
      if (error) break
      crewRuns.push(...(data || []))
      if (!data || data.length < 500) break
    }
    const crewTotals = new Map<string, number>()
    crewRuns.forEach(run => crewTotals.set(run.profile_id, (crewTotals.get(run.profile_id) || 0) + Number(run.distance_km || 0)))
    const rankedIds = Array.from(crewTotals.entries()).sort((a, b) => b[1] - a[1]).map(entry => entry[0])

    setReportData({
      month: viewingDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalDistance: mDist,
      totalRuns: mRuns,
      totalDurationSec: mDur,
      totalCalories: mCal,
      avgPace: mPacedDistance > 0 ? mPacedDuration / mPacedDistance : 0,
      avgHeartRate: mHrCount > 0 ? Math.round(mHrTot / mHrCount) : 0,
      dailyDistances: Object.keys(dailyMap).sort((a,b) => parseInt(a) - parseInt(b)).map(d => ({ 
        day: parseInt(d), 
        distance: dailyMap[parseInt(d)] 
      })),
      bestRun: bestR ? { distance: parseFloat(bestR.distance_km), date: bestR.activity_date } : null,
      displayName: profile?.display_name || 'Runner',
      dowData: [dowMap[1], dowMap[2], dowMap[3], dowMap[4], dowMap[5], dowMap[6], dowMap[0]], 
      quality: { good: qualityGood, normal: qualityNormal },
      maxStreak: maxStrk,
      crewRank: rankedIds.indexOf(user.id) >= 0 ? rankedIds.indexOf(user.id) + 1 : null,
      crewSize: rankedIds.length,
      goalPercent: monthlyGoal > 0 ? Math.round((mDist / monthlyGoal) * 100) : 0,
    })
    
    setIsLoading(false)
    setShowInfographic(true)
  }

  const renderReport = async () => {
    if (!reportRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    return html2canvas(reportRef.current, {
      scale: 2, // Higher quality
      backgroundColor: '#F9F9F4'
    })
  }

  const handleDownload = async () => {
    const canvas = await renderReport()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `RunBoard_Report_${reportData?.month}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleShare = async () => {
    const canvas = await renderReport()
    if (!canvas) return
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], `RunBoard_${reportData?.month}.png`, { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: `${reportData?.month} RunBoard Report`, files: [file] }) }
      catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error }
    } else {
      await handleDownload()
    }
  }

  const saveGoal = async () => {
    const value = Number(goalDraft)
    if (!Number.isFinite(value) || value <= 0 || value > 2000) { setGoalMessage('1~2,000km 사이로 입력해주세요.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const goalType = isMonthly ? 'monthly_distance_km' : 'weekly_distance_km'
    const { error } = await supabase.from('running_goals').upsert({
      profile_id: user.id, goal_type: goalType, goal_value: value,
      unit: 'km', period: isMonthly ? 'monthly' : 'weekly', is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,goal_type' })
    if (error) { setGoalMessage('목표를 저장하지 못했습니다.'); return }
    if (isMonthly) setMonthlyGoal(value); else setWeeklyGoal(value)
    setEditingGoal(false); setGoalMessage('목표를 저장했습니다.')
  }

  const handleDeleteRun = async (id: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return
    
    setIsLoading(true)
    const { error } = await supabase.from('run_sessions').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete run', error)
      alert('Failed to delete run')
      setIsLoading(false)
    } else {
      await fetchStats() // Ensure we wait for fetchStats to complete
    }
  }

  // Calculate goal progress based on current filter (only relevant if not all-time)
  const isWeekly = filter === 'Weekly'
  const isMonthly = filter === 'Monthly'
  const currentGoal = isMonthly ? monthlyGoal : weeklyGoal
  const currentProgress = Math.min(100, Math.round((filteredDistance / currentGoal) * 100)) || 0
  const comparisonDistancePct = comparison?.distance
    ? Math.round(((filteredDistance - comparison.distance) / comparison.distance) * 100)
    : null
  const comparisonRunPct = comparison?.runs
    ? Math.round(((filteredRuns - comparison.runs) / comparison.runs) * 100)
    : null

  const maxVal = Math.max(...chartData.map(d => d.val), 10)

  return (
    <div className="content active">
      <div className="filter-chips">
        {['Today', 'Weekly', 'Monthly', 'All Time'].map(f => (
          <div 
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f as FilterType)}
          >
            {f}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>
          Loading stats...
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card main">
              <div className="stat-label">{filter} Distance</div>
              <div className="stat-number">{filteredDistance.toFixed(1)} <span className="stat-unit">km</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Runs</div>
              <div className="stat-number">{filteredRuns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Pace</div>
              <div className="stat-number">{formatPace(avgPace)} <span className="stat-unit">/km</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg HR</div>
              <div className="stat-number">{avgHeartRate > 0 ? avgHeartRate : '--'} <span className="stat-unit">bpm</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Time</div>
              <div className="stat-number" style={{ fontSize: '1.8rem' }}>{formatDuration(filteredDuration)}</div>
            </div>
          </div>

          {filter === 'Monthly' && comparison && (
            <div className="comparison-card">
              <div className="stat-label">Compared with {comparison.label}</div>
              <div className="comparison-grid">
                <div><div className="muted">Distance</div><div className={`comparison-value ${(comparisonDistancePct || 0) >= 0 ? 'trend-up' : 'trend-down'}`}>{comparisonDistancePct === null ? 'New' : `${comparisonDistancePct >= 0 ? '+' : ''}${comparisonDistancePct}%`}</div><div className="muted">previous {comparison.distance.toFixed(1)} km</div></div>
                <div><div className="muted">Runs</div><div className={`comparison-value ${(comparisonRunPct || 0) >= 0 ? 'trend-up' : 'trend-down'}`}>{comparisonRunPct === null ? 'New' : `${comparisonRunPct >= 0 ? '+' : ''}${comparisonRunPct}%`}</div><div className="muted">previous {comparison.runs} runs</div></div>
              </div>
            </div>
          )}

          {filter !== 'Today' && filter !== 'Monthly' && (
            <div className="chart-section">
              <h2 className="section-title" style={{ fontSize: '1.2rem' }}>{filter === 'All Time' ? 'Monthly Distance (All Time)' : 'Activity by Day of Week'}</h2>
              <div style={{ overflowX: filter === 'All Time' ? 'auto' : 'visible', paddingTop: '20px' }}>
              <div className="chart-container" style={{ minWidth: filter === 'All Time' ? `${Math.max(420, chartData.length * 64)}px` : undefined }}>
                {chartData.map((d, i) => {
                  const heightPct = Math.max(0, (d.val / maxVal) * 100)
                  const isActive = d.val > 0
                  return (
                    <div 
                      key={i} 
                      className={`bar ${isActive ? 'active' : ''}`} 
                      style={{ height: `${heightPct}%`, position: 'relative' }}
                      title={`${d.val.toFixed(1)} km`}
                    >
                      {isActive && (
                        <span style={{ 
                          position: 'absolute', 
                          top: '-20px', 
                          left: '50%', 
                          transform: 'translateX(-50%)', 
                          fontSize: '0.7rem', 
                          color: 'var(--volt)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}>
                          {d.val >= 10 ? Math.round(d.val) : d.val.toFixed(1)}
                        </span>
                      )}
                      <span className="bar-label">{d.label}</span>
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          )}
          
          {(filter === 'Weekly' || filter === 'Monthly') && (
            <div className="chart-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="section-title" style={{ marginBottom: 0, fontSize: '1.2rem' }}>Goal Progress</h2>
              <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{filter} {currentGoal}km Goal</span>
                  <span><button className="inline-action" onClick={() => { setGoalDraft(String(currentGoal)); setEditingGoal(true); setGoalMessage('') }}>Edit goal</button> <span style={{ fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, fontStyle: 'italic', color: 'var(--volt)', marginLeft: '8px' }}>{currentProgress}%</span></span>
                </div>
                <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${currentProgress}%`, background: 'var(--volt)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                </div>
                {editingGoal && <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}><input className="form-input" type="number" min="1" max="2000" step="1" value={goalDraft} onChange={event => setGoalDraft(event.target.value)} style={{ padding: '10px' }} /><button onClick={saveGoal} style={{ background: 'var(--volt)', border: 0, borderRadius: '10px', padding: '0 16px', fontWeight: 800, cursor: 'pointer' }}>Save</button></div>}
                {goalMessage && <p role="status" className="muted" style={{ marginTop: '8px' }}>{goalMessage}</p>}
              </div>

              {filter === 'Monthly' && (
                <div className="chart-section" style={{ marginTop: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '15px', 
                    marginBottom: '20px',
                    background: 'var(--surface-color)',
                    padding: '10px',
                    borderRadius: '30px'
                  }}>
                    <button 
                      onClick={() => setViewingDate(new Date(viewingDate.getFullYear(), viewingDate.getMonth() - 1, 1))}
                      style={{ background: 'none', border: 'none', color: 'var(--volt)', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                      &larr;
                    </button>
                    <div style={{ fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, fontSize: '1.2rem', textTransform: 'uppercase' }}>
                      {viewingDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <button 
                      onClick={() => setViewingDate(new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 1))}
                      style={{ background: 'none', border: 'none', color: 'var(--volt)', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                      &rarr;
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>Monthly Report</h2>
                    <button 
                      onClick={prepareReportData}
                      className="stats-card" 
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '0.8rem', 
                        background: 'var(--volt)', 
                        color: '#000', 
                        border: 'none',
                        fontWeight: 700,
                        borderRadius: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      {reportData ? 'View Report' : 'Generate Report'}
                    </button>
                  </div>

                  <div className="calendar-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '10px',
                    background: 'var(--surface-color)',
                    padding: '20px',
                    borderRadius: '24px'
                  }}>
                    {['M','T','W','T','F','S','S'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{d}</div>
                    ))}
                    {(() => {
                      const days = []
                      const start = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1)
                      const end = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0)
                      let startDay = start.getDay() === 0 ? 6 : start.getDay() - 1
                      
                      for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} />)
                      
                      const now = new Date()
                      for (let d = 1; d <= end.getDate(); d++) {
                        const dateStr = `${viewingDate.getFullYear()}-${String(viewingDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const hasRun = allVerifiedRuns.some(r => r.activity_date === dateStr)
                        const isToday = d === now.getDate() && viewingDate.getMonth() === now.getMonth() && viewingDate.getFullYear() === now.getFullYear()
                        
                        days.push(
                          <div key={d} style={{
                            aspectRatio: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            fontSize: '0.9rem',
                            background: hasRun ? 'var(--volt)' : isToday ? 'var(--surface-hover)' : 'transparent',
                            color: hasRun ? '#000' : isToday ? 'var(--volt)' : 'var(--text-primary)',
                            fontWeight: hasRun || isToday ? 700 : 400,
                            border: isToday ? '1px solid var(--volt)' : 'none'
                          }}>
                            {d}
                          </div>
                        )
                      }
                      return days
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Recent Uploads List - Always visible */}
      <div className="chart-section" style={{ marginTop: '32px', marginBottom: '40px' }}>
        <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Recent Uploads</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recentRuns.length === 0 && !isLoading && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No recent runs.</div>
          )}
          {recentRuns.map(run => (
            <div key={run.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-color)', padding: '16px', borderRadius: '12px'
            }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>
                  {new Date(run.activity_date).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow-condensed)' }}>
                  {parseFloat(run.distance_km).toFixed(1)} km
                </div>
              </div>
              <button 
                onClick={() => handleDeleteRun(run.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ff4444', padding: '8px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Delete Run"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Infographic Overlay */}
      {showInfographic && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{ width: '100%', maxWidth: '400px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <button 
              onClick={() => setShowInfographic(false)}
              style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '1rem' }}
            >
              Close
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDownload} style={{ background: '#222', border: '1px solid #555', color: '#fff', padding: '8px 14px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
              <button onClick={handleShare} style={{ background: 'var(--volt)', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' }}>Share</button>
            </div>
          </div>
          <div ref={reportRef}>
            {reportData && <InfographicReport key={reportData.month + reportData.totalRuns} data={reportData} />}
          </div>
        </div>
      )}
    </div>
  )
}
