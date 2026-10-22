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
      expect(alts[1]).toMatch(/^Timeline, 0:12 elapsed: build:1\.2, /)
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
