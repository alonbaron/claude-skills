import { describe, expect, mock, test } from 'claude-code/testing'

import { EMPTY, applyEntries, parseLines } from '../hooks/journal'

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

describe('render', () => {
  test('the terminal draws one block per stage, newest first', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    for (const surface of ['terminal'] as const) {
      const ui = await $.ui.mount({
        plugin: 'workflow-watch',
        surface,
        component: 'Pane',
        requestId: 'workflow-watch',
        props: { title: 'Workflow', isFocused: false, bodyColumns: 120, placement: 'dock', ...SITE },
      })
      expect(await ui.find({ type: 'Text', text: 'wf_1' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' 1 done   1 failed   1 running   0.0k output tokens' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Timeline · 0:12 elapsed$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' Refute · round 1 ' })).toBeDefined()
      const heads = await ui.findAll({ type: 'Text', text: /^ (▶ running|✓ done|! failed) {3}\S+ {2}/ })
      expect(heads.map(h => h.text.trim().split(/ {2,}/)[1])).toEqual(['refute:correctness:1.2:r1', 'refute:invariants:1.2:r1', 'build:1.2'])
      expect(await ui.find({ type: 'Text', text: /^ ! failed {3}refute:invariants:1\.2:r1 {2}haiku→claude-haiku-5-5 low$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'FAIL blocking=1 advisory=0 testsRan=false | src/a.js: off by one' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Running for 0:12 · 0 calls · starting…$/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('a narrow column count does not cut pane text; the surface truncates at its real width', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    const ui = await $.ui.mount({
      plugin: 'workflow-watch',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'workflow-watch',
      props: { title: 'Workflow', isFocused: false, bodyColumns: 40, placement: 'dock', ...SITE },
    })
    expect(await ui.find({ type: 'Text', text: ' 1 done   1 failed   1 running   0.0k output tokens' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'FAIL blocking=1 advisory=0 testsRan=false | src/a.js: off by one' })).toBeDefined()
    await ui.unmount()
  })

  test('the desktop and the editor draw rounded vector cards: header, timeline, a phase chip per run, one card per stage, newest first', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    for (const surface of ['desktop', 'vscode'] as const) {
      const ui = await $.ui.mount({
        plugin: 'workflow-watch',
        surface,
        component: 'Pane',
        requestId: 'workflow-watch',
        props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
      })
      const alts = (await ui.findAll({ type: 'Svg' })).map(n => String(n.props.alt))
      expect(alts[0]).toBe('wf_1: 1 done · 1 failed · 1 running · 0.0k output tokens')
      expect(alts[1]).toBe('ctx unknown | limits unknown | 0 out · cache warm')
      expect(alts[2]).toMatch(/^Timeline, 0:12 elapsed: build:1\.2, /)
      expect(alts.filter(a => /^(▶ running|✓ done|! failed) /.test(a)).map(a => a.split(' ')[2])).toEqual(['refute:correctness:1.2:r1', 'refute:invariants:1.2:r1', 'build:1.2'])
      expect(alts).toContain('Refute · round 1')
      const card = (await ui.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('! failed'))
      expect(String(card?.props.source)).toContain('rx="16"')
      expect(String(card?.props.source)).toContain('FAIL blocking=1')
      await ui.unmount()
    }
  })

  test('the theme button flips the cards between dark and light, whatever the system theme', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    const ui = await $.ui.mount({
      plugin: 'workflow-watch',
      surface: 'vscode',
      component: 'Pane',
      requestId: 'workflow-watch',
      props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
    })
    expect((await ui.find({ key: 'theme' }))?.props.label).toBe('☀ Light mode')
    expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('fill:#202124')
    await ui.press({ key: 'theme' })
    expect((await ui.find({ key: 'theme' }))?.props.label).toBe('☾ Dark mode')
    expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('.card{fill:#fff')
    await ui.unmount()
  })

  test('an idle session folds the pane to one strip; Expand and Minimize flip it, and Hide closes the pane', async ($, on) => {
    mock.clock(on)
    const done = WATCH.stages.map(s => ({ ...s, endedAt: s.endedAt ?? 9000, summary: s.summary ?? 'PASS blocking=0 advisory=0 testsRan=true' }))
    const IDLE = { ...WATCH, stages: done, now: 60000, isIdle: true }
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: IDLE, version: 1 } }))
    const closed: string[] = []
    on('ui.close', (_$: any, e: any) => {
      closed.push(e.id)
      return { value: undefined }
    })
    const ui = await $.ui.mount({
      plugin: 'workflow-watch',
      surface: 'vscode',
      component: 'Pane',
      requestId: 'workflow-watch',
      props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
    })
    const alts = async () => (await ui.findAll({ type: 'Svg' })).map(n => String(n.props.alt))
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('+ Expand')
    expect(await alts()).toEqual(['wf_1: 2 done · 1 failed · 0 running | ✓ done refute:correctness:1.2:r1 0:08'])
    await ui.press({ key: 'size' })
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('− Minimize')
    expect((await alts())[0]).toBe('wf_1: 2 done · 1 failed · 0 running · 0.0k output tokens')
    await ui.press({ key: 'size' })
    expect((await alts()).length).toBe(1)
    await ui.press({ key: 'hide' })
    expect(closed).toEqual(['workflow-watch'])
    await ui.unmount()
  })

  test('the usage card sits under the header, drawn from the engine figures, and the minimized strip carries the context fill', async ($, on) => {
    mock.clock(on)
    const done = WATCH.stages.map(s => ({ ...s, endedAt: s.endedAt ?? 9000, summary: s.summary ?? 'PASS' }))
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, stages: done, now: 60000, isIdle: true }, version: 1 } }))
    on('state.get', { plugin: 'workflow-watch', key: 'usage' }, () => ({ value: { value: { context: { tokens: 320_000, window: 1_000_000, percent: 32 }, rateLimits: [{ kind: 'five_hour', percentUsed: 18 }], cost: { usd: 0.11 } }, version: 1 } }))
    const ui = await $.ui.mount({ plugin: 'workflow-watch', surface: 'desktop', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE } })
    const alts = async () => (await ui.findAll({ type: 'Svg' })).map(n => String(n.props.alt))
    expect((await alts())[0]).toContain('· ctx 32% |')
    await ui.press({ key: 'size' })
    expect((await alts())[1]).toBe('ctx 32% · 320k of 1.0M | 5h 18% | $0.11 · 0 out · cache 4m left')
    await ui.unmount()
  })

  test('a turn card with more to show unfolds to its full prompt, answer and tool trail, and folds back', async ($, on) => {
    mock.clock(on)
    const prompt = `${'Please look at the tracker pane and tell me why it keeps opening every time I send a message. '.repeat(2)}Then plan.`
    const turn = { ...stages[0]!, kind: 'turn' as const, key: 'turn:1', label: 'turn:1', phase: 'Turn 1', endedAt: 9000, prompt, answer: 'Done: it opens only when you say so. Two tests cover it.', summary: 'Done: it opens only when you say so.', tools: ['Edit src/a.ts', 'Bash npm test'], files: ['src/a.ts'], commands: 1 }
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, stages: [turn], isIdle: false }, version: 1 } }))
    const ui = await $.ui.mount({ plugin: 'workflow-watch', surface: 'desktop', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE } })
    const card = async () => String((await ui.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('✓ done turn:1'))?.props.alt)
    expect(await card()).toContain('turn:1 · Please look at the tracker pane and tell me why it keeps…')
    expect(await card()).toContain(`› ${prompt.slice(0, 99)}…`)
    expect(await card()).toContain('| edited 1 file · 1 command')
    expect(await card()).not.toContain('Bash npm test')
    expect((await ui.find({ key: 'fold:turn:1' }))?.props.label).toBe('+ more')
    await ui.press({ key: 'fold:turn:1' })
    expect((await ui.find({ key: 'fold:turn:1' }))?.props.label).toBe('− less')
    expect((await card()).replace(/ \| /g, ' ')).toContain(prompt)
    expect((await card()).replace(/ \| /g, ' ')).toContain('Done: it opens only when you say so. Two tests cover it.')
    expect(await card()).toContain('| · Bash npm test')
    await ui.press({ key: 'fold:turn:1' })
    expect(await card()).not.toContain('Bash npm test')
    await ui.unmount()
  })

  test('Copy prompt puts the turn prompt on the pressing surface and reads Copied; Compact needs two presses and only while idle', async ($, on) => {
    mock.clock(on)
    const turn = { ...stages[0]!, kind: 'turn' as const, key: 'turn:1', label: 'turn:1', phase: 'Turn 1', endedAt: 9000, prompt: 'ship it', summary: 'done' }
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
    // Busy first: a turn still running, no offer to compact. Then idle at 84%: the offer, armed by one press, carried out by the second.
    let watchNow: typeof WATCH = { ...WATCH, stages: [{ ...turn, endedAt: null }], isIdle: false }
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: watchNow, version: 1 } }))
    const site = { plugin: 'workflow-watch', surface: 'desktop', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE } } as const
    let ui = await $.ui.mount(site)
    expect(await ui.find({ key: 'compact' })).toBeUndefined()
    await ui.unmount()
    watchNow = { ...WATCH, stages: [turn], isIdle: true }
    ui = await $.ui.mount(site)
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
      const ui = await $.ui.mount({
        plugin: 'workflow-watch',
        surface: 'desktop',
        component: 'Pane',
        requestId: 'workflow-watch',
        props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
      })
      expect((await ui.find({ key: 'auto' }))?.props.label).toBe(label)
      await ui.press({ key: 'auto' })
      expect(sets).toEqual([['workflow-watch.autoOpen', flipped]])
      await ui.unmount()
    })
  }

  test('a busy session draws every card, the live item first, with Minimize on offer', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: { ...WATCH, isIdle: false }, version: 1 } }))
    const ui = await $.ui.mount({
      plugin: 'workflow-watch',
      surface: 'vscode',
      component: 'Pane',
      requestId: 'workflow-watch',
      props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
    })
    expect((await ui.find({ key: 'size' }))?.props.label).toBe('− Minimize')
    expect((await ui.findAll({ type: 'Svg' })).length).toBeGreaterThan(3)
    await ui.unmount()
  })

  test('the timeline folds to its +/- button and opens again', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    const ui = await $.ui.mount({
      plugin: 'workflow-watch',
      surface: 'vscode',
      component: 'Pane',
      requestId: 'workflow-watch',
      props: { title: 'Workflow', isFocused: false, bodyColumns: 60, placement: 'dock', ...SITE },
    })
    const timeline = async () => (await ui.findAll({ type: 'Svg' })).some(n => String(n.props.alt).startsWith('Timeline'))
    expect((await ui.find({ key: 'timeline' }))?.props.label).toBe('− Timeline')
    expect(await timeline()).toBe(true)
    await ui.press({ key: 'timeline' })
    expect((await ui.find({ key: 'timeline' }))?.props.label).toBe('+ Timeline · 0:12 elapsed')
    expect(await timeline()).toBe(false)
    await ui.press({ key: 'timeline' })
    expect(await timeline()).toBe(true)
    await ui.unmount()
  })
})
