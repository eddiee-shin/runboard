import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseGarminCsv } from '@/lib/garmin-csv'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '다시 로그인해주세요.' }, { status: 401 })
  try {
    const body = await request.json()
    if (typeof body.csv !== 'string' || !['km', 'mi'].includes(body.unit)) throw new Error('CSV 파일과 거리 단위를 확인해주세요.')
    const parsed = parseGarminCsv(body.csv, body.unit)
    if (parsed.errors.length) throw new Error(parsed.errors[0])
    if (!parsed.runs.length) throw new Error('가져올 러닝 기록이 없습니다.')
    const dates = parsed.runs.map(r => r.date).sort()
    // Paginate to avoid silently missing existing records beyond the response limit.
    const existing: { activity_date: string; distance_km: number; duration_sec: number; import_key: string | null }[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('run_sessions')
        .select('activity_date, distance_km, duration_sec, import_key')
        .eq('profile_id', user.id).gte('activity_date', dates[0]).lte('activity_date', dates[dates.length - 1])
        .order('id').range(offset, offset + 499)
      if (error) {
        console.error('CSV import lookup failed:', error)
        return NextResponse.json({ error: '기존 기록을 확인하지 못했습니다. CSV 가져오기용 DB 업데이트 적용 여부를 확인해주세요.' }, { status: 500 })
      }
      existing.push(...(data || []))
      if (!data || data.length < 500) break
    }
    const signature = (date: string, distance: number, duration: number) => `${date}|${Number(distance).toFixed(2)}|${duration}`
    const oldKeys = new Set(existing.filter(r => !r.import_key).map(r => signature(r.activity_date, r.distance_km, r.duration_sec)))
    const importedKeys = new Set(existing.map(r => r.import_key))
    const fresh = parsed.runs.filter(r => !importedKeys.has(r.key) && !oldKeys.has(signature(r.date, r.distance, r.duration)))
    if (body.preview === true) return NextResponse.json({ fresh: fresh.map(r => r.key), existing: parsed.runs.length - fresh.length })
    if (body.preview !== false) throw new Error('잘못된 가져오기 요청입니다.')
    let imported = 0
    if (fresh.length) {
      const { data, error } = await supabase.from('run_sessions').upsert(fresh.map(r => ({
        profile_id: user.id, source_app_id: 2, activity_date: r.date,
        distance_km: r.distance, duration_sec: r.duration, pace_sec_per_km: r.pace,
        calories: r.calories, avg_heart_rate: r.heartRate, status: 'verified', import_key: r.key,
      })), { onConflict: 'profile_id,import_key', ignoreDuplicates: true }).select('id')
      if (error) {
        console.error('CSV import save failed:', error)
        return NextResponse.json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
      }
      imported = data?.length || 0
    }
    return NextResponse.json({ imported, existing: parsed.runs.length - imported })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'CSV를 읽지 못했습니다.' }, { status: 400 })
  }
}
