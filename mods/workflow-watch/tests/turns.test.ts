import { describe, expect, test } from 'claude-code/testing'

import { digest, firstSentence, parseSession, stageLines, turnTitle } from '../hooks/journal'
import type { Stage } from '../types'

const NOW = 100_000
const at = (s: number): string => new Date(Date.UTC(2026, 9, 22, 8, 0, s)).toISOString()
const line = (o: unknown): string => JSON.stringify(o)
const LONG = 'Please look at the tracker pane and tell me why it keeps opening every time I send a message, then propose a plan. Second sentence here.'

const SESSION = [
  line({ type: 'user', timestamp: at(0), message: { content: LONG } }),
  line({ type: 'assistant', timestamp: at(1), message: { id: 'a', model: 'claude-fable-5-1', stop_reason: 'tool_use', content: [{ type: 'text', text: 'Alon, on it.' }, { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'src/a.ts' } }, { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'src/a.ts' } }, { type: 'tool_use', id: 't3', name: 'Write', input: { file_path: 'src/b.ts' } }, { type: 'tool_use', id: 't4', name: 'Bash', input: { command: 'npm test' } }, { type: 'tool_use', id: 't5', name: 'PowerShell', input: { command: 'dir' } }] } }),
  line({ type: 'assistant', timestamp: at(5), message: { id: 'b', model: 'claude-fable-5-1', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done: the pane now opens only when you say so. Two tests cover it, and the README says how.' }] } }),
  line({ type: 'user', timestamp: at(9), message: { content: 'thanks' } }),
].join('\n')

const stage = (over: Partial<Stage>): Stage => ({ kind: 'commit', key: 'c', agentId: null, label: 'commit:abc', phase: 'Turn 1', startedAt: 0, endedAt: 1, summary: null, isEmpty: false, isFailed: false, isDisputed: false, alias: null, model: null, effort: null, outputTokens: 0, calls: 0, lastTool: null, isSettled: true, ...over })

describe('turns', () => {
  test('a title is the first sentence of the prompt, cut at a word to 100 characters', async () => {
    expect(turnTitle('Fix the login bug.')).toBe('Fix the login bug.')
    expect(turnTitle('Fix the login bug. Then deploy.')).toBe('Fix the login bug.')
    expect(turnTitle('why does it fail? no idea')).toBe('why does it fail?')
    expect(turnTitle(LONG)).toBe('Please look at the tracker pane and tell me why it keeps opening every time I send a message, then…')
    expect(turnTitle('a'.repeat(120))).toBe(`${'a'.repeat(99)}…`)
    expect(turnTitle('')).toBe(null)
    expect(turnTitle(null)).toBe(null)
    expect(firstSentence('no punctuation at all', 100)).toBe('no punctuation at all')
    expect(firstSentence('v1.2 shipped. Next one soon.', 100)).toBe('v1.2 shipped.')
    expect(firstSentence('', 100)).toBe('')
  })

  test('a turn keeps its full prompt and answer, summarizes the closing sentence, and counts its edits, commands and tools', async () => {
    const [t] = parseSession(SESSION, NOW)
    expect(t?.prompt).toBe(LONG)
    expect(t?.answer).toBe('Done: the pane now opens only when you say so. Two tests cover it, and the README says how.')
    expect(t?.summary).toBe('Done: the pane now opens only when you say so.')
    expect(t?.files).toEqual(['src/a.ts', 'src/b.ts'])
    expect(t?.commands).toBe(2)
    expect(t?.tools).toEqual(['Edit src/a.ts', 'Edit src/a.ts', 'Write src/b.ts', 'Bash npm test', 'PowerShell dir'])
    const lines = stageLines(t as Stage, NOW, parseSession(SESSION, NOW))
    expect(lines[1]).toBe(`    › ${LONG.slice(0, 99).trimEnd()}…`)
    expect(lines.at(-1)).toBe('    edited 2 files · 2 commands')
    expect(lines[0]).toContain('turn:1 · Please look at the tracker pane and tell me why it keeps opening every time I send a message, then…')
  })

  test('the digest counts the items that started inside the turn, whatever phase a skill moved them to', async () => {
    const turn = stage({ kind: 'turn', key: 'turn:1', label: 'turn:1', startedAt: 10, endedAt: 50, files: ['a', 'b', 'c'], commands: 7 })
    const all = [turn, stage({ kind: 'skill', startedAt: 12, phase: 'Skill · x' }), stage({ kind: 'agent', startedAt: 20 }), stage({ kind: 'agent', startedAt: 30 }), stage({ kind: 'commit', startedAt: 45 }), stage({ kind: 'commit', startedAt: 60 }), stage({ kind: 'turn', key: 'turn:2', startedAt: 60 })]
    expect(digest(turn, all, NOW)).toBe('edited 3 files · 7 commands · 1 commit · 2 agents · 1 skill')
    expect(digest(stage({ kind: 'turn', key: 'turn:3', startedAt: 70, endedAt: null }), [stage({ kind: 'commit', startedAt: 80 })], NOW)).toBe('1 commit')
    expect(digest(stage({ kind: 'turn', key: 'turn:4', startedAt: 90, endedAt: 95 }), [], NOW)).toBe('')
  })
})
