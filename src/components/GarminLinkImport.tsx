'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GarminLinkActivity } from '@/lib/garmin-link'
import { extractGarminActivityUrl } from '@/lib/garmin-link'

const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds % 3600 / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function GarminLinkImport() {
  const [url, setUrl] = useState('')
  const [activity, setActivity] = useState<GarminLinkActivity | null>(null)
  const [existing, setExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const request = async (preview: boolean) => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/import/garmin-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, preview }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.')
      if (preview) { setActivity(result.activity); setExisting(result.existing); setSaved(false) }
      else { setSaved(true); setExisting(result.existing > 0) }
    } catch (err) { setError(err instanceof Error ? err.message : '요청에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Garmin 링크 가져오기">
    <p>공개 범위가 <strong>모두</strong>인 Garmin Connect 활동 링크를 붙여넣으세요. 가민 앱에서 복사한 공유 문구 전체를 붙여넣어도 링크만 자동으로 추출합니다.</p>
    <div className="form-group">
      <label className="form-label" htmlFor="garmin-link">Garmin Connect 활동 링크</label>
      <textarea id="garmin-link" className="form-input garmin-link-textarea" rows={5}
        placeholder={'가민 앱에서 복사한 공유 문구 전체를 붙여넣으세요.\n예: Check out my running activity on Garmin Connect. https://connect.garmin.com/modern/activity/...'}
        value={url} disabled={busy} spellCheck={false}
        onChange={e => {
          const value = e.target.value
          setUrl(extractGarminActivityUrl(value) || value)
          setActivity(null); setExisting(false); setSaved(false); setError('')
        }} />
    </div>
    {error && <p role="alert" style={{ color: '#ff7777' }}>{error}</p>}
    {!activity && <button className="action-btn" disabled={busy || !url.trim()} onClick={() => request(true)}>
      {busy ? '불러오는 중...' : 'GARMIN 활동 불러오기'}
    </button>}
    {activity && <>
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        <strong>{activity.name}</strong>
        <p>{activity.startedAt} · {activity.distance.toFixed(2)}km · {duration(activity.duration)}</p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          평균 페이스 {Math.floor(activity.pace / 60)}'{String(activity.pace % 60).padStart(2, '0')}"/km
          {activity.heartRate ? ` · 평균 심박 ${activity.heartRate}` : ''}
          {activity.calories ? ` · ${activity.calories}kcal` : ''}
        </p>
      </div>
      {existing ? <p role="status">이미 등록된 운동과 일치합니다. 중복 저장하지 않습니다.</p>
        : <button className="action-btn" disabled={busy || saved} onClick={() => request(false)}>
          {busy ? '저장 중...' : saved ? '저장 완료' : '이 러닝 저장'}
        </button>}
      {saved && <p role="status">저장 완료 · <Link href="/runs?filter=Monthly">월간 통계</Link> · <Link href="/runs">가져오기 보고서</Link></p>}
    </>}
  </section>
}
