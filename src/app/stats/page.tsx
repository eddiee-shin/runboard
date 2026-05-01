'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import html2canvas from 'html2canvas'
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

  useEffect(() => {
    fetchStats()
  }, [filter, viewingDate])

  const getMonthLabel = (date: Date) => {
    return date.toLocaleString('default', { month: 'short' })
  }

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
        if (g.goal_type === 'weekly_distance_km') setWeeklyGoal(g.goal_value)
        if (g.goal_type === 'monthly_distance_km') setMonthlyGoal(g.goal_value)
      })
    }

    // 2. Date Helpers
    const getLocalISODate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const now = new Date()
    const targetDate = filter === 'Monthly' ? viewingDate : now
    
    let query = supabase
      .from('run_sessions')
      .select('distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, activity_date')
      .eq('profile_id', user.id)
      .eq('status', 'verified')

    if (filter === 'Today') {
      const todayStr = getLocalISODate(now)
      query = query.eq('activity_date', todayStr)
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
      query = query.gte('activity_date', getLocalISODate(startOfWeek)).lte('activity_date', getLocalISODate(now))
    } else if (filter === 'Monthly') {
      const startOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth(), 1)
      const endOfMonth = new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 0)
      query = query.gte('activity_date', getLocalISODate(startOfMonth)).lte('activity_date', getLocalISODate(endOfMonth))
    }

    const { data: runs } = await query

    let fDist = 0, fRuns = 0, fDur = 0, totPaceSec = 0, paceCount = 0, totHr = 0, hrCount = 0
    const daysMap = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 0:0 }

    runs?.forEach((r: any) => {
      const dist = parseFloat(r.distance_km || 0)
      fDist += dist
      fRuns++
      fDur += parseInt(r.duration_sec || 0)
      const p = parseInt(r.pace_sec_per_km || 0)
      if (p > 0) { totPaceSec += p; paceCount++ }
      const hr = parseInt(r.avg_heart_rate || 0)
      if (hr > 0) { totHr += hr; hrCount++ }

      const runDate = new Date(r.activity_date)
      daysMap[runDate.getDay() as keyof typeof daysMap] += dist
    })

    setFilteredDistance(fDist)
    setFilteredRuns(fRuns)
    setFilteredDuration(fDur)
    setAvgPace(paceCount > 0 ? totPaceSec / paceCount : 0)
    setAvgHeartRate(hrCount > 0 ? Math.round(totHr / hrCount) : 0)

    if (filter === 'All Time') {
      // Monthly chart for last 6 months
      const monthlyMap: Record<string, number> = {}
      const monthLabels: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyMap[key] = 0
        monthLabels.push(getMonthLabel(d))
      }

      runs?.forEach((r: any) => {
        const rDate = new Date(r.activity_date)
        const key = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`
        if (monthlyMap[key] !== undefined) {
          monthlyMap[key] += parseFloat(r.distance_km || 0)
        }
      })

      const keys = Object.keys(monthlyMap).sort()
      setChartData(keys.map((k, i) => ({ label: monthLabels[i], val: monthlyMap[k] })))
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
    const { data: allRuns } = await supabase
      .from('run_sessions')
      .select('activity_date')
      .eq('profile_id', user.id)
      .eq('status', 'verified')
    
    if (allRuns) {
      setAllVerifiedRuns(allRuns)
    }

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
    
    const { data: thisMonthRuns } = await supabase
      .from('run_sessions')
      .select('*')
      .eq('profile_id', user.id)
      .eq('status', 'verified')
      .gte('activity_date', getLocalISODate(startOfMonth))
      .lte('activity_date', getLocalISODate(endOfMonth))

    let mDist = 0, mRuns = 0, mDur = 0, mPaceTot = 0, mPaceCount = 0, mHrTot = 0, mHrCount = 0, mCal = 0
    let bestR: any = null
    const dowMap: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }
    let qualityGood = 0, qualityNormal = 0

    if (thisMonthRuns) {
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
        if (p > 0) { mPaceTot += p; mPaceCount++ }
        const hr = parseInt(r.avg_heart_rate || 0)
        if (hr > 0) { mHrTot += hr; mHrCount++ }
        if (!bestR || dist > parseFloat(bestR.distance_km)) bestR = r
        if (p > 0 && p <= 360) qualityGood++
        else qualityNormal++
      })
    }


    let maxStrk = 0, currStrk = 0
    for (let i = 1; i <= daysInMonth; i++) {
      if (dailyMap[i] > 0) { currStrk++; if (currStrk > maxStrk) maxStrk = currStrk }
      else currStrk = 0
    }

    setReportData({
      month: viewingDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalDistance: mDist,
      totalRuns: mRuns,
      totalDurationSec: mDur,
      totalCalories: mCal,
      avgPace: mPaceCount > 0 ? mPaceTot / mPaceCount : 0,
      avgHeartRate: mHrCount > 0 ? Math.round(mHrTot / mHrCount) : 0,
      dailyDistances: Object.keys(dailyMap).sort((a,b) => parseInt(a) - parseInt(b)).map(d => ({ 
        day: parseInt(d), 
        distance: dailyMap[parseInt(d)] 
      })),
      bestRun: bestR ? { distance: parseFloat(bestR.distance_km), date: bestR.activity_date } : null,
      displayName: profile?.display_name || 'Runner',
      dowData: [dowMap[1], dowMap[2], dowMap[3], dowMap[4], dowMap[5], dowMap[6], dowMap[0]], 
      quality: { good: qualityGood, normal: qualityNormal },
      maxStreak: maxStrk
    })
    
    setIsLoading(false)
    setShowInfographic(true)
  }

  const handleDownload = async () => {
    if (!reportRef.current) return
    const canvas = await html2canvas(reportRef.current, {
      scale: 2, // Higher quality
      backgroundColor: '#F9F9F4'
    })
    const link = document.createElement('a')
    link.download = `RunBoard_Report_${reportData?.month}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
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

          {filter !== 'Today' && filter !== 'Monthly' && (
            <div className="chart-section">
              <h2 className="section-title" style={{ fontSize: '1.2rem' }}>{filter === 'All Time' ? 'Monthly Distance (Last 6m)' : 'Activity by Day of Week'}</h2>
              <div className="chart-container">
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
          )}
          
          {(filter === 'Weekly' || filter === 'Monthly') && (
            <div className="chart-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="section-title" style={{ marginBottom: 0, fontSize: '1.2rem' }}>Goal Progress</h2>
              <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{filter} {currentGoal}km Goal</span>
                  <span style={{ fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, fontStyle: 'italic', color: 'var(--volt)' }}>{currentProgress}%</span>
                </div>
                <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${currentProgress}%`, background: 'var(--volt)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                </div>
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
            <button 
              onClick={handleDownload}
              style={{ background: 'var(--volt)', border: 'none', color: '#000', padding: '8px 20px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' }}
            >
              Save as Image
            </button>
          </div>
          <div ref={reportRef}>
            {reportData && <InfographicReport key={reportData.month + reportData.totalRuns} data={reportData} />}
          </div>
        </div>
      )}
    </div>
  )
}
