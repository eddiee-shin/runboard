'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type FilterType = 'Today' | 'Weekly' | 'Monthly' | 'All Time'

interface UserRank {
  profileId: string
  displayName: string
  avatarUrl: string
  totalDistance: number
  totalRuns: number
  rank?: number
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const [filter, setFilter] = useState<FilterType>('Today')
  const [leaderboard, setLeaderboard] = useState<UserRank[]>([])
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [filter])

  const fetchLeaderboard = async () => {
    setIsLoading(true)
    
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setMyProfileId(user.id)

    // 2. Fetch all verified run sessions with profile info
    let query = supabase.from('run_sessions')
      .select('distance_km, activity_date, profiles(id, display_name, avatar_url)')
      .eq('status', 'verified')

    // 3. Apply date filters
    const now = new Date()
    const getLocalISODate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    if (filter === 'Today') {
      query = query.eq('activity_date', getLocalISODate(now))
    } else if (filter === 'Weekly') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const startOfWeek = new Date(now.setDate(diff))
      startOfWeek.setHours(0,0,0,0)
      query = query.gte('activity_date', getLocalISODate(startOfWeek))
    } else if (filter === 'Monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      query = query.gte('activity_date', getLocalISODate(startOfMonth))
    }

    const { data: runs, error } = await query

    if (error || !runs) {
      console.error('Error fetching leaderboard', error)
      setIsLoading(false)
      return
    }

    // 4. Aggregate data
    const userMap: Record<string, UserRank> = {}

    runs.forEach((run: any) => {
      const p = run.profiles
      if (!p) return
      if (!userMap[p.id]) {
        userMap[p.id] = {
          profileId: p.id,
          displayName: p.display_name || 'Anonymous',
          avatarUrl: p.avatar_url || '',
          totalDistance: 0,
          totalRuns: 0
        }
      }
      userMap[p.id].totalDistance += parseFloat(run.distance_km || 0)
      userMap[p.id].totalRuns += 1
    })

    // 5. Sort by distance and assign ranks
    const sorted = Object.values(userMap).sort((a, b) => b.totalDistance - a.totalDistance)
    sorted.forEach((u, i) => u.rank = i + 1)

    setLeaderboard(sorted)
    setIsLoading(false)
  }

  const myRankData = leaderboard.find(u => u.profileId === myProfileId)

  // Helper to get initials
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase()
  }

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
          Loading leaderboard...
        </div>
      ) : (
        <>
          {/* Total Crew Distance */}
          <div style={{
            background: 'var(--surface-color)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Crew Total ({filter})
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--volt)' }}>
              {leaderboard.reduce((sum, user) => sum + user.totalDistance, 0).toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>km</span>
            </div>
          </div>

          {/* My Rank */}
          {myRankData && (
            <div className="my-rank-card">
              <div className="stat-number my-rank-pos">{myRankData.rank}</div>
              <div className="my-rank-info">
                <div className="my-rank-name">{myRankData.displayName} (Me)</div>
                <div className="my-rank-stats">
                  <span><span className="stat-highlight">{myRankData.totalDistance.toFixed(1)}</span> km</span>
                  <span><span className="stat-highlight">{myRankData.totalRuns}</span> runs</span>
                </div>
              </div>
            </div>
          )}

          {/* List */}
          <div className="rank-list">
            {leaderboard.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                No runs recorded yet.
              </div>
            )}
            {leaderboard.map((user) => {
              const isMe = user.profileId === myProfileId
              const isTop3 = user.rank! <= 3
              
              const fireThreshold = filter === 'Weekly' ? 3 : 15;
              const hasFire = (filter === 'Weekly' || filter === 'Monthly') && user.totalRuns >= fireThreshold;

              // Colors for top 3
              let bg = '#1A202C' // default
              if (user.rank === 1) bg = 'var(--volt)' // Volt
              else if (user.rank === 2) bg = '#CBD5E0' // Silver
              else if (user.rank === 3) bg = '#A0AEC0' // Bronze
              if (isMe && !isTop3) bg = 'var(--volt)'

              return (
                <div key={user.profileId} className={`rank-item ${isTop3 ? `top-${user.rank}` : ''}`}>
                  <div className="rank-pos">{user.rank}</div>
                  <div className="avatar" style={{ background: bg, color: (user.rank === 1 || isMe) ? '#000' : '#fff' }}>
                    {getInitials(user.displayName)}
                  </div>
                  <div className="rank-details">
                    <div className="rank-name">
                      {user.displayName} {isMe ? '(Me)' : ''}
                      {hasFire && <span className="fire-icon" title={`On Fire! (${fireThreshold}+ runs)`}>🔥</span>}
                    </div>
                    <div className="rank-meta">{user.totalRuns} runs</div>
                  </div>
                  <div className="rank-score">
                    <span className="val" style={{ color: isMe ? 'var(--volt)' : 'var(--text-primary)' }}>
                      {user.totalDistance.toFixed(1)}
                    </span>
                    <span className="unit">km</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
