import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Refresh Strava access token if expired
async function refreshToken(refreshTokenStr: string) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshTokenStr,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Failed to refresh Strava token')
  return res.json()
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Get stored tokens
    const { data: tokenRow, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('*')
      .eq('profile_id', user.id)
      .single()

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
    }

    let accessToken = tokenRow.access_token
    const now = Math.floor(Date.now() / 1000)

    // 2. Refresh token if expired
    if (tokenRow.expires_at < now) {
      const refreshed = await refreshToken(tokenRow.refresh_token)
      accessToken = refreshed.access_token

      // Update tokens in DB
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: refreshed.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', user.id)
    }

    // 3. Fetch recent activities from Strava (last 7 days)
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${sevenDaysAgo}&per_page=30`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!activitiesRes.ok) {
      const errText = await activitiesRes.text()
      console.error('Strava activities fetch failed:', errText)
      return NextResponse.json({ error: 'Failed to fetch Strava activities' }, { status: 500 })
    }

    const activities = await activitiesRes.json()

    // 4. Filter only Run activities
    const runs = activities.filter((a: any) => a.type === 'Run' || a.type === 'VirtualRun')

    // 5. Get existing sessions for this user in the date range to avoid duplicates
    const { data: existingSessions } = await supabase
      .from('run_sessions')
      .select('activity_date, distance_km')
      .eq('profile_id', user.id)
      .eq('status', 'verified')

    const existingKeys = new Set(
      (existingSessions || []).map((s: any) => `${s.activity_date}_${parseFloat(s.distance_km).toFixed(2)}`)
    )

    // 6. Insert new runs
    let importedCount = 0
    for (const run of runs) {
      const distanceKm = (run.distance / 1000).toFixed(2)
      const activityDate = run.start_date_local.split('T')[0]
      const durationSec = run.moving_time
      const paceSecPerKm = durationSec / parseFloat(distanceKm)
      const avgHr = run.average_heartrate || null
      const calories = run.calories || 0

      const key = `${activityDate}_${parseFloat(distanceKm).toFixed(2)}`
      if (existingKeys.has(key)) continue // Skip duplicate

      const { error: insertError } = await supabase
        .from('run_sessions')
        .insert({
          profile_id: user.id,
          source_app_id: 3, // Strava
          activity_date: activityDate,
          distance_km: parseFloat(distanceKm),
          duration_sec: durationSec,
          pace_sec_per_km: Math.round(paceSecPerKm),
          calories: calories,
          avg_heart_rate: avgHr ? Math.round(avgHr) : null,
          status: 'verified',
        })

      if (!insertError) {
        importedCount++
        existingKeys.add(key) // Prevent duplicates within same batch
      }
    }

    return NextResponse.json({ 
      success: true, 
      imported: importedCount, 
      total: runs.length,
      message: importedCount > 0 
        ? `${importedCount} new run(s) imported!` 
        : 'No new runs to import.'
    })

  } catch (err: any) {
    console.error('Strava sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
