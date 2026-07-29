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
      try {
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
      } catch (refreshErr) {
        console.error('Strava token refresh failed. Cleaning expired tokens:', refreshErr)
        // Clean up invalid token from DB
        await supabase.from('strava_tokens').delete().eq('profile_id', user.id)
        return NextResponse.json(
          { error: 'Strava 연동이 만료되었습니다. Strava를 다시 연동해 주세요.', needsReconnect: true },
          { status: 401 }
        )
      }
    }

    // 3. Fetch recent activities from Strava (last 90 days, up to 100 activities)
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${ninetyDaysAgo}&per_page=100`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    )

    if (!activitiesRes.ok) {
      const errText = await activitiesRes.text()
      console.error('Strava activities fetch failed:', activitiesRes.status, errText)

      if (activitiesRes.status === 401 || activitiesRes.status === 403) {
        // Access token unauthorized or insufficient permissions, delete token and request reconnect
        await supabase.from('strava_tokens').delete().eq('profile_id', user.id)
        return NextResponse.json(
          { error: `Strava 인증/권한(HTTP ${activitiesRes.status})이 유효하지 않습니다. Strava를 다시 연동해 주세요. (${errText})`, needsReconnect: true },
          { status: activitiesRes.status }
        )
      }

      return NextResponse.json(
        { error: `Failed to fetch Strava activities (HTTP ${activitiesRes.status}): ${errText}` },
        { status: 500 }
      )
    }

    const activities = await activitiesRes.json()

    // 4. Filter only Run activities (flexible matching on type & sport_type)
    const runs = activities.filter((a: any) => {
      const typeStr = (a.type || '').toLowerCase()
      const sportStr = (a.sport_type || '').toLowerCase()
      return typeStr.includes('run') || sportStr.includes('run')
    })

    // 5. Get existing sessions for this user to avoid duplicates
    const { data: existingSessions } = await supabase
      .from('run_sessions')
      .select('activity_date, distance_km')
      .eq('profile_id', user.id)

    const existingKeys = new Set(
      (existingSessions || []).map((s: any) => `${s.activity_date}_${parseFloat(s.distance_km || 0).toFixed(2)}`)
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
          pace_sec_per_km: isFinite(paceSecPerKm) ? Math.round(paceSecPerKm) : 0,
          calories: calories,
          avg_heart_rate: avgHr ? Math.round(avgHr) : null,
          status: 'verified',
        })

      if (!insertError) {
        importedCount++
        existingKeys.add(key) // Prevent duplicates within same batch
      } else {
        console.error('Failed to insert Strava run:', insertError)
      }
    }

    let resultMsg = ''
    if (importedCount > 0) {
      resultMsg = `${importedCount}개 새 러닝 기록을 가져왔습니다!`
    } else if (runs.length > 0) {
      resultMsg = `최근 90일 동안의 Strava 러닝 기록 ${runs.length}개가 이미 모두 등록되어 있습니다.`
    } else if (activities.length > 0) {
      resultMsg = `최근 90일 동안 Strava에 ${activities.length}개의 활동이 있으나 러닝(Run) 기록이 없습니다.`
    } else {
      resultMsg = '최근 90일 동안 Strava에 등록된 활동이 없습니다.'
    }

    return NextResponse.json({ 
      success: true, 
      imported: importedCount, 
      totalRuns: runs.length,
      totalActivities: activities.length,
      message: resultMsg
    })

  } catch (err: any) {
    console.error('Strava sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
