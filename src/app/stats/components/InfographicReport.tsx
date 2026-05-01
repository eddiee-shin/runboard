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
  }
}

export default function InfographicReport({ data }: InfographicProps) {
  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return h > 0 ? `${h}.${Math.floor(m/6)}` : `${m}`
  }

  const formatPace = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const maxDist = Math.max(...data.dailyDistances.map(d => d.distance), 5)
  const calories = Math.round(data.totalDistance * 65)
  
  // Calculate streaks or milestones
  const hasConsistency = data.totalRuns >= 12
  const hasLongRun = (data.bestRun?.distance || 0) >= 15
  const hasGreatPace = data.avgPace < 360 // < 6:00

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
        padding: '45px 30px', 
        marginBottom: '25px',
        textAlign: 'left',
        position: 'relative',
        zIndex: 1,
        borderBottom: '4px solid var(--volt)'
      }}>
        <h1 style={{ 
          fontSize: '30px', 
          fontWeight: 900, 
          margin: 0, 
          color: 'var(--volt)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic',
          textTransform: 'uppercase',
          lineHeight: '1',
          letterSpacing: '-1px'
        }}>
          {data.month} <br />
          RUNNING REPORT
        </h1>
        <p style={{ fontSize: '12px', color: '#AAA', marginTop: '15px', fontWeight: 700, letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={14} color="var(--volt)" fill="var(--volt)" /> RUNBOARD CREW • {data.displayName}
        </p>
      </header>

      <div style={{ padding: '0 30px', position: 'relative', zIndex: 1 }}>
        {/* Main Stats Grid with Gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #0D2B1D 0%, #1a4a35 100%)',
          borderRadius: '32px',
          padding: '30px',
          color: '#FFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          rowGap: '35px',
          columnGap: '15px',
          marginBottom: '40px',
          boxShadow: '0 20px 40px rgba(13, 43, 29, 0.25)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Footprints size={12} /> Runs
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{data.totalRuns}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '2px' }}>회</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Target size={12} /> Dist
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '2px' }}>km</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Zap size={12} /> Time
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '2px' }}>h</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Zap size={12} /> Pace
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{formatPace(data.avgPace)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Heart size={12} /> HR
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '2px' }}>bpm</span></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88A096', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 800, letterSpacing: '0.5px' }}>
              <Flame size={12} /> Cal
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900 }}>{Math.round(calories/100)*100}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>kcal</span></div>
          </div>
        </div>

        {/* Daily Trend Chart */}
        <div style={{ 
          background: '#FFF', 
          borderRadius: '28px', 
          padding: '25px', 
          marginBottom: '40px',
          border: '1px solid #EEE',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <h3 style={{ fontSize: '12px', textAlign: 'left', marginBottom: '25px', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color: '#111', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="#0D2B1D" /> DAILY DISTANCE TREND
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

        {/* Bento Grid: DOW + Quality */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '40px' }}>
          <div style={{ background: '#FFF', borderRadius: '28px', padding: '25px', border: '1px solid #EEE' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '15px', fontWeight: 800, textTransform: 'uppercase' }}>ACTIVITY BY DAY</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '50px' }}>
              {data.dowData?.map((v, i) => {
                const labels = ['M','T','W','T','F','S','S']
                const maxDow = Math.max(...(data.dowData || [1]), 1)
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '10px', background: v > 0 ? '#0D2B1D' : '#F5F5F0', height: `${(v / maxDow) * 100}%`, borderRadius: '5px' }} />
                    <span style={{ fontSize: '8px', color: '#BBB', fontWeight: 800 }}>{labels[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background: '#FFF', borderRadius: '28px', padding: '25px', border: '1px solid #EEE' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '12px', fontWeight: 800, textTransform: 'uppercase' }}>QUALITY</div>
            <div style={{ position: 'relative', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 900 }}>{Math.round((data.quality?.good || 0) / (data.totalRuns || 1) * 100)}%</div>
              <svg style={{ position: 'absolute', width: '60px', height: '60px', transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r="25" fill="none" stroke="#F5F5F0" strokeWidth="5" />
                <circle cx="30" cy="30" r="25" fill="none" stroke="#5E8B61" strokeWidth="5" 
                  strokeDasharray={`${(data.quality?.good || 0) / (data.totalRuns || 1) * 157} 157`} />
              </svg>
            </div>
          </div>
        </div>

        {/* Milestones / Achievement Badges */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#999', marginBottom: '15px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>
            MONTHLY MILESTONES
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
            {hasConsistency && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#F0F7F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px', border: '2px solid #5E8B61' }}>
                  <Medal size={24} color="#5E8B61" />
                </div>
                <div style={{ fontSize: '9px', fontWeight: 800 }}>CONSISTENT</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px', border: '2px solid #FFC107' }}>
                <Trophy size={24} color="#FFC107" />
              </div>
              <div style={{ fontSize: '9px', fontWeight: 800 }}>BEST {data.bestRun?.distance.toFixed(0)}K</div>
            </div>
            {hasGreatPace && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#FBE9E7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px', border: '2px solid #FF5722' }}>
                  <Flame size={24} color="#FF5722" />
                </div>
                <div style={{ fontSize: '9px', fontWeight: 800 }}>SPEEDSTER</div>
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
