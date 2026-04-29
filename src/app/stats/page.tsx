'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  // Goals
  const [weeklyGoal, setWeeklyGoal] = useState(40) // Default 40
  const [monthlyGoal, setMonthlyGoal] = useState(150) // Default 150

  useEffect(() => {
    fetchStats()
  }, [filter])

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

    // 2. Date Logic
    const now = new Date()
    const getLocalISODate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    
    let query = supabase
      .from('run_sessions')
      .select('distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, activity_date')
      .eq('profile_id', user.id)
      .eq('status', 'verified')

    if (filter === 'Today') {
      query = query.eq('activity_date', getLocalISODate(now))
    } else if (filter === 'Weekly') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const startOfWeek = new Date(now.setDate(diff))
      startOfWeek.setHours(0,0,0,0)
      query = query.gte('activity_date', getLocalISODate(startOfWeek))
    } else if (filter === 'Monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('activity_date', getLocalISODate(startOfMonth))
    }

    const { data: runs, error } = await query

    if (error || !runs) {
      console.error('Error fetching stats', error)
      setIsLoading(false)
      return
    }

    let fDist = 0
    let fRuns = 0
    let fDur = 0
    let totPaceSec = 0
    let paceCount = 0
    let totHr = 0
    let hrCount = 0

    const daysMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 } // Sunday is 0
    
    runs.forEach((r: any) => {
      const dist = parseFloat(r.distance_km || 0)
      fDist += dist
      fRuns++
      fDur += parseInt(r.duration_sec || 0)
      
      const pace = parseInt(r.pace_sec_per_km || 0)
      if (pace > 0) {
        totPaceSec += pace
        paceCount++
      }

      const hr = parseInt(r.avg_heart_rate || 0)
      if (hr > 0) {
        totHr += hr
        hrCount++
      }

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

      runs.forEach((r: any) => {
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

    // 4. Fetch All Verified Runs (for calendar)
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

  const handleDeleteRun = async (id: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return
    
    setIsLoading(true)
    const { error } = await supabase.from('run_sessions').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete run', error)
      alert('Failed to delete run')
      setIsLoading(false)
    } else {
      fetchStats()
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
              <h2 className="section-title">{filter === 'All Time' ? 'Monthly Distance (Last 6m)' : 'Activity by Day of Week'}</h2>
              <div className="chart-container">
                {chartData.map((d, i) => {
                  const heightPct = Math.max(0, (d.val / maxVal) * 100)
                  const isActive = d.val > 0
                  return (
                    <div 
                      key={i} 
                      className={`bar ${isActive ? 'active' : ''}`} 
                      style={{ height: `${heightPct}%` }}
                      title={`${d.val.toFixed(1)} km`}
                    >
                      <span className="bar-label">{d.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
            {(filter === 'Weekly' || filter === 'Monthly') && (
              <div className="chart-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Goal Progress</h2>
              
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
                  <h2 className="section-title">Monthly Calendar</h2>
                  <div className="calendar-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '8px',
                    background: 'var(--surface-color)',
                    padding: '16px',
                    borderRadius: '16px'
                  }}>
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                      <div key={i} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{d}</div>
                    ))}
                    {(() => {
                      const now = new Date()
                      const start = new Date(now.getFullYear(), now.getMonth(), 1)
                      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                      const days = []
                      
                      for (let i = 0; i < start.getDay(); i++) {
                        days.push(<div key={`pad-${i}`} />)
                      }
                      
                      for (let d = 1; d <= end.getDate(); d++) {
                        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const hasRun = allVerifiedRuns.some(r => r.activity_date === dateStr)
                        const isToday = d === now.getDate()
                        
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



          <div className="chart-section" style={{ marginTop: '32px' }}>
            <h2 className="section-title">Recent Uploads</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentRuns.length === 0 && (
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
        </>
      )}
    </div>
  )
}
