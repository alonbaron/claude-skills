import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Stage, Watch } from '../types'
import { EMPTY, applyEntries, clip, elapsed, mergeStages, parseLines, parseSession, phaseRuns, phaseTitle, readMeta, readMetaInfo, readTranscript, report, running, stageDetail, stageResult, stageTitle, state, statusLine, tally, timelineBar, tone, who, withFacts } from './journal'

const PANE = 'workflow-watch'
const TITLE = 'Tracker'
const watch = atom({ plugin: 'workflow-watch', key: 'watch' } as const, EMPTY)

type Engine = Parameters<Parameters<Register>[0]>[2] extends (...a: infer A) => unknown ? A[0] : never
type Listing = Awaited<ReturnType<Engine['fs']['list']>>

const listOr = async ($: Engine, path: string): Promise<Listing> => {
  try {
    return await $.fs.list(path)
  } catch {
    return []
  }
}

type Target = {
  sid: string
  sessionPath: string | null
  subagentsDir: string | null
  wf: { dir: string; path: string; run: string } | null
}

/** Finds this session's main transcript (<sid>.jsonl or Antigravity transcript.jsonl), subagents directory, and newest Workflow journal.jsonl. */
async function findTarget($: Engine): Promise<Target | null> {
  const rawHome = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  if (!rawHome) return null
  const home = rawHome.replace(/\\/g, '/')
  const sid = await $.session.id()
  const projects = `${home}/.claude/projects`
  let sessionPath: string | null = null
  let subagentsDir: string | null = null
  let bestWf: { dir: string; run: string; mtime: number } | null = null

  for (const d of await listOr($, projects)) {
    if (d.kind !== 'dir') continue
    const projDir = `${projects}/${d.name}`
    const candidateSession = `${projDir}/${sid}.jsonl`
    if (!sessionPath && (await $.fs.exists(candidateSession))) {
      sessionPath = candidateSession
      const sub = `${projDir}/${sid}/subagents`
      if (await $.fs.exists(sub)) subagentsDir = sub
    }
    const wf = `${projDir}/${sid}/subagents/workflows`
    if (await $.fs.exists(wf)) {
      if (!subagentsDir) subagentsDir = `${projDir}/${sid}/subagents`
      for (const r of await listOr($, wf)) {
        if (r.kind !== 'dir') continue
        const j = (await listOr($, `${wf}/${r.name}`)).find(f => f.name === 'journal.jsonl')
        if (j && (!bestWf || j.mtimeMs > bestWf.mtime)) bestWf = { dir: `${wf}/${r.name}`, run: r.name, mtime: j.mtimeMs }
      }
    }
    if (sessionPath || bestWf) break
  }

  if (!sessionPath && !bestWf) {
    const agyBrain = `${home}/.gemini/antigravity/brain`
    const agyTranscript = `${agyBrain}/${sid}/.system_generated/logs/transcript.jsonl`
    if (await $.fs.exists(agyTranscript)) {
      sessionPath = agyTranscript
      subagentsDir = agyBrain
    }
  }

  const wf = bestWf ? { dir: bestWf.dir, path: `${bestWf.dir}/journal.jsonl`, run: bestWf.run } : null
  if (!sessionPath && !wf) return null
  return { sid, sessionPath, subagentsDir, wf }
}

const VALID_ID = /^[a-zA-Z0-9_-]+$/

/** The theme color for each tally word; a zero count is drawn subtle whatever its word. */
const TALLY_TONE: Record<string, string> = { done: 'success', disputed: 'warning', failed: 'error', running: 'warning' }

/** A timeline bar as its track and span pieces, so the track can be drawn quieter than the span. */
const barParts = (bar: string): Array<[string, boolean]> =>
  (bar.match(/░+|[█▓]+/g) ?? []).map(part => [part, part[0] !== '░'])

/**
 * Antigravity writes a compact transcript.jsonl (long tool args truncated) and an untruncated
 * transcript_full.jsonl beside it: read the full one when it exists and fits, else the compact one.
 */
async function readTranscriptText($: Engine, path: string): Promise<string> {
  if (path.endsWith('/transcript.jsonl')) {
    const full = path.replace(/transcript\.jsonl$/, 'transcript_full.jsonl')
    try {
      if (await $.fs.exists(full)) return await $.fs.read(full)
    } catch {
      /* over the read limit: fall back to the compact transcript */
    }
  }
  return $.fs.read(path)
}

/** Model, effort, tokens and tool calls from the stage's own transcript; a finished stage is read once more, then left alone. */
async function enrich($: Engine, dir: string, s: Stage): Promise<Stage> {
  if (!s.agentId || !VALID_ID.test(s.agentId) || s.isSettled) return s
  let next = s
  if (next.alias === null) {
    try {
      next = { ...next, alias: readMeta(await $.fs.read(`${dir}/agent-${s.agentId}.meta.json`)) }
    } catch {
      /* not written yet */
    }
  }
  try {
    const claudePath = `${dir}/agent-${s.agentId}.jsonl`
    const agyPath = `${dir}/${s.agentId}/.system_generated/logs/transcript.jsonl`
    const path = (await $.fs.exists(claudePath)) ? claudePath : agyPath
    next = withFacts(next, readTranscript(await readTranscriptText($, path)))
  } catch {
    /* not written yet, or over the read limit: keep what we have */
  }
  return next.endedAt !== null ? { ...next, isSettled: true } : next
}

/** Links any live session Agent call whose tool_result has not returned an agentId yet by scanning agent-*.meta.json. */
async function linkSessionAgents($: Engine, subagentsDir: string, stages: Stage[]): Promise<void> {
  const unlinked = stages.filter(s => s.kind === 'agent' && !s.agentId && s.endedAt === null)
  if (unlinked.length === 0) return
  for (const f of await listOr($, subagentsDir)) {
    if (f.kind !== 'file' || !f.name.startsWith('agent-') || !f.name.endsWith('.meta.json')) continue
    const aid = f.name.slice('agent-'.length, -'.meta.json'.length)
    if (!VALID_ID.test(aid)) continue
    try {
      const info = readMetaInfo(await $.fs.read(`${subagentsDir}/${f.name}`))
      if (!info.toolUseId) continue
      const match = unlinked.find(s => s.key === `agent:${info.toolUseId}`)
      if (match) {
        match.agentId = aid
        if (!match.alias && info.model) match.alias = info.model
      }
    } catch {
      /* ignore unreadable meta */
    }
  }
}

/** Opens the pane unless it is already up; says in the transcript whether the surface placed it. */
async function openPane($: Engine): Promise<void> {
  const isUp = (await $.ui.panes()).some(p => p.id === PANE)
  if (isUp) return
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  $.ui.log(
    opened.isPlaced
      ? 'workflow-watch: tracker pane open'
      : `workflow-watch: pane not placed on this surface (${opened.reason}); AbovePrompt, status line, toasts and /tracker provide the view`,
  )
}

async function tick($: Engine): Promise<void> {
  const target = await findTarget($)
  if (!target) return
  const now = await $.clock.now()
  const journalKey = [target.sessionPath, target.wf?.path].filter(Boolean).join('+')
  const prev = await read($, watch)
  const sameRun = prev.journal === journalKey
  const base = sameRun ? prev.stages : []
  const prevByKey = new Map(base.map(s => [s.key, s]))

  const sessionStages: Stage[] = []
  if (target.sessionPath) {
    try {
      const raw = parseSession(await readTranscriptText($, target.sessionPath), now)
      for (const s of raw) if (s.kind === 'agent') s.agentId ??= prevByKey.get(s.key)?.agentId ?? null
      if (target.subagentsDir) await linkSessionAgents($, target.subagentsDir, raw)
      for (const s of raw) {
        if (s.kind === 'agent' && target.subagentsDir) {
          const known = prevByKey.get(s.key)
          if (known?.isSettled) {
            sessionStages.push({ ...known, summary: known.summary ?? s.summary, endedAt: known.endedAt ?? s.endedAt })
          } else {
            const merged = known
              ? { ...s, agentId: s.agentId ?? known.agentId, alias: s.alias ?? known.alias, model: s.model ?? known.model, effort: s.effort ?? known.effort, outputTokens: known.outputTokens, calls: known.calls, lastTool: known.lastTool }
              : s
            sessionStages.push(await enrich($, target.subagentsDir, merged))
          }
        } else {
          sessionStages.push(s)
        }
      }
    } catch {
      /* session transcript not readable yet */
    }
  }

  const wfStages: Stage[] = []
  if (target.wf) {
    try {
      const text = await $.fs.read(target.wf.path)
      const prevWf = base.filter(s => !s.kind || s.kind === 'stage')
      for (const s of applyEntries(prevWf, parseLines(text), now)) wfStages.push(await enrich($, target.wf.dir, s))
    } catch {
      /* workflow journal not readable yet */
    }
  }

  const stages = mergeStages(sessionStages, wfStages)
  const run = target.wf && sessionStages.length === 0 ? target.wf.run : target.wf ? `${target.sid.slice(0, 8)} · ${target.wf.run}` : `session ${target.sid.slice(0, 8)}`
  const next: Watch = { journal: journalKey, run, stages, now }

  // A run first seen now toasts nothing: its finished stages finished before this mod was watching.
  // Normal chat turns do not toast; workflow stages, subagents, and commits do.
  const wasDone = new Set(base.filter(s => s.endedAt !== null).map(s => s.key))
  const justDone = sameRun ? stages.filter(s => s.endedAt !== null && !wasDone.has(s.key) && s.kind !== 'turn' && s.kind !== 'skill') : []
  for (const s of justDone) $.ui.toast(clip(`${state(s)}: ${s.label} — ${s.summary ?? ''}`, 120))
  if (!sameRun && stages.length) {
    if (target.wf) $.ui.toast(`workflow-watch: following ${run}`)
    void openPane($)
  }

  const changed = !sameRun || JSON.stringify(prev.stages) !== JSON.stringify(stages) || running(next).length > 0
  if (changed) await update($, watch, () => next)
  $.ui.status(statusLine(next))
}

async function runCommand($: Engine): Promise<{ text: string }> {
  let w = await read($, watch)
  if (!w.run || w.stages.length === 0) {
    await tick($)
    w = await read($, watch)
  }
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  if (!w.run || w.stages.length === 0) return { text: 'No session or workflow activity recorded yet; send a prompt or start a Workflow, then type /tracker again.' }
  const where = opened.isPlaced ? 'pane open' : 'no pane on this surface; this text is the view, type /tracker again for a fresh one'
  return { text: `${report(w)}\n(${where})` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const description = 'Live session & workflow tracker: turns, skills, subagents, commits and stages with models, effort, tokens and timeline'
    await $.command.register({ name: 'workflow-watch', description })
    await $.command.register({ name: 'tracker', description })
    $.clock.every(2000, () => void tick($))
    void openPane($)
    void tick($)
    return next(e)
  })

  // The pane is drawn by the terminal and the desktop app only; the text report below is what
  // every surface shows (the mobile app shows nothing else), so it carries the whole picture.
  on('command.run', { command: 'workflow-watch' }, async $ => runCommand($))
  on('command.run', { command: 'tracker' }, async $ => runCommand($))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const w = await read($, watch)
    if (!w.run || w.stages.length === 0) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="subtle">Waiting for session activity. Turns, skills, subagents, commits and Workflow stages appear here live.</Text>
        </Box>
      )
    }
    const tokens = w.stages.reduce((n, s) => n + s.outputTokens, 0)
    const t0 = w.stages.reduce((m, s) => Math.min(m, s.startedAt), Infinity)
    const t1 = w.stages.reduce((m, s) => Math.max(m, s.endedAt ?? w.now), -Infinity)
    const total = Math.max(1, t1 - t0)
    // Top waterfall timeline (when 2+ items exist), then one block per stage in run order with phase dividers.
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text wrap="truncate-end">
          <Text bold color="claude">
            {w.run}
          </Text>
          {tally(w)
            .split(' · ')
            .map(part => (
              <Text key={part} color={/^0 /.test(part) ? 'subtle' : TALLY_TONE[part.split(' ')[1] ?? ''] ?? 'text'}>{` · ${part}`}</Text>
            ))}
          <Text color="subtle">{` · ${(tokens / 1000).toFixed(1)}k output tokens`}</Text>
        </Text>
        {w.stages.length > 1 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="suggestion" wrap="truncate-end">
              {`── Timeline · ${elapsed(total)} elapsed`}
            </Text>
            {w.stages.slice(-10).map(s => (
              <Text key={`tl-${s.key}`} wrap="truncate-end">
                {barParts(timelineBar(s, t0, total, 14)).map(([part, isSpan], j) => (
                  <Text key={j} color={isSpan ? tone(s) : 'subtle'}>
                    {part}
                  </Text>
                ))}
                {`  ${s.label} `}
                <Text color="subtle">{`(${elapsed((s.endedAt ?? w.now) - s.startedAt)})`}</Text>
              </Text>
            ))}
          </Box>
        )}
        {phaseRuns(w.stages).map((g, i) => (
          <Box key={`phase-${i}`} flexDirection="column" marginTop={1}>
            <Text bold color="suggestion" wrap="truncate-end">
              {`── ${phaseTitle(g)}`}
            </Text>
            {g.stages.map((s, j) => (
              <Box key={s.key} flexDirection="column" marginTop={j === 0 ? 0 : 1}>
                <Text wrap="truncate-end">
                  <Text color={tone(s)} bold>
                    {state(s)}
                  </Text>
                  <Text bold>{`  ${s.label}`}</Text>
                  <Text color="permission">{`  ${who(s)}`}</Text>
                </Text>
                {s.endedAt === null ? (
                  <Text color="subtle" italic wrap="truncate-end">{`    ${stageResult(s)}`}</Text>
                ) : (
                  <Text wrap="truncate-end">{`    ${stageResult(s)}`}</Text>
                )}
                <Text color="subtle" wrap="truncate-end">
                  {`    ${stageDetail(s, w.now)}`}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const w = await read($, watch)
    const live = running(w)
    const isQuiet = e.props.hasSurvey || !w.run || live.length === 0
    if (isQuiet) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // A running stage has no result yet, so its block is the head line and the live details under it.
    return (
      <Box flexDirection="column">
        <Text bold color="claude" wrap="truncate-end">
          {`${w.run}: ${tally(w)}`}
        </Text>
        {live.slice(0, 4).map(s => (
          <Box key={s.key} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={tone(s)} bold>
                {state(s)}
              </Text>
              {`  ${stageTitle(s)}`}
            </Text>
            <Text dimColor wrap="truncate-end">
              {`    ${stageDetail(s, w.now)}`}
            </Text>
          </Box>
        ))}
        {live.length > 4 && <Text dimColor>{`  +${live.length - 4} more running`}</Text>}
      </Box>
    )
  })
}
