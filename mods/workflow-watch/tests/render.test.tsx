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
  test('the pane draws one block per stage in run order on the terminal and the desktop', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'workflow-watch',
        surface,
        component: 'Pane',
        requestId: 'workflow-watch',
        props: { title: 'Workflow', isFocused: false, bodyColumns: 120, placement: 'dock', ...SITE },
      })
      expect(await ui.find({ type: 'Text', text: 'wf_1 · 1 done · 1 failed · 1 running · 0.0k output tokens' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^── Refute · round 1$/ })).toBeDefined()
      const heads = await ui.findAll({ type: 'Text', text: /^(▶ running|✓ done|! failed) {2}\S+ {2}/ })
      expect(heads.map(h => h.text.split('  ')[1])).toEqual(['build:1.2', 'refute:invariants:1.2:r1', 'refute:correctness:1.2:r1'])
      expect(await ui.find({ type: 'Text', text: /^! failed {2}refute:invariants:1\.2:r1 {2}haiku→claude-haiku-5-5 low$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '    FAIL blocking=1 advisory=0 testsRan=false | src/a.js: off by one' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^ {4}Running for 0:12 · 0 calls · starting…$/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('the band draws each running stage as its head and its live details', async ($, on) => {
    mock.clock(on)
    on('state.get', { plugin: 'workflow-watch', key: 'watch' }, () => ({ value: { value: WATCH, version: 1 } }))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'workflow-watch',
        surface,
        component: 'AbovePrompt',
        props: { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns: 100, ...SITE },
      })
      expect(await ui.find({ type: 'Text', text: /^wf_1: 1 done · 1 failed · 1 running$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^▶ running {2}refute:correctness:1\.2:r1 {2}haiku→claude-haiku-5-5 low$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^! failed/ })).toBe(undefined)
      await ui.unmount()
    }
  })
})
