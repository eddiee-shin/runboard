import { Trophy, Flame, Heart, Footprints, Target, Zap, Medal } from 'lucide-react'

interface InfographicProps {
  data: {
    month: string
    totalDistance: number
    totalRuns: number
    totalDurationSec: number
    avgPace: number
    avgHeartRate: number
    dailyDistances: { day: number; distance: number }[]
    bestRun: { distance: number; date: string } | null
    displayName: string
    dowData?: number[]
    quality?: { good: number; normal: number }
    maxStreak?: number
    totalCalories?: number
  }
}

import { useState, useEffect } from 'react'

export default function InfographicReport({ data }: InfographicProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return h > 0 ? `${h}.${Math.round(m/6)}` : `0.${Math.round(m/6)}`
  }

  const formatPace = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Reactive calculations
  const safeDailyDistances = data.dailyDistances || []
  const maxDist = Math.max(...safeDailyDistances.map(d => d.distance), 5)
  const hasGreatPace = data.avgPace > 0 && data.avgPace <= 330 // Under 5:30 min/km

  if (!mounted) return null

  return (
    <div id="infographic-report" style={{
      width: '400px',
      background: '#F9F9F4',
      backgroundImage: 'radial-gradient(#e5e5f7 0.5px, transparent 0.5px)',
      backgroundSize: '10px 10px', // Subtle grid texture
      color: '#1A1A1A',
      paddingBottom: '50px',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Paths */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.04, zIndex: 0 }} viewBox="0 0 400 800">
        <path d="M-50 200 Q 100 100, 200 300 T 450 250" fill="none" stroke="#0D2B1D" strokeWidth="2" />
        <path d="M-50 500 Q 150 400, 250 600 T 450 550" fill="none" stroke="#0D2B1D" strokeWidth="2" />
        <circle cx="350" cy="150" r="100" fill="none" stroke="#0D2B1D" strokeWidth="1" />
      </svg>
      
      {/* Header Section with Gradient */}
      <header style={{ 
        background: 'linear-gradient(135deg, #222 0%, #333 100%)', 
        padding: '30px 25px', 
        marginBottom: '20px',
        textAlign: 'left',
        position: 'relative',
        zIndex: 1,
        borderBottom: '4px solid var(--volt)'
      }}>
        <h1 style={{ 
          fontSize: '22px', 
          fontWeight: 900, 
          margin: 0, 
          color: 'var(--volt)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic',
          textTransform: 'uppercase',
          lineHeight: '1.1',
          letterSpacing: '-0.5px'
        }}>
          {data.month} <br />
          RUNNING REPORT
        </h1>
        <p style={{ fontSize: '11px', color: '#AAA', marginTop: '10px', fontWeight: 700, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={12} color="var(--volt)" fill="var(--volt)" /> RUNBOARD CREW • {data.displayName}
        </p>
      </header>

      <div style={{ padding: '0 25px', position: 'relative', zIndex: 1 }}>
        {/* Main Stats Grid with Gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #0D2B1D 0%, #1a4a35 100%)',
          borderRadius: '28px',
          padding: '30px 25px',
          color: '#FFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          rowGap: '30px',
          columnGap: '10px',
          marginBottom: '20px',
          boxShadow: '0 15px 35px rgba(13, 43, 29, 0.25)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Footprints size={14} /> Runs
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{data.totalRuns}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '3px', opacity: 0.8 }}>회</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Target size={14} /> Dist
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '3px', opacity: 0.8 }}>km</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Zap size={14} /> Time
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '3px', opacity: 0.8 }}>h</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Zap size={14} /> Pace
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{formatPace(data.avgPace)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Heart size={14} /> HR
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '3px', opacity: 0.8 }}>bpm</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Flame size={14} /> Cal
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{data.totalCalories || 0}<span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '3px', opacity: 0.8 }}>kcal</span></div>
          </div>
        </div>

        {/* Daily Trend Chart (Bars + Cumulative Line) */}
        <div style={{ 
          background: '#FFF', 
          borderRadius: '24px', 
          padding: '20px', 
          marginBottom: '20px',
          border: '1px solid #EEE',
          boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
          position: 'relative'
        }}>
          <h3 style={{ fontSize: '11px', textAlign: 'left', marginBottom: '20px', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={12} color="#0D2B1D" /> DAILY TREND & CUMULATIVE
          </h3>
          <div style={{ 
            height: '120px', 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between',
            position: 'relative',
            padding: '0 5px'
          }}>
            {/* Grid Lines */}
            <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed #F5F5F0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #F5F5F0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed #F5F5F0', zIndex: 0 }} />

            {/* Cumulative Line Path */}
            <svg 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, overflow: 'visible' }}
              viewBox="0 0 350 120"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(94, 139, 97, 0.3)" />
                  <stop offset="100%" stopColor="rgba(94, 139, 97, 0)" />
                </linearGradient>
              </defs>
              {(() => {
                let cumulative = 0
                const numDays = data.dailyDistances.length
                const points = data.dailyDistances.map((d, i) => {
                  cumulative += d.distance
                  const x = (i / (numDays - 1)) * 350
                  const y = 120 - (cumulative / (data.totalDistance || 1)) * 110 - 5
                  return { x, y }
                })
                
                const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                const areaData = `${pathData} L 350 120 L 0 120 Z`
                
                return (
                  <>
                    <path d={areaData} fill="url(#cumGradient)" stroke="none" />
                    <path 
                      d={pathData}
                      fill="none"
                      stroke="#5E8B61"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    />
                    {/* End point dot */}
                    <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4" fill="#5E8B61" stroke="#FFF" strokeWidth="2" />
                  </>
                )
              })()}
            </svg>

            {/* Daily Bars */}
            {data.dailyDistances.map((d, i) => (
              <div key={i} style={{ width: '6px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                {d.distance > 0 && (
                  <span style={{ fontSize: '7px', fontWeight: 800, marginBottom: '4px', color: '#5E8B61', position: 'absolute', top: `calc(${100 - (d.distance / maxDist) * 100}% - 14px)`, zIndex: 3 }}>
                    {d.distance >= 1 ? Math.round(d.distance) : d.distance.toFixed(1)}
                  </span>
                )}
                <div style={{ width: '100%', background: d.distance > 0 ? 'rgba(94, 139, 97, 0.2)' : '#F5F5F0', height: d.distance > 0 ? `${(d.distance / maxDist) * 100}%` : '2px', borderRadius: '3px', transition: 'all 0.3s' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <span style={{ fontSize: '8px', color: '#BBB', fontWeight: 700 }}>1ST</span>
            <span style={{ fontSize: '8px', color: '#BBB', fontWeight: 700 }}>{data.month.split(' ')[0].toUpperCase()} PROGRESS</span>
            <span style={{ fontSize: '8px', color: '#BBB', fontWeight: 700 }}>{data.dailyDistances.length}TH</span>
          </div>
        </div>

        {/* Milestones / Achievement Badges */}
        <div style={{ 
          background: '#FFF', 
          borderRadius: '24px', 
          padding: '25px', 
          marginBottom: '20px',
          border: '1px solid #EEE',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#999', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            MONTHLY MILESTONES
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#F0F7F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', border: '2px solid #5E8B61' }}>
                <Medal size={28} color="#5E8B61" />
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800 }}>{data.maxStreak || 0} DAY STREAK</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', border: '2px solid #FFC107' }}>
                <Trophy size={28} color="#FFC107" />
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800 }}>BEST {data.bestRun?.distance.toFixed(0)}K</div>
            </div>
            {hasGreatPace && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#FBE9E7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', border: '2px solid #FF5722' }}>
                  <Flame size={28} color="#FF5722" />
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800 }}>SPEEDSTER</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '50px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '5px', color: '#DDD', textTransform: 'uppercase' }}>RUNBOARD APP</div>
        </footer>
      </div>
    </div>
  )
}
