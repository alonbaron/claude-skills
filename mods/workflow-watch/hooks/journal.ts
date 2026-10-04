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
      byKey.set(e.key, { ...known, endedAt: now, isEmpty, summary: isEmpty ? '(no result)' : summarize(known.label, e.result) })
    }
  }
  return order.map(k => byKey.get(k) as Stage)
}

type Rec = Record<string, unknown>
const rec = (r: unknown): Rec => (r && typeof r === 'object' ? (r as Rec) : {})

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

/** Stages in journal order, grouped by phase in first-seen order. */
export function groupByPhase(stages: Stage[]): Array<{ phase: string; stages: Stage[] }> {
  const groups: Array<{ phase: string; stages: Stage[] }> = []
  for (const s of stages) {
    const g = groups.find(x => x.phase === s.phase)
    if (g) g.stages.push(s)
    else groups.push({ phase: s.phase, stages: [s] })
  }
  return groups
}

export const running = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt === null)
export const finished = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt !== null)

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** `fable→claude-fable-5-1 high 0.8k`: what ran the stage and what it cost. */
export function who(s: Stage): string {
  const model = s.alias && s.model ? `${s.alias}→${s.model}` : (s.model ?? s.alias ?? '?')
  const tokens = s.outputTokens >= 1000 ? `${(s.outputTokens / 1000).toFixed(1)}k` : String(s.outputTokens)
  return `${model} ${s.effort ?? 'n/a'} ${tokens}`
}

/** One stage as a line: glyph, time, label, who ran it, then the live tool or the result. */
export function stageLine(s: Stage, now: number): string {
  const isLive = s.endedAt === null
  const glyph = isLive ? '▶' : s.isEmpty ? '✗' : '✓'
  const time = elapsed((isLive ? now : (s.endedAt as number)) - s.startedAt)
  const tail = isLive ? (s.lastTool ? `${s.calls} calls · ${s.lastTool}` : 'starting…') : (s.summary ?? '')
  return `${glyph} ${time}  ${s.label}  [${who(s)}]  ${tail}`
}

/** The one-line status: what runs now, and the tally. */
export function statusLine(w: Watch): string | undefined {
  if (!w.run || w.stages.length === 0) return undefined
  const live = running(w)
  const done = finished(w).length
  if (live.length === 0) return `${w.run}: done, ${done} stages`
  const names = live.map(s => s.label).join(', ')
  return `${w.run}: ${live.length} running (${names.slice(0, 60)}${names.length > 60 ? '…' : ''}), ${done} done`
}

/** The whole picture as plain text: what the command prints, the same lines the pane draws. */
export function report(w: Watch): string {
  const live = running(w)
  const done = finished(w)
  const lines = [`${w.run}: ${live.length} running, ${done.length} done`]
  for (const g of groupByPhase(w.stages)) {
    lines.push(`${g.phase || '(no phase)'}:`)
    for (const s of g.stages) lines.push(`  ${stageLine(s, w.now)}`)
  }
  return lines.join('\n')
}
