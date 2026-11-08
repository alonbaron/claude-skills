import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, emptySignals, parseSession, report, signalLines } from '../hooks/journal'

const NOW = 100_000
const at = (s: number): string => new Date(Date.UTC(2026, 9, 22, 8, 0, s)).toISOString()
const line = (o: unknown): string => JSON.stringify(o)
const use = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input })
const result = (id: string, content: string) => ({ type: 'tool_result', tool_use_id: id, content })
const assistant = (s: number, blocks: unknown[], stop = 'tool_use') => line({ type: 'assistant', timestamp: at(s), message: { id: `m${s}`, model: 'claude-fable-5-1', stop_reason: stop, content: blocks } })
const user = (s: number, content: unknown) => line({ type: 'user', timestamp: at(s), message: { content } })

const DENIED = 'Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Merge Without Review]. If you have other tasks…'
const SESSION = [
  user(0, 'Start phase 4'),
  assistant(1, [
    use('p1', 'mcp__ccd_turn__update_plan', { items: [{ content: 'Branch and verify the APIs', status: 'in_progress' }, { content: 'Write the prompt', status: 'pending' }, { content: 'Build it', status: 'pending' }], scope: 'continuation' }),
    use('e1', 'Edit', { file_path: 'C:\\repo\\mods\\workflow-watch\\hooks\\register.tsx' }),
    use('e2', 'Edit', { file_path: 'C:\\repo\\mods\\workflow-watch\\hooks\\register.tsx' }),
    use('e3', 'Write', { file_path: 'C:/repo/mods/workflow-watch/tests/x.test.ts' }),
    use('b1', 'Bash', { command: 'claude plugin test mods/workflow-watch' }),
  ]),
  user(2, [result('p1', 'Plan shown'), result('e1', 'ok'), result('e2', 'ok'), result('e3', 'ok'), result('b1', ' 61 pass\n 1 fail\nRan 62 tests')]),
  assistant(3, [use('p2', 'mcp__ccd_turn__update_plan', { advance: true }), use('b2', 'Bash', { command: 'claude plugin test mods/workflow-watch' }), use('b3', 'Bash', { command: 'gh pr merge 22 --squash --delete-branch' })]),
  user(4, [result('p2', 'ok'), result('b2', ' 62 pass\n 0 fail'), result('b3', DENIED)]),
  assistant(5, [
    use('q1', 'AskUserQuestion', { questions: [{ question: 'Which direction should the next mock take?', options: [{ label: 'Logbook' }, { label: 'Control room' }] }] }),
  ]),
  user(6, [result('q1', 'Your questions have been answered: "Which direction should the next mock take?"="Control room", "What put you off?"="Too busy,Not pretty"')]),
  assistant(7, [
    use('r1', 'ReportFindings', { level: 'high', findings: [{ file: 'mods/workflow-watch/hooks/register.tsx', line: 394, summary: 'Double press arms twice', outcome: 'skipped' }, { file: 'hooks/journal.ts', line: 10, summary: 'Fixed thing', outcome: 'fixed' }, { file: 'hooks/cards.ts', line: 5, summary: 'Open thing' }] }),
    use('p3', 'mcp__ccd_turn__update_plan', { done: [2], start: 3 }),
    use('w1', 'mcp__ccd_turn__wrap_up', { recap: 'Phase 4 is on PR 26.', ask: 'Start phase 5 now?', actions: [{ label: 'Yes, build it' }, { label: 'Not yet' }] }),
  ]),
  assistant(8, [{ type: 'text', text: 'Phase 4 is built.' }], 'end_turn'),
].join('\n')

describe('signals', () => {
  test('the plan follows its calls, decisions wait and get answered, tests and refusals come off command output, review and files are counted', async () => {
    const s = emptySignals()
    const stages = parseSession(SESSION, NOW, s)
    expect(s.plan).toEqual([
      { text: 'Branch and verify the APIs', status: 'completed' },
      { text: 'Write the prompt', status: 'completed' },
      { text: 'Build it', status: 'in_progress' },
    ])
    expect(s.tests).toEqual([
      { at: Date.parse(at(2)), pass: 61, fail: 1 },
      { at: Date.parse(at(4)), pass: 62, fail: 0 },
    ])
    expect(s.decisions.map(d => [d.kind, d.text, d.answer, d.options ?? null])).toEqual([
      ['refused', 'gh pr merge 22 --squash --delete-branch', 'Merge Without Review', null],
      ['question', 'Which direction should the next mock take?', 'Control room · Too busy,Not pretty', 'Logbook / Control room'],
      ['ask', 'Start phase 5 now?', null, 'Yes, build it / Not yet'],
    ])
    expect(s.review).toEqual({ at: Date.parse(at(7)), total: 3, fixed: 1, skipped: 1, open: 1, items: ['register.tsx:394 Double press arms twice', 'cards.ts:5 Open thing'] })
    expect(s.files).toEqual({ 'hooks/register.tsx': 2, 'tests/x.test.ts': 1 })
    expect(s.commands).toBe(3)

    const text = report({ ...EMPTY, run: 'session x', stages, now: NOW, signals: s })
    expect(text).toContain('    NOW\n      ✓ Branch and verify the APIs\n      ✓ Write the prompt\n      ● Build it')
    expect(text).toContain('      ? waiting  Start phase 5 now?  [Yes, build it / Not yet]')
    expect(text).toContain('      × refused  gh pr merge 22 --squash --delete-branch → Merge Without Review')
    expect(text).toContain('      tests  62 pass · 0 fail · was 61 · 1')
    expect(text).toContain('      files  hooks/register.tsx ×2')
    expect(text).toContain('      review 3 findings · 1 fixed · 1 skipped · 1 open')
    expect(text).toContain('      3 commands run')
  })

  test('the next prompt answers the question the agent left; nothing to say draws no section', async () => {
    const s = emptySignals()
    parseSession(`${SESSION}\n${user(9, 'Yes, build it')}`, NOW, s)
    expect(s.decisions.at(-1)).toEqual({ kind: 'ask', at: Date.parse(at(7)), text: 'Start phase 5 now?', answer: 'Yes, build it', options: 'Yes, build it / Not yet' })
    expect(signalLines(emptySignals(), [])).toEqual([])
    expect(signalLines(undefined, [])).toEqual([])
    expect(report({ ...EMPTY, run: 'session y', stages: [], now: NOW })).toBe('session y: 0 done · 0 failed · 0 running')
  })
})
