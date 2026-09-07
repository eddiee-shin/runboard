'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DistanceUnit, parseGarminCsv } from '@/lib/garmin-csv'

export default function GarminCsvImport() {
  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [unit, setUnit] = useState<DistanceUnit | ''>('')
  const [fresh, setFresh] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  let parsed: ReturnType<typeof parseGarminCsv> | null = null
  let parseError = ''
  if (csv && unit) {
    try { parsed = parseGarminCsv(csv, unit) }
    catch (err) { parseError = err instanceof Error ? err.message : 'CSV를 읽지 못했습니다.' }
  }
  const invalidate = () => { setFresh(null); setMessage(''); setError('') }
  const requestImport = async (preview: boolean) => {
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/import/garmin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, unit, preview }),
      })
      if (res.redirected) throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.')
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '요청에 실패했습니다.')
      if (preview) { setFresh(result.fresh); setMessage(`새 기록 ${result.fresh.length}건 · 기존 기록과 일치 ${result.existing}건`) }
      else { setFresh([]); setMessage(`${result.imported}건 저장 완료 · 기존 기록 ${result.existing}건 제외`) }
    } catch (err) { setError(err instanceof Error ? err.message : '요청에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return <section aria-label="Garmin CSV 가져오기">
    <p>Garmin Connect의 활동 목록에서 내보낸 CSV를 올려주세요. 러닝 기록만 가져옵니다.</p>
    <div className="form-group">
      <label className="form-label" htmlFor="garmin-csv">활동 CSV 파일 (최대 2MB / 5,000건)</label>
      <input id="garmin-csv" className="form-input" type="file" accept=".csv,text/csv" disabled={busy}
        onChange={async e => {
          const file = e.target.files?.[0]
          invalidate(); setCsv(''); setFilename(''); setBusy(true)
          try {
            if (!file) return
            if (file.size > 2 * 1024 * 1024) throw new Error('2MB 이하의 CSV를 선택해주세요.')
            const text = await file.text()
            if (!text.trim()) throw new Error('빈 파일입니다.')
            setCsv(text); setFilename(file.name)
          } catch (err) { setError(err instanceof Error ? err.message : '파일을 읽지 못했습니다.') }
          finally { setBusy(false) }
        }} />
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor="garmin-unit">CSV 원본 거리 단위</label>
      <select id="garmin-unit" className="form-input" value={unit} disabled={busy}
        onChange={e => { setUnit(e.target.value as DistanceUnit | ''); invalidate() }}>
        <option value="">Garmin에서 사용한 단위를 선택해주세요</option>
        <option value="km">킬로미터 (km)</option><option value="mi">마일 (mi)</option>
      </select>
      <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>CSV에는 단위가 표시되지 않습니다. 마일은 km로 변환합니다. 현재 영문 열 이름의 Garmin CSV를 지원합니다.</p>
    </div>
    {(error || parseError) && <p role="alert" style={{ color: '#ff7777' }}>{error || parseError}</p>}
    {parsed && <>
      <p>{filename}: 러닝 {parsed.runs.length}건 · 다른 운동 {parsed.skipped}건 제외 · 파일 내 중복 {parsed.duplicates}건 제외</p>
      <p>러닝 총 거리 <strong>{parsed.runs.reduce((sum, r) => sum + r.distance, 0).toFixed(2)} km</strong></p>
      {parsed.errors.length > 0 && <div role="alert" style={{ color: '#ff7777' }}>
        <p>잘못된 기록 {parsed.errors.length}건이 있습니다. 원본 CSV를 수정한 후 다시 올려주세요.</p>
        <ul>{parsed.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}</ul>
      </div>}
      <div style={{ overflowX: 'auto', maxHeight: '380px', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
          <caption style={{ textAlign: 'left', padding: '8px 0' }}>저장 전 기록 확인</caption>
          <thead><tr>{['운동 시작', '거리 (km)', '운동 시간', '상태'].map(h => <th key={h} scope="col" style={{ padding: '8px' }}>{h}</th>)}</tr></thead>
          <tbody>{parsed.runs.map(r => <tr key={r.key}>
            <td style={{ padding: '8px' }}>{r.startedAt}</td><td style={{ padding: '8px' }}>{r.distance.toFixed(2)}</td>
            <td style={{ padding: '8px' }}>{Math.floor(r.duration / 3600)}:{String(Math.floor(r.duration % 3600 / 60)).padStart(2, '0')}:{String(r.duration % 60).padStart(2, '0')}</td>
            <td style={{ padding: '8px' }}>{fresh === null ? '중복 확인 전' : fresh.includes(r.key) ? '새 기록' : '등록됨 / 일치'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>기존 수동·Strava 기록과 날짜, 거리, 운동 시간이 모두 같으면 제외합니다. 시간이 다르게 기록된 동일 운동은 직접 확인해주세요.</p>
      <button className="action-btn" disabled={busy || !parsed.runs.length || !!parsed.errors.length || (fresh !== null && !fresh.length)}
        onClick={() => requestImport(fresh === null)}>
        {busy ? '처리 중...' : fresh === null ? '기존 기록과 중복 확인' : `새 러닝 ${fresh.length}건 저장`}
      </button>
    </>}
    {message && <p role="status">{message} {fresh?.length === 0 && <Link href="/stats">통계 보기</Link>}</p>}
  </section>
}
