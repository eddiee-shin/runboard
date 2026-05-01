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

  return (
    <div id="infographic-report" style={{
      width: '400px',
      background: '#F9F9F4',
      color: '#1A1A1A',
      paddingBottom: '30px',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header Section with Dark Background */}
      <header style={{ 
        background: '#222', 
        padding: '30px 20px', 
        marginBottom: '25px',
        textAlign: 'left'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 900, 
          margin: 0, 
          color: 'var(--volt)', // Use Volt for high contrast on dark
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic',
          textTransform: 'uppercase',
          lineHeight: '1.1'
        }}>
          {data.month} <br />
          RUNNING REPORT
        </h1>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '10px', fontWeight: 600 }}>
          RunBoard Crew • {data.displayName}
        </p>
      </header>

      <div style={{ padding: '0 20px' }}>
        {/* Summary Box */}
        <div style={{
          background: '#0D2B1D',
          borderRadius: '24px',
          padding: '24px',
          color: '#FFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          rowGap: '20px',
          columnGap: '10px',
          marginBottom: '30px'
        }}>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>Runs</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.totalRuns}<span style={{ fontSize: '12px', fontWeight: 400 }}>회</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>Distance</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '12px', fontWeight: 400 }}>km</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>Time</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '12px', fontWeight: 400 }}>h</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>Avg Pace</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatPace(data.avgPace)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 700 }}>Avg HR</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '12px', fontWeight: 400 }}>bpm</span></div>
          </div>
        </div>

        {/* Daily Trend Chart with numbers */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '13px', textAlign: 'center', marginBottom: '25px', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase' }}>
            MONTHLY DISTANCE TREND
          </h3>
          <div style={{ 
            height: '140px', 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between',
            padding: '0 5px',
            borderBottom: '1px solid #DDD'
          }}>
            {data.dailyDistances.map((d, i) => (
              <div key={i} style={{ 
                width: '6px', 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                position: 'relative'
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
                  background: d.distance > 0 ? '#5E8B61' : 'transparent',
                  height: `${(d.distance / maxDist) * 100}%`,
                  borderRadius: '3px 3px 0 0'
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#BBB', fontWeight: 600 }}>
            <span>Day 1</span>
            <span>Day {data.dailyDistances.length}</span>
          </div>
        </div>

        {/* Insights Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ 
            background: '#FFF', 
            borderRadius: '16px', 
            padding: '20px', 
            border: '1px solid #EEE'
          }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>BEST PERFORMANCE</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1A1A1A' }}>
              {data.bestRun ? data.bestRun.distance.toFixed(1) : '0.0'} <span style={{ fontSize: '12px' }}>km</span>
            </div>
            <div style={{ fontSize: '10px', color: '#BBB', marginTop: '4px' }}>{data.bestRun ? data.bestRun.date : '-'}</div>
          </div>
          <div style={{ 
            background: '#FFF', 
            borderRadius: '16px', 
            padding: '20px', 
            border: '1px solid #EEE'
          }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>MONTHLY GOAL</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: data.totalDistance >= 100 ? 'var(--volt)' : '#1A1A1A', fontStyle: 'italic' }}>
              {data.totalDistance >= 100 ? 'SUCCESS' : 'PROGRESS'}
            </div>
            <div style={{ fontSize: '10px', color: '#BBB', marginTop: '4px' }}>Target: 100km</div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '50px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '3px', color: '#DDD', textTransform: 'uppercase' }}>RUNBOARD APP</div>
        </footer>
      </div>
    </div>
  )
}
