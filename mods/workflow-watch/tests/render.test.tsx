import { describe, expect, mock, test } from 'claude-code/testing'

import { EMPTY, applyEntries, parseLines } from '../hooks/journal'
import type { Signals } from '../types'

const JOURNAL = [
  '{"type":"started","key":"k1","agentId":"a1","label":"build:1.2","phase":"Build"}',
  '{"type":"result","key":"k1","agentId":"a1","result":{"ok":true,"commits":["c1"],"testsPassed":true,"lintPassed":true,"deviations":[]}}',
  '{"type":"started","key":"k2","agentId":"a2","label":"refute:invariants:1.2:r1","phase":"Refute"}',
  '{"type":"result","key":"k2","agentId":"a2","result":{"verdict":"fail","testsRan":false,"blocking":[{"file":"src/a.js","issue":"off by one"}],"advisory":[]}}',
  '{"type":"started","key":"k3","agentId":"a3","label":"refute:correctness:1.2:r1","phase":"Refute"}',
].join('\n')
const stages = applyEntries([], parseLines(JOURNAL), 1000).map(s => ({ ...s, alias: 'haiku', model: 'claude-haiku-5-5', effort: 'low' }))
const WATCH = { ...EMPTY, journal: 'journal.jsonl', run: 'wf_1', stages, now: 13000 }
const SITE = { scroll: { offset: 0, bodyRows: 40 }, view: {} }
const PANE = { plugin: 'workflow-watch', surface: 'desktop', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE } } as const
const alts = async (ui: { findAll: (q: { type: string }) => Promise<Array<{ props: Record<string, unknown> }>> }) => (await ui.findAll({ type: 'Svg' })).map(n => String(n.props.alt))
const USAGE = { context: { tokens: 320_000, window: 1_000_000, percent: 32 }, rateLimits: [{ kind: 'five_hour', percentUsed: 18 }], cost: { usd: 0.11 } }
const TURN = { ...stages[0]!, kind: 'turn' as const, key: 'turn:1', label: 'turn:1', phase: 'Turn 1', endedAt: 9000, prompt: 'ship it', summary: 'done', answer: 'done' }

describe('render', () => {
  test('the terminal draws one block per stage, newest first', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: 'wf_1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 1 done   1 failed   1 running   0.0k output tokens' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Timeline · 0:12 elapsed$/ })).toBeDefined()
    const heads = await ui.findAll({ type: 'Text', text: /^ (▶ running|✓ done|! failed) {3}\S+ {2}/ })
    expect(heads.map(h => h.text.trim().split(/ {2,}/)[1])).toEqual(['refute:correctness:1.2:r1', 'refute:invariants:1.2:r1', 'build:1.2'])
    expect(await ui.find({ type: 'Text', text: 'FAIL blocking=1 advisory=0 testsRan=false | src/a.js: off by one' })).toBeDefined()
    await ui.unmount()
  })

  test('the desktop draws the console: session rule, NOW, USAGE, the TURNS rule and one entry per stage, newest first; no DECISIONS without signals', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    for (const surface of ['desktop', 'vscode'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      const a = await alts(ui)
      expect(a[0]).toBe('SESSION wf_1 | 1 DONE · 1 FAILED · 1 LIVE · 0:12')
      expect(a[1]).toBe('NOW | waiting for the first turn')
      expect(a[2]).toBe('USAGE | ctx unknown | limits unknown | 0 out · cache warm')
      expect(a[3]).toBe('TURNS | 3 ENTRIES')
      expect(a.slice(4).map(x => x.split(' ')[0])).toEqual(['refute:correctness:1.2:r1', 'refute:invariants:1.2:r1', 'build:1.2'])
      expect(a[5]).toBe('refute:invariants:1.2:r1 ! failed 0:00 0 tools · 0 out | refute:invariants:1.2:r1 | FAIL blocking=1 advisory=0 testsRan=false | src/a.js: off by one')
      expect(a.some(x => x.startsWith('DECISIONS'))).toBe(false)
      const entry = (await ui.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('refute:invariants'))
      expect(String(entry?.props.source)).toContain('font-size="12"')
      await ui.unmount()
    }
  })

  test('the theme button flips the panels between dark and light, whatever the system theme', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    const ui = await $.ui.mount(PANE)
    const first = async () => String((await ui.findAll({ type: 'Svg' }))[0]?.props.source)
    expect(await first()).toContain('.bg{fill:#0e1116}')
    expect((await ui.find({ key: 'theme' }))?.props.label).toBe('☀ Light mode')
    await ui.press({ key: 'theme' })
    expect(await first()).toContain('.bg{fill:#f6f3ee}')
    expect((await ui.find({ key: 'theme' }))?.props.label).toBe('☾ Dark mode')
    await ui.unmount()
  })

  test('an idle session shows NOW alone; Expand and Minimize flip it; Hide closes the pane', async ($, on) => {
    mock.clock(on)
    const done = WATCH.stages.map(s => ({ ...s, endedAt: s.endedAt ?? 9000, summary: s.summary ?? 'PASS' }))
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, stages: done, now: 60000, isIdle: true }, version: 1 } }))
    const closed: string[] = []
    on('ui.close', (_$: any, e: any) => {
      closed.push(e.id)
      return { value: undefined }
    })
    const ui = await $.ui.mount(PANE)
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('+ Expand')
    expect(await alts(ui)).toEqual(['NOW | waiting for the first turn'])
    await ui.press({ key: 'size' })
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('− Minimize')
    expect((await alts(ui))[0]).toBe('SESSION wf_1 | 2 DONE · 1 FAILED · 0:59')
    await ui.press({ key: 'size' })
    expect((await alts(ui)).length).toBe(1)
    await ui.press({ key: 'hide' })
    expect(closed).toEqual(['workflow-watch'])
    await ui.unmount()
  })

  test('the usage panel draws the engine figures as meters; a waiting decision shows even on the minimized pane', async ($, on) => {
    mock.clock(on)
    const signals: Signals = { plan: [{ text: 'Build it', status: 'in_progress' }], decisions: [{ kind: 'ask', at: 1, text: 'Start phase 5?', answer: null, options: 'Yes / No' }, { kind: 'refused', at: 2, text: 'gh pr merge 22', answer: 'Merge Without Review' }], tests: [{ at: 1, pass: 61, fail: 1 }, { at: 2, pass: 62, fail: 0 }], review: { at: 3, total: 3, fixed: 1, skipped: 1, open: 1, items: ['a.ts:1 x'] }, files: { 'hooks/a.ts': 3 }, commands: 7 }
    const done = WATCH.stages.map(s => ({ ...s, endedAt: s.endedAt ?? 9000, summary: s.summary ?? 'PASS' }))
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, stages: [...done, TURN], signals, isIdle: true, now: 60000 }, version: 1 } }))
    on('state.get', { plugin: 'workflow-watch', key: 'usage' }, () => ({ value: { value: USAGE, version: 1 } }))
    const ui = await $.ui.mount(PANE)
    expect(await alts(ui)).toEqual(['NOW | 0:08 · 0 tools · 0 out | ship it | done | ● Build it', 'DECISIONS | ? waiting  Start phase 5?  [Yes / No]'])
    await ui.press({ key: 'size' })
    const a = await alts(ui)
    expect(a).toContain('DECISIONS | ? waiting  Start phase 5?  [Yes / No] | × refused  gh pr merge 22 → Merge Without Review')
    expect(a).toContain('CHANGES | tests  62 pass · 0 fail · was 61 · 1 | files  hooks/a.ts ×3 | 7 commands run')
    expect(a).toContain('QUALITY | review 3 findings · 1 fixed · 1 skipped · 1 open | a.ts:1 x')
    expect(a).toContain('USAGE | ctx 32% · 320k of 1.0M | 5h 18% | $0.11 · 0 out · cache 4m left')
    const usage = (await ui.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('USAGE'))
    expect((String(usage?.props.source).match(/class="on"/g) ?? []).length).toBe(6 + 4)
    await ui.unmount()
  })

  test('a turn entry with more to show unfolds to its full prompt, answer and tool trail, and folds back', async ($, on) => {
    mock.clock(on)
    const prompt = `${'Please look at the tracker pane and tell me why it keeps opening every time I send a message. '.repeat(2)}Then plan.`
    const turn = { ...TURN, prompt, answer: 'Done: it opens only when you say so. Two tests cover it.', summary: 'Done: it opens only when you say so.', tools: ['Edit src/a.ts', 'Bash npm test'], files: ['src/a.ts'], commands: 1 }
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, stages: [turn], isIdle: false }, version: 1 } }))
    const ui = await $.ui.mount(PANE)
    const card = async () => String((await ui.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('1 ✓ done'))?.props.alt)
    expect(await card()).toContain('| Please look at the tracker pane and tell me why it keeps… | › ')
    expect(await card()).toContain(`› ${prompt.slice(0, 99)}…`)
    expect(await card()).toContain('| edited 1 file · 1 command')
    expect(await card()).not.toContain('Bash npm test')
    expect((await ui.find({ key: 'fold:turn:1' }))?.props.label).toBe('+ more')
    await ui.press({ key: 'fold:turn:1' })
    expect((await ui.find({ key: 'fold:turn:1' }))?.props.label).toBe('− less')
    expect((await card()).replace(/ \| /g, ' ')).toContain(prompt)
    expect((await card()).replace(/ \| /g, ' ')).toContain('Done: it opens only when you say so. Two tests cover it.')
    expect(await card()).toContain('| Bash npm test')
    await ui.press({ key: 'fold:turn:1' })
    expect(await card()).not.toContain('Bash npm test')
    await ui.unmount()
  })

  test('Copy prompt puts the turn prompt on the pressing surface and reads Copied; Compact needs two presses and only while idle', async ($, on) => {
    mock.clock(on)
    const full = { context: { tokens: 840_000, window: 1_000_000, percent: 84 }, rateLimits: [], cost: { usd: 1 } }
    on('state.get', { plugin: 'workflow-watch', key: 'usage' }, () => ({ value: { value: full, version: 1 } }))
    const copies: Array<[string, string]> = []
    on('ui.copy', (_$: any, e: any) => {
      copies.push([e.text, e.surface])
      return { value: { isCopied: true } }
    })
    let compactions = 0
    on('session.compact', () => {
      compactions += 1
      return { skip: 'test' }
    })
    let watchNow: typeof WATCH = { ...WATCH, stages: [{ ...TURN, endedAt: null }], isIdle: false }
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: watchNow, version: 1 } }))
    let ui = await $.ui.mount(PANE)
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    await ui.unmount()
    watchNow = { ...WATCH, stages: [TURN], isIdle: true }
    ui = await $.ui.mount(PANE)
    expect((await ui.find({ key: 'compact' }))?.props.label).toBe('Compact now · ctx 84%')
    await ui.press({ key: 'compact' })
    expect(compactions).toBe(0)
    expect((await ui.find({ key: 'compact' }))?.props.label).toBe('Press again to compact')
    await ui.press({ key: 'compact' })
    expect(compactions).toBe(1)
    expect((await ui.find({ key: 'compact' }))?.props.label).toBe('Compact now · ctx 84%')
    await ui.press({ key: 'size' })
    expect((await ui.find({ key: 'copy:turn:1' }))?.props.label).toBe('Copy prompt')
    await ui.press({ key: 'copy:turn:1' })
    expect(copies).toEqual([['ship it', 'desktop']])
    expect((await ui.find({ key: 'copy:turn:1' }))?.props.label).toBe('Copied')
    await ui.unmount()
  })

  for (const [autoOpen, label, flipped] of [
    [true, 'Auto-open: on', false],
    [false, 'Auto-open: off', true],
  ] as const) {
    test(`the Auto-open button reads "${label}" and flips the setting through /config`, { options: { autoOpen } }, async ($, on) => {
      mock.clock(on)
      on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
      const sets: Array<[string, unknown]> = []
      on('config.set', (_$: any, e: any) => {
        sets.push([e.key, e.value])
        return { value: e.value }
      })
      const ui = await $.ui.mount(PANE)
      expect((await ui.find({ key: 'auto' }))?.props.label).toBe(label)
      await ui.press({ key: 'auto' })
      expect(sets).toEqual([['workflow-watch.autoOpen', flipped]])
      await ui.unmount()
    })
  }
})
