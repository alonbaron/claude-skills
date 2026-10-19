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
        byKey.set(e.key, { ...known, agentId: e.agentId ?? known.agentId, label: e.label !== undefined ? oneLine(e.label) : known.label, phase: e.phase !== undefined ? oneLine(e.phase) : known.phase })
      } else {
        byKey.set(e.key, {
          key: e.key,
          agentId: e.agentId ?? null,
          label: oneLine(e.label ?? e.key.slice(0, 12)),
          phase: oneLine(e.phase ?? ''),
          startedAt: now,
          endedAt: null,
          summary: null,
          isEmpty: false,
          isFailed: false,
          isDisputed: false,
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
    } else if (e.type === 'result' || e.type === 'failed') {
      const known = byKey.get(e.key)
      if (!known) continue
      if (known.endedAt !== null) continue
      // `failed`: the stage died before it returned (a session limit, an API error), so there is no result.
      const died = e.type === 'failed'
      const isEmpty = died || e.result === null || e.result === undefined
      const summary = died ? '(stopped without a result)' : isEmpty ? '(no result)' : oneLine(summarize(known.label, e.result))
      byKey.set(e.key, { ...known, endedAt: now, isEmpty, isFailed: !isEmpty && isFailure(e.result), isDisputed: !isEmpty && isDispute(e.result), summary })
    }
  }
  return order.map(k => byKey.get(k) as Stage)
}

type Rec = Record<string, unknown>
const rec = (r: unknown): Rec => (r && typeof r === 'object' ? (r as Rec) : {})

/** A result that reports a failure: a failing verdict or `ok: false`. */
export function isFailure(result: unknown): boolean {
  const r = rec(result)
  return r.verdict === 'fail' || r.ok === false
}

/** A fix round that left findings disputed: the arbiter rules on them next, so it is neither a pass nor a failure. */
export function isDispute(result: unknown): boolean {
  const r = rec(result)
  return Array.isArray(r.notFixed) && r.notFixed.length > 0
}

/** What a transcript (agent-<id>.jsonl) says about its stage so far; `first` and `last` are its timestamps in epoch ms. */
export type TranscriptFacts = {
  model: string | null
  effort: string | null
  outputTokens: number
  calls: number
  lastTool: string | null
  first: number | null
  last: number | null
  handback?: string | null
  lastText?: string | null
}

/** Reads model, effort, output tokens, tool calls and the first and last timestamps off a transcript's lines (Claude Code or Antigravity). */
export function readTranscript(text: string): TranscriptFacts {
  const facts: TranscriptFacts = { model: null, effort: null, outputTokens: 0, calls: 0, lastTool: null, first: null, last: null, handback: null, lastText: null }
  const seenMsgTokens = new Map<string, number>()
  for (const line of text.split('\n')) {
    if (!line) continue
    let e: Rec
    try {
      e = rec(JSON.parse(line))
    } catch {
      continue
    }
    const rawTs = typeof e.timestamp === 'string' ? e.timestamp : typeof e.created_at === 'string' ? e.created_at : null
    const at = rawTs ? Date.parse(rawTs) : NaN
    if (Number.isFinite(at)) {
      facts.first = facts.first ?? at
      facts.last = at
    }
    if (e.type === 'PLANNER_RESPONSE') {
      if (typeof e.output_tokens === 'number') facts.outputTokens += e.output_tokens
      if (typeof e.content === 'string' && oneLine(e.content)) facts.lastText = str(e.content, 100)
      if (Array.isArray(e.tool_calls)) {
        for (const tc of e.tool_calls) {
          const t = rec(tc)
          const name = oneLine(t.name ?? '?')
          const args = rec(t.args)
          if (name === 'send_message') {
            const msgText = unquoteArg(args.Message)
            if (oneLine(msgText)) facts.handback = str(msgText, 100)
            continue
          }
          facts.calls += 1
          const arg = [args.CommandLine, args.AbsolutePath, args.TargetFile, args.query, args.Url, args.toolSummary].map(unquoteArg).find(v => v.length > 0)
          facts.lastTool = `${name}${arg ? ' ' + str(arg, 50) : ''}`
        }
      }
      continue
    }
    const msg = rec(e.message)
    if (e.type === 'assistant') {
      // `<synthetic>` is the client's own message when a call fails (a session limit, an API error), not a model.
      if (typeof msg.model === 'string' && msg.model !== '<synthetic>') facts.model = oneLine(msg.model)
      if (typeof e.effort === 'string') facts.effort = oneLine(e.effort)
      const usage = rec(msg.usage)
      if (typeof usage.output_tokens === 'number') {
        if (typeof msg.id === 'string') {
          const prevTok = seenMsgTokens.get(msg.id) ?? 0
          if (usage.output_tokens > prevTok) {
            facts.outputTokens += usage.output_tokens - prevTok
            seenMsgTokens.set(msg.id, usage.output_tokens)
          }
        } else {
          facts.outputTokens += usage.output_tokens
        }
      }
    }
    const content = msg.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const b = rec(block)
      if (b.type === 'text' && typeof b.text === 'string' && oneLine(b.text)) {
        facts.lastText = str(b.text, 100)
      }
      if (b.type !== 'tool_use') continue
      const input = rec(b.input)
      if (b.name === 'SubagentHandback') {
        if (typeof input.message === 'string' && oneLine(input.message)) facts.handback = str(input.message, 100)
        continue
      }
      facts.calls += 1
      const arg = [input.command, input.file_path, input.pattern, input.description].find(v => typeof v === 'string') as string | undefined
      facts.lastTool = `${oneLine(b.name ?? '?')}${arg ? ' ' + str(arg, 50) : ''}`
    }
  }
  return facts
}

/**
 * The stage with what its transcript says. Its times come from the transcript's own timestamps once
 * there are any, so a stage first seen after it finished still shows how long it ran.
 */
export function withFacts(s: Stage, facts: TranscriptFacts): Stage {
  const { first, last, handback, lastText, ...rest } = facts
  const endedAt = s.endedAt !== null ? (last ?? s.endedAt) : s.kind === 'agent' && handback ? (last ?? s.startedAt) : null
  const summary = s.kind === 'agent' ? (handback ?? s.summary ?? (endedAt !== null ? lastText : null) ?? null) : s.summary
  const model = rest.model ?? s.model
  const effort = rest.effort ?? s.effort
  const alias = s.alias ?? (s.kind === 'agent' ? inferAlias(model) : null)
  return { ...s, ...rest, model, effort, alias, summary, startedAt: first ?? s.startedAt, endedAt, isSettled: endedAt !== null }
}

/** Full metadata from agent-<id>.meta.json for linking session subagents by toolUseId. */
export function readMetaInfo(text: string): { model: string | null; description: string | null; toolUseId: string | null } {
  try {
    const m = rec(JSON.parse(text))
    return {
      model: typeof m.model === 'string' && oneLine(m.model) ? oneLine(m.model) : null,
      description: typeof m.description === 'string' && oneLine(m.description) ? oneLine(m.description) : null,
      toolUseId: typeof m.toolUseId === 'string' && oneLine(m.toolUseId) ? oneLine(m.toolUseId) : null,
    }
  } catch {
    return { model: null, description: null, toolUseId: null }
  }
}

/** The alias the script asked for, from agent-<id>.meta.json. */
export const readMeta = (text: string): string | null => readMetaInfo(text).model

/** Infers the short tier alias (`fable`, `opus`, `sonnet`, `haiku`, `gemini`) from a resolved model id. */
export function inferAlias(model: string | null): string | null {
  if (!model) return null
  const m = model.toLowerCase()
  if (m.includes('fable')) return 'fable'
  if (m.includes('opus')) return 'opus'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('gemini') || m.includes('argon')) return 'gemini'
  return null
}

const count = (a: unknown): number => (Array.isArray(a) ? a.length : 0)
/** One line: each run of whitespace and control characters (which the host refuses to draw) becomes one space. */
const oneLine = (v: unknown): string => String(v ?? '').replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ').trim()
/** At most n characters; a cut ends in `…`. */
export const clip = (text: string, n: number): string => (text.length <= n ? text : n <= 0 ? '' : `${text.slice(0, n - 1)}…`)
const str = (v: unknown, n = 80): string => clip(oneLine(v), n)

function unquoteArg(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
    try {
      const parsed: unknown = JSON.parse(s)
      if (typeof parsed === 'string') return parsed
    } catch {
      /* keep raw string */
    }
  }
  // A JSON-quoted value cut short by transcript truncation: drop the opening quote and undo the escapes.
  if (s.startsWith('"')) return s.slice(1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  return s
}

const toolResultText = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(b => (typeof rec(b).text === 'string' ? String(rec(b).text) : '')).join('\n')
      : ''

function cleanPrompt(content: unknown): string | null {
  if (Array.isArray(content) && content.every(b => rec(b).type === 'tool_result')) return null
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter(b => rec(b).type === 'text')
            .map(b => String(rec(b).text ?? ''))
            .join(' ')
        : ''
  const stripped = raw
    .replace(/<browser_instruction>[\s\S]*?<\/browser_instruction>/gi, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .trim()
  if (!stripped || /^<(task-notification|command-name|local-command-|agent-message)/i.test(stripped)) return null
  return oneLine(stripped) || null
}

/**
 * Parses a main session transcript (`<sessionId>.jsonl`) into stages:
 * main-thread turns (`turn:N`), skill activations (`skill:<name>`), spawned subagents (`agent:<desc>`),
 * and git commits (`commit:<sha>`).
 */
export function parseSession(text: string, now: number): Stage[] {
  const stages: Stage[] = []
  const pendingAgents = new Map<string, Stage>()
  const agentsById = new Map<string, Stage>()
  const pendingCommits = new Map<string, { cmd: string; phase: string; alias: string | null; model: string | null; effort: string | null; at: number }>()
  const seenCommits = new Set<string>()
  const seenMsgTokens = new Map<string, number>()
  let turnCount = 0
  let currentTurn: Stage | null = null
  let currentPhase = 'Session'
  let lastTurnAt = now

  const openTurn = (at: number, summary: string | null): Stage => {
    turnCount += 1
    currentPhase = `Turn ${turnCount}`
    lastTurnAt = at
    const turn: Stage = {
      kind: 'turn',
      key: `turn:${turnCount}`,
      agentId: null,
      label: `turn:${turnCount}`,
      phase: currentPhase,
      startedAt: at,
      endedAt: null,
      summary,
      isEmpty: false,
      isFailed: false,
      isDisputed: false,
      alias: null,
      model: null,
      effort: null,
      outputTokens: 0,
      calls: 0,
      lastTool: null,
      isSettled: false,
    }
    stages.push(turn)
    return turn
  }

  const recordCommit = (id: string, pc: { cmd: string; phase: string; alias: string | null; model: string | null; effort: string | null; at: number }, out: string, t: number): void => {
    if (/nothing to commit/i.test(out)) return
    const std = /\[([^\s\]]+)\s+([0-9a-f]{7,12})\]\s*([^\r\n]+)/.exec(out)
    const mFlag = /\bgit\s+(?:-C\s+\S+\s+)?commit\b[^;&|]*?-m\s+(?:"([^"]+)"|'([^']+)')/.exec(pc.cmd)
    const subject = oneLine(std?.[3] ?? mFlag?.[1] ?? mFlag?.[2] ?? 'git commit')
    const shaLine = subject
      ? out
          .split(/\r?\n/)
          .map(l => /^([0-9a-f]{7,12})\s+(.+)/.exec(l.replace(/\u001b\[[0-9;]*m/g, '')))
          .find(m => m && m[2]?.includes(subject.slice(0, 20)))
      : undefined
    const sha = std?.[2] ?? shaLine?.[1] ?? null
    const dedupKey = sha ?? subject
    if (seenCommits.has(dedupKey)) return
    seenCommits.add(dedupKey)
    stages.push({
      kind: 'commit',
      key: `commit:${id}`,
      agentId: null,
      label: sha ? `commit:${sha}` : 'commit',
      phase: pc.phase,
      startedAt: pc.at,
      endedAt: t,
      summary: str(subject, 100),
      isEmpty: false,
      isFailed: false,
      isDisputed: false,
      alias: pc.alias,
      model: pc.model,
      effort: pc.effort,
      outputTokens: 0,
      calls: 1,
      lastTool: 'Bash git commit',
      isSettled: true,
    })
  }

  let agyModel: string | null = null
  let agyEffort: string | null = null
  let agyAlias: string | null = null
  const pendingAgyAgents: Stage[] = []
  // Set by invoke_subagent; only the next "Created the following subagents" result is a real spawn (not a tool output quoting it).
  let awaitingSubagents = false
  const pendingAgyCommits: Array<{ id: string; cmd: string; phase: string; alias: string | null; model: string | null; effort: string | null; at: number }> = []
  const seenTurnSkills = new Set<string>()

  const lines = text.split('\n').filter(l => l.length > 0)
  for (let i = 0; i < lines.length; i++) {
    let e: Rec
    try {
      e = rec(JSON.parse(lines[i] as string))
    } catch {
      if (i === lines.length - 1) break
      continue
    }
    const rawTs = typeof e.timestamp === 'string' ? e.timestamp : typeof e.created_at === 'string' ? e.created_at : null
    const at = rawTs ? Date.parse(rawTs) : NaN
    const t = Number.isFinite(at) ? at : now
    const msg = rec(e.message)

    if (e.type === 'USER_INPUT') {
      const rawContent = typeof e.content === 'string' ? e.content : ''
      const modelMatch = /Model Selection[^\r\n]*? to ([^\r\n.]+)/i.exec(rawContent)?.[1]
      if (modelMatch) {
        const me = /^(.+?)\s*\((Low|Medium|High|Max)\)$/i.exec(modelMatch.trim())
        agyModel = oneLine(me ? me[1] : modelMatch)
        if (me?.[2]) agyEffort = oneLine(me[2].toLowerCase())
        agyAlias = inferAlias(agyModel)
      }
      const reqMatch = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i.exec(rawContent)?.[1]
      const cleaned = oneLine(reqMatch ?? rawContent.replace(/<(ADDITIONAL_METADATA|USER_SETTINGS_CHANGE)>[\s\S]*?<\/\1>/gi, ''))
      if (cleaned) {
        if (currentTurn && currentTurn.endedAt === null) {
          currentTurn.endedAt = lastTurnAt
          currentTurn.isSettled = true
        }
        seenTurnSkills.clear()
        currentTurn = openTurn(t, str(cleaned, 100))
        currentTurn.model = agyModel ?? 'gemini'
        currentTurn.alias = agyAlias ?? 'gemini'
        currentTurn.effort = agyEffort
      }
      continue
    }

    if (e.type === 'PLANNER_RESPONSE') {
      if (!currentTurn) {
        currentTurn = openTurn(t, null)
        currentTurn.model = agyModel ?? 'gemini'
        currentTurn.alias = agyAlias ?? 'gemini'
        currentTurn.effort = agyEffort
      }
      lastTurnAt = t
      if (typeof e.output_tokens === 'number') currentTurn.outputTokens += e.output_tokens
      if (typeof e.content === 'string' && oneLine(e.content)) currentTurn.summary = str(e.content, 100)
      const tcs = Array.isArray(e.tool_calls) ? e.tool_calls : []
      if (tcs.length === 0) {
        currentTurn.endedAt = t
        currentTurn.isSettled = true
        continue
      }
      currentTurn.endedAt = null
      currentTurn.isSettled = false
      for (const tc of tcs) {
        const b = rec(tc)
        const name = oneLine(b.name ?? '?')
        const args = rec(b.args)
        if (name === 'send_message') continue
        currentTurn.calls += 1
        const arg = [args.CommandLine, args.AbsolutePath, args.TargetFile, args.query, args.Url, args.toolSummary].map(unquoteArg).find(v => v.length > 0)
        currentTurn.lastTool = `${name}${arg ? ' ' + str(arg, 50) : ''}`
        const id = `step_${String(e.step_index ?? stages.length)}_${currentTurn.calls}`

        const pathArg = unquoteArg(args.AbsolutePath)
        const skillMatch = name === 'view_file' ? /[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/i.exec(pathArg)?.[1] : undefined
        if (skillMatch) {
          const shortSkill = oneLine(skillMatch).replace(/_/g, '-')
          if (!seenTurnSkills.has(shortSkill)) {
            seenTurnSkills.add(shortSkill)
            currentPhase = `Skill · ${shortSkill}`
            stages.push({
              kind: 'skill',
              key: `skill:${id}`,
              agentId: null,
              label: `skill:${shortSkill}`,
              phase: currentPhase,
              startedAt: t,
              endedAt: t,
              summary: `Activated /${shortSkill}`,
              isEmpty: false,
              isFailed: false,
              isDisputed: false,
              alias: currentTurn.alias,
              model: currentTurn.model,
              effort: currentTurn.effort,
              outputTokens: 0,
              calls: 1,
              lastTool: `Skill ${shortSkill}`,
              isSettled: true,
            })
          }
        } else if (name === 'invoke_subagent') {
          awaitingSubagents = true
          let list: unknown[] = Array.isArray(args.Subagents) ? args.Subagents : []
          const rawSubs = unquoteArg(args.Subagents)
          if (!list.length && rawSubs) try {
            const parsed: unknown = JSON.parse(rawSubs)
            if (Array.isArray(parsed)) list = parsed
          } catch {
            for (const m of rawSubs.matchAll(/"Role"\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
              list.push({ Role: m[1]?.replace(/\\"/g, '"') })
            }
          }
          for (let sIdx = 0; sIdx < list.length; sIdx++) {
            const sub = rec(list[sIdx])
            const desc = oneLine(sub.Role) || oneLine(sub.TypeName) || 'subagent'
            const reqModel = oneLine(sub.Model)
            const reqAlias = reqModel && reqModel !== 'inherit' ? reqModel : currentTurn.alias
            const ag: Stage = {
              kind: 'agent',
              key: `agent:${id}_${sIdx}`,
              agentId: null,
              label: `agent:${clip(desc, 42)}`,
              phase: currentPhase,
              startedAt: t,
              endedAt: null,
              summary: null,
              isEmpty: false,
              isFailed: false,
              isDisputed: false,
              alias: reqAlias,
              model: currentTurn.model,
              effort: currentTurn.effort,
              outputTokens: 0,
              calls: 0,
              lastTool: null,
              isSettled: false,
            }
            pendingAgyAgents.push(ag)
            stages.push(ag)
          }
        } else if (name === 'run_command') {
          const cmd = unquoteArg(args.CommandLine)
          if (/(?:^|[;&|\r\n])\s*git\s+(?:-C\s+\S+\s+)?commit\b/.test(cmd)) {
            pendingAgyCommits.push({ id, cmd, phase: currentPhase, alias: currentTurn.alias, model: currentTurn.model, effort: currentTurn.effort, at: t })
          }
        }
      }
      continue
    }

    if (e.type === 'GENERIC') {
      const raw = typeof e.content === 'string' ? e.content : ''
      if (awaitingSubagents && raw.includes('Created the following subagents:')) {
        awaitingSubagents = false
        let sIdx = 0
        for (const m of raw.matchAll(/"conversationId":\s*"([a-zA-Z0-9_-]+)"/g)) {
          const cid = m[1]
          if (cid && agentsById.has(cid)) continue
          let ag = pendingAgyAgents.shift()
          if (!ag && cid) {
            ag = {
              kind: 'agent',
              key: `agent:agy_${t}_${sIdx}`,
              agentId: cid,
              label: `agent:${clip(cid, 12)}`,
              phase: currentPhase,
              startedAt: t,
              endedAt: null,
              summary: null,
              isEmpty: false,
              isFailed: false,
              isDisputed: false,
              alias: currentTurn?.alias ?? null,
              model: currentTurn?.model ?? null,
              effort: currentTurn?.effort ?? null,
              outputTokens: 0,
              calls: 0,
              lastTool: null,
              isSettled: false,
            }
            stages.push(ag)
          }
          if (cid && ag) {
            ag.agentId = cid
            agentsById.set(cid, ag)
          }
          sIdx++
        }
        pendingAgyAgents.length = 0
      } else if (pendingAgyCommits.length > 0 && raw.includes('The command exited with code')) {
        const pc = pendingAgyCommits.shift()
        if (pc && raw.includes('The command exited with code 0')) recordCommit(pc.id, pc, raw, t)
      }
      continue
    }

    if (e.type === 'SYSTEM_MESSAGE') {
      const raw = typeof e.content === 'string' ? e.content : ''
      for (const m of raw.matchAll(/\[Message\]\s+timestamp=[^\s]+\s+sender=([^\s]+)\s+priority=[^\s]+\s+content=([\s\S]*?)(?=\n\[Message\]|<\/SYSTEM_MESSAGE>|$)/g)) {
        const sender = oneLine(m[1])
        const body = m[2] ?? ''
        if (sender === 'system' && /subagents and background tasks have been stopped/i.test(body)) {
          for (const s of stages) {
            if (s.kind === 'agent' && s.endedAt === null) {
              s.endedAt = t
              s.isFailed = true
              s.summary = s.summary ?? '(stopped by server restart)'
            }
          }
        } else if (sender && agentsById.has(sender)) {
          const ag = agentsById.get(sender) as Stage
          if (ag.endedAt === null) ag.endedAt = t
          if (!ag.summary && oneLine(body)) ag.summary = str(body, 100)
        }
      }
      continue
    }

    if (e.type === 'user') {
      const rawContent = toolResultText(msg.content)
      if (rawContent && (rawContent.includes('<agent-message') || rawContent.includes('<task-'))) {
        const am = /<agent-message\s+from="([^"]+)"[^>]*>([\s\S]*?)<\/agent-message>/i.exec(rawContent)
        const tnId = /<task-id>([^<]+)<\/task-id>/i.exec(rawContent)?.[1]
        const tnTool = /<tool-use-id>([^<]+)<\/tool-use-id>/i.exec(rawContent)?.[1]
        const aid = oneLine(am?.[1] ?? tnId)
        const ag = (aid ? agentsById.get(aid) : undefined) ?? (tnTool ? pendingAgents.get(oneLine(tnTool)) : undefined)
        if (ag) {
          if (aid && !ag.agentId) {
            ag.agentId = aid
            agentsById.set(aid, ag)
          }
          if (ag.endedAt === null) ag.endedAt = t
          if (ag.phase) currentPhase = ag.phase
          if (/<status>failed<\/status>/i.test(rawContent)) ag.isFailed = true
          if (am?.[2] && !ag.summary) ag.summary = str(am[2].replace(/^\[Subagent\s+[^\]]+\]\s*/i, ''), 100)
        }
      }

      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          const b = rec(block)
          if (b.type !== 'tool_result') continue
          const id = String(b.tool_use_id ?? '')
          const ag = pendingAgents.get(id)
          if (ag) {
            const tr = rec(e.toolUseResult)
            if (typeof tr.agentId === 'string' && oneLine(tr.agentId)) {
              ag.agentId = oneLine(tr.agentId)
              agentsById.set(ag.agentId, ag)
            }
            if (typeof tr.resolvedModel === 'string' && oneLine(tr.resolvedModel) && !ag.model) {
              ag.model = oneLine(tr.resolvedModel)
              ag.alias = ag.alias ?? inferAlias(ag.model)
            }
            const isAsync = tr.isAsync === true || tr.status === 'async_launched'
            if (b.is_error === true) {
              ag.endedAt = t
              ag.isFailed = true
              ag.summary = str(toolResultText(b.content), 100) || '(agent failed)'
            } else if (!isAsync) {
              ag.endedAt = t
              const outTxt = toolResultText(b.content)
              if (outTxt && !ag.summary) ag.summary = str(outTxt, 100)
            }
          }
          const pc = pendingCommits.get(id)
          if (pc) {
            pendingCommits.delete(id)
            if (b.is_error !== true) {
              const out = `${toolResultText(b.content)}\n${typeof rec(e.toolUseResult).stdout === 'string' ? String(rec(e.toolUseResult).stdout) : ''}`
              recordCommit(id, pc, out, t)
            }
          }
        }
      }

      if (!e.isMeta) {
        const prompt = cleanPrompt(msg.content)
        if (prompt) {
          if (currentTurn && currentTurn.endedAt === null) {
            currentTurn.endedAt = lastTurnAt
            currentTurn.isSettled = true
          }
          currentTurn = openTurn(t, str(prompt, 100))
        }
      }
    } else if (e.type === 'assistant') {
      if (!currentTurn) currentTurn = openTurn(t, null)
      lastTurnAt = t
      if (typeof msg.model === 'string' && msg.model !== '<synthetic>') {
        currentTurn.model = oneLine(msg.model)
        currentTurn.alias = inferAlias(currentTurn.model)
      }
      if (typeof e.effort === 'string') currentTurn.effort = oneLine(e.effort)
      const usage = rec(msg.usage)
      if (typeof usage.output_tokens === 'number') {
        if (typeof msg.id === 'string') {
          const prevTok = seenMsgTokens.get(msg.id) ?? 0
          if (usage.output_tokens > prevTok) {
            currentTurn.outputTokens += usage.output_tokens - prevTok
            seenMsgTokens.set(msg.id, usage.output_tokens)
          }
        } else {
          currentTurn.outputTokens += usage.output_tokens
        }
      }
      if (msg.stop_reason === 'end_turn') {
        currentTurn.endedAt = t
        currentTurn.isSettled = true
      } else if (msg.stop_reason === 'tool_use') {
        currentTurn.endedAt = null
        currentTurn.isSettled = false
      }

      const content = msg.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        const b = rec(block)
        if (b.type === 'text' && typeof b.text === 'string' && oneLine(b.text)) {
          currentTurn.summary = str(b.text, 100)
        }
        if (b.type !== 'tool_use') continue
        currentTurn.calls += 1
        const input = rec(b.input)
        const arg = [input.command, input.file_path, input.pattern, input.description, input.skill].find(v => typeof v === 'string') as string | undefined
        currentTurn.lastTool = `${oneLine(b.name ?? '?')}${arg ? ' ' + str(arg, 50) : ''}`
        const id = String(b.id ?? stages.length)

        if (b.name === 'Skill') {
          const rawSkill = oneLine(input.skill) || 'skill'
          const shortSkill = rawSkill.replace(/^alon-skills:/, '')
          currentPhase = `Skill · ${shortSkill}`
          stages.push({
            kind: 'skill',
            key: `skill:${id}`,
            agentId: null,
            label: `skill:${shortSkill}`,
            phase: currentPhase,
            startedAt: t,
            endedAt: t,
            summary: oneLine(input.args) ? str(input.args, 100) : `Activated /${shortSkill}`,
            isEmpty: false,
            isFailed: false,
            isDisputed: false,
            alias: currentTurn.alias,
            model: currentTurn.model,
            effort: currentTurn.effort,
            outputTokens: 0,
            calls: 1,
            lastTool: `Skill ${shortSkill}`,
            isSettled: true,
          })
        } else if (b.name === 'Agent') {
          const desc = oneLine(input.description) || oneLine(input.subagent_type) || 'subagent'
          const reqAlias = typeof input.model === 'string' && oneLine(input.model) ? oneLine(input.model) : null
          const ag: Stage = {
            kind: 'agent',
            key: `agent:${id}`,
            agentId: null,
            label: `agent:${clip(desc, 42)}`,
            phase: currentPhase,
            startedAt: t,
            endedAt: null,
            summary: null,
            isEmpty: false,
            isFailed: false,
            isDisputed: false,
            alias: reqAlias,
            model: null,
            effort: null,
            outputTokens: 0,
            calls: 0,
            lastTool: null,
            isSettled: false,
          }
          pendingAgents.set(id, ag)
          stages.push(ag)
        } else if ((b.name === 'Bash' || b.name === 'PowerShell') && typeof input.command === 'string' && /(?:^|[;&|\r\n])\s*git\s+(?:-C\s+\S+\s+)?commit\b/.test(input.command)) {
          pendingCommits.set(id, { cmd: input.command, phase: currentPhase, alias: currentTurn.alias, model: currentTurn.model, effort: currentTurn.effort, at: t })
        }
      }
    }
  }
  return stages
}

/** Merges session items and workflow stages in chronological start order. */
export function mergeStages(sessionStages: Stage[], workflowStages: Stage[]): Stage[] {
  if (sessionStages.length === 0) return workflowStages
  if (workflowStages.length === 0) return sessionStages
  return [...sessionStages, ...workflowStages].sort((a, b) => a.startedAt - b.startedAt)
}

/** Compact Unicode swimlane bar (`░░████░░`) for a stage's span across `[t0, t0 + total]`. */
export function timelineBar(s: Stage, t0: number, total: number, width = 16): string {
  const w = Math.max(4, width)
  const span = Math.max(1, total)
  const from = Math.max(0, s.startedAt - t0)
  const to = Math.max(from, (s.endedAt ?? t0 + span) - t0)
  const start = Math.min(w - 1, Math.floor((from / span) * w))
  const len = Math.max(1, Math.min(w - start, Math.ceil(((to - from) / span) * w)))
  const fill = s.endedAt === null ? '▓' : '█'
  return `${'░'.repeat(start)}${fill.repeat(len)}${'░'.repeat(Math.max(0, w - start - len))}`
}

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
      return ((r.rulings as unknown[] | undefined) ?? []).map(x => `${str(rec(x).key)} ${str(rec(x).ruling)}: ${str(rec(x).reason, 100)}`).join('; ') || 'no rulings'
    case 'fix':
      return `fixed=${count(r.fixed)} disputed=${count(r.notFixed)} commits=${count(r.commits)}` + ((r.notFixed as unknown[] | undefined) ?? []).map(x => ` | disputed ${str(rec(x).key)}: ${str(rec(x).reason, 100)}`).join('')
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

/** A divider's text: the phase, and the round when its stages' labels carry one (`refute:…:r2`): `Refute · round 2`. */
export function phaseTitle(g: { phase: string; stages: Stage[] }): string {
  const round = /:r(\d+)$/.exec(g.stages[0]?.label ?? '')?.[1]
  return `${g.phase || '(no phase)'}${round ? ` · round ${round}` : ''}`
}

export const running = (w: Watch): Stage[] => w.stages.filter(s => s.endedAt === null)

/** `0:46`, `15:03`: minutes unpadded, seconds rounded down. */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const many = (n: number, one: string, more: string): string => `${n} ${n === 1 ? one : more}`

type Outcome = 'running' | 'empty' | 'failed' | 'disputed' | 'done'
function outcome(s: Stage): Outcome {
  if (s.endedAt === null) return 'running'
  if (s.isEmpty) return 'empty'
  if (s.isFailed === true) return 'failed'
  if (s.isDisputed === true) return 'disputed'
  return 'done'
}
const STATE: Record<Outcome, string> = { running: '▶ running', empty: '✗ no result', failed: '! failed', disputed: '! disputed', done: '✓ done' }

/** The stage's state as a glyph and a word, so it never rests on color alone. */
export const state = (s: Stage): string => STATE[outcome(s)]

/** The theme color that goes with the state. */
export function tone(s: Stage): 'warning' | 'error' | 'success' {
  const o = outcome(s)
  return o === 'running' || o === 'disputed' ? 'warning' : o === 'done' ? 'success' : 'error'
}

/**
 * Every stage counted once, as its card shows it: `14 done · 5 failed · 0 running`, with
 * `· 1 disputed` after done when a fix round left findings for the arbiter. Failed includes no result.
 */
export function tally(w: Watch): string {
  const n = { done: 0, disputed: 0, failed: 0, running: 0 }
  for (const s of w.stages) {
    const o = outcome(s)
    n[o === 'empty' ? 'failed' : o] += 1
  }
  return `${n.done} done${n.disputed ? ` · ${n.disputed} disputed` : ''} · ${n.failed} failed · ${n.running} running`
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
  if (live.length === 0) {
    const isClean = w.stages.every(s => outcome(s) === 'done')
    return `${w.run}: ${isClean ? '✓' : '!'} finished · ${tally(w)}`
  }
  const first = live[0] as Stage
  if (live.length === 1) return `${w.run}: ▶ running ${first.label} (${who(first)}) · ${tally(w)}`
  return `${w.run}: ▶ ${live.length} running (${clip(live.map(s => s.label).join(', '), 61)}) · ${tally(w)}`
}

/** The whole picture as plain text: what the command prints, the same blocks the pane draws. */
export function report(w: Watch): string {
  const lines = [`${w.run}: ${tally(w)}`]
  for (const g of phaseRuns(w.stages)) {
    lines.push(`── ${phaseTitle(g)}`)
    for (const s of g.stages) lines.push(...stageLines(s, w.now))
  }
  return lines.join('\n')
}
