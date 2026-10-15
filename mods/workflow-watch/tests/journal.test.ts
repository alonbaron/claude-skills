import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, applyEntries, parseLines, phaseRuns, readMeta, readTranscript, report, stageDetail, stageLines, state, statusLine, summarize, tally, tone, who, withFacts } from '../hooks/journal'

const STARTED = '{"type":"started","key":"k1","agentId":"a1","label":"build:1.2","phase":"Build"}'
const RESULT = '{"type":"result","key":"k1","agentId":"a1","result":{"ok":true,"commits":["c1","c2"],"testsPassed":true,"lintPassed":false,"deviations":[]}}'
const REFUTE_STARTED = '{"type":"started","key":"k2","agentId":"a2","label":"refute:invariants:1.2:r1","phase":"Refute"}'
const REFUTE_FAILED = '{"type":"result","key":"k2","agentId":"a2","result":{"verdict":"fail","testsRan":false,"blocking":[{"file":"src/a.js","issue":"off by one"}],"advisory":[]}}'
const TRANSCRIPT = [
  '{"type":"user","message":{"role":"user","content":"go"}}',
  '{"type":"assistant","effort":"high","message":{"model":"claude-sonnet-5-5","usage":{"input_tokens":10,"output_tokens":300},"content":[{"type":"tool_use","name":"Bash","input":{"command":"npm   test"}}]}}',
  '{"type":"assistant","effort":"high","message":{"model":"claude-sonnet-5-5","usage":{"output_tokens":450},"content":[{"type":"text","text":"done"}]}}',
].join('\n')

describe('journal', () => {
  test('parseLines keeps whole lines and leaves a half-flushed last line for the next read', async () => {
    const entries = parseLines('{"type":"launched"}\n' + STARTED + '\n{"type":"res')
    expect(entries.length).toBe(2)
    expect(entries[1]?.label).toBe('build:1.2')
  })

  test('a started line opens a stage and its result line closes it with a summary', async () => {
    const open = applyEntries([], parseLines(STARTED), 1000)
    expect(open.length).toBe(1)
    expect(open[0]?.endedAt).toBe(null)
    const closed = applyEntries(open, parseLines(STARTED + '\n' + RESULT), 5000)
    expect(closed[0]?.endedAt).toBe(5000)
    expect(closed[0]?.startedAt).toBe(1000)
    expect(closed[0]?.summary).toBe('ok=true commits=2 tests=pass lint=FAIL deviations=0')
  })

  test('a null result is marked empty, and re-reading the journal does not reopen a stage', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n{"type":"result","key":"k1","result":null}'), 7)
    expect(stages[0]?.isEmpty).toBe(true)
    const again = applyEntries(stages, parseLines(STARTED + '\n{"type":"result","key":"k1","result":null}'), 9)
    expect(again[0]?.endedAt).toBe(7)
  })

  test('summaries cover the build-loop stages and fall back to JSON for others', async () => {
    expect(summarize('plan', { taskId: '1.2', branch: 'feature/x', resuming: false })).toBe('picked 1.2 on feature/x')
    expect(summarize('refute:correctness:1.2:r1', { verdict: 'fail', blocking: [{ file: 'src/a.js', issue: 'off by one' }], advisory: [], testsRan: true })).toBe('FAIL blocking=1 advisory=0 testsRan=true | src/a.js: off by one')
    expect(summarize('probe:one', { word: 'ok' })).toBe('{"word":"ok"}')
  })

  test('the status line names the running stages', async () => {
    const stages = applyEntries([], parseLines(STARTED), 1)
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 1 })).toBe('wf_1: ▶ running build:1.2 (? n/a) · 0 done · 0 failed · 1 running')
    expect(statusLine(EMPTY)).toBe(undefined)
  })

  test('a failing result is marked failed, shown as a glyph and a word, and counted on the status line', async () => {
    const lines = parseLines(STARTED + '\n' + REFUTE_STARTED + '\n' + RESULT + '\n' + REFUTE_FAILED)
    const stages = applyEntries([], lines, 4000)
    const lens = stages[1] as NonNullable<(typeof stages)[1]>
    expect(lens.isFailed).toBe(true)
    expect(state(lens)).toBe('! failed')
    expect(tone(lens)).toBe('error')
    expect(state(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('✓ done')
    expect(tone(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('success')
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 4000 })).toBe('wf_1: ! finished · 1 done · 1 failed · 0 running')
  })

  test('ok:false fails, a dispute is its own state, and a null result or a failed entry has no result; the tally adds up', async () => {
    const at = (n: number, label: string) => `{"type":"started","key":"k${n}","agentId":"a${n}","label":"${label}","phase":"P"}`
    const lines = parseLines(
      [
        at(1, 'build:1.2'),
        '{"type":"result","key":"k1","result":{"ok":false,"commits":[],"testsPassed":false,"lintPassed":true,"deviations":[]}}',
        at(2, 'fix:1.2:r1'),
        '{"type":"result","key":"k2","result":{"fixed":["a"],"notFixed":[{"key":"b","reason":"not a bug"}],"commits":["c1"]}}',
        at(3, 'close:1.2'),
        '{"type":"result","key":"k3","result":null}',
        at(4, 'scout:1.2'),
        '{"type":"failed","key":"k4","agentId":"a4"}',
        at(5, 'plan'),
        '{"type":"result","key":"k5","result":{"taskId":"1.2","branch":"feature/x"}}',
        at(6, 'measure:1.2'),
      ].join('\n'),
    )
    const [build, fix, close, scout, plan, measure] = applyEntries([], lines, 10) as NonNullable<ReturnType<typeof applyEntries>[0]>[]
    expect([build, fix, close, scout, plan, measure].map(s => state(s as NonNullable<typeof s>))).toEqual(['! failed', '! disputed', '✗ no result', '✗ no result', '✓ done', '▶ running'])
    expect([build, fix, close, scout, plan, measure].map(s => tone(s as NonNullable<typeof s>))).toEqual(['error', 'warning', 'error', 'error', 'success', 'warning'])
    expect(fix?.summary).toBe('fixed=1 disputed=1 commits=1 | disputed b: not a bug')
    expect(close?.summary).toBe('(no result)')
    expect(scout?.summary).toBe('(stopped without a result)')
    const stages = applyEntries([], lines, 10)
    expect(tally({ ...EMPTY, run: 'wf_1', stages, now: 10 })).toBe('1 done · 1 disputed · 3 failed · 1 running')
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 10 })).toBe('wf_1: ▶ running measure:1.2 (? n/a) · 1 done · 1 disputed · 3 failed · 1 running')
    const ended = applyEntries(stages, parseLines('{"type":"result","key":"k6","result":{"filesChanged":1,"linesChanged":2}}'), 20)
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages: ended, now: 20 })).toBe('wf_1: ! finished · 2 done · 1 disputed · 3 failed · 0 running')
  })

  test('a failed entry for an unknown stage, or after its result, changes nothing', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n' + RESULT + '\n{"type":"failed","key":"k1"}\n{"type":"failed","key":"nope"}'), 5)
    expect(stages.length).toBe(1)
    expect(state(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('✓ done')
  })

  test('a cut line ends in an ellipsis, and control characters never reach the screen', async () => {
    const long = summarize('probe', 'x'.repeat(150))
    expect(long.length).toBe(100)
    expect(long.endsWith('x…')).toBe(true)
    expect(summarize('probe', 'a\u001b[31mb\u0007c')).toBe('a [31mb c')
    const [s] = applyEntries([], parseLines('{"type":"started","key":"k1","label":"build:\\u001b[2J1.2","phase":"Bu\\u009bild"}\n{"type":"result","key":"k1","result":{"ok":true,"commits":[],"testsPassed":true,"lintPassed":true,"deviations":[],"blockedReason":"x\\u0000y"}}'), 1)
    expect(s?.label).toBe('build: [2J1.2')
    expect(s?.phase).toBe('Bu ild')
    expect(s?.summary).toBe('ok=true commits=0 tests=pass lint=pass deviations=0 BLOCKED: x y')
  })

  test('phase dividers follow run order and name the round, so a second refute round gets its own', async () => {
    const at = (phase: string, n: number) => `{"type":"started","key":"k${n}","agentId":"a${n}","label":"${phase.toLowerCase()}:1.2:r${n}","phase":"${phase}"}`
    const stages = applyEntries([], parseLines([at('Refute', 1), at('Fix', 2), at('Refute', 3), '{"type":"started","key":"k4","label":"arbiter:1.2","phase":"Arbiter"}'].join('\n')), 1)
    expect(phaseRuns(stages).map(g => g.phase)).toEqual(['Refute', 'Fix', 'Refute', 'Arbiter'])
    expect(report({ ...EMPTY, run: 'wf_1', stages, now: 1 }).split('\n').filter(l => l.startsWith('── '))).toEqual(['── Refute · round 1', '── Fix · round 2', '── Refute · round 3', '── Arbiter'])
  })
})

describe('transcript', () => {
  test('readTranscript takes the resolved model, the effort, the output tokens and the tool calls', async () => {
    const facts = readTranscript(TRANSCRIPT)
    expect(facts.model).toBe('claude-sonnet-5-5')
    expect(facts.effort).toBe('high')
    expect(facts.outputTokens).toBe(750)
    expect(facts.calls).toBe(1)
    expect(facts.lastTool).toBe('Bash npm test')
  })

  test('the client message a failed call leaves (<synthetic>) is not taken for the model', async () => {
    const died = TRANSCRIPT + '\n{"type":"assistant","message":{"model":"<synthetic>","usage":{"output_tokens":0},"content":[{"type":"text","text":"session limit"}]}}'
    expect(readTranscript(died).model).toBe('claude-sonnet-5-5')
  })

  test('a stage first seen after it finished takes its times from the transcript, not from when the mod looked', async () => {
    const stamped = [
      '{"type":"user","timestamp":"2026-10-12T14:00:00.000Z","message":{"content":"go"}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:02:40.900Z","effort":"low","message":{"model":"claude-haiku-5-5","usage":{"output_tokens":100},"content":[]}}',
    ].join('\n')
    const t0 = Date.parse('2026-10-12T14:00:00.000Z')
    const [seenLate] = applyEntries([], parseLines(STARTED + '\n' + RESULT), t0 + 3_600_000)
    const s = withFacts(seenLate as NonNullable<typeof seenLate>, readTranscript(stamped))
    expect(s.startedAt).toBe(t0)
    expect(s.endedAt).toBe(t0 + 160_900)
    expect(s.isSettled).toBe(true)
    expect(stageDetail(s, t0 + 3_600_000)).toBe('Ran for 2:40 · 0 tools · 0.1k tokens')
    const [live] = applyEntries([], parseLines(STARTED), t0 + 5_000)
    const l = withFacts(live as NonNullable<typeof live>, readTranscript(stamped))
    expect(l.endedAt).toBe(null)
    expect(l.isSettled).toBe(false)
    expect(stageDetail(l, t0 + 200_000)).toBe('Running for 3:20 · 0 calls · starting…')
  })

  test('readMeta takes the alias and tolerates garbage', async () => {
    expect(readMeta('{"model":"sonnet","agentType":"workflow-subagent"}')).toBe('sonnet')
    expect(readMeta('not json')).toBe(null)
  })

  test('who shows alias, resolved model and effort, and n/a for a model with no effort', async () => {
    const [s] = applyEntries([], parseLines(STARTED), 1)
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'sonnet', model: 'claude-sonnet-5-5', effort: 'high', outputTokens: 750 })).toBe('sonnet→claude-sonnet-5-5 high')
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-4-5-20251001', effort: null, outputTokens: 1300 })).toBe('haiku→claude-haiku-4-5-20251001 n/a')
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-5-5', effort: 'low', outputTokens: 400 })).toBe('haiku→claude-haiku-5-5 low')
  })

  test('the details are one compact line: time, tools and tokens once done; calls and the last tool while running', async () => {
    const [live] = applyEntries([], parseLines(STARTED), 1000)
    const s = { ...(live as NonNullable<typeof live>), ...readTranscript(TRANSCRIPT) }
    expect(stageDetail(s, 13000)).toBe('Running for 0:12 · 1 call · Bash npm test')
    expect(stageDetail({ ...s, endedAt: 47000 }, 99000)).toBe('Ran for 0:46 · 1 tool · 0.8k tokens')
  })
})

describe('report', () => {
  test('the text report lists every stage under its phase with its state', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n' + RESULT), 3000)
    const text = report({ ...EMPTY, run: 'wf_1', stages, now: 3000 })
    expect(text.split('\n')[0]).toBe('wf_1: 1 done · 0 failed · 0 running')
    expect(text.split('\n')[1]).toBe('── Build')
    expect(text.split('\n')[2]).toBe('✓ done  build:1.2  ? n/a')
    expect(text.includes('ok=true commits=2')).toBe(true)
  })

  test('a stage block is the head line, then the result and the details indented under it', async () => {
    const [s] = applyEntries([], parseLines(STARTED), 1000)
    const live = { ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-5-5', effort: 'low' }
    expect(stageLines(live, 3000)).toEqual(['▶ running  build:1.2  haiku→claude-haiku-5-5 low', '    no result yet', '    Running for 0:02 · 0 calls · starting…'])
  })
})
