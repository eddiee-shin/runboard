'use client'

import React from 'react'

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
  const calories = Math.round(data.totalDistance * 60) // Rough estimate

  return (
    <div id="infographic-report" style={{
      width: '400px',
      background: '#F9F9F4',
      color: '#1A1A1A',
      paddingBottom: '40px',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Wave */}
      <svg style={{ position: 'absolute', top: '150px', left: 0, width: '100%', opacity: 0.05, zIndex: 0 }} viewBox="0 0 400 200">
        <path d="M0 100 C 50 150, 150 50, 200 100 S 350 150, 400 100" fill="none" stroke="#0D2B1D" strokeWidth="20" strokeLinecap="round" />
      </svg>
      
      {/* Header Section */}
      <header style={{ 
        background: '#222', 
        padding: '40px 25px', 
        marginBottom: '25px',
        textAlign: 'left',
        position: 'relative',
        zIndex: 1
      }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 900, 
          margin: 0, 
          color: 'var(--volt)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic',
          textTransform: 'uppercase',
          lineHeight: '1'
        }}>
          {data.month} <br />
          RUNNING REPORT
        </h1>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '12px', fontWeight: 600, letterSpacing: '1px' }}>
          RunBoard Crew • {data.displayName}
        </p>
      </header>

      <div style={{ padding: '0 25px', position: 'relative', zIndex: 1 }}>
        {/* Main Stats Grid */}
        <div style={{
          background: '#0D2B1D',
          borderRadius: '28px',
          padding: '25px',
          color: '#FFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          rowGap: '25px',
          columnGap: '15px',
          marginBottom: '35px',
          boxShadow: '0 15px 35px rgba(13, 43, 29, 0.2)'
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>Runs</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{data.totalRuns}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>회</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>Distance</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>km</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>Time</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>h</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>Avg Pace</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{formatPace(data.avgPace)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>Avg HR</div>
            <div style={{ fontSize: '22px', fontWeight: 800 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '2px' }}>bpm</span></div>
          </div>
        </div>

        {/* Daily Trend Chart */}
        <div style={{ 
          background: '#FFF', 
          borderRadius: '24px', 
          padding: '25px', 
          marginBottom: '35px',
          border: '1px solid #EEE'
        }}>
          <h3 style={{ fontSize: '12px', textAlign: 'left', marginBottom: '25px', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color: '#333' }}>
            DAILY DISTANCE TREND
          </h3>
          <div style={{ 
            height: '120px', 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between',
            position: 'relative',
            padding: '0 5px'
          }}>
            {/* Goal Line (simulated) */}
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #EEE', zIndex: 0 }} />
            
            {data.dailyDistances.map((d, i) => (
              <div key={i} style={{ 
                width: '6px', 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                {d.distance > 0 && (
                  <span style={{ 
                    fontSize: '7px', 
                    fontWeight: 700, 
                    marginBottom: '4px', 
                    color: '#5E8B61',
                    position: 'absolute',
                    top: `calc(${100 - (d.distance / maxDist) * 100}% - 14px)`
                  }}>
                    {d.distance >= 1 ? Math.round(d.distance) : d.distance.toFixed(1)}
                  </span>
                )}
                <div style={{ 
                  width: '100%',
                  background: d.distance > 0 ? '#5E8B61' : '#F0F0F0',
                  height: d.distance > 0 ? `${(d.distance / maxDist) * 100}%` : '4px',
                  borderRadius: '3px'
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '9px', color: '#BBB', fontWeight: 600 }}>
            <span>DAY 1</span>
            <span>DAY {data.dailyDistances.length}</span>
          </div>
        </div>

        {/* Insights Section - Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '35px' }}>
          {/* Day of Week Distribution */}
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '20px', border: '1px solid #EEE' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '15px', fontWeight: 700, textTransform: 'uppercase' }}>ACTIVITY BY DAY</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '60px', padding: '0 5px' }}>
              {data.dowData?.map((v, i) => {
                const labels = ['M','T','W','T','F','S','S']
                const maxDow = Math.max(...(data.dowData || [1]), 1)
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', background: v > 0 ? '#0D2B1D' : '#F0F0F0', height: `${(v / maxDow) * 100}%`, borderRadius: '4px' }} />
                    <span style={{ fontSize: '8px', color: '#BBB', fontWeight: 700 }}>{labels[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Calories */}
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '20px', border: '1px solid #EEE', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>ENERGY</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{calories.toLocaleString()}</div>
            <div style={{ fontSize: '10px', color: '#BBB' }}>KCAL BURNED</div>
          </div>
        </div>

        {/* Quality and Goals Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '20px', border: '1px solid #EEE' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase' }}>RUN QUALITY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '8px', background: '#F0F0F0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(data.quality?.good || 0) / (data.totalRuns || 1) * 100}%`, background: '#5E8B61' }} />
                <div style={{ width: `${(data.quality?.normal || 0) / (data.totalRuns || 1) * 100}%`, background: '#E0E0D0' }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800 }}>{Math.round((data.quality?.good || 0) / (data.totalRuns || 1) * 100)}%</span>
            </div>
            <div style={{ fontSize: '9px', color: '#BBB', marginTop: '5px' }}>{data.quality?.good} Good • {data.quality?.normal} Normal</div>
          </div>
          
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '20px', border: '1px solid #EEE' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>MONTHLY GOAL</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: data.totalDistance >= 100 ? 'var(--volt)' : '#1A1A1A', fontStyle: 'italic' }}>
              {data.totalDistance >= 100 ? 'SUCCESS' : 'ON GOING'}
            </div>
            <div style={{ fontSize: '10px', color: '#BBB', marginTop: '2px' }}>Target: 100km</div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '4px', color: '#DDD', textTransform: 'uppercase' }}>RUNBOARD APP</div>
        </footer>
      </div>
    </div>
  )
}
