import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GarminConnect } from 'garmin-connect'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Garmin 이메일과 비밀번호를 입력해 주세요.' },
        { status: 400 }
      )
    }

    // 1. Initialize & Login to Garmin Connect
    const GC = new GarminConnect({
      username,
      password,
    })

    try {
      await GC.login()
    } catch (loginErr: any) {
      console.error('Garmin login failed:', loginErr)
      const detail = loginErr?.message || String(loginErr)
      return NextResponse.json(
        { error: `Garmin 로그인 실패 (${detail}). 계정 정보 또는 2차 인증(2FA) 활성화 여부를 확인해 주세요.` },
        { status: 401 }
      )
    }

    // 2. Fetch recent activities (up to 30)
    const activities = await GC.getActivities(0, 30)

    if (!Array.isArray(activities)) {
      return NextResponse.json(
        { error: 'Garmin 활동 목록을 가져오지 못했습니다.' },
        { status: 500 }
      )
    }

    // 3. Filter running activities
    const runs = activities.filter((a: any) => {
      const typeKey = (a.activityType?.typeKey || '').toLowerCase()
      const parentTypeKey = (a.activityType?.parentTypeId || 0)
      return typeKey.includes('run') || parentTypeKey === 1
    })

    // 4. Get existing sessions for duplicate prevention
    const { data: existingSessions } = await supabase
      .from('run_sessions')
      .select('activity_date, distance_km')
      .eq('profile_id', user.id)

    const existingKeys = new Set(
      (existingSessions || []).map((s: any) => `${s.activity_date}_${parseFloat(s.distance_km || 0).toFixed(2)}`)
    )

    // 5. Insert new runs into Supabase
    let importedCount = 0
    for (const run of runs) {
      const distanceMeter = run.distance || 0
      if (distanceMeter <= 0) continue

      const distanceKm = (distanceMeter / 1000).toFixed(2)
      const activityDate = (run.startTimeLocal || run.startTimeGMT || '').split(' ')[0] || new Date().toISOString().split('T')[0]
      const durationSec = Math.round(run.movingDuration || run.duration || 0)
      const paceSecPerKm = durationSec / parseFloat(distanceKm)
      const avgHr = run.averageHR || null
      const maxHr = run.maxHR || null
      const calories = Math.round(run.calories || 0)
      const elevationGain = run.elevationGain || null

      const key = `${activityDate}_${parseFloat(distanceKm).toFixed(2)}`
      if (existingKeys.has(key)) continue // Skip duplicate

      const { error: insertError } = await supabase
        .from('run_sessions')
        .insert({
          profile_id: user.id,
          source_app_id: 2, // Garmin Connect
          activity_date: activityDate,
          distance_km: parseFloat(distanceKm),
          duration_sec: durationSec,
          pace_sec_per_km: isFinite(paceSecPerKm) ? Math.round(paceSecPerKm) : 0,
          calories: calories,
          avg_heart_rate: avgHr ? Math.round(avgHr) : null,
          max_heart_rate: maxHr ? Math.round(maxHr) : null,
          elevation_gain_m: elevationGain ? parseFloat(elevationGain.toFixed(2)) : null,
          status: 'verified',
        })

      if (!insertError) {
        importedCount++
        existingKeys.add(key)
      } else {
        console.error('Failed to insert Garmin run:', insertError)
      }
    }

    let message = ''
    if (importedCount > 0) {
      message = `${importedCount}개의 새로운 Garmin 러닝 기록을 성공적으로 동기화했습니다!`
    } else if (runs.length > 0) {
      message = `Garmin에서 찾은 ${runs.length}개의 러닝 기록이 이미 모두 등록되어 있습니다.`
    } else {
      message = '최근 Garmin 계정에 등록된 러닝 활동이 없습니다.'
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      totalRuns: runs.length,
      totalActivities: activities.length,
      message,
    })

  } catch (err: any) {
    console.error('Garmin sync error:', err)
    return NextResponse.json({ error: err.message || 'Garmin 동기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
