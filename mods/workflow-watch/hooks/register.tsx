import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PaneView, Stage, Theme, Usage, Watch } from '../types'
// The host draws the Buttons in its own theme colors, so the pane paints no background of its own under them: the panels carry their theme.
import { KIND_FILL, linesPanel, nowPanel, sessionRule, signalPanels, turnEntry, turnsRule, usagePanel } from './cards'
import type { Card } from './cards'
import { EMPTY, READ_LIMIT, SLIM_CUT, SLIM_TIMEOUT_MS, applyEntries, clip, decisionLines, digest, elapsed, emptySignals, labelWithTitle, mergeStages, parseLines, parseSession, phaseRuns, phaseTitle, readMeta, readMetaInfo, readTranscript, report, signalLines, slimCommand, stageDetail, stageResult, state, tally, timelineBar, tone, usageText, usageView, who, withFacts } from './journal'

const PANE = 'workflow-watch'
const TITLE = 'Tracker'
const watch = atom({ plugin: 'workflow-watch', key: 'watch' } as const, EMPTY)
const theme = atom({ plugin: 'workflow-watch', key: 'theme' } as const, 'dark' as Theme)
const pinnedView = atom({ plugin: 'workflow-watch', key: 'pinnedView' } as const, null as PaneView | null)
const isHidden = atom({ plugin: 'workflow-watch', key: 'isHidden' } as const, false)
const usage = atom({ plugin: 'workflow-watch', key: 'usage' } as const, null as Usage | null)
const openKeys = atom({ plugin: 'workflow-watch', key: 'openKeys' } as const, [] as string[])
const copiedKey = atom({ plugin: 'workflow-watch', key: 'copiedKey' } as const, null as string | null)
const armed = atom({ plugin: 'workflow-watch', key: 'armed' } as const, false)
const folded = atom({ plugin: 'workflow-watch', key: 'folded' } as const, [] as string[])
const allTurns = atom({ plugin: 'workflow-watch', key: 'allTurns' } as const, false)
const autoOpenOn = atom({ plugin: 'workflow-watch', key: 'autoOpenOn' } as const, null as boolean | null)

/** How many entries TURNS shows until the person asks for all of them. */
const TURNS_SHOWN = 8

/** The context fill, in percent, from which the pane offers to compact. */
const COMPACT_AT = 80

/** Whether a turn card has more than its lines show: a prompt past the clip, an answer longer than its first sentence, or a tool trail. */
const hasMore = (s: Stage): boolean => s.kind === 'turn' && ((s.prompt?.length ?? 0) > 100 || (Boolean(s.answer) && s.answer !== s.summary) || (s.tools?.length ?? 0) > 0)

/** The settings (plugin.json userConfig, rows under /config); a change there reloads the module with the new values. */
let autoOpen = true
let cacheTtlMs = 5 * 60e3

/** How long nothing has to run before the pane folds to its compact strip. */
export const IDLE_MS = 20000

/** The item the compact strip shows: the newest one running, else the one that finished last. */
const latestOf = (stages: Stage[]): Stage | undefined =>
  [...stages].reverse().find(s => s.endedAt === null) ?? stages.reduce<Stage | undefined>((m, s) => (!m || (s.endedAt ?? 0) > (m.endedAt ?? 0) ? s : m), undefined)

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

/** Each slimmed log's last result by path until its size changes; a failure (null) too, so it isn't respawned every tick. */
const slimmed = new Map<string, { size: number; text: string | null }>()

/**
 * A session log over the read limit, read through the SLIM filter (journal.ts): the engine's bookkeeping lines,
 * pasted images' base64 and the tails of long strings go, every line stays valid JSON, and a 10 MiB log comes to
 * about 1 MiB. A log still past SLIM_TAIL after that keeps only its newest whole lines, behind a SLIM_CUT line.
 * Windows PowerShell by its full path on Windows, perl elsewhere (slimCommand); rerun only when the file's size changed.
 */
async function readSlimmed($: Engine, path: string, size: number): Promise<string> {
  const known = slimmed.get(path)
  if (known?.size === size) {
    if (known.text === null) throw new Error('slimmed read failed at this size')
    return known.text
  }
  const { argv, env } = slimCommand(path, await $.env.get('SystemRoot'))
  const out = await $.process.run(argv, { env, timeoutMs: SLIM_TIMEOUT_MS }).catch(() => null)
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

/** An open the plugin makes on its own: only while auto-open is on and the person has not hidden the pane this session. */
async function openPaneAuto($: Engine): Promise<void> {
  if (((await read($, autoOpenOn)) ?? autoOpen) && !(await read($, isHidden))) await openPane($)
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
  let signals = prev.signals
  let unread: string | null = null
  let isCut = false
  if (target.sessionPath) {
    try {
      const text = await readTranscriptText($, target.sessionPath)
      isCut = text.startsWith(SLIM_CUT)
      const found = emptySignals()
      const raw = parseSession(text, now, found)
      signals = found
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
  const notice = unread
    ? `Could not read ${unread}; showing what was last read.`
    : isCut
      ? 'This session’s log is too long to read in full, so only its most recent part is shown. Turn numbers start from there.'
      : null
  const isBusy = stages.some(s => s.endedAt === null)
  const lastEnd = stages.reduce((m, s) => Math.max(m, s.endedAt ?? 0), 0)
  const isIdle = stages.length > 0 && !isBusy && now - lastEnd >= IDLE_MS
  const next: Watch = { journal: journalKey, run, stages, now, notice, isIdle, ...(signals ? { signals } : {}) }
  // The pane comes back when work starts again (a new run, or the first item running after a quiet spell), unless hidden or auto-open is off.
  const isWaking = isBusy && !prev.stages.some(s => s.endedAt === null)
  if (stages.length && (!sameRun || isWaking)) void openPaneAuto($)
  // A Minimize or Expand press holds until the session next turns busy or idle; then the pane sizes itself again.
  if (!sameRun || Boolean(prev.isIdle) !== isIdle) await update($, pinnedView, () => null)
  // A Compact press that was waiting for its second press is forgotten once work starts: the engine refuses to compact mid-turn anyway.
  if (isBusy && (await read($, armed))) await update($, armed, () => false)

  const changed = !sameRun || prev.notice !== notice || Boolean(prev.isIdle) !== isIdle || JSON.stringify(prev.stages) !== JSON.stringify(stages) || JSON.stringify(prev.signals) !== JSON.stringify(signals) || isBusy
  if (changed) await update($, watch, () => next)

  // The engine's own figures (context fill, rate limits, cost), a free call; kept to the fields drawn, written only when they move.
  const u = await $.session.usage().catch(() => null)
  const fresh: Usage | null = u
    ? { context: { tokens: u.context.tokens, window: u.context.window, percent: u.context.percent }, rateLimits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })), cost: u.cost }
    : null
  if (JSON.stringify(fresh) !== JSON.stringify(await read($, usage))) await update($, usage, () => fresh)
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
  // The person asked: the pane opens whatever the setting, and a Hide from earlier in the session is over.
  await update($, isHidden, () => false)
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  await update($, pinnedView, () => 'full')
  if (!w.run || w.stages.length === 0) return { text: 'No session or workflow activity recorded yet; send a prompt or start a Workflow, then type /tracker again.' }
  const where = opened.isPlaced ? 'pane open' : 'no pane on this surface; this text is the view, type /tracker again for a fresh one'
  const view = usageView(await read($, usage), w.stages, w.now, cacheTtlMs)
  return { text: `${report(w, usageText(view))}\n(${where})` }
}

export const register: Register = (on, options) => {
  autoOpen = options.autoOpen !== false
  if (typeof options.cacheTtlMinutes === 'number' && options.cacheTtlMinutes > 0) cacheTtlMs = options.cacheTtlMinutes * 60e3
  on('session.start', async ($, e, next) => {
    const description = 'Live session & workflow tracker: turns, skills, subagents, commits and stages with models, effort, tokens and timeline'
    await $.command.register({ name: 'workflow-watch', description })
    await $.command.register({ name: 'tracker', description })
    const saved = await $.store.get('theme').catch(() => undefined)
    if (saved === 'dark' || saved === 'light') await update($, theme, () => saved)
    const folds = await $.store.get('folded').catch(() => undefined)
    if (Array.isArray(folds) && folds.every(f => typeof f === 'string')) await update($, folded, () => folds as string[])
    // The Auto-open choice the button kept on a host where the engine refused the /config write; it wins over the row.
    const kept = await $.store.get('autoOpen').catch(() => undefined)
    if (typeof kept === 'boolean') await update($, autoOpenOn, () => kept)
    $.clock.every(2000, () => void tickOnce($))
    void openPaneAuto($)
    void tickOnce($)
    return next(e)
  })

  // A close the person made (the close mark or key) holds for the session, as the Hide button does.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') await update($, isHidden, () => true)
    return next(e)
  }).catch((_$, e, next) => next(e))

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
    // Idle, the pane folds to one strip (the run, its counts, the latest item); busy, it opens to every card. A press overrides either.
    const pinned = await read($, pinnedView)
    const isCompact = pinned ? pinned === 'compact' : Boolean(w.isIdle)
    const latest = latestOf(w.stages) as Stage
    const view = usageView(await read($, usage), w.stages, w.now, cacheTtlMs)
    // A header card, the usage card, a timeline card (when 2+ items exist), then one card per stage, newest first, under a colored phase chip.
    // A surface with Svg (desktop, vscode, mobile) draws the console as panels; the terminal draws the same text in box glyphs.
    if (Svg) {
      const mode = await read($, theme)
      const unfolded = await read($, openKeys)
      const copied = await read($, copiedKey)
      const isArmed = await read($, armed)
      const folds = await read($, folded)
      const isAll = await read($, allTurns)
      const isAuto = (await read($, autoOpenOn)) ?? autoOpen
      const isBusy = w.stages.some(s => s.endedAt === null)
      // The offer to compact: its own row, so the bar's buttons keep their places; two presses; never while anything runs.
      const compactRow =
        view.ctx !== null && view.ctx >= COMPACT_AT && !isBusy ? (
          <Box justifyContent="flex-end">
            <Button
              key="compact"
              label={isArmed ? 'Press again to compact' : `Compact now · ctx ${view.ctx}%`}
              onPress={() => {
                if (!isArmed) {
                  void update($, armed, () => true).catch(() => undefined)
                  return
                }
                void update($, armed, () => false)
                  .then(() => $.session.compact())
                  .catch(() => undefined)
              }}
            />
          </Box>
        ) : null
      // The rows of buttons wrap to the pane's width, so a narrow pane stacks them instead of cutting the leftmost off.
      const bar = (
        <Box justifyContent="flex-end" flexWrap="wrap" gap={1}>
          <Button key="size" label={isCompact ? '+ Expand' : '− Minimize'} onPress={() => void update($, pinnedView, () => (isCompact ? 'full' : 'compact')).catch(() => undefined)} />
          <Button
            key="theme"
            label={mode === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
            onPress={() => {
              void update($, theme, m => (m === 'dark' ? 'light' : 'dark'))
                .then(m => $.store.set('theme', m))
                .catch(() => undefined)
            }}
          />
          <Button
            key="auto"
            label={isAuto ? 'Auto-open: on' : 'Auto-open: off'}
            onPress={() => {
              const next = !isAuto
              // The /config row is the setting wherever the engine lets the pane write it. A relayed session (the desktop app's) refuses
              // a plugin's write, so the choice is kept in the mod's own store then, and wins over the row at the next start.
              void update($, autoOpenOn, () => next)
                .then(() => $.config.set({ key: `${PANE}.autoOpen`, value: next }).then(r => !r.deny, () => false))
                .then(isWritten => (isWritten ? $.store.delete('autoOpen') : $.store.set('autoOpen', next)))
                .catch(() => undefined)
            }}
          />
          <Button
            key="hide"
            label="✕ Hide"
            onPress={() => {
              void update($, isHidden, () => true)
                .then(() => $.ui.close({ id: PANE }))
                .catch(() => undefined)
            }}
          />
        </Box>
      )
      const draw = (c: Card | null, key: string) =>
        c ? (
          <Box key={key}>
            <Svg source={c.source} alt={c.alt} />
          </Box>
        ) : null
      // NOW follows the live turn, else the last one; its children are the items that started inside its span.
      const turns = w.stages.filter(s => s.kind === 'turn')
      const liveTurn = [...turns].reverse().find(s => s.endedAt === null) ?? turns[turns.length - 1]
      const nowCard = nowPanel(liveTurn, w.signals, w.now, mode)
      if (isCompact) {
        const waiting = w.signals ? decisionLines(w.signals).filter(l => l.includes('? waiting')) : []
        return (
          <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
            {compactRow}
            {bar}
            {notice}
            {draw(nowCard, 'now')}
            {draw(linesPanel('DECISIONS', `${waiting.length} WAITING`, waiting, mode), 'decisions')}
          </Box>
        )
      }
      // Each section after NOW folds to its button: `− Changes` open, `+ Changes · 4` folded, the set kept between sessions.
      const foldButton = (name: string, count: number) => {
        const isFolded = folds.includes(name)
        const word = name[0] + name.slice(1).toLowerCase()
        return (
          <Button
            key={`panel:${name}`}
            label={isFolded ? `+ ${word} · ${count}` : `− ${word}`}
            onPress={() => {
              void update($, folded, f => (f.includes(name) ? f.filter(n => n !== name) : [...f, name]))
                .then(f => $.store.set('folded', f))
                .catch(() => undefined)
            }}
          />
        )
      }
      const section = (name: string, count: number, card: Card | null) => (
        <Box key={name} flexDirection="column">
          <Box>{foldButton(name, count)}</Box>
          {!folds.includes(name) && draw(card, `${name}-card`)}
        </Box>
      )
      const spanOf = (t: Stage): [number, number] => [t.startedAt, t.endedAt ?? w.now]
      const parentOf = (s: Stage): Stage | undefined => turns.find(t => s.startedAt >= spanOf(t)[0] && s.startedAt <= spanOf(t)[1])
      const isEntry = (s: Stage): boolean => s.kind === 'turn' || !s.kind || s.kind === 'stage' || !parentOf(s)
      const entries = w.stages.filter(isEntry).reverse()
      // ponytail: the cap is by recency alone; the entries are newest first, so the first eight are the last eight turns.
      const shown = isAll ? entries : entries.slice(0, TURNS_SHOWN)
      // One pass over the stages per render: each item under its turn's key, read back per entry.
      const childrenByTurn = new Map<string, Stage[]>()
      for (const s of w.stages) {
        if (isEntry(s)) continue
        const t = parentOf(s) as Stage
        const list = childrenByTurn.get(t.key)
        if (list) list.push(s)
        else childrenByTurn.set(t.key, [s])
      }
      const childrenOf = (t: Stage): Stage[] => (t.kind === 'turn' ? (childrenByTurn.get(t.key) ?? []) : [])
      // One unit of air between every row of the console: the buttons, the rules, each section and each entry.
      return (
        <Box flexDirection="column" paddingX={1} paddingY={1} gap={1}>
          {compactRow}
          {bar}
          {notice}
          {draw(sessionRule(w, w.now, mode), 'session')}
          {draw(nowCard, 'now')}
          {signalPanels(w.signals, w.stages, mode, folds).map(p => section(p.name, p.count, p.card))}
          {section('USAGE', view.meters.length, folds.includes('USAGE') ? null : usagePanel(view, mode))}
          <Box flexWrap="wrap" gap={1}>
            {foldButton('TURNS', entries.length)}
            {!folds.includes('TURNS') && entries.length > TURNS_SHOWN && <Button key="turns:all" label={isAll ? `Last ${TURNS_SHOWN}` : `Show all ${entries.length}`} onPress={() => void update($, allTurns, v => !v).catch(() => undefined)} />}
          </Box>
          {!folds.includes('TURNS') && draw(turnsRule(shown.length, entries.length, mode), 'turns')}
          {!folds.includes('TURNS') && shown.map(s => {
            const isUnfolded = unfolded.includes(s.key)
            const c = turnEntry(s, childrenOf(s), w.now, mode, { digest: s.kind === 'turn' ? digest(s, w.stages, w.now) : undefined, isOpen: isUnfolded })
            return (
              <Box key={s.key} flexDirection="column">
                <Svg source={c.source} alt={c.alt} />
                {(hasMore(s) || (s.kind === 'turn' && s.prompt)) && (
                  <Box flexWrap="wrap" gap={1}>
                    {hasMore(s) && (
                      <Button
                        key={`fold:${s.key}`}
                        label={isUnfolded ? '− less' : '+ more'}
                        onPress={() => void update($, openKeys, keys => (isUnfolded ? keys.filter(k => k !== s.key) : [...keys, s.key])).catch(() => undefined)}
                      />
                    )}
                    {s.kind === 'turn' && s.prompt && (
                      <Button
                        key={`copy:${s.key}`}
                        label={copied === s.key ? 'Copied' : 'Copy prompt'}
                        onPress={press => {
                          void $.ui
                            .copy({ text: s.prompt ?? '', surface: press.surface })
                            .then(r => (r.isCopied ? update($, copiedKey, () => s.key) : undefined))
                            .catch(() => undefined)
                        }}
                      />
                    )}
                  </Box>
                )}
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
          {!isCompact &&
            usageText(view).map((l, i) => (
              <Text key={`usage-${i}`} color="subtle" wrap="truncate-end">
                {l}
              </Text>
            ))}
          {!isCompact &&
            signalLines(w.signals, w.stages).map((l, i) => (
              <Text key={`signal-${i}`} color={/^[A-Z]+$/.test(l) ? 'claude' : 'text'} bold={/^[A-Z]+$/.test(l)} wrap="truncate-end">
                {l}
              </Text>
            ))}
          {isCompact && (
            <Text wrap="truncate-end">
              <Text bold backgroundColor={tone(latest)} color="inverseText">{` ${state(latest)} `}</Text>
              {`  ${latest.label} `}
              <Text color="subtle">{`(${elapsed((latest.endedAt ?? w.now) - latest.startedAt)})`}</Text>
            </Text>
          )}
        </Box>
        {!isCompact && w.stages.length > 1 && (
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
        {!isCompact && groups.map((g, i) => (
          <Box key={`phase-${i}`} flexDirection="column" marginTop={1}>
            <Text wrap="truncate-end">
              <Text bold backgroundColor={fill(g.stages[0])} color={INK}>{` ${phaseTitle(g)} `}</Text>
            </Text>
            {newestOf(g).map(s => (
              <Box key={s.key} flexDirection="column" borderStyle="round" borderColor={s.endedAt === null ? tone(s) : 'subtle'} paddingX={1}>
                <Text wrap="truncate-end">
                  <Text bold backgroundColor={tone(s)} color="inverseText">{` ${state(s)} `}</Text>
                  <Text bold>{`  ${labelWithTitle(s)}`}</Text>
                  <Text color="permission">{`  ${who(s)}`}</Text>
                </Text>
                {s.prompt && (
                  <Text color="claude" wrap="truncate-end">
                    {`› ${clip(s.prompt, 100)}`}
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
                {s.kind === 'turn' && digest(s, w.stages, w.now) && (
                  <Text color="subtle" wrap="truncate-end">
                    {digest(s, w.stages, w.now)}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
