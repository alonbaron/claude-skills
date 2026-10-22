import { describe, expect, mock, test } from 'claude-code/testing'

const HOME = '/home/u'
const SID = 'sid12345-abcd'
const SESSION = `${HOME}/.claude/projects/p1/${SID}.jsonl`
const USER = '{"type":"user","timestamp":"2026-10-22T08:00:00.000Z","message":{"content":"hello there"}}'
const REPLY = '{"type":"assistant","timestamp":"2026-10-22T08:00:05.000Z","message":{"model":"claude-opus-5-5","stop_reason":"end_turn","content":[{"type":"text","text":"hi back"}]}}'
const BIG = 5 * 1024 * 1024
const norm = (p: string): string => p.split(String.fromCharCode(92)).join('/').replace(/^[A-Za-z]:/, '')
const ran = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: exitCode ? 'failed' : '', isStdoutTruncated: false, isStderrTruncated: false })

type World = { size: number; isReadBroken: boolean; result: ReturnType<typeof ran>; runs: Array<{ argv: string[]; env: Record<string, string> }>; saved: Map<string, unknown>; sets: Array<[string, unknown]> }

/** A home with one session log, the engine's file, process and store ops answered from `w`. */
function world(on: any, env: Record<string, string> = {}): { w: World; clock: ReturnType<typeof mock.clock> } {
  const w: World = { size: 1000, isReadBroken: false, result: ran(`${USER}\n${REPLY}`), runs: [], saved: new Map(), sets: [] }
  const clock = mock.clock(on)
  mock.env(on, { HOME, ...env })
  on('session.id', () => ({ value: SID }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('command.register', () => ({ value: { isNew: true } }))
  on('fs.list', (_$: any, e: any) => ({ value: norm(e.path) === `${HOME}/.claude/projects` ? [{ name: 'p1', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] : [] }))
  on('fs.exists', (_$: any, e: any) => ({ value: norm(e.path) === SESSION }))
  on('fs.stat', () => ({ value: { kind: 'file', size: w.size, mtimeMs: 1, isLink: false } }))
  on('fs.read', () => {
    if (w.isReadBroken) throw new Error('unreadable')
    return { value: `${USER}\n${REPLY}` }
  })
  on('process.run', (_$: any, e: any) => {
    w.runs.push({ argv: [...e.argv], env: { ...(e.init?.env ?? {}) } })
    return { value: w.result }
  })
  on('store.get', (_$: any, e: any) => ({ value: w.saved.get(e.key) }))
  on('store.set', (_$: any, e: any) => {
    w.sets.push([e.key, e.value])
    return { value: undefined }
  })
  return { w, clock }
}

const START = { cwd: '/x', surface: 'terminal', isInteractive: true } as const

describe('tick', () => {
  test('a log that stops being readable keeps the last items and says so', async ($, on) => {
    const { w, clock } = world(on)
    await $.session.start(START)
    await clock.settle()
    expect((await $.command.run({ command: 'tracker' })).text).toContain('hi back')
    w.isReadBroken = true
    await clock.advance(2000)
    expect((await $.command.run({ command: 'tracker' })).text).toContain('hi back')
    const ui = await $.ui.mount({ plugin: 'workflow-watch', surface: 'terminal', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Tracker', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
    expect(await ui.find({ type: 'Text', text: 'Could not read the session log; showing what was last read.' })).toBeDefined()
    await ui.unmount()
  })

  test('a log past the read limit goes through Windows PowerShell by full path, the path in the environment, not the script', async ($, on) => {
    const { w, clock } = world(on, { SystemRoot: 'C:\\Windows' })
    w.size = BIG
    await $.session.start(START)
    await clock.settle()
    expect((await $.command.run({ command: 'tracker' })).text).toContain('hi back')
    const [run] = w.runs
    expect(run?.argv[0]).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
    expect(run?.argv.join(' ')).not.toContain(SID)
    expect(norm(run?.env.WW_LOG ?? '')).toBe(SESSION)
  })

  test('elsewhere perl reads it, the path as its own argument', async ($, on) => {
    const { w, clock } = world(on)
    w.size = BIG
    await $.session.start(START)
    await clock.settle()
    expect(w.runs[0]?.argv[0]).toBe('perl')
    expect(norm(w.runs[0]?.argv.at(-1) ?? '')).toBe(SESSION)
  })

  test('a failed slimmed read is not run again until the log grows, and an empty result counts as failed', async ($, on) => {
    const { w, clock } = world(on, { SystemRoot: 'C:\\Windows' })
    w.size = BIG
    w.result = ran('')
    await $.session.start(START)
    await clock.settle()
    await clock.advance(2000)
    await clock.advance(2000)
    expect(w.runs.length).toBe(1)
    w.size = BIG + 10
    await clock.advance(2000)
    expect(w.runs.length).toBe(2)
  })

  test('the saved theme and fold come back in a new session, and a press saves the new value', async ($, on) => {
    const { w, clock } = world(on)
    w.saved.set('theme', 'light')
    w.saved.set('isTimelineOpen', false)
    await $.session.start(START)
    await clock.settle()
    const ui = await $.ui.mount({ plugin: 'workflow-watch', surface: 'vscode', component: 'Pane', requestId: 'workflow-watch', props: { title: 'Tracker', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
    expect((await ui.find({ key: 'theme' }))?.props.label).toBe('☾ Dark mode')
    await ui.press({ key: 'theme' })
    await clock.settle()
    expect(w.sets).toContainEqual(['theme', 'dark'])
    await ui.unmount()
  })
})
