'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import InstallPWA from '@/components/InstallPWA'

export default function ProfilePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [nickname, setNickname] = useState('')
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [monthlyGoal, setMonthlyGoal] = useState('')
  const [memo, setMemo] = useState('')
  
  const [message, setMessage] = useState('')

  // Strava
  const [stravaConnected, setStravaConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    fetchProfileData()

    // Check for Strava callback status
    const stravaStatus = searchParams?.get('strava')
    const stravaReason = searchParams?.get('reason')
    if (stravaStatus === 'connected') {
      setSyncMessage('✅ Strava connected successfully!')
    } else if (stravaStatus === 'error') {
      setSyncMessage(`❌ Failed to connect Strava. ${stravaReason || 'Please try again.'}`)
    }
  }, [])

  const fetchProfileData = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setIsLoading(false)
      return
    }
    
    setUserId(user.id)

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, running_memo')
      .eq('id', user.id)
      .single()

    if (profile) {
      if (profile.display_name) setNickname(profile.display_name)
      if (profile.running_memo) setMemo(profile.running_memo)
    }

    // Fetch goals
    const { data: goals } = await supabase
      .from('running_goals')
      .select('goal_type, goal_value')
      .eq('profile_id', user.id)
      .in('goal_type', ['weekly_distance_km', 'monthly_distance_km'])

    if (goals) {
      goals.forEach((g: any) => {
        if (g.goal_type === 'weekly_distance_km') setWeeklyGoal(g.goal_value.toString())
        if (g.goal_type === 'monthly_distance_km') setMonthlyGoal(g.goal_value.toString())
      })
    }

    // Check Strava connection
    const { data: stravaToken } = await supabase
      .from('strava_tokens')
      .select('profile_id')
      .eq('profile_id', user.id)
      .single()

    setStravaConnected(!!stravaToken)

    setIsLoading(false)
  }

  const handleSave = async () => {
    if (!userId) return
    setIsSaving(true)
    setMessage('')

    try {
      // 1. Update Profile (nickname & memo)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          display_name: nickname,
          running_memo: memo 
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // 2. Upsert Weekly Goal
      if (weeklyGoal) {
        // Find existing weekly goal
        const { data: existingWeekly } = await supabase
          .from('running_goals')
          .select('id')
          .eq('profile_id', userId)
          .eq('goal_type', 'weekly_distance_km')
          .single()

        if (existingWeekly) {
          await supabase.from('running_goals').update({ goal_value: parseFloat(weeklyGoal) }).eq('id', existingWeekly.id)
        } else {
          await supabase.from('running_goals').insert({
            profile_id: userId,
            goal_type: 'weekly_distance_km',
            goal_value: parseFloat(weeklyGoal),
            unit: 'km',
            period: 'weekly'
          })
        }
      }

      // 3. Upsert Monthly Goal
      if (monthlyGoal) {
        // Find existing monthly goal
        const { data: existingMonthly } = await supabase
          .from('running_goals')
          .select('id')
          .eq('profile_id', userId)
          .eq('goal_type', 'monthly_distance_km')
          .single()

        if (existingMonthly) {
          await supabase.from('running_goals').update({ goal_value: parseFloat(monthlyGoal) }).eq('id', existingMonthly.id)
        } else {
          await supabase.from('running_goals').insert({
            profile_id: userId,
            goal_type: 'monthly_distance_km',
            goal_value: parseFloat(monthlyGoal),
            unit: 'km',
            period: 'monthly'
          })
        }
      }

      setMessage('Profile saved successfully! AI will now use this for feedback.')
    } catch (err: any) {
      console.error(err)
      setMessage('Error saving profile: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStravaSync = async () => {
    setIsSyncing(true)
    setSyncMessage('')
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setSyncMessage(`✅ ${json.message}`)
      } else {
        if (json.needsReconnect) {
          setStravaConnected(false)
        }
        setSyncMessage(`❌ ${json.error || 'Sync failed'}`)
      }
    } catch (err: any) {
      setSyncMessage(`❌ ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleStravaDisconnect = async () => {
    if (!confirm('Disconnect Strava? Your imported runs will remain.')) return
    
    const { error } = await supabase
      .from('strava_tokens')
      .delete()
      .eq('profile_id', userId!)

    if (!error) {
      setStravaConnected(false)
      setSyncMessage('Strava disconnected.')
    }
  }

  return (
    <div className="content active">
      {isLoading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>
          Loading profile...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ── Strava Section ── */}
          <div style={{ 
            padding: '20px', 
            background: 'var(--surface-color)', 
            borderRadius: '16px',
            border: stravaConnected ? '1px solid rgba(252, 76, 2, 0.3)' : '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
              </svg>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Strava</span>
              {stravaConnected && (
                <span style={{ 
                  fontSize: '0.75rem', 
                  background: 'rgba(252, 76, 2, 0.15)', 
                  color: '#FC4C02', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  fontWeight: 600
                }}>Connected</span>
              )}
            </div>

            {stravaConnected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleStravaSync}
                  disabled={isSyncing}
                  style={{
                    background: '#FC4C02',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: isSyncing ? 'wait' : 'pointer',
                    opacity: isSyncing ? 0.7 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  {isSyncing ? '⏳ Syncing...' : '🔄 Sync Recent Runs'}
                </button>
                <button
                  onClick={handleStravaDisconnect}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Disconnect Strava
                </button>
              </div>
            ) : (
              <a
                href="/api/strava/connect"
                style={{
                  display: 'block',
                  background: '#FC4C02',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  textDecoration: 'none'
                }}
              >
                Connect Strava
              </a>
            )}

            {syncMessage && (
              <div style={{ 
                marginTop: '12px', 
                fontSize: '0.9rem', 
                color: syncMessage.includes('❌') ? '#ff4444' : 'var(--volt)',
                textAlign: 'center'
              }}>
                {syncMessage}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Nickname (Leaderboard Name)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Fast Runner"
              value={nickname} 
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Weekly Goal (km)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 40"
                value={weeklyGoal} 
                onChange={(e) => setWeeklyGoal(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Goal (km)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 150"
                value={monthlyGoal} 
                onChange={(e) => setMonthlyGoal(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Personal Memo for AI Coach</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
              Write any goals, current injuries, or focus areas. The AI will read this and give you personalized coaching feedback when you upload a run!
            </p>
            <textarea 
              className="form-input" 
              placeholder="e.g. Training for a half marathon in October. Trying to maintain a 5'30 pace. Right knee is a bit sore so taking it easy on downhills."
              value={memo} 
              onChange={(e) => setMemo(e.target.value)}
              style={{ minHeight: '120px', resize: 'vertical' }}
            />
          </div>

          {message && (
            <div style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              background: message.includes('Error') ? 'rgba(255, 68, 68, 0.1)' : 'rgba(212, 255, 0, 0.1)',
              color: message.includes('Error') ? '#ff4444' : 'var(--volt)',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          <div style={{ marginTop: '30px', marginBottom: '20px' }}>
            <InstallPWA />
          </div>

          <button 
            className="action-btn" 
            onClick={handleSave} 
            disabled={isSaving}
            style={{ marginTop: '10px' }}
          >
            {isSaving ? 'SAVING...' : 'SAVE PROFILE'}
          </button>

        </div>
      )}
    </div>
  )
}
