import { describe, expect, test } from 'claude-code/testing'

import { countdown, fmtTokens, paceTarget, parseSession, readTranscript, stageDetail, usageText, usageView } from '../hooks/journal'
import type { Stage, Usage } from '../types'

const NOW = 1_000_000_000
const RESET_5H = new Date(NOW + 2 * 3600e3 + 13 * 60e3).toISOString()
const RESET_7D = new Date(NOW + 5 * 86400e3 + 3 * 3600e3).toISOString()
const USAGE: Usage = { context: { tokens: 320_000, window: 1_000_000, percent: 32 }, rateLimits: [{ kind: 'five_hour', percentUsed: 18, resetsAt: RESET_5H }, { kind: 'seven_day', percentUsed: 36, resetsAt: RESET_7D }], cost: { usd: 0.1111 } }

const turn = (over: Partial<Stage>): Stage => ({ kind: 'turn', key: 'turn:1', agentId: null, label: 'turn:1', phase: 'Turn 1', startedAt: 0, endedAt: 1000, summary: 'ok', isEmpty: false, isFailed: false, isDisputed: false, alias: null, model: null, effort: null, outputTokens: 800, calls: 5, lastTool: null, isSettled: true, ...over })

// One response streamed as two snapshots (same id, output grows), then a second response: input figures count once per id.
const SESSION = [
  '{"type":"user","timestamp":"2026-10-22T08:00:00.000Z","message":{"content":"go"}}',
  '{"type":"assistant","timestamp":"2026-10-22T08:00:01.000Z","message":{"id":"m1","model":"claude-fable-5-1","stop_reason":"tool_use","usage":{"input_tokens":2,"cache_creation_input_tokens":36485,"cache_read_input_tokens":48773,"output_tokens":100},"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}',
  '{"type":"assistant","timestamp":"2026-10-22T08:00:02.000Z","message":{"id":"m1","model":"claude-fable-5-1","stop_reason":"tool_use","usage":{"input_tokens":2,"cache_creation_input_tokens":36485,"cache_read_input_tokens":48773,"output_tokens":472},"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}',
  '{"type":"assistant","timestamp":"2026-10-22T08:00:05.000Z","message":{"id":"m2","model":"claude-fable-5-1","stop_reason":"end_turn","usage":{"input_tokens":32,"cache_creation_input_tokens":2596,"cache_read_input_tokens":85258,"output_tokens":697},"content":[{"type":"text","text":"done"}]}}',
].join('\n')

describe('usage', () => {
  test('input and cache tokens count once per message id, in a session and in a subagent transcript', async () => {
    const [t] = parseSession(SESSION, NOW)
    expect(t?.outputTokens).toBe(472 + 697)
    expect(t?.inputTokens).toBe(34)
    expect(t?.cacheWriteTokens).toBe(36485 + 2596)
    expect(t?.cacheReadTokens).toBe(48773 + 85258)
    const facts = readTranscript(SESSION)
    expect(facts.inputTokens).toBe(34)
    expect(facts.cacheReadTokens).toBe(48773 + 85258)
  })

  test('a finished card carries its input total and cache share; one with no input figure keeps the short line', async () => {
    expect(stageDetail(turn({ inputTokens: 100, cacheReadTokens: 38_000, cacheWriteTokens: 3_900 }), NOW)).toBe('Ran for 0:01 · 5 tools · 0.8k out · 42k in · 90% cached')
    expect(stageDetail(turn({}), NOW)).toBe('Ran for 0:01 · 5 tools · 0.8k out')
  })

  test('pace is the share of the window already gone; countdowns floor to the minute', async () => {
    expect(paceTarget(RESET_5H, 5 * 3600e3, NOW)).toBe(56)
    expect(paceTarget(undefined, 5 * 3600e3, NOW)).toBe(null)
    expect(countdown(2 * 3600e3 + 13 * 60e3 + 59e3)).toBe('2h 13m')
    expect(countdown(5 * 86400e3 + 3 * 3600e3)).toBe('5d 3h')
    expect(countdown(45 * 60e3)).toBe('45m')
    expect(fmtTokens(842)).toBe('842')
    expect(fmtTokens(4_200)).toBe('4.2k')
    expect(fmtTokens(320_000)).toBe('320k')
    expect(fmtTokens(1_000_000)).toBe('1.0M')
  })

  test('the usage lines carry the engine figures, the pace gap, the reset, the cost and the cache clock', async () => {
    const stages = [turn({ inputTokens: 100, cacheReadTokens: 38_000, cacheWriteTokens: 3_900, endedAt: NOW - 60e3 })]
    const lines = usageText(usageView(USAGE, stages, NOW, 5 * 60e3))
    // 5h: 2h 47m of 5h gone = 56%, usage 18 is 38 under pace; 7d: 1d 21h of 7d gone = 27%, usage 36 is 9 over.
    expect(lines).toEqual(['ctx 32% · 320k of 1.0M', '5h 18% · pace 56% (-38) · resets in 2h 13m', '7d 36% · pace 27% (+9) · resets in 5d 3h', '$0.11 · 800 out · 42k in · 90% cached · cache 4m left'])
    expect(usageText(usageView(USAGE, [turn({ endedAt: null })], NOW, 5 * 60e3)).at(-1)).toBe('$0.11 · 800 out · cache warm')
    expect(usageText(usageView(USAGE, stages, NOW + 10 * 60e3, 5 * 60e3)).at(-1)).toBe('$0.11 · 800 out · 42k in · 90% cached · cache expired')
  })

  test('what the engine has not reported reads unknown or is left out, never 0', async () => {
    expect(usageText(usageView(null, [turn({})], NOW, 5 * 60e3))).toEqual(['ctx unknown', 'limits unknown', '800 out · cache expired'])
    const noCost: Usage = { context: { window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 7 }] }
    expect(usageText(usageView(noCost, [], NOW, 5 * 60e3))).toEqual(['ctx unknown', '5h 7%', '0 out'])
  })
})
