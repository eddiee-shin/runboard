export type GarminLinkActivity = {
  id: string
  key: string
  name: string
  type: string
  startedAt: string
  date: string
  distance: number
  duration: number
  pace: number
  calories: number | null
  heartRate: number | null
  maxHeartRate: number | null
  cadence: number | null
  elevationGain: number | null
}

export function extractGarminActivityUrl(value: string): string | null {
  // iOS share sheets can insert invisible Unicode characters into copied text.
  const normalized = value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
  const match = /https:\/\/connect\.garmin\.com\/(?:modern\/|app\/)?activity\/\d+(?:[/?#][^\s]*)?/i.exec(normalized)
  if (!match) return null
  const candidate = match[0].replace(/[),.;!?]+$/, '')
  let url: URL
  try { url = new URL(candidate) }
  catch { return null }
  if (url.protocol !== 'https:' || url.hostname !== 'connect.garmin.com') return null
  const pathMatch = /^\/(?:modern\/|app\/)?activity\/(\d+)\/?$/.exec(url.pathname)
  if (!pathMatch) return null
  return `https://connect.garmin.com/modern/activity/${pathMatch[1]}`
}

export function mergeGarminClipboardText(plainText: string, alternateFormats: string[] = []): string {
  const plain = plainText.trim()
  const activityUrl = [plainText, ...alternateFormats]
    .map(value => extractGarminActivityUrl(value.replace(/&amp;/g, '&')))
    .find((value): value is string => Boolean(value))

  if (!activityUrl || extractGarminActivityUrl(plain)) return plain
  return plain ? `${plain}\n${activityUrl}` : activityUrl
}

export function parseGarminActivityUrl(value: string): string {
  const extracted = extractGarminActivityUrl(value)
  if (!extracted) throw new Error('Garmin Connect 활동 링크를 확인해주세요.')
  return extracted.slice(extracted.lastIndexOf('/') + 1)
}

export function parseGarminEmbedHtml(html: string, expectedId: string): GarminLinkActivity {
  if (html.length > 2_000_000) throw new Error('Garmin 활동 응답이 너무 큽니다.')
  const text = html.replace(/\\"/g, '"')
  const activityMarker = `"activityId":${expectedId}`
  const activityIndex = text.indexOf(activityMarker)
  if (activityIndex < 0) throw new Error('공개된 Garmin 활동 정보를 찾지 못했습니다.')
  const activity = text.slice(activityIndex, activityIndex + 30_000)
  const summaryIndex = activity.indexOf('"summaryDTO":{')
  if (summaryIndex < 0) throw new Error('Garmin 활동 요약을 찾지 못했습니다.')
  const summary = activity.slice(summaryIndex, summaryIndex + 12_000)
  const stringValue = (source: string, key: string) => {
    const match = new RegExp(`"${key}":"([^"\\\\]*)"`).exec(source)
    return match?.[1] || null
  }
  const numberValue = (source: string, key: string) => {
    const match = new RegExp(`"${key}":(-?\\d+(?:\\.\\d+)?)`).exec(source)
    return match ? Number(match[1]) : null
  }
  const type = stringValue(activity, 'typeKey')
  const allowedTypes = ['running', 'trail_running', 'treadmill_running', 'indoor_running', 'track_running', 'ultra_run', 'virtual_running']
  if (!type || !allowedTypes.includes(type)) throw new Error('러닝 활동 링크만 등록할 수 있습니다.')
  const startedAtRaw = stringValue(summary, 'startTimeLocal')
  const distanceMeters = numberValue(summary, 'distance')
  const durationRaw = numberValue(summary, 'duration')
  if (!startedAtRaw || distanceMeters === null || durationRaw === null) {
    throw new Error('Garmin 링크에서 날짜, 거리 또는 운동 시간을 읽지 못했습니다.')
  }
  const startedAt = startedAtRaw.replace(/\.\d+$/, '')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(startedAt)) throw new Error('Garmin 활동 날짜 형식이 올바르지 않습니다.')
  const distance = Math.round(distanceMeters / 10) / 100
  const duration = Math.round(durationRaw)
  if (distance <= 0 || duration <= 0) throw new Error('Garmin 활동 거리와 시간을 확인해주세요.')
  const optionalInteger = (key: string) => {
    const value = numberValue(summary, key)
    return value === null ? null : Math.round(value)
  }
  const elevation = numberValue(summary, 'elevationGain')
  return {
    id: expectedId,
    key: `garmin-link:${expectedId}`,
    name: stringValue(activity, 'activityName') || 'Garmin Running',
    type,
    startedAt: startedAt.replace('T', ' '),
    date: startedAt.slice(0, 10),
    distance,
    duration,
    pace: Math.round(duration / distance),
    calories: optionalInteger('calories'),
    heartRate: optionalInteger('averageHR'),
    maxHeartRate: optionalInteger('maxHR'),
    cadence: optionalInteger('averageRunCadence'),
    elevationGain: elevation === null ? null : Math.round(elevation * 100) / 100,
  }
}
