export type DistanceUnit = 'km' | 'mi'
export type CsvRun = {
  key: string; date: string; startedAt: string; distance: number; duration: number
  pace: number; calories: number | null; heartRate: number | null
}

// RFC 4180 fields: quoted commas, escaped quotes and embedded newlines.
export function readCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { quoted = false; closed = true }
      } else field += c
    } else if (c === '"') {
      if (field || closed) throw new Error('CSV 따옴표 형식이 올바르지 않습니다.')
      quoted = true
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ''; closed = false
      if (c !== ',') {
        if (row.some(v => v.trim())) rows.push(row)
        row = []
        if (c === '\r' && text[i + 1] === '\n') i++
      }
    } else {
      if (closed) throw new Error('CSV 따옴표 뒤에 잘못된 문자가 있습니다.')
      field += c
    }
  }
  if (quoted) throw new Error('CSV 따옴표가 닫히지 않았습니다.')
  row.push(field)
  if (row.some(v => v.trim())) rows.push(row)
  return rows
}

function number(value: string): number | null {
  if (!value || value === '--') return null
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) throw new Error('숫자 형식을 확인해주세요.')
  return Number(value.replace(/,/g, ''))
}

export function parseStartedAt(raw: string): { startedAt: string; date: string } {
  const trimmed = raw.trim()
  let y = '', m = '', d = '', h = '00', min = '00', s = '00'

  const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed)
  if (ymd) {
    y = ymd[1]
    m = ymd[2].padStart(2, '0')
    d = ymd[3].padStart(2, '0')
    if (ymd[4] !== undefined) h = ymd[4].padStart(2, '0')
    if (ymd[5] !== undefined) min = ymd[5].padStart(2, '0')
    if (ymd[6] !== undefined) s = ymd[6].padStart(2, '0')
  } else {
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed)
    if (dmy) {
      d = dmy[1].padStart(2, '0')
      m = dmy[2].padStart(2, '0')
      y = dmy[3]
      if (dmy[4] !== undefined) h = dmy[4].padStart(2, '0')
      if (dmy[5] !== undefined) min = dmy[5].padStart(2, '0')
      if (dmy[6] !== undefined) s = dmy[6].padStart(2, '0')
    } else {
      throw new Error('날짜/시간 형식을 확인해주세요.')
    }
  }

  const hNum = Number(h), minNum = Number(min), sNum = Number(s)
  if (hNum > 23 || minNum > 59 || sNum > 59) throw new Error('유효하지 않은 시간입니다.')

  const iso = `${y}-${m}-${d}T${h}:${min}:${s}`
  const dateObj = new Date(`${iso}Z`)
  if (!Number.isFinite(dateObj.getTime()) || dateObj.toISOString().slice(0, 19) !== iso) {
    throw new Error('유효하지 않은 날짜입니다.')
  }

  return {
    startedAt: `${y}-${m}-${d} ${h}:${min}:${s}`,
    date: `${y}-${m}-${d}`,
  }
}

export function parseDuration(raw: string): number {
  const trimmed = raw.trim()
  const hms = /^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(trimmed)
  if (hms) {
    const duration = Math.round(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]))
    if (duration <= 0 || duration > 2147483647) throw new Error('운동 시간을 확인해주세요.')
    return duration
  }
  const ms = /^([0-5]?\d):([0-5]\d(?:\.\d+)?)$/.exec(trimmed)
  if (ms) {
    const duration = Math.round(Number(ms[1]) * 60 + Number(ms[2]))
    if (duration <= 0 || duration > 2147483647) throw new Error('운동 시간을 확인해주세요.')
    return duration
  }
  throw new Error('운동 시간은 HH:MM:SS 또는 MM:SS 형식이어야 합니다.')
}

export function parseGarminCsv(text: string, unit: DistanceUnit) {
  if (unit !== 'km' && unit !== 'mi') throw new Error('거리 단위를 선택해주세요.')
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error('CSV는 2MB 이하로 올려주세요.')
  const rows = readCsv(text)
  const header = rows.shift()?.map(v => v.trim()) || []
  const required = ['Activity Type', 'Date', 'Distance', 'Time']
  if (required.some(k => !header.includes(k))) throw new Error('Garmin 활동 목록 CSV가 필요합니다. Activity Type, Date, Distance, Time 열을 확인해주세요. 현재 영문 열 이름을 지원합니다.')
  if (new Set(header).size !== header.length) throw new Error('중복된 CSV 열 이름이 있습니다.')
  if (rows.length > 5000) throw new Error('한 번에 최대 5,000개 활동을 가져올 수 있습니다.')
  const runs: CsvRun[] = [], errors: string[] = []
  const seen = new Set<string>()
  let skipped = 0, duplicates = 0
  rows.forEach((row, i) => {
    try {
      if (row.length !== header.length) throw new Error('열 개수가 일치하지 않습니다.')
      const get = (name: string) => (row[header.indexOf(name)] || '').trim()
      if (!['Running', 'Trail Running', 'Treadmill Running', 'Indoor Running', 'Track Running', 'Ultra Running', 'Virtual Running'].includes(get('Activity Type'))) { skipped++; return }
      const { startedAt, date } = parseStartedAt(get('Date'))
      const rawDistance = number(get('Distance'))
      if (!rawDistance || rawDistance <= 0) throw new Error('거리는 0보다 커야 합니다.')
      const distance = Math.round(rawDistance * (unit === 'mi' ? 1.609344 : 1) * 100) / 100
      if (!distance || distance >= 100000000) throw new Error('거리가 저장 범위를 벗어납니다.')
      const duration = parseDuration(get('Time'))
      const optional = (name: string) => {
        const value = number(get(name))
        if (value !== null && value > 2147483647) throw new Error(`${name} 값이 너무 큽니다.`)
        return value === null ? null : Math.round(value)
      }
      const key = `garmin-csv:${startedAt}`
      if (seen.has(key)) { duplicates++; return }
      const pace = Math.round(duration / distance)
      if (pace > 2147483647) throw new Error('거리와 운동 시간을 확인해주세요.')
      runs.push({ key, startedAt, date, distance, duration, pace, calories: optional('Calories'), heartRate: optional('Avg HR') })
      seen.add(key)
    } catch (error) { errors.push(`${i + 2}행: ${error instanceof Error ? error.message : '잘못된 기록입니다.'}`) }
  })
  return { runs, errors, skipped, duplicates }
}
