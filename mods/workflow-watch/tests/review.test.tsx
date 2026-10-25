import { describe, expect, mock, test } from 'claude-code/testing'

import { headerCard, phaseChip, stageCard, timelineCard } from '../hooks/cards'
import { EMPTY, SLIM_CUT, parseSession, report, slimLog } from '../hooks/journal'
import type { Stage } from '../types'

const line = (o: unknown): string => JSON.stringify(o)
const SITE = { scroll: { offset: 0, bodyRows: 40 }, view: {} }

describe('slimmed logs', () => {
  test('the filter keeps the lines the parser reads, empties image data, cuts long strings, and every line stays JSON', async () => {
    const long = 'a "quoted" \\ line\n'.repeat(400)
    const text = [
      line({ type: 'api-request', body: 'x'.repeat(5000) }),
      line({ parentUuid: 'p', type: 'user', timestamp: '2026-10-22T08:00:00.000Z', message: { content: [{ type: 'image', source: { data: 'A'.repeat(5000) } }, { type: 'text', text: 'look at this' }] } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:01.000Z', message: { content: long } }),
      line({ type: 'ai-title', aiTitle: 'gone' }),
      '',
    ].join('\n')
    const slim = slimLog(text).split('\n').filter(Boolean)
    expect(slim.length).toBe(2)
    for (const l of slim) expect(() => JSON.parse(l)).not.toThrow()
    expect(slim[0]).toContain('"data":""')
    expect(slim[0]).toContain('look at this')
    expect(slim[1]!.length).toBeLessThan(long.length)
  })

  test('a log cut to its newest lines skips the cut marker, and an opening mid-turn becomes one promptless turn', async () => {
    const lines = [
      SLIM_CUT,
      line({ type: 'assistant', timestamp: '2026-10-22T08:00:01.000Z', message: { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'earlier reply' }] } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:02.000Z', toolUseResult: { stdout: 'ok' }, message: { content: [{ type: 'tool_result', tool_use_id: 'gone', content: 'ok' }] } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:10.000Z', message: { content: 'next prompt' } }),
      line({ type: 'assistant', timestamp: '2026-10-22T08:00:12.000Z', message: { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] } }),
    ].join('\n')
    const turns = parseSession(lines, Date.parse('2026-10-22T08:01:00.000Z')).filter(s => s.kind === 'turn')
    expect(turns.map(s => s.prompt ?? null)).toEqual([null, 'next prompt'])
    expect(turns.at(-1)?.summary).toBe('done')
  })

  test('a report cut before its closing tag still ends its subagent', async () => {
    const lines = [
      line({ type: 'user', timestamp: '2026-10-22T08:00:00.000Z', message: { content: 'review it' } }),
      line({ type: 'assistant', timestamp: '2026-10-22T08:00:01.000Z', message: { model: 'claude-opus-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu1', name: 'Agent', input: { description: 'lens' } }] } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:02.000Z', toolUseResult: { isAsync: true, agentId: 'ag1' }, message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'launched' }] } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:30.000Z', message: { content: '<agent-message from="ag1">All three findings hold up...' } }),
    ].join('\n')
    const agent = parseSession(lines, Date.parse('2026-10-22T08:01:00.000Z')).find(s => s.kind === 'agent')
    expect(agent?.endedAt).toBe(Date.parse('2026-10-22T08:00:30.000Z'))
    expect(agent?.summary).toBe('All three findings hold up...')
  })
})

describe('turns', () => {
  test('the client filler after an interrupt does not replace it, and an interrupt before any reply does not repeat the prompt', async () => {
    const lines = [
      line({ type: 'user', timestamp: '2026-10-22T08:00:00.000Z', message: { content: 'fix the bug' } }),
      line({ type: 'user', timestamp: '2026-10-22T08:00:02.000Z', message: { content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } }),
      line({ type: 'assistant', timestamp: '2026-10-22T08:00:03.000Z', message: { model: '<synthetic>', stop_reason: 'stop_sequence', content: [{ type: 'text', text: 'No response requested.' }] } }),
    ].join('\n')
    const [turn, ...rest] = parseSession(lines, Date.parse('2026-10-22T08:01:00.000Z'))
    expect(rest.length).toBe(0)
    expect(turn?.prompt).toBe('fix the bug')
    expect(turn?.summary).toBe('(interrupted)')
  })

  test('the text report carries each turn prompt, as the pane does', async () => {
    const stages = parseSession(line({ type: 'user', timestamp: '2026-10-22T08:00:00.000Z', message: { content: 'ship it' } }), 1)
    expect(report({ ...EMPTY, run: 'session x', stages, now: 2 })).toContain('    › ship it')
  })
})

const at = (n: number) => Date.parse('2026-10-22T08:00:00.000Z') + n * 1000
const item = (kind: Stage['kind'], label: string, phase: string, start: number): Stage => ({
  kind, key: label, agentId: null, label, phase, startedAt: at(start), endedAt: at(start + 1), summary: 'ok', isEmpty: false, isFailed: false, isDisputed: false,
  alias: null, model: null, effort: null, outputTokens: 0, calls: 0, lastTool: null, isSettled: true,
})

describe('cards', () => {
  test('a phase chip takes its opener kind while its cards run newest first', async ($, on) => {
    mock.clock(on)
    const stages = [item('turn', 'turn:1', 'Turn 1', 0), item('skill', 'skill:x', 'Skill · x', 2), item('agent', 'agent:lens', 'Skill · x', 3)]
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...EMPTY, journal: 'j', run: 'session x', stages, now: at(10) }, version: 1 } }))
    const ui = await $.ui.mount({ plugin: 'workflow-watch', surface: 'vscode', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Tracker', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE } })
    const svgs = await ui.findAll({ type: 'Svg' })
    const chip = svgs.find(n => n.props.alt === 'Skill · x')
    expect(String(chip?.props.source)).toContain('#A78BFA')
    const order = svgs.map(n => String(n.props.alt)).filter(a => /^(Skill · x|Turn 1|✓ done)/.test(a)).map(a => a.split(' ').slice(0, 3).join(' '))
    expect(order).toEqual(['Skill · x', '✓ done agent:lens', '✓ done skill:x', 'Turn 1', '✓ done turn:1'])
    await ui.unmount()
  })

  test('text from the log is escaped in every card', async () => {
    const evil = '<b onload="x()">&amp; \'q\' </text><script>1</script>'
    const s = { ...item('turn', evil, evil, 0), prompt: evil, summary: evil, model: evil, lastTool: evil }
    const w = { ...EMPTY, journal: 'j', run: evil, stages: [s], now: at(5) }
    for (const theme of ['dark', 'light'] as const) {
      for (const card of [headerCard(w, 0, theme), timelineCard([s], at(0), 5000, at(5), theme), phaseChip({ phase: evil, stages: [s] }, theme), stageCard(s, at(5), theme)]) {
        expect(card.source).not.toContain('<script')
        expect(card.source).not.toContain('<b ')
        expect(card.source.replace(/<\/?[a-z]+(\s[^<>]*)?\/?>/g, '').replace(/&#\d+;/g, '')).not.toMatch(/[<>&]/)
      }
    }
  })
})
