import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, applyEntries, mergeStages, parseLines, parseSession, phaseRuns, readMeta, readMetaInfo, readTranscript, report, stageDetail, stageLines, state, summarize, tally, timelineBar, tone, who, withFacts } from '../hooks/journal'

const STARTED = '{"type":"started","key":"k1","agentId":"a1","label":"build:1.2","phase":"Build"}'
const RESULT = '{"type":"result","key":"k1","agentId":"a1","result":{"ok":true,"commits":["c1","c2"],"testsPassed":true,"lintPassed":false,"deviations":[]}}'
const REFUTE_STARTED = '{"type":"started","key":"k2","agentId":"a2","label":"refute:invariants:1.2:r1","phase":"Refute"}'
const REFUTE_FAILED = '{"type":"result","key":"k2","agentId":"a2","result":{"verdict":"fail","testsRan":false,"blocking":[{"file":"src/a.js","issue":"off by one"}],"advisory":[]}}'
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

  test('a failing result is marked failed, shown as a glyph and a word, and counted in the tally', async () => {
    const lines = parseLines(STARTED + '\n' + REFUTE_STARTED + '\n' + RESULT + '\n' + REFUTE_FAILED)
    const stages = applyEntries([], lines, 4000)
    const lens = stages[1] as NonNullable<(typeof stages)[1]>
    expect(lens.isFailed).toBe(true)
    expect(state(lens)).toBe('! failed')
    expect(tone(lens)).toBe('error')
    expect(state(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('✓ done')
    expect(tone(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('success')
    expect(tally({ ...EMPTY, run: 'wf_1', stages, now: 4000 })).toBe('1 done · 1 failed · 0 running')
  })

  test('ok:false fails, a dispute is its own state, and a null result or a failed entry has no result; the tally adds up', async () => {
    const at = (n: number, label: string) => `{"type":"started","key":"k${n}","agentId":"a${n}","label":"${label}","phase":"P"}`
    const lines = parseLines(
      [
        at(1, 'build:1.2'),
        '{"type":"result","key":"k1","result":{"ok":false,"commits":[],"testsPassed":false,"lintPassed":true,"deviations":[]}}',
        at(2, 'fix:1.2:r1'),
        '{"type":"result","key":"k2","result":{"fixed":["a"],"notFixed":[{"key":"b","reason":"not a bug"}],"commits":["c1"]}}',
        at(3, 'close:1.2'),
        '{"type":"result","key":"k3","result":null}',
        at(4, 'scout:1.2'),
        '{"type":"failed","key":"k4","agentId":"a4"}',
        at(5, 'plan'),
        '{"type":"result","key":"k5","result":{"taskId":"1.2","branch":"feature/x"}}',
        at(6, 'measure:1.2'),
      ].join('\n'),
    )
    const [build, fix, close, scout, plan, measure] = applyEntries([], lines, 10) as NonNullable<ReturnType<typeof applyEntries>[0]>[]
    expect([build, fix, close, scout, plan, measure].map(s => state(s as NonNullable<typeof s>))).toEqual(['! failed', '! disputed', '✗ no result', '✗ no result', '✓ done', '▶ running'])
    expect([build, fix, close, scout, plan, measure].map(s => tone(s as NonNullable<typeof s>))).toEqual(['error', 'warning', 'error', 'error', 'success', 'warning'])
    expect(fix?.summary).toBe('fixed=1 disputed=1 commits=1 | disputed b: not a bug')
    expect(close?.summary).toBe('(no result)')
    expect(scout?.summary).toBe('(stopped without a result)')
    const stages = applyEntries([], lines, 10)
    expect(tally({ ...EMPTY, run: 'wf_1', stages, now: 10 })).toBe('1 done · 1 disputed · 3 failed · 1 running')
    const ended = applyEntries(stages, parseLines('{"type":"result","key":"k6","result":{"filesChanged":1,"linesChanged":2}}'), 20)
    expect(tally({ ...EMPTY, run: 'wf_1', stages: ended, now: 20 })).toBe('2 done · 1 disputed · 3 failed · 0 running')
  })

  test('a failed entry for an unknown stage, or after its result, changes nothing', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n' + RESULT + '\n{"type":"failed","key":"k1"}\n{"type":"failed","key":"nope"}'), 5)
    expect(stages.length).toBe(1)
    expect(state(stages[0] as NonNullable<(typeof stages)[0]>)).toBe('✓ done')
  })

  test('a cut line ends in an ellipsis, and control characters never reach the screen', async () => {
    const long = summarize('probe', 'x'.repeat(150))
    expect(long.length).toBe(100)
    expect(long.endsWith('x…')).toBe(true)
    expect(summarize('probe', 'a\u001b[31mb\u0007c')).toBe('a [31mb c')
    const [s] = applyEntries([], parseLines('{"type":"started","key":"k1","label":"build:\\u001b[2J1.2","phase":"Bu\\u009bild"}\n{"type":"result","key":"k1","result":{"ok":true,"commits":[],"testsPassed":true,"lintPassed":true,"deviations":[],"blockedReason":"x\\u0000y"}}'), 1)
    expect(s?.label).toBe('build: [2J1.2')
    expect(s?.phase).toBe('Bu ild')
    expect(s?.summary).toBe('ok=true commits=0 tests=pass lint=pass deviations=0 BLOCKED: x y')
  })

  test('phase dividers follow run order and name the round, so a second refute round gets its own', async () => {
    const at = (phase: string, n: number) => `{"type":"started","key":"k${n}","agentId":"a${n}","label":"${phase.toLowerCase()}:1.2:r${n}","phase":"${phase}"}`
    const stages = applyEntries([], parseLines([at('Refute', 1), at('Fix', 2), at('Refute', 3), '{"type":"started","key":"k4","label":"arbiter:1.2","phase":"Arbiter"}'].join('\n')), 1)
    expect(phaseRuns(stages).map(g => g.phase)).toEqual(['Refute', 'Fix', 'Refute', 'Arbiter'])
    expect(report({ ...EMPTY, run: 'wf_1', stages, now: 1 }).split('\n').filter(l => l.startsWith('── '))).toEqual(['── Refute · round 1', '── Fix · round 2', '── Refute · round 3', '── Arbiter'])
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

  test('the client message a failed call leaves (<synthetic>) is not taken for the model', async () => {
    const died = TRANSCRIPT + '\n{"type":"assistant","message":{"model":"<synthetic>","usage":{"output_tokens":0},"content":[{"type":"text","text":"session limit"}]}}'
    expect(readTranscript(died).model).toBe('claude-sonnet-5-5')
  })

  test('a stage first seen after it finished takes its times from the transcript, not from when the mod looked', async () => {
    const stamped = [
      '{"type":"user","timestamp":"2026-10-12T14:00:00.000Z","message":{"content":"go"}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:02:40.900Z","effort":"low","message":{"model":"claude-haiku-5-5","usage":{"output_tokens":100},"content":[]}}',
    ].join('\n')
    const t0 = Date.parse('2026-10-12T14:00:00.000Z')
    const [seenLate] = applyEntries([], parseLines(STARTED + '\n' + RESULT), t0 + 3_600_000)
    const s = withFacts(seenLate as NonNullable<typeof seenLate>, readTranscript(stamped))
    expect(s.startedAt).toBe(t0)
    expect(s.endedAt).toBe(t0 + 160_900)
    expect(s.isSettled).toBe(true)
    expect(stageDetail(s, t0 + 3_600_000)).toBe('Ran for 2:40 · 0 tools · 0.1k tokens')
    const [live] = applyEntries([], parseLines(STARTED), t0 + 5_000)
    const l = withFacts(live as NonNullable<typeof live>, readTranscript(stamped))
    expect(l.endedAt).toBe(null)
    expect(l.isSettled).toBe(false)
    expect(stageDetail(l, t0 + 200_000)).toBe('Running for 3:20 · 0 calls · starting…')
  })

  test('readMeta and readMetaInfo take the alias and toolUseId and tolerate garbage', async () => {
    expect(readMeta('{"model":"sonnet","agentType":"workflow-subagent"}')).toBe('sonnet')
    expect(readMeta('not json')).toBe(null)
    expect(readMetaInfo('{"model":"opus","description":"Verify findings","toolUseId":"toolu_1"}')).toEqual({
      model: 'opus',
      description: 'Verify findings',
      toolUseId: 'toolu_1',
    })
  })

  test('who shows alias, resolved model and effort, and n/a for a model with no effort', async () => {
    const [s] = applyEntries([], parseLines(STARTED), 1)
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'sonnet', model: 'claude-sonnet-5-5', effort: 'high', outputTokens: 750 })).toBe('sonnet→claude-sonnet-5-5 high')
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-4-5-20251001', effort: null, outputTokens: 1300 })).toBe('haiku→claude-haiku-4-5-20251001 n/a')
    expect(who({ ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-5-5', effort: 'low', outputTokens: 400 })).toBe('haiku→claude-haiku-5-5 low')
  })

  test('the details are one compact line: time, tools and tokens once done; calls and the last tool while running', async () => {
    const [live] = applyEntries([], parseLines(STARTED), 1000)
    const s = { ...(live as NonNullable<typeof live>), ...readTranscript(TRANSCRIPT) }
    expect(stageDetail(s, 13000)).toBe('Running for 0:12 · 1 call · Bash npm test')
    expect(stageDetail({ ...s, endedAt: 47000 }, 99000)).toBe('Ran for 0:46 · 1 tool · 0.8k tokens')
  })
})

describe('session & timeline', () => {
  test('parseSession extracts turns, skills, background subagents, and git commits while filtering meta noise', async () => {
    const sessionLines = [
      '{"type":"user","timestamp":"2026-10-12T14:00:00.000Z","message":{"content":[{"type":"text","text":"<browser_instruction>ignore</browser_instruction>"},{"type":"text","text":"Review the PR and commit fix"}]}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:00:05.000Z","effort":"high","message":{"model":"claude-fable-5-1","stop_reason":"tool_use","usage":{"output_tokens":200},"content":[{"type":"tool_use","id":"tu_skill","name":"Skill","input":{"skill":"alon-skills:review-swarm","args":"PR #12"}}]}}',
      '{"type":"user","isMeta":true,"timestamp":"2026-10-12T14:00:05.100Z","message":{"content":[{"type":"text","text":"skill body injected"}]}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:00:10.000Z","effort":"high","message":{"model":"claude-fable-5-1","stop_reason":"tool_use","usage":{"output_tokens":300},"content":[{"type":"tool_use","id":"tu_agent","name":"Agent","input":{"description":"Review lens: security","model":"sonnet"}}]}}',
      '{"type":"user","timestamp":"2026-10-12T14:00:11.000Z","toolUseResult":{"isAsync":true,"status":"async_launched","agentId":"ag_sec","resolvedModel":"claude-sonnet-5-5"},"message":{"content":[{"type":"tool_result","tool_use_id":"tu_agent","content":"launched"}]}}',
      '{"type":"user","timestamp":"2026-10-12T14:01:00.000Z","message":{"content":"<task-notification><task-id>ag_sec</task-id><tool-use-id>tu_agent</tool-use-id></task-notification>"}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:01:10.000Z","effort":"high","message":{"model":"claude-fable-5-1","stop_reason":"tool_use","usage":{"output_tokens":150},"content":[{"type":"tool_use","id":"tu_commit","name":"Bash","input":{"command":"git commit -m \\"fix: tighten auth check\\""}}]}}',
      '{"type":"user","timestamp":"2026-10-12T14:01:12.000Z","toolUseResult":{"stdout":"[main 40bb8bd] fix: tighten auth check\\n 1 file changed"},"message":{"content":[{"type":"tool_result","tool_use_id":"tu_commit","content":"[main 40bb8bd] fix: tighten auth check"}]}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:01:20.000Z","effort":"high","message":{"model":"claude-fable-5-1","stop_reason":"end_turn","usage":{"output_tokens":100},"content":[{"type":"text","text":"All review findings fixed and committed."}]}}',
    ].join('\n')

    const items = parseSession(sessionLines, Date.parse('2026-10-12T14:02:00.000Z'))
    expect(items.map(s => `${s.kind}:${s.label}`)).toEqual([
      'turn:turn:1',
      'skill:skill:review-swarm',
      'agent:agent:Review lens: security',
      'commit:commit:40bb8bd',
    ])
    const [turn, skill, agent, commit] = items
    expect(turn?.alias).toBe('fable')
    expect(turn?.model).toBe('claude-fable-5-1')
    expect(turn?.outputTokens).toBe(750)
    expect(turn?.summary).toBe('All review findings fixed and committed.')
    expect(turn?.endedAt).toBe(Date.parse('2026-10-12T14:01:20.000Z'))
    expect(skill?.phase).toBe('Skill · review-swarm')
    expect(skill?.summary).toBe('PR #12')
    expect(agent?.agentId).toBe('ag_sec')
    expect(agent?.phase).toBe('Skill · review-swarm')
    expect(commit?.summary).toBe('fix: tighten auth check')

    // Enriching the background agent from its subagent transcript takes SubagentHandback as the summary without counting it as a tool call
    const subLines = [
      '{"type":"user","timestamp":"2026-10-12T14:00:11.000Z","message":{"content":"audit security"}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:00:30.000Z","effort":"medium","message":{"model":"claude-sonnet-5-5","usage":{"output_tokens":400},"content":[{"type":"tool_use","name":"Grep","input":{"pattern":"auth"}}]}}',
      '{"type":"assistant","timestamp":"2026-10-12T14:00:59.000Z","effort":"medium","message":{"model":"claude-sonnet-5-5","usage":{"output_tokens":200},"content":[{"type":"tool_use","name":"SubagentHandback","input":{"message":"No blocking vulnerabilities found."}}]}}',
    ].join('\n')
    const enriched = withFacts(agent as NonNullable<typeof agent>, readTranscript(subLines))
    expect(enriched.calls).toBe(1)
    expect(enriched.lastTool).toBe('Grep auth')
    expect(enriched.summary).toBe('No blocking vulnerabilities found.')
  })

  test('mergeStages orders session items and workflow stages chronologically, and timelineBar renders spans', async () => {
    const [wf] = applyEntries([], parseLines(STARTED + '\n' + RESULT), 2000)
    const turn = parseSession('{"type":"user","timestamp":"1970-01-01T00:00:01.000Z","message":{"content":"run workflow"}}', 3000)[0]
    const merged = mergeStages(turn ? [turn] : [], wf ? [wf] : [])
    expect(merged.map(s => s.label)).toEqual(['turn:1', 'build:1.2'])
    expect(timelineBar({ ...(wf as NonNullable<typeof wf>), startedAt: 1000, endedAt: 3000 }, 1000, 4000, 8)).toBe('████░░░░')
    expect(timelineBar({ ...(wf as NonNullable<typeof wf>), startedAt: 3000, endedAt: null }, 1000, 4000, 8)).toBe('░░░░▓▓▓▓')
  })

  test('parseSession and readTranscript parse Antigravity extension transcripts and subagent handbacks', async () => {
    const agyLines = [
      '{"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","created_at":"2026-10-19T10:00:00Z","content":"<USER_REQUEST>\\nReview and commit\\n</USER_REQUEST>\\n<USER_SETTINGS_CHANGE>\\nThe user changed setting `Model Selection` from None to Gemini 4 Argon (High).\\n</USER_SETTINGS_CHANGE>"}',
      '{"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","created_at":"2026-10-19T10:00:05Z","output_tokens":300,"tool_calls":[{"name":"view_file","args":{"AbsolutePath":"\\"c:/repo/skills/review-swarm/SKILL.md\\""}},{"name":"invoke_subagent","args":{"Subagents":"[{\\"Model\\":\\"inherit\\",\\"Role\\":\\"Review Lens: Security\\",\\"TypeName\\":\\"research\\",\\"Prompt\\":\\"Audit auth\\"}]"}},{"name":"run_command","args":{"CommandLine":"\\"git commit -m \'fix: auth\'\\""}}]}',
      '{"step_index":2,"source":"MODEL","type":"GENERIC","created_at":"2026-10-19T10:00:06Z","content":"Created the following subagents:\\n{\\n  \\"conversationId\\": \\"conv_sec_1\\"\\n}"}',
      '{"step_index":3,"source":"MODEL","type":"GENERIC","created_at":"2026-10-19T10:00:08Z","content":"The command exited with code 0.\\nOutput:\\n[main 9a1b2c3] fix: auth"}',
      '{"step_index":4,"source":"SYSTEM","type":"SYSTEM_MESSAGE","created_at":"2026-10-19T10:00:20Z","content":"<SYSTEM_MESSAGE>\\n[Message] timestamp=2026-10-19T10:00:20Z sender=conv_sec_1 priority=MESSAGE_PRIORITY_HIGH content=Clean security pass.\\n</SYSTEM_MESSAGE>"}',
      '{"step_index":5,"source":"MODEL","type":"PLANNER_RESPONSE","created_at":"2026-10-19T10:00:25Z","output_tokens":150,"content":"Review and commit finished."}',
    ].join('\n')
    const items = parseSession(agyLines, Date.parse('2026-10-19T10:01:00Z'))
    expect(items.map(s => `${s.kind}:${s.label}`)).toEqual(['turn:turn:1', 'skill:skill:review-swarm', 'agent:agent:Review Lens: Security', 'commit:commit:9a1b2c3'])
    const [turn, , agent] = items
    expect(turn?.alias).toBe('gemini')
    expect(turn?.model).toBe('Gemini 4 Argon')
    expect(turn?.effort).toBe('high')
    expect(turn?.outputTokens).toBe(450)
    expect(agent?.agentId).toBe('conv_sec_1')

    const subTranscript = [
      '{"step_index":1,"source":"MODEL","type":"PLANNER_RESPONSE","created_at":"2026-10-19T10:00:10Z","output_tokens":220,"tool_calls":[{"name":"view_file","args":{"AbsolutePath":"\\"src/auth.ts\\""}},{"name":"send_message","args":{"Message":"\\"Verified no injection issues.\\""}}]}',
    ].join('\n')
    const enriched = withFacts(agent as NonNullable<typeof agent>, readTranscript(subTranscript))
    expect(enriched.calls).toBe(1)
    expect(enriched.outputTokens).toBe(220)
    expect(enriched.summary).toBe('Verified no injection issues.')
  })

  test('Antigravity: truncated subagent args, quoted spawn output, and commands that only mention git commit', async () => {
    const step = (o: Record<string, unknown>): string => JSON.stringify(o)
    // The compact transcript cuts the Subagents arg mid-way: the first Role survives, the second does not.
    const truncatedSubs = JSON.stringify(JSON.stringify([{ Model: 'inherit', Prompt: 'p1', Role: 'Lens: Correctness' }])).slice(0, -3) + ',{"Model":"inherit","Prompt":"p2 cut'
    const spawn = 'Created the following subagents:\n{\n  "conversationId": "conv_a"\n}\n{\n  "conversationId": "conv_b"\n}'
    const lines = [
      step({ step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', created_at: '2026-10-19T10:00:00Z', content: '<USER_REQUEST>\nreview\n</USER_REQUEST>' }),
      step({ step_index: 1, type: 'PLANNER_RESPONSE', created_at: '2026-10-19T10:00:01Z', tool_calls: [{ name: 'invoke_subagent', args: { Subagents: truncatedSubs } }] }),
      step({ step_index: 2, type: 'GENERIC', created_at: '2026-10-19T10:00:02Z', content: spawn }),
      step({ step_index: 3, type: 'PLANNER_RESPONSE', created_at: '2026-10-19T10:00:03Z', tool_calls: [{ name: 'run_command', args: { CommandLine: JSON.stringify("node -e \"if (l.includes('git commit')) console.log(l)\"") } }] }),
      step({ step_index: 4, type: 'GENERIC', created_at: '2026-10-19T10:00:04Z', content: `The command exited with code 0.\nOutput:\n${spawn.replace('conv_a', 'conv_x')}` }),
    ].join('\n')
    const items = parseSession(lines, Date.parse('2026-10-19T10:01:00Z'))
    expect(items.map(s => `${s.kind}:${s.label}:${s.agentId ?? ''}`)).toEqual(['turn:turn:1:', 'agent:agent:Lens: Correctness:conv_a', 'agent:agent:conv_b:conv_b'])
  })
})

describe('report', () => {
  test('the text report lists every stage under its phase with its state', async () => {
    const stages = applyEntries([], parseLines(STARTED + '\n' + RESULT), 3000)
    const text = report({ ...EMPTY, run: 'wf_1', stages, now: 3000 })
    expect(text.split('\n')[0]).toBe('wf_1: 1 done · 0 failed · 0 running')
    expect(text.split('\n')[1]).toBe('── Build')
    expect(text.split('\n')[2]).toBe('✓ done  build:1.2  ? n/a')
    expect(text.includes('ok=true commits=2')).toBe(true)
  })

  test('a stage block is the head line, then the result and the details indented under it', async () => {
    const [s] = applyEntries([], parseLines(STARTED), 1000)
    const live = { ...(s as NonNullable<typeof s>), alias: 'haiku', model: 'claude-haiku-5-5', effort: 'low' }
    expect(stageLines(live, 3000)).toEqual(['▶ running  build:1.2  haiku→claude-haiku-5-5 low', '    no result yet', '    Running for 0:02 · 0 calls · starting…'])
  })

  test('an interrupt ends the turn without opening one; a message typed mid-turn becomes the turn prompt, not a new turn', async () => {
    const lines = [
      '{"type":"user","timestamp":"2026-10-22T08:00:00.000Z","message":{"content":"make the pane pretty"}}',
      '{"type":"assistant","timestamp":"2026-10-22T08:00:05.000Z","message":{"model":"claude-opus-5-5","stop_reason":"tool_use","content":[{"type":"text","text":"Checking the props"},{"type":"tool_use","id":"tu1","name":"Read","input":{"file_path":"a.ts"}}]}}',
      '{"type":"user","timestamp":"2026-10-22T08:00:06.000Z","message":{"content":[{"type":"text","text":"[Request interrupted by user]"}]}}',
      '{"type":"user","timestamp":"2026-10-22T08:00:10.000Z","message":{"content":"only the side pane"}}',
      '{"type":"assistant","timestamp":"2026-10-22T08:00:12.000Z","message":{"model":"claude-opus-5-5","stop_reason":"tool_use","content":[{"type":"tool_use","id":"tu2","name":"Bash","input":{"command":"ls"}}]}}',
      '{"type":"attachment","timestamp":"2026-10-22T08:00:13.000Z","attachment":{"type":"queued_command","commandMode":"prompt","prompt":[{"type":"text","text":"approve the look first"}]}}',
      '{"type":"assistant","timestamp":"2026-10-22T08:00:20.000Z","message":{"model":"claude-opus-5-5","stop_reason":"end_turn","content":[{"type":"text","text":"Stopped for your approval."}]}}',
    ].join('\n')
    const items = parseSession(lines, Date.parse('2026-10-22T08:01:00.000Z'))
    expect(items.map(s => s.label)).toEqual(['turn:1', 'turn:2'])
    const [first, second] = items
    expect(first?.endedAt).toBe(Date.parse('2026-10-22T08:00:05.000Z'))
    expect(first?.summary).toBe('(interrupted) Checking the props')
    expect(first?.prompt).toBe('make the pane pretty')
    expect(second?.prompt).toBe('(mid-turn) approve the look first')
    expect(second?.summary).toBe('Stopped for your approval.')
  })
})
