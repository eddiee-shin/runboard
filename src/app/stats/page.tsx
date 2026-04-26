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

export default function StatsPage() {
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  
  // Stats
  const [weeklyDistance, setWeeklyDistance] = useState(0)
  const [monthlyDistance, setMonthlyDistance] = useState(0)
  const [weeklyRuns, setWeeklyRuns] = useState(0)
  const [avgPace, setAvgPace] = useState(0)
  const [avgHeartRate, setAvgHeartRate] = useState(0)
  const [chartData, setChartData] = useState<{label: string, val: number}[]>([])

  // Goals
  const [weeklyGoal, setWeeklyGoal] = useState(40) // Default 40
  const [monthlyGoal, setMonthlyGoal] = useState(150) // Default 150

  useEffect(() => {
    fetchStats()
  }, [])

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
    
    // 1st of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0]

    // Monday of current week
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    // Create new Date instance to avoid mutating
    const startOfWeek = new Date(now.getTime())
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0,0,0,0)
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0]

    // We need to fetch runs from the earliest of startOfWeek or startOfMonth
    const minDateStr = startOfWeek < startOfMonth ? startOfWeekStr : startOfMonthStr

    // Fetch runs
    const { data: runs, error } = await supabase
      .from('run_sessions')
      .select('distance_km, duration_sec, pace_sec_per_km, avg_heart_rate, activity_date')
      .eq('profile_id', user.id)
      .eq('status', 'verified')
      .gte('activity_date', minDateStr)

    if (error || !runs) {
      console.error('Error fetching stats', error)
      setIsLoading(false)
      return
    }

    let wDist = 0
    let mDist = 0
    let totPaceSec = 0
    let paceCount = 0
    let totHr = 0
    let hrCount = 0
    let wRuns = 0

    // Initialize chart data for Mon-Sun
    const daysMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 } // Sunday is 0
    
    runs.forEach((r: any) => {
      const dist = parseFloat(r.distance_km || 0)
      const rDateStr = r.activity_date

      // Monthly aggregation
      if (rDateStr >= startOfMonthStr) {
        mDist += dist
      }

      // Weekly aggregation
      if (rDateStr >= startOfWeekStr) {
        wDist += dist
        wRuns++
        
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

        const runDate = new Date(rDateStr)
        daysMap[runDate.getDay() as keyof typeof daysMap] += dist
      }
    })

    setWeeklyDistance(wDist)
    setMonthlyDistance(mDist)
    setWeeklyRuns(wRuns)
    setAvgPace(paceCount > 0 ? totPaceSec / paceCount : 0)
    setAvgHeartRate(hrCount > 0 ? Math.round(totHr / hrCount) : 0)

    // Format chart array [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    setChartData([
      { label: 'M', val: daysMap[1] },
      { label: 'T', val: daysMap[2] },
      { label: 'W', val: daysMap[3] },
      { label: 'T', val: daysMap[4] },
      { label: 'F', val: daysMap[5] },
      { label: 'S', val: daysMap[6] },
      { label: 'S', val: daysMap[0] }
    ])

    setIsLoading(false)
  }

  const weeklyProgress = Math.min(100, Math.round((weeklyDistance / weeklyGoal) * 100)) || 0
  const monthlyProgress = Math.min(100, Math.round((monthlyDistance / monthlyGoal) * 100)) || 0
  // Find max for chart scaling
  const maxVal = Math.max(...chartData.map(d => d.val), 10) // min 10km scale

  return (
    <div className="content active">
      {isLoading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>
          Loading stats...
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card main">
              <div className="stat-label">This Week</div>
              <div className="stat-number">{weeklyDistance.toFixed(1)} <span className="stat-unit">km</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Runs</div>
              <div className="stat-number">{weeklyRuns}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Pace</div>
              <div className="stat-number">{formatPace(avgPace)} <span className="stat-unit">/km</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg HR</div>
              <div className="stat-number">{avgHeartRate > 0 ? avgHeartRate : '--'} <span className="stat-unit">bpm</span></div>
            </div>
          </div>

          <div className="chart-section">
            <h2 className="section-title">Weekly Distance</h2>
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
          
          <div className="chart-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Goal Progress</h2>
            
            {/* Weekly Goal */}
            <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Weekly {weeklyGoal}km Goal</span>
                <span style={{ fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, fontStyle: 'italic', color: 'var(--volt)' }}>{weeklyProgress}%</span>
              </div>
              <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${weeklyProgress}%`, background: 'var(--volt)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
              </div>
            </div>

            {/* Monthly Goal */}
            <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Monthly {monthlyGoal}km Goal</span>
                <span style={{ fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700, fontStyle: 'italic', color: 'var(--volt)' }}>{monthlyProgress}%</span>
              </div>
              <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${monthlyProgress}%`, background: 'var(--volt)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
