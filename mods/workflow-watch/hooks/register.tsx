import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Stage, Watch } from '../types'
import { EMPTY, applyEntries, elapsed, finished, groupByPhase, parseLines, readMeta, readTranscript, report, running, stageLine, statusLine } from './journal'

const PANE = 'workflow-watch'
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

/** The newest journal.jsonl under <projects>/<any project>/<this session>/subagents/workflows/<run>/. */
async function findJournal($: Engine): Promise<{ dir: string; path: string; run: string } | null> {
  const home = await $.env.get('HOME')
  if (!home) return null
  const sid = await $.session.id()
  const projects = `${home}/.claude/projects`
  let best: { dir: string; run: string; mtime: number } | null = null
  for (const d of await listOr($, projects)) {
    if (d.kind !== 'dir') continue
    const wf = `${projects}/${d.name}/${sid}/subagents/workflows`
    if (!(await $.fs.exists(wf))) continue
    for (const r of await listOr($, wf)) {
      if (r.kind !== 'dir') continue
      const j = (await listOr($, `${wf}/${r.name}`)).find(f => f.name === 'journal.jsonl')
      if (j && (!best || j.mtimeMs > best.mtime)) best = { dir: `${wf}/${r.name}`, run: r.name, mtime: j.mtimeMs }
    }
  }
  return best ? { dir: best.dir, path: `${best.dir}/journal.jsonl`, run: best.run } : null
}

/** Model, effort, tokens and tool calls from the stage's own transcript; a finished stage is read once more, then left alone. */
async function enrich($: Engine, dir: string, s: Stage): Promise<Stage> {
  if (!s.agentId || s.isSettled) return s
  let next = s
  if (next.alias === null) {
    try {
      next = { ...next, alias: readMeta(await $.fs.read(`${dir}/agent-${s.agentId}.meta.json`)) }
    } catch {
      /* not written yet */
    }
  }
  try {
    const facts = readTranscript(await $.fs.read(`${dir}/agent-${s.agentId}.jsonl`))
    next = { ...next, ...facts, isSettled: next.endedAt !== null }
  } catch {
    /* not written yet, or over the read limit: keep what we have */
  }
  return next
}

/** Opens the pane unless it is already up; says in the transcript whether the surface placed it. */
async function openPane($: Engine): Promise<void> {
  const isUp = (await $.ui.panes()).some(p => p.id === PANE)
  if (isUp) return
  const opened = await $.ui.open({ id: PANE, title: 'Workflow' })
  $.ui.log(opened.isPlaced ? 'workflow-watch: pane open' : `workflow-watch: pane not placed on this surface (${opened.reason}); /workflow-watch prints the report as text`)
}

async function tick($: Engine): Promise<void> {
  const found = await findJournal($)
  if (!found) return
  const now = await $.clock.now()
  let text = ''
  try {
    text = await $.fs.read(found.path)
  } catch {
    return
  }
  const prev = await read($, watch)
  const sameRun = prev.journal === found.path
  const base: Stage[] = sameRun ? prev.stages : []
  const stages: Stage[] = []
  for (const s of applyEntries(base, parseLines(text), now)) stages.push(await enrich($, found.dir, s))
  const next: Watch = { journal: found.path, run: found.run, stages, now }

  const wasDone = new Set(base.filter(s => s.endedAt !== null).map(s => s.key))
  const justDone = stages.filter(s => s.endedAt !== null && !wasDone.has(s.key))
  for (const s of justDone) $.ui.toast(`${s.isEmpty ? '✗' : '✓'} ${s.phase}: ${s.label} — ${s.summary ?? ''}`.slice(0, 120))
  if (!sameRun && stages.length) {
    $.ui.toast(`workflow-watch: following run ${found.run}`)
    void openPane($)
  }

  const changed = !sameRun || JSON.stringify(prev.stages) !== JSON.stringify(stages) || running(next).length > 0
  if (changed) await update($, watch, () => next)
  $.ui.status(statusLine(next))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'workflow-watch',
      description: 'Live view of the running Workflow: each stage, its model, effort and tokens, what it is doing, its result',
    })
    $.clock.every(2000, () => void tick($))
    void openPane($)
    return next(e)
  })

  // The pane is drawn by the terminal and the desktop app only; the text report below is what
  // every surface shows (the mobile app shows nothing else), so it carries the whole picture.
  on('command.run', { command: 'workflow-watch' }, async $ => {
    const w = await read($, watch)
    const opened = await $.ui.open({ id: PANE, title: 'Workflow' })
    if (!w.run || w.stages.length === 0) return { text: 'No workflow run found for this session yet; run one with the Workflow tool, then type /workflow-watch again.' }
    const where = opened.isPlaced ? 'pane open' : 'no pane on this surface; this text is the view, type /workflow-watch again for a fresh one'
    return { text: `${report(w)}\n(${where})` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const w = await read($, watch)
    const width = Math.max(40, e.props.bodyColumns ?? e.viewport?.columns ?? 80)
    if (!w.run || w.stages.length === 0) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text dimColor>No workflow run yet. Start one with the Workflow tool; this pane follows the newest run of this session.</Text>
        </Box>
      )
    }
    const live = running(w)
    const done = finished(w)
    const tokens = w.stages.reduce((n, s) => n + s.outputTokens, 0)
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>
          {w.run} · {live.length} running · {done.length} done · {(tokens / 1000).toFixed(1)}k output tokens
        </Text>
        {groupByPhase(w.stages).map(g => (
          <Box key={`phase-${g.phase}`} flexDirection="column" marginTop={1}>
            <Text bold dimColor={g.stages.every(s => s.endedAt !== null)}>
              {g.phase || '(no phase)'}
            </Text>
            {g.stages.map(s => (
              <Text key={s.key} dimColor={s.endedAt !== null} wrap="truncate-end">
                {`  ${stageLine(s, w.now)}`.slice(0, width - 2)}
              </Text>
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
    const width = Math.max(40, e.props.bodyColumns ?? 80)
    const head = `${w.run}: ${finished(w).length} done · ${live.length} running`
    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">{head}</Text>
        {live.slice(0, 4).map(s => (
          <Text key={s.key} dimColor wrap="truncate-end">
            {`  ▶ ${elapsed(w.now - s.startedAt)} ${s.label} [${s.model ?? s.alias ?? '?'} ${s.effort ?? ''}]${s.lastTool ? ' · ' + s.lastTool : ''}`.slice(0, width)}
          </Text>
        ))}
      </Box>
    )
  })
}
