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
  const calories = Math.round(data.totalDistance * 65)
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
          padding: '25px',
          color: '#FFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          rowGap: '25px',
          columnGap: '15px',
          marginBottom: '20px',
          boxShadow: '0 15px 35px rgba(13, 43, 29, 0.2)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Footprints size={12} /> Runs
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{data.totalRuns}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>회</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Target size={12} /> Dist
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>km</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Zap size={12} /> Time
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>h</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Zap size={12} /> Pace
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{formatPace(data.avgPace)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Heart size={12} /> HR
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>bpm</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 800 }}>
              <Flame size={12} /> Cal
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{Math.round(calories/100)*100}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>kcal</span></div>
          </div>
        </div>

        {/* Daily Trend Chart */}
        <div style={{ 
          background: '#FFF', 
          borderRadius: '24px', 
          padding: '20px', 
          marginBottom: '20px',
          border: '1px solid #EEE',
          boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '11px', textAlign: 'left', marginBottom: '20px', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={12} color="#0D2B1D" /> DAILY TREND
          </h3>
          <div style={{ 
            height: '110px', 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between',
            position: 'relative',
            padding: '0 5px'
          }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #F0F0F0', zIndex: 0 }} />
            {data.dailyDistances.map((d, i) => (
              <div key={i} style={{ width: '6px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                {d.distance > 0 && (
                  <span style={{ fontSize: '7px', fontWeight: 800, marginBottom: '4px', color: '#5E8B61', position: 'absolute', top: `calc(${100 - (d.distance / maxDist) * 100}% - 14px)` }}>
                    {d.distance >= 1 ? Math.round(d.distance) : d.distance.toFixed(1)}
                  </span>
                )}
                <div style={{ width: '100%', background: d.distance > 0 ? '#5E8B61' : '#F5F5F0', height: d.distance > 0 ? `${(d.distance / maxDist) * 100}%` : '4px', borderRadius: '3px' }} />
              </div>
            ))}
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
