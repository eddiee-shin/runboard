import test from 'node:test'
import assert from 'node:assert/strict'
import { extractGarminActivityUrl, mergeGarminClipboardText, parseGarminActivityUrl, parseGarminEmbedHtml } from '../src/lib/garmin-link.ts'

const id = '24241206383'
const html = `<script>self.__next_f.push([1,"{\\"activityData\\":{\\"activityId\\":24241206383,\\"activityName\\":\\"Melbourne Running\\",\\"activityTypeDTO\\":{\\"typeKey\\":\\"running\\"},\\"summaryDTO\\":{\\"startTimeLocal\\":\\"2026-09-05T06:46:17.0\\",\\"distance\\":30021.32,\\"duration\\":12201.966,\\"elevationGain\\":307.53,\\"calories\\":2615,\\"averageHR\\":137,\\"maxHR\\":164,\\"averageRunCadence\\":169.46875}}}"])</script>`

test('accepts canonical Garmin activity URLs only', () => {
  assert.equal(parseGarminActivityUrl(`https://connect.garmin.com/modern/activity/${id}`), id)
  assert.equal(parseGarminActivityUrl(`https://connect.garmin.com/app/activity/${id}`), id)
  const shared = `Check out my running activity on Garmin Connect. #beatyesterday https://connect.garmin.com/modern/activity/${id}`
  assert.equal(parseGarminActivityUrl(shared), id)
  assert.equal(extractGarminActivityUrl(shared), `https://connect.garmin.com/modern/activity/${id}`)
  assert.equal(extractGarminActivityUrl(`활동 링크: https://connect.garmin.com/app/activity/${id}?utm_source=share.`), `https://connect.garmin.com/modern/activity/${id}`)
  assert.equal(extractGarminActivityUrl(`https://connect\u200B.garmin.com/modern/activity/${id}`), `https://connect.garmin.com/modern/activity/${id}`)
  assert.throws(() => parseGarminActivityUrl(`https://example.com/modern/activity/${id}`))
  assert.throws(() => parseGarminActivityUrl('https://connect.garmin.com/modern/profile/test'))
})

test('restores a Garmin URL stored in an alternate iOS clipboard format', () => {
  const plain = 'Check out my running activity on Garmin Connect. #beatyesterday'
  const html = `<a href="https://connect.garmin.com/modern/activity/${id}">Garmin activity</a>`
  assert.equal(mergeGarminClipboardText(plain, [html]), `${plain}\nhttps://connect.garmin.com/modern/activity/${id}`)
})

test('extracts the public embedded Garmin running summary', () => {
  const activity = parseGarminEmbedHtml(html, id)
  assert.equal(activity.date, '2026-09-05')
  assert.equal(activity.startedAt, '2026-09-05 06:46:17')
  assert.equal(activity.distance, 30.02)
  assert.equal(activity.duration, 12202)
  assert.equal(activity.pace, 406)
  assert.equal(activity.calories, 2615)
  assert.equal(activity.heartRate, 137)
  assert.equal(activity.elevationGain, 307.53)
})

test('rejects non-running or unrelated embed data', () => {
  assert.throws(() => parseGarminEmbedHtml(html.replace('running', 'cycling'), id))
  assert.throws(() => parseGarminEmbedHtml(html, '999'))
})
