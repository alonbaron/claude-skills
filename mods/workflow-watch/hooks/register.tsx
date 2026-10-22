import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Stage, Theme, Watch } from '../types'
import { KIND_FILL, PANE_BG, headerCard, phaseChip, stageCard, timelineCard } from './cards'
import { EMPTY, SLIM, applyEntries, elapsed, mergeStages, parseLines, parseSession, phaseRuns, phaseTitle, readMeta, readMetaInfo, readTranscript, report, running, stageDetail, stageResult, state, tally, timelineBar, tone, who, withFacts } from './journal'

const PANE = 'workflow-watch'
const TITLE = 'Tracker'
const watch = atom({ plugin: 'workflow-watch', key: 'watch' } as const, EMPTY)
const theme = atom({ plugin: 'workflow-watch', key: 'theme' } as const, 'dark' as Theme)
const isTimelineOpen = atom({ plugin: 'workflow-watch', key: 'isTimelineOpen' } as const, true)

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

const INK = '#111111'
const fill = (s: Stage | undefined): string => KIND_FILL[s?.kind ?? 'stage']

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
  const { size } = await $.fs.stat(path)
  return size > READ_LIMIT ? readSlimmed($, path, size) : $.fs.read(path)
}

/** What one $.fs.read copies at most: the engine rejects a larger file, and caps a process's stdout the same. */
const READ_LIMIT = 4 * 1024 * 1024

/** Each slimmed log's last result by path until its size changes; a failure (null) too, so it isn't respawned every tick. */
const slimmed = new Map<string, { size: number; text: string | null }>()

// The log path and the SLIM patterns reach the child as environment variables, never spliced into its script.
const POWERSHELL_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
  '$t=[IO.File]::ReadAllText($env:WW_LOG)',
  "$t=[regex]::Replace($t,$env:WW_META,'',[Text.RegularExpressions.RegexOptions]::Multiline)",
  `$t=[regex]::Replace($t,$env:WW_IMAGE,'"data":""')`,
  `[Console]::Out.Write([regex]::Replace($t,$env:WW_LONG,'"$1..."'))`,
].join('; ')
const PERL_SCRIPT = 's/$ENV{WW_META}//gm; s/$ENV{WW_IMAGE}/"data":""/g; s/$ENV{WW_LONG}/"$1..."/g'

/**
 * A session log over the read limit, read through the SLIM filter (journal.ts): the engine's bookkeeping lines,
 * pasted images' base64 and the tails of long strings go, every line stays valid JSON, and a 10 MiB log comes to
 * about 1 MiB. Windows PowerShell by its full path on Windows, perl elsewhere; rerun only when the file's size changed.
 */
async function readSlimmed($: Engine, path: string, size: number): Promise<string> {
  const known = slimmed.get(path)
  if (known?.size === size) {
    if (known.text === null) throw new Error('slimmed read failed at this size')
    return known.text
  }
  const systemRoot = await $.env.get('SystemRoot')
  const argv = systemRoot
    ? [`${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, '-NoProfile', '-NonInteractive', '-Command', POWERSHELL_SCRIPT]
    : ['perl', '-0777', '-pe', PERL_SCRIPT, path]
  const env = { WW_LOG: path, WW_META: SLIM.meta, WW_IMAGE: SLIM.image, WW_LONG: SLIM.long }
  const out = await $.process.run(argv, { env, timeoutMs: 20000 }).catch(() => null)
  const text = out && out.exitCode === 0 && !out.isStdoutTruncated && out.stdout.length > 0 ? out.stdout : null
  if (slimmed.size > 16) slimmed.clear()
  slimmed.set(path, { size, text })
  if (text === null) throw new Error(`slimmed read failed: ${out?.stderr.slice(0, 200) ?? 'did not start'}`)
  return text
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

/** Opens the pane unless it is already up. The pane is the only view; nothing is written to the chat. */
async function openPane($: Engine): Promise<void> {
  const isUp = (await $.ui.panes()).some(p => p.id === PANE)
  if (!isUp) await $.ui.open({ id: PANE, title: TITLE })
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

  // A log that cannot be read this tick keeps what the last read found, and the pane says so instead of blanking.
  let sessionStages: Stage[] = base.filter(s => s.kind && s.kind !== 'stage')
  let unread: string | null = null
  if (target.sessionPath) {
    try {
      const raw = parseSession(await readTranscriptText($, target.sessionPath), now)
      for (const s of raw) if (s.kind === 'agent') s.agentId ??= prevByKey.get(s.key)?.agentId ?? null
      if (target.subagentsDir) await linkSessionAgents($, target.subagentsDir, raw)
      const fresh: Stage[] = []
      for (const s of raw) {
        if (s.kind === 'agent' && target.subagentsDir) {
          const known = prevByKey.get(s.key)
          if (known?.isSettled) {
            fresh.push({ ...known, summary: known.summary ?? s.summary, endedAt: known.endedAt ?? s.endedAt })
          } else {
            const merged = known
              ? { ...s, agentId: s.agentId ?? known.agentId, alias: s.alias ?? known.alias, model: s.model ?? known.model, effort: s.effort ?? known.effort, outputTokens: known.outputTokens, calls: known.calls, lastTool: known.lastTool }
              : s
            fresh.push(await enrich($, target.subagentsDir, merged))
          }
        } else {
          fresh.push(s)
        }
      }
      sessionStages = fresh
    } catch {
      unread = 'the session log'
    }
  }

  let wfStages: Stage[] = base.filter(s => !s.kind || s.kind === 'stage')
  if (target.wf) {
    try {
      const text = await $.fs.read(target.wf.path)
      const fresh: Stage[] = []
      for (const s of applyEntries(wfStages, parseLines(text), now)) fresh.push(await enrich($, target.wf.dir, s))
      wfStages = fresh
    } catch {
      unread = unread ? 'the session log and the workflow journal' : 'the workflow journal'
    }
  }

  const stages = mergeStages(sessionStages, wfStages)
  const run = target.wf && sessionStages.length === 0 ? target.wf.run : target.wf ? `${target.sid.slice(0, 8)} · ${target.wf.run}` : `session ${target.sid.slice(0, 8)}`
  const notice = unread ? `Could not read ${unread}; showing what was last read.` : null
  const next: Watch = { journal: journalKey, run, stages, now, notice }
  if (!sameRun && stages.length) void openPane($)

  const changed = !sameRun || prev.notice !== notice || JSON.stringify(prev.stages) !== JSON.stringify(stages) || running(next).length > 0
  if (changed) await update($, watch, () => next)
}

/** One tick at a time: a slow read (a slimmed log, many transcripts) skips the ticks that come due meanwhile. */
let isTicking = false
async function tickOnce($: Engine): Promise<void> {
  if (isTicking) return
  isTicking = true
  try {
    await tick($)
  } finally {
    isTicking = false
  }
}

async function runCommand($: Engine): Promise<{ text: string }> {
  let w = await read($, watch)
  if (!w.run || w.stages.length === 0) {
    await tickOnce($)
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
    const saved = await $.store.get('theme').catch(() => undefined)
    if (saved === 'dark' || saved === 'light') await update($, theme, () => saved)
    const savedOpen = await $.store.get('isTimelineOpen').catch(() => undefined)
    if (typeof savedOpen === 'boolean') await update($, isTimelineOpen, () => savedOpen)
    $.clock.every(2000, () => void tickOnce($))
    void openPane($)
    void tickOnce($)
    return next(e)
  })

  // Not every surface seats the pane; the text report below is what every surface can show, so it carries the whole picture.
  on('command.run', { command: 'workflow-watch' }, async $ => runCommand($))
  on('command.run', { command: 'tracker' }, async $ => runCommand($))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Svg = e.surface !== 'terminal' && 'Svg' in elements ? elements.Svg : null
    const w = await read($, watch)
    const notice = w.notice ? (
      <Text color="warning" wrap="wrap">
        {w.notice}
      </Text>
    ) : null
    if (!w.run || w.stages.length === 0) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box borderStyle="round" borderColor="claude" paddingX={1}>
            <Text color="subtle">Waiting for session activity. Turns, skills, subagents, commits and Workflow stages appear here live.</Text>
          </Box>
          {notice}
        </Box>
      )
    }
    const tokens = w.stages.reduce((n, s) => n + s.outputTokens, 0)
    const t0 = w.stages.reduce((m, s) => Math.min(m, s.startedAt), Infinity)
    const t1 = w.stages.reduce((m, s) => Math.max(m, s.endedAt ?? w.now), -Infinity)
    const total = Math.max(1, t1 - t0)
    // Newest first: the latest work sits under the header with no scrolling, history further down.
    // (The editor's pane scrolls by itself and leaves $.ui.scroll unapplied, so following the end is not an option there.)
    // Phases are cut in run order, so each chip keeps its opener's kind and round; then groups and members are reversed.
    const groups = phaseRuns(w.stages).reverse()
    const newestOf = (g: { stages: Stage[] }): Stage[] => [...g.stages].reverse()
    // A header card, a timeline card (when 2+ items exist), then one card per stage, newest first, under a colored phase chip.
    // A surface with Svg (desktop, vscode, mobile) draws each card as a rounded vector card; the terminal draws them in box glyphs.
    if (Svg) {
      const mode = await read($, theme)
      const isOpen = await read($, isTimelineOpen)
      const head = headerCard(w, tokens, mode)
      const tl = timelineCard(w.stages, t0, total, w.now, mode)
      return (
        <Box flexDirection="column" paddingX={1} paddingY={1} backgroundColor={PANE_BG[mode]}>
          <Box justifyContent="flex-end" marginBottom={1}>
            <Button
              key="theme"
              label={mode === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
              onPress={() => {
                void update($, theme, m => (m === 'dark' ? 'light' : 'dark'))
                  .then(m => $.store.set('theme', m))
                  .catch(() => undefined)
              }}
            />
          </Box>
          {notice}
          <Svg source={head.source} alt={head.alt} width={head.width} height={head.height} />
          {w.stages.length > 1 && (
            <Box flexDirection="column" marginTop={1}>
              <Box>
                <Button
                  key="timeline"
                  label={isOpen ? '− Timeline' : `+ Timeline · ${elapsed(total)} elapsed`}
                  onPress={() => {
                    void update($, isTimelineOpen, open => !open)
                      .then(open => $.store.set('isTimelineOpen', open))
                      .catch(() => undefined)
                  }}
                />
              </Box>
              {isOpen && (
                <Box marginTop={1}>
                  <Svg source={tl.source} alt={tl.alt} width={tl.width} height={tl.height} />
                </Box>
              )}
            </Box>
          )}
          {groups.map((g, i) => {
            const chip = phaseChip(g, mode)
            return (
              <Box key={`phase-${i}`} flexDirection="column" marginTop={1}>
                <Svg source={chip.source} alt={chip.alt} width={chip.width} height={chip.height} />
                {newestOf(g).map(s => {
                  const c = stageCard(s, w.now, mode)
                  return (
                    <Box key={s.key} marginTop={1}>
                      <Svg source={c.source} alt={c.alt} width={c.width} height={c.height} />
                    </Box>
                  )
                })}
              </Box>
            )
          })}
        </Box>
      )
    }
    return (
      <Box flexDirection="column" paddingX={1}>
        {notice}
        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
          <Text bold color="claude" wrap="truncate-end">
            {w.run}
          </Text>
          <Text wrap="truncate-end">
            {tally(w)
              .split(' · ')
              .map((part, i) => (
                <Text key={part}>
                  {i > 0 ? ' ' : ''}
                  {/^0 /.test(part) ? (
                    <Text color="subtle">{` ${part} `}</Text>
                  ) : (
                    <Text bold backgroundColor={TALLY_TONE[part.split(' ')[1] ?? ''] ?? 'text'} color="inverseText">{` ${part} `}</Text>
                  )}
                </Text>
              ))}
            <Text color="subtle">{`  ${(tokens / 1000).toFixed(1)}k output tokens`}</Text>
          </Text>
        </Box>
        {w.stages.length > 1 && (
          <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1} marginTop={1}>
            <Text bold color="claude" wrap="truncate-end">
              {`Timeline · ${elapsed(total)} elapsed`}
            </Text>
            {w.stages.slice(-10).map(s => (
              <Text key={`tl-${s.key}`} wrap="truncate-end">
                {barParts(timelineBar(s, t0, total, 14)).map(([part, isSpan], j) => (
                  <Text key={j} color={isSpan ? fill(s) : 'subtle'}>
                    {part}
                  </Text>
                ))}
                {`  ${s.label} `}
                <Text color="subtle">{`(${elapsed((s.endedAt ?? w.now) - s.startedAt)})`}</Text>
              </Text>
            ))}
          </Box>
        )}
        {groups.map((g, i) => (
          <Box key={`phase-${i}`} flexDirection="column" marginTop={1}>
            <Text wrap="truncate-end">
              <Text bold backgroundColor={fill(g.stages[0])} color={INK}>{` ${phaseTitle(g)} `}</Text>
            </Text>
            {newestOf(g).map(s => (
              <Box key={s.key} flexDirection="column" borderStyle="round" borderColor={s.endedAt === null ? tone(s) : 'subtle'} paddingX={1}>
                <Text wrap="truncate-end">
                  <Text bold backgroundColor={tone(s)} color="inverseText">{` ${state(s)} `}</Text>
                  <Text bold>{`  ${s.label}`}</Text>
                  <Text color="permission">{`  ${who(s)}`}</Text>
                </Text>
                {s.prompt && (
                  <Text color="claude" wrap="truncate-end">
                    {`› ${s.prompt}`}
                  </Text>
                )}
                {s.endedAt === null ? (
                  <Text color="subtle" italic wrap="truncate-end">{stageResult(s)}</Text>
                ) : (
                  <Text wrap="truncate-end">{stageResult(s)}</Text>
                )}
                <Text color="subtle" wrap="truncate-end">
                  {stageDetail(s, w.now)}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
