import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseGarminActivityUrl, parseGarminEmbedHtml } from '@/lib/garmin-link'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '다시 로그인해주세요.' }, { status: 401 })
  try {
    const body = await request.json()
    if (typeof body.url !== 'string' || typeof body.preview !== 'boolean') throw new Error('Garmin 링크와 요청을 확인해주세요.')
    const id = parseGarminActivityUrl(body.url)
    const response = await fetch(`https://connect.garmin.com/modern/activity/embed/${id}`, {
      headers: { 'User-Agent': 'Runboard Garmin activity importer' },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Garmin 활동을 불러오지 못했습니다.')
    const activity = parseGarminEmbedHtml(await response.text(), id)
    const { data: existing, error: lookupError } = await supabase.from('run_sessions')
      .select('distance_km, duration_sec, import_key')
      .eq('profile_id', user.id).eq('activity_date', activity.date)
    if (lookupError) throw new Error('기존 기록을 확인하지 못했습니다.')
    const duplicate = (existing || []).some(run =>
      run.import_key === activity.key || (
        Math.abs(Number(run.distance_km) - activity.distance) <= 0.02 &&
        Math.abs(Number(run.duration_sec) - activity.duration) <= 2
      )
    )
    if (body.preview) return NextResponse.json({ activity, existing: duplicate })
    if (duplicate) {
      const { error: reportError } = await supabase.from('import_reports').insert({
        profile_id: user.id, source: 'garmin_link', label: activity.name,
        total_count: 1, imported_count: 0, duplicate_count: 1,
        details: { activity_date: activity.date, distance_km: activity.distance },
      })
      if (reportError) console.error('Garmin link report save failed:', reportError)
      return NextResponse.json({ imported: 0, existing: 1 })
    }
    const { data, error } = await supabase.from('run_sessions').upsert({
      profile_id: user.id,
      source_app_id: 2,
      activity_date: activity.date,
      distance_km: activity.distance,
      duration_sec: activity.duration,
      pace_sec_per_km: activity.pace,
      calories: activity.calories,
      avg_heart_rate: activity.heartRate,
      max_heart_rate: activity.maxHeartRate,
      cadence: activity.cadence,
      elevation_gain_m: activity.elevationGain,
      notes: activity.name,
      status: 'verified',
      import_key: activity.key,
    }, { onConflict: 'profile_id,import_key', ignoreDuplicates: true }).select('id')
    if (error) throw new Error('Garmin 활동을 저장하지 못했습니다.')
    const imported = data?.length || 0
    const { error: reportError } = await supabase.from('import_reports').insert({
      profile_id: user.id, source: 'garmin_link', label: activity.name,
      total_count: 1, imported_count: imported, duplicate_count: imported ? 0 : 1,
      details: { activity_date: activity.date, distance_km: activity.distance },
    })
    if (reportError) console.error('Garmin link report save failed:', reportError)
    return NextResponse.json({ imported, existing: imported ? 0 : 1 })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'Garmin 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      : error instanceof Error ? error.message : 'Garmin 링크를 처리하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
