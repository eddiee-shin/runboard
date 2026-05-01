'use client'

import React from 'react'
import { format } from 'date-fns'

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

  const maxDist = Math.max(...data.dailyDistances.map(d => d.distance), 10)

  return (
    <div id="infographic-report" style={{
      width: '400px',
      background: '#F9F9F4', // Light cream background like the reference
      color: '#1A1A1A',
      padding: '30px 20px',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative elements could go here */}
      
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 900, 
          margin: 0, 
          color: '#0D2B1D',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontStyle: 'italic',
          textTransform: 'uppercase'
        }}>
          {data.month} <br />
          RUNNING REPORT
        </h1>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          RunBoard Crew • {data.displayName}
        </p>
      </header>

      {/* Summary Box */}
      <div style={{
        background: '#0D2B1D', // Dark green like reference
        borderRadius: '16px',
        padding: '20px',
        color: '#FFF',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px' }}>Runs</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.totalRuns}<span style={{ fontSize: '12px', fontWeight: 400 }}>회</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px' }}>Distance</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.totalDistance.toFixed(1)}<span style={{ fontSize: '12px', fontWeight: 400 }}>km</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px' }}>Time</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatDuration(data.totalDurationSec)}<span style={{ fontSize: '12px', fontWeight: 400 }}>h</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px' }}>Avg Pace</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatPace(data.avgPace)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#88A096', textTransform: 'uppercase', marginBottom: '4px' }}>Avg HR</div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>{data.avgHeartRate > 0 ? data.avgHeartRate : '--'}<span style={{ fontSize: '12px', fontWeight: 400 }}>bpm</span></div>
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '15px', fontWeight: 800 }}>MONTHLY DISTANCE TREND</h3>
        <div style={{ 
          height: '120px', 
          display: 'flex', 
          alignItems: 'flex-end', 
          justifyContent: 'space-between',
          padding: '0 10px'
        }}>
          {data.dailyDistances.map((d, i) => (
            <div key={i} style={{ 
              width: '6px', 
              background: d.distance > 0 ? '#5E8B61' : '#E0E0D0',
              height: `${(d.distance / maxDist) * 100}%`,
              borderRadius: '3px'
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '9px', color: '#999' }}>
          <span>Day 1</span>
          <span>Day {data.dailyDistances.length}</span>
        </div>
      </div>

      {/* Insights Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div style={{ 
          background: '#FFF', 
          borderRadius: '12px', 
          padding: '15px', 
          border: '1px solid #EAEAEA',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px' }}>BEST PERFORMANCE</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#5E8B61' }}>
            {data.bestRun ? data.bestRun.distance.toFixed(1) : '0.0'} <span style={{ fontSize: '10px' }}>km</span>
          </div>
          <div style={{ fontSize: '9px', color: '#BBB' }}>{data.bestRun ? data.bestRun.date : '-'}</div>
        </div>
        <div style={{ 
          background: '#FFF', 
          borderRadius: '12px', 
          padding: '15px', 
          border: '1px solid #EAEAEA',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px' }}>MONTHLY GOAL</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: data.totalDistance >= 100 ? '#D4FF00' : '#1A1A1A' }}>
            {data.totalDistance >= 100 ? 'SUCCESS' : 'ON GOING'}
          </div>
          <div style={{ fontSize: '9px', color: '#BBB' }}>Target: 100km</div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ marginTop: '40px', textAlign: 'center', borderTop: '1px solid #EEE', paddingTop: '15px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: '#BBB' }}>RUNBOARD APP</div>
      </footer>
    </div>
  )
}
