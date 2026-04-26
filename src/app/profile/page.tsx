'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [nickname, setNickname] = useState('')
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [monthlyGoal, setMonthlyGoal] = useState('')
  const [memo, setMemo] = useState('')
  
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProfileData()
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

  return (
    <div className="content active">
      {isLoading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>
          Loading profile...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
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
