import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGarminCsv, readCsv } from '../src/lib/garmin-csv.ts'

const header = 'Activity Type,Date,Distance,Time,Calories,Avg HR,Title\r\n'
const run = 'Running,2026-09-05 06:46:17,30.02,03:23:22,"2,615",137,"Morning, run"'
test('Garmin values and quoted thousands parse without AI', () => {
  const result = parseGarminCsv('\uFEFF' + header + run, 'km')
  assert.equal(result.errors.length, 0)
  assert.equal(result.runs[0].duration, 12202)
  assert.equal(result.runs[0].distance, 30.02)
  assert.equal(result.runs[0].calories, 2615)
})
test('walking is excluded; repeated runs deduplicate, distinct start times survive', () => {
  const result = parseGarminCsv(header + [run, run, run.replace('06:46:17', '18:46:17'), run.replace('Running', 'Walking')].join('\n'), 'km')
  assert.equal(result.runs.length, 2)
  assert.equal(result.duplicates, 1)
  assert.equal(result.skipped, 1)
})
test('miles convert distance and calculated pace', () => {
  const result = parseGarminCsv(header + run.replace('30.02', '5').replace('03:23:22', '00:40:00'), 'mi')
  assert.equal(result.runs[0].distance, 8.05)
  assert.equal(result.runs[0].pace, 298)
})
test('invalid dates, times, negative distances and malformed CSV fail', () => {
  for (const value of [run.replace('2026-09-05', '2026-02-30'), run.replace('03:23:22', '03:99:22'), run.replace('30.02', '-5')]) {
    const result = parseGarminCsv(header + value, 'km')
    assert.equal(result.errors.length, 1)
    assert.equal(result.runs.length, 0)
  }
  assert.throws(() => readCsv('a,"unterminated'))
  assert.throws(() => parseGarminCsv('Date,Distance\n2026-09-05,5', 'km'))
})
test('quoted multiline fields and escaped quotes', () => {
  assert.deepEqual(readCsv('a,b\r\n"line\nnext","a""b"'), [['a', 'b'], ['line\nnext', 'a"b']])
})
test('DD/MM/YYYY dates and MM:SS duration formats parse and normalize', () => {
  const dmyRun = 'Running,05/09/2026 06:46:17,10.00,45:30,"500",150,"Tempo run"'
  const result = parseGarminCsv(header + dmyRun, 'km')
  assert.equal(result.errors.length, 0)
  assert.equal(result.runs[0].date, '2026-09-05')
  assert.equal(result.runs[0].startedAt, '2026-09-05 06:46:17')
  assert.equal(result.runs[0].duration, 2730) // 45*60 + 30
  assert.equal(result.runs[0].pace, 273)

  // With DD/MM/YYYY HH:MM (no seconds)
  const noSecRun = 'Running,05/09/2026 06:46,5.00,25:00,"250",140,"Easy run"'
  const result2 = parseGarminCsv(header + noSecRun, 'km')
  assert.equal(result2.runs[0].startedAt, '2026-09-05 06:46:00')
  assert.equal(result2.runs[0].duration, 1500)

  // Invalid DD/MM/YYYY date
  const invalidDmy = 'Running,31/02/2026 06:46:17,10.00,45:30,"500",150,"Run"'
  const result3 = parseGarminCsv(header + invalidDmy, 'km')
  assert.equal(result3.errors.length, 1)
})

