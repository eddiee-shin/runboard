'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Helper: Format seconds to HH:MM:SS
const formatDuration = (sec: number) => {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Helper: Format seconds per km to M'SS"
const formatPace = (sec: number) => {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}'${s.toString().padStart(2, '0')}"`
}

// Helper: Parse HH:MM:SS to seconds
const parseDuration = (str: string) => {
  const parts = str.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

// Helper: Parse M'SS" to seconds
const parsePace = (str: string) => {
  const m = str.match(/(\d+)'/)
  const s = str.match(/'(\d+)"?/)
  let sec = 0
  if (m) sec += parseInt(m[1]) * 60
  if (s) sec += parseInt(s[1])
  return sec
}

const APP_SOURCES: Record<string, number> = {
  'nike': 1, 'garmin': 2, 'strava': 3, 'apple': 1
};

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [mode, setMode] = useState<'photo' | 'manual'>('photo')
  const [appSource, setAppSource] = useState('nike')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form State
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0])
  const [distanceKm, setDistanceKm] = useState('')
  const [durationStr, setDurationStr] = useState('')
  const [paceStr, setPaceStr] = useState('')
  const [calories, setCalories] = useState('')
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [feedback, setFeedback] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // User context for AI
  const [userContext, setUserContext] = useState<any>(null)

  // Fetch user context on mount
  useEffect(() => {
    fetchUserContext()
  }, [])

  const fetchUserContext = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('running_memo').eq('id', user.id).single()
    const { data: goals } = await supabase.from('running_goals').select('goal_type, goal_value').eq('profile_id', user.id)

    let wGoal = null
    let mGoal = null
    goals?.forEach(g => {
      if (g.goal_type === 'weekly_distance_km') wGoal = g.goal_value
      if (g.goal_type === 'monthly_distance_km') mGoal = g.goal_value
    })

    setUserContext({
      memo: profile?.running_memo || '',
      weeklyGoal: wGoal,
      monthlyGoal: mGoal
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setError(null)
    }
  }

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleAnalyze = async () => {
    if (!fileInputRef.current?.files?.[0]) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const file = fileInputRef.current.files[0]
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: base64Image, 
          sourceApp: appSource,
          userContext: userContext
        })
      })

      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.error || 'Failed to analyze image')
      }

      // Populate manual form with extracted data
      const data = json.data
      // Ignore AI date and keep the current date (today) as default
      // if (data.activity_date) setActivityDate(data.activity_date)
      if (data.distance_km) setDistanceKm(data.distance_km.toString())
      if (data.duration_sec) setDurationStr(formatDuration(data.duration_sec))
      if (data.pace_sec_per_km) setPaceStr(formatPace(data.pace_sec_per_km))
      if (data.calories) setCalories(data.calories.toString())
      if (data.avg_heart_rate) setAvgHeartRate(data.avg_heart_rate.toString())
      if (data.feedback_text) setFeedback(data.feedback_text)

      setIsAnalyzing(false)
      // Switch to manual mode for user review
      setMode('manual')
      
    } catch (err: any) {
      setError(err.message)
      setIsAnalyzing(false)
    }
  }

  const handleSaveRun = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Please log in again.")

      const sourceAppId = APP_SOURCES[appSource] || 1

      // 1. Insert session
      const { data: sessionData, error: sessionError } = await supabase
        .from('run_sessions')
        .insert({
          profile_id: user.id,
          source_app_id: sourceAppId,
          activity_date: activityDate,
          distance_km: parseFloat(distanceKm) || 0,
          duration_sec: parseDuration(durationStr) || 0,
          pace_sec_per_km: parsePace(paceStr) || 0,
          calories: parseInt(calories) || 0,
          avg_heart_rate: parseInt(avgHeartRate) || null,
          status: 'verified'
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      // 2. Insert feedback if exists
      if (feedback) {
        await supabase.from('ai_feedbacks').insert({
          run_session_id: sessionData.id,
          profile_id: user.id,
          feedback_text: feedback,
          tone: 'coach'
        })
      }

      router.push('/leaderboard')
    } catch (err: any) {
      setError(`Database Error: ${err.message}`)
      setIsSaving(false)
    }
  }

  return (
    <div className="content">
      <h2 className="header-title" style={{ fontSize: '2rem', marginBottom: '24px', color: 'var(--text-primary)' }}>ADD RUN</h2>

      <div className="upload-mode-toggle">
        <button 
          className={`mode-btn ${mode === 'photo' ? 'active' : ''}`}
          onClick={() => setMode('photo')}
        >
          Photo
        </button>
        <button 
          className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>

      {mode === 'photo' && (
        <div className="photo-mode-content">
          <div className="form-group">
            <label className="form-label">Source App</label>
            <div className="filter-chips">
              {['nike', 'garmin', 'strava', 'apple'].map(app => (
                <div 
                  key={app}
                  className={`chip ${appSource === app ? 'active' : ''}`}
                  onClick={() => setAppSource(app)}
                >
                  {app.toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          <div 
            className="upload-area"
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{ opacity: isAnalyzing ? 0.6 : 1, pointerEvents: isAnalyzing ? 'none' : 'auto' }}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className="image-preview" />
                <button 
                  onClick={clearImage}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="upload-icon"><Upload size={24} /></div>
                <div className="upload-text">Tap to upload screenshot</div>
                <div className="upload-subtext">or drag and drop</div>
              </>
            )}
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: 'none' }} />

          {error && <div style={{ color: '#ff4444', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

          <button 
            className="action-btn" disabled={!previewUrl || isAnalyzing} onClick={handleAnalyze}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
          >
            {isAnalyzing ? <><Loader2 className="animate-spin" size={24} /> ANALYZING...</> : 'ANALYZE RUN'}
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="manual-mode-content">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" className="form-input" 
              value={activityDate} onChange={(e) => setActivityDate(e.target.value)} 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input 
                type="number" step="0.01" className="form-input" placeholder="0.00"
                value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <input 
                type="text" className="form-input" placeholder="00:00:00"
                value={durationStr} onChange={(e) => setDurationStr(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Pace (/km)</label>
              <input 
                type="text" className="form-input" placeholder="0'00&quot;"
                value={paceStr} onChange={(e) => setPaceStr(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Calories</label>
              <input 
                type="number" className="form-input" placeholder="0"
                value={calories} onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Avg HR</label>
              <input 
                type="number" className="form-input" placeholder="bpm"
                value={avgHeartRate} onChange={(e) => setAvgHeartRate(e.target.value)}
              />
            </div>
          </div>

          {feedback && (
            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="form-label" style={{ color: 'var(--volt)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span> AI COACH FEEDBACK
              </label>
              <div style={{ 
                background: 'rgba(212, 255, 0, 0.05)', 
                border: '1px solid rgba(212, 255, 0, 0.2)', 
                padding: '16px', 
                borderRadius: '12px',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                lineHeight: '1.5'
              }}>
                {feedback}
              </div>
            </div>
          )}

          {error && <div style={{ color: '#ff4444', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

          <button 
            className="action-btn" onClick={handleSaveRun} disabled={isSaving}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
          >
            {isSaving ? <><Loader2 className="animate-spin" size={24} /> SAVING...</> : 'SAVE RUN'}
          </button>
        </div>
      )}
    </div>
  )
}
