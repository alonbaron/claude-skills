// Pure functions over a workflow run's files (journal.jsonl, agent-<id>.jsonl, agent-<id>.meta.json):
// no `$`, so they test alone.
import type { Stage, Watch } from '../types'

export type Entry = {
  type: string
  key?: string
  agentId?: string
  label?: string
  phase?: string
  result?: unknown
}

export const EMPTY: Watch = { journal: null, run: null, stages: [], now: 0 }

/** Parses JSON lines; a half-flushed last line is left for the next read. */
export function parseLines(text: string): Entry[] {
  const lines = text.split('\n').filter(line => line.length > 0)
  const out: Entry[] = []
  for (let i = 0; i < lines.length; i++) {
    try {
      const value: unknown = JSON.parse(lines[i] as string)
      if (value && typeof value === 'object' && typeof (value as Entry).type === 'string') out.push(value as Entry)
    } catch {
      if (i === lines.length - 1) break
    }
  }
  return out
}

/** Folds the journal's entries over the stages seen so far. */
export function applyEntries(prev: Stage[], entries: Entry[], now: number): Stage[] {
  const byKey = new Map(prev.map(s => [s.key, s]))
  const order = prev.map(s => s.key)
  for (const e of entries) {
    if (!e.key) continue
    if (e.type === 'started') {
      const known = byKey.get(e.key)
      if (known) {
        byKey.set(e.key, { ...known, agentId: e.agentId ?? known.agentId, label: e.label ?? known.label, phase: e.phase ?? known.phase })
      } else {
        byKey.set(e.key, {
          key: e.key,
          agentId: e.agentId ?? null,
          label: e.label ?? e.key.slice(0, 12),
          phase: e.phase ?? '',
          startedAt: now,
          endedAt: null,
          summary: null,
          isEmpty: false,
          isFailed: false,
          alias: null,
          model: null,
          effort: null,
          outputTokens: 0,
          calls: 0,
          lastTool: null,
          isSettled: false,
        })
        order.push(e.key)
      }
    } else if (e.type === 'result') {
      const known = byKey.get(e.key)
      if (!known) continue
      if (known.endedAt !== null) continue
      const isEmpty = e.result === null || e.result === undefined
      byKey.set(e.key, { ...known, endedAt: now, isEmpty, isFailed: !isEmpty && isFailure(e.result), summary: isEmpty ? '(no result)' : summarize(known.label, e.result) })
    }
  }
  return order.map(k => byKey.get(k) as Stage)
}

type Rec = Record<string, unknown>
const rec = (r: unknown): Rec => (r && typeof r === 'object' ? (r as Rec) : {})

/** A result that reports a failure: a failing verdict, `ok: false`, or findings the fixer left disputed. */
export function isFailure(result: unknown): boolean {
  const r = rec(result)
  return r.verdict === 'fail' || r.ok === false || (Array.isArray(r.notFixed) && r.notFixed.length > 0)
}

/** What a transcript (agent-<id>.jsonl) says about its stage so far. */
export type TranscriptFacts = { model: string | null; effort: string | null; outputTokens: number; calls: number; lastTool: string | null }

/** Reads model, effort, output tokens and tool calls off a transcript's lines. */
export function readTranscript(text: string): TranscriptFacts {
  const facts: TranscriptFacts = { model: null, effort: null, outputTokens: 0, calls: 0, lastTool: null }
  for (const line of text.split('\n')) {
    if (!line) continue
    let e: Rec
    try {
      e = rec(JSON.parse(line))
    } catch {
      continue
    }
    const msg = rec(e.message)
    if (e.type === 'assistant') {
      if (typeof msg.model === 'string') facts.model = msg.model
      if (typeof e.effort === 'string') facts.effort = e.effort
      const usage = rec(msg.usage)
      if (typeof usage.output_tokens === 'number') facts.outputTokens += usage.output_tokens
    }
    const content = msg.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const b = rec(block)
      if (b.type !== 'tool_use') continue
      facts.calls += 1
      const input = rec(b.input)
      const arg = [input.command, input.file_path, input.pattern, input.description].find(v => typeof v === 'string') as string | undefined
      facts.lastTool = `${String(b.name ?? '?')}${arg ? ' ' + arg.replace(/\s+/g, ' ').slice(0, 50) : ''}`
    }
  }
  return facts
}

/** The alias the script asked for, from agent-<id>.meta.json. */
export function readMeta(text: string): string | null {
  try {
    const m = rec(JSON.parse(text))
    return typeof m.model === 'string' ? m.model : null
  } catch {
    return null
  }
}

const count = (a: unknown): number => (Array.isArray(a) ? a.length : 0)
const str = (v: unknown, n = 80): string => String(v ?? '').replace(/\s+/g, ' ').slice(0, n)

/**
 * One line per stage result. The alon-skills build-loop labels are known
 * (plan, scout, spec, research, build, measure, refute, arbiter, fix, close);
 * any other label gets a short generic line.
 */
export function summarize(label: string, result: unknown): string {
  const role = label.split(':')[0] ?? ''
  if (typeof result === 'string') return str(result, 100)
  const r = rec(result)
  switch (role) {
    case 'plan': {
      const stale = rec(r.staleBlocked)
      if (r.staleBlocked) return `stale row ${str(stale.taskId)}: ${str(stale.reason)}`
      return r.taskId ? `picked ${str(r.taskId)} on ${str(r.branch)}${r.resuming ? ' (resuming)' : ''}` : `stop: ${str(r.stopReason)}`
    }
    case 'scout':
      return `${count(r.files)} files, ${count(r.tests)} tests, ${count(r.docSections)} doc sections`
    case 'spec':
      return r.stopReason ? `stop: ${str(r.stopReason)}` : `spec at ${str(r.specPath)}; docs changed ${count(r.docsChanged)}; unverified APIs ${count(r.unverifiedApis)}`
    case 'research':
      return `research at ${str(r.researchPath)}; still unverified ${count(r.unverifiedRemaining)}`
    case 'build':
      return `ok=${String(r.ok)} commits=${count(r.commits)} tests=${r.testsPassed ? 'pass' : 'FAIL'} lint=${r.lintPassed ? 'pass' : 'FAIL'} deviations=${count(r.deviations)}${r.blockedReason ? ` BLOCKED: ${str(r.blockedReason)}` : ''}`
    case 'measure':
      return `${String(r.filesChanged)} files, ${String(r.linesChanged)} lines${r.docsOnly ? ', docs only' : ''}${r.touchesTrustBoundary ? ', trust boundary' : ''}`
    case 'refute': {
      const first = rec((r.blocking as unknown[] | undefined)?.[0])
      const head = `${String(r.verdict).toUpperCase()} blocking=${count(r.blocking)} advisory=${count(r.advisory)} testsRan=${String(r.testsRan)}`
      return first.issue ? `${head} | ${str(first.file)}: ${str(first.issue, 60)}` : head
    }
    case 'arbiter':
      return ((r.rulings as unknown[] | undefined) ?? []).map(x => `${str(rec(x).key)} ${str(rec(x).ruling)}`).join('; ') || 'no rulings'
    case 'fix':
      return `fixed=${count(r.fixed)} disputed=${count(r.notFixed)} commits=${count(r.commits)}`
    case 'close':
      return r.ok ? `row updated, commit ${str(r.commit) || '?'}` : 'close reported not ok'
    default:
      return str(JSON.stringify(result), 100)
  }
}

/**
 * Stages in run order, cut where the phase changes: each stretch of one phase
 * gets its own divider, so a second refute round is not folded into the first.
 */
export function phaseRuns(stages: Stage[]): Array<{ phase: string; stages: Stage[] }> {
  const runs: Array<{ phase: string; stages: Stage[] }> = []
  for (const s of stages) {
    const last = runs[runs.length - 1]
    if (last && last.phase === s.phase) last.stages.push(s)
    else runs.push({ phase: s.phase, stages: [s] })
  }
  return runs
}

export const running = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt === null)
export const finished = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt !== null)
const failed = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt !== null && (s.isEmpty || s.isFailed === true))

/** `0:46`, `15:03`: minutes unpadded. */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const many = (n: number, one: string, more: string): string => `${n} ${n === 1 ? one : more}`

/** The stage's state as a glyph and a word, so it never rests on color alone. */
export function state(s: Stage): string {
  if (s.endedAt === null) return '▶ running'
  if (s.isEmpty) return '✗ no result'
  if (s.isFailed === true) return '! failed'
  return '✓ done'
}

/** The theme color that goes with the state. */
export function tone(s: Stage): 'warning' | 'error' | 'success' {
  if (s.endedAt === null) return 'warning'
  return s.isEmpty || s.isFailed === true ? 'error' : 'success'
}

/** `fable→claude-fable-5-1 high`: what ran the stage, at which effort (`n/a` for a model that records none). */
export function who(s: Stage): string {
  const model = s.alias && s.model ? `${s.alias}→${s.model}` : (s.model ?? s.alias ?? '?')
  return `${model} ${s.effort ?? 'n/a'}`
}

/** The head of a stage's block after its state: `build:1.2  sonnet→claude-sonnet-5-5 medium`. */
export function stageTitle(s: Stage): string {
  return `${s.label}  ${who(s)}`
}

/** The result in one line, or `no result yet` while the stage runs. */
export function stageResult(s: Stage): string {
  return s.endedAt === null ? 'no result yet' : (s.summary ?? '')
}

/**
 * The details as one compact line, the element tables having no fold:
 * `Ran for 0:46 · 5 tools · 0.8k tokens`, or `Running for 0:12 · 3 calls · Bash npm test`.
 */
export function stageDetail(s: Stage, now: number): string {
  const isLive = s.endedAt === null
  const time = elapsed((isLive ? now : (s.endedAt as number)) - s.startedAt)
  if (isLive) return `Running for ${time} · ${many(s.calls, 'call', 'calls')} · ${s.lastTool ?? 'starting…'}`
  return `Ran for ${time} · ${many(s.calls, 'tool', 'tools')} · ${(s.outputTokens / 1000).toFixed(1)}k tokens`
}

/** One stage as a block: the head line, then its result and its details indented under it. */
export function stageLines(s: Stage, now: number): string[] {
  return [`${state(s)}  ${stageTitle(s)}`, `    ${stageResult(s)}`, `    ${stageDetail(s, now)}`]
}

/** The one-line status: the state as glyph and word, what runs now, and the tally. */
export function statusLine(w: Watch): string | undefined {
  if (!w.run || w.stages.length === 0) return undefined
  const live = running(w)
  const bad = failed(w).length
  const tally = `${finished(w).length} done${bad ? `, ${bad} failed` : ''}`
  if (live.length === 0) return `${w.run}: ${bad ? '!' : '✓'} finished, ${tally}`
  const first = live[0] as Stage
  if (live.length === 1) return `${w.run}: ▶ running ${first.label} (${who(first)}), ${tally}`
  const names = live.map(s => s.label).join(', ')
  return `${w.run}: ▶ ${live.length} running (${names.slice(0, 60)}${names.length > 60 ? '…' : ''}), ${tally}`
}

/** The whole picture as plain text: what the command prints, the same blocks the pane draws. */
export function report(w: Watch): string {
  const live = running(w)
  const done = finished(w)
  const lines = [`${w.run}: ${live.length} running, ${done.length} done`]
  for (const g of phaseRuns(w.stages)) {
    lines.push(`── ${g.phase || '(no phase)'}`)
    for (const s of g.stages) lines.push(...stageLines(s, w.now))
  }
  return lines.join('\n')
}
