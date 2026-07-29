import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'

function runPythonScript(scriptPath: string, inputPayload: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile('python3', [scriptPath], { timeout: 45000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
    if (child.stdin) {
      child.stdin.write(inputPayload)
      child.stdin.end()
    }
  })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { username, password, mfaCode } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Garmin 이메일과 비밀번호를 입력해 주세요.' },
        { status: 400 }
      )
    }

    const scriptPath = path.join(process.cwd(), 'src/lib/garmin_sync.py')
    const inputPayload = JSON.stringify({
      email: username,
      password: password,
      mfa_code: mfaCode || null,
    })

    // Execute Python script with stdin
    const { stdout, stderr } = await runPythonScript(scriptPath, inputPayload)

    if (!stdout || !stdout.trim()) {
      console.error('Python execution stderr:', stderr)
      return NextResponse.json({ error: 'Garmin 스크립트 실행 중 응답이 없습니다.' }, { status: 500 })
    }

    let pyResult: any = {}
    try {
      pyResult = JSON.parse(stdout.trim())
    } catch {
      console.error('Raw python output:', stdout)
      return NextResponse.json({ error: `응답 해석 실패: ${stdout.slice(0, 200)}` }, { status: 500 })
    }

    if (pyResult.status === 'mfa_required') {
      return NextResponse.json({
        mfaRequired: true,
        message: pyResult.message || '등록된 이메일로 6자리 2차 인증(MFA) 코드가 발송되었습니다. 인증 코드를 입력해 주세요.',
      })
    }

    if (pyResult.status === 'error') {
      return NextResponse.json(
        { error: pyResult.message || 'Garmin 동기화 중 오류가 발생했습니다.' },
        { status: 400 }
      )
    }

    const runs = pyResult.runs || []

    // Get existing sessions to prevent duplicates
    const { data: existingSessions } = await supabase
      .from('run_sessions')
      .select('activity_date, distance_km')
      .eq('profile_id', user.id)

    const existingKeys = new Set(
      (existingSessions || []).map((s: any) => `${s.activity_date}_${parseFloat(s.distance_km || 0).toFixed(2)}`)
    )

    let importedCount = 0
    for (const run of runs) {
      const distanceMeter = run.distance || 0
      if (distanceMeter <= 0) continue

      const distanceKm = (distanceMeter / 1000).toFixed(2)
      const activityDate = (run.startTimeLocal || '').split(' ')[0] || new Date().toISOString().split('T')[0]
      const durationSec = Math.round(run.duration || 0)
      const paceSecPerKm = durationSec / parseFloat(distanceKm)

      const key = `${activityDate}_${parseFloat(distanceKm).toFixed(2)}`
      if (existingKeys.has(key)) continue

      const { error: insertError } = await supabase
        .from('run_sessions')
        .insert({
          profile_id: user.id,
          source_app_id: 2, // Garmin Connect
          activity_date: activityDate,
          distance_km: parseFloat(distanceKm),
          duration_sec: durationSec,
          pace_sec_per_km: isFinite(paceSecPerKm) ? Math.round(paceSecPerKm) : 0,
          calories: Math.round(run.calories || 0),
          avg_heart_rate: run.averageHR ? Math.round(run.averageHR) : null,
          max_heart_rate: run.maxHR ? Math.round(run.maxHR) : null,
          elevation_gain_m: run.elevationGain ? parseFloat(run.elevationGain.toFixed(2)) : null,
          status: 'verified',
        })

      if (!insertError) {
        importedCount++
        existingKeys.add(key)
      } else {
        console.error('Failed to insert Garmin run:', insertError)
      }
    }

    let resultMsg = ''
    if (importedCount > 0) {
      resultMsg = `${importedCount}개의 새로운 Garmin 러닝 기록을 동기화했습니다!`
    } else if (runs.length > 0) {
      resultMsg = `Garmin에서 찾은 ${runs.length}개의 러닝 기록이 이미 모두 등록되어 있습니다.`
    } else {
      resultMsg = '최근 Garmin 계정에 등록된 러닝 활동이 없습니다.'
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      totalRuns: runs.length,
      message: resultMsg,
    })

  } catch (err: any) {
    console.error('Garmin sync error:', err)
    return NextResponse.json({ error: err.message || 'Garmin 동기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
