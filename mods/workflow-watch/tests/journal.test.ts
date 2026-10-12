import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, applyEntries, parseLines, phaseRuns, readMeta, readTranscript, report, stageDetail, stageLines, state, statusLine, summarize, tone, who } from '../hooks/journal'

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
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 1 })).toBe('wf_1: ▶ running build:1.2 (? n/a), 0 done')
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
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 4000 })).toBe('wf_1: ! finished, 2 done, 1 failed')
  })

  test('phase dividers follow run order, so a second refute round gets its own', async () => {
    const at = (phase: string, n: number) => `{"type":"started","key":"k${n}","agentId":"a${n}","label":"${phase.toLowerCase()}:1.2:r${n}","phase":"${phase}"}`
    const stages = applyEntries([], parseLines([at('Refute', 1), at('Fix', 2), at('Refute', 3)].join('\n')), 1)
    expect(phaseRuns(stages).map(g => g.phase)).toEqual(['Refute', 'Fix', 'Refute'])
    expect(report({ ...EMPTY, run: 'wf_1', stages, now: 1 }).split('\n').filter(l => l.startsWith('── '))).toEqual(['── Refute', '── Fix', '── Refute'])
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
    expect(text.split('\n')[0]).toBe('wf_1: 0 running, 1 done')
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
