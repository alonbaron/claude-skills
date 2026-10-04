import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, applyEntries, parseLines, readMeta, readTranscript, report, statusLine, summarize, who } from '../hooks/journal'

const STARTED = '{"type":"started","key":"k1","agentId":"a1","label":"build:1.2","phase":"Build"}'
const RESULT = '{"type":"result","key":"k1","agentId":"a1","result":{"ok":true,"commits":["c1","c2"],"testsPassed":true,"lintPassed":false,"deviations":[]}}'
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
    expect(statusLine({ ...EMPTY, run: 'wf_1', stages, now: 1 })).toBe('wf_1: 1 running (build:1.2), 0 done')
    expect(statusLine(EMPTY)).toBe(undefined)
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

  test('who shows alias, resolved model, effort and tokens, and n/a for a model with no effort', async () => {
    const [s] = applyEntries([], parseLines(STARTED), 1)
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'sonnet', model: 'claude-sonnet-5-5', effort: 'high', outputTokens: 750 })).toBe('sonnet→claude-sonnet-5-5 high 750')
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-4-5-20251001', effort: null, outputTokens: 1300 })).toBe('haiku→claude-haiku-4-5-20251001 n/a 1.3k')
  })
})

describe('report', () => {
  test('the text report lists every stage under its phase with its state', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n' + RESULT), 3000)
    const text = report({ ...EMPTY, run: 'wf_1', stages, now: 3000 })
    expect(text.split('\n')[0]).toBe('wf_1: 0 running, 1 done')
    expect(text.split('\n')[1]).toBe('Build:')
    expect(text.includes('build:1.2  [?')).toBe(true)
    expect(text.includes('ok=true commits=2')).toBe(true)
  })
})
