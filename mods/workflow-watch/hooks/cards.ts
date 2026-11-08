import type { Signals, Stage, StageKind, Theme, Watch } from '../types'
import { changeLines, clip, decisionLines, elapsed, fmtTokens, planLines, qualityLines, stageResult, state, tally, turnTitle } from './journal'
import type { UsageView } from './journal'

/** One panel of the console as SVG markup for the graphical surfaces (desktop, vscode, mobile); `alt` is its text, line by line; `width` and `height` are its grid size, the drawing scaling to the pane. */
export type Card = { source: string; alt: string; width: number; height: number }

/** The grid's width in CSS pixels: the pane's own, set by setWidth before a render, 440 until the surface says. */
export let W = 440
/** About how wide the desktop draws one column of the pane. */
const COLUMN_PX = 8
/** Lays the grid out at the pane's width, from the columns the surface reports, so text keeps its size and lines are cut to fit instead of the whole card scaling. */
export function setWidth(columns: number | undefined): void {
  W = typeof columns === 'number' && columns > 0 ? Math.max(240, Math.round(columns * COLUMN_PX)) : 440
}
const FONT = `font-family="JetBrains Mono, Cascadia Mono, ui-monospace, Consolas, SF Mono, monospace"`

/** One fill per kind of item, for the terminal's timeline bars. */
export const KIND_FILL: Record<StageKind, string> = { turn: '#FB923C', skill: '#A78BFA', agent: '#2DD4BF', commit: '#60A5FA', stage: '#F472B6' }

// One accent for what is alive or good, amber and red only for trouble; the pane's toggle picks the theme, whatever the host's.
const STYLE: Record<Theme, string> = {
  dark: `<style>.bg{fill:#0e1116}.ink{fill:#d7dbe0}.mute{fill:#7c8591}.faint{fill:#46505c}.acc{fill:#7ee0c2}.bad{fill:#ff7b72}.warn{fill:#e3b341}.rule{stroke:#242a33}.seg{fill:#1b2027}.on{fill:#7ee0c2}.onw{fill:#e3b341}.onb{fill:#ff7b72}.accDim{fill:rgba(126,224,194,.12)}.warnDim{fill:rgba(227,179,65,.14)}.notch{stroke:#d7dbe0}.tree{stroke:#46505c}</style>`,
  light: `<style>.bg{fill:#f6f3ee}.ink{fill:#1f2328}.mute{fill:#6e7681}.faint{fill:#a39b8f}.acc{fill:#0f7b6c}.bad{fill:#b42318}.warn{fill:#9a6700}.rule{stroke:#dcd5ca}.seg{fill:#e6e0d6}.on{fill:#0f7b6c}.onw{fill:#9a6700}.onb{fill:#b42318}.accDim{fill:rgba(15,123,108,.10)}.warnDim{fill:rgba(154,103,0,.12)}.notch{stroke:#1f2328}.tree{stroke:#a39b8f}</style>`,
}

const CH = 0.6
const esc = (v: string): string => v.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
/** Cuts a line to what fits in `px` at `size`, a monospace glyph being 0.6em wide. */
const fit = (v: string, px: number, size: number): string => {
  const n = Math.max(1, Math.floor(px / (size * CH)))
  return v.length <= n ? v : `${v.slice(0, n - 1)}…`
}
/** Breaks a line at spaces into lines that fit `px` at `size`; a word longer than a line is cut. */
const wrap = (v: string, px: number, size: number): string[] => {
  const n = Math.max(1, Math.floor(px / (size * CH)))
  const lines: string[] = []
  let line = ''
  for (const word of v.split(' ')) {
    if (line && line.length + 1 + word.length > n) {
      lines.push(line)
      line = ''
    }
    line = line ? `${line} ${word}` : word
    while (line.length > n) {
      lines.push(line.slice(0, n))
      line = line.slice(n)
    }
  }
  if (line) lines.push(line)
  return lines
}
// Laid out on a 440-unit grid and drawn at the pane's full width (width="100%", the height following the viewBox), so the
// panels and the button row above them span the same width whatever size or side the pane has, minimized or not.
const svg = (h: number, body: string, theme: Theme): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="100%" ${FONT} font-size="12">${STYLE[theme]}<rect class="bg" width="${W}" height="${h}"/>${body}</svg>`
const text = (x: number, y: number, v: string, cls = 'ink', extra = ''): string => `<text class="${cls}" x="${x}" y="${y}"${extra}>${esc(v)}</text>`
const END = ' text-anchor="end"'

/** A hairline across the panel with its label inset at the left in small caps, and a second label at the right. */
function rule(y: number, label: string, right = ''): string {
  // The text is held to the width its cap covers (textLength), so a font wider than the 7.4px guess never runs past the cap onto the hairline.
  const cap = (x: number, v: string, anchor: string): string => {
    const w = v.length * 7.4
    return `<rect class="bg" x="${anchor === END ? x - w - 6 : x - 6}" y="${y - 8}" width="${w + 12}" height="16"/><text class="mute" x="${x}" y="${y + 4}" font-size="10" letter-spacing="0.14em" textLength="${w}" lengthAdjust="spacingAndGlyphs"${anchor}>${esc(v)}</text>`
  }
  return `<line class="rule" x1="0" y1="${y}" x2="${W}" y2="${y}"/>${cap(18, label, '')}${right ? cap(W - 12, right, END) : ''}`
}

const GLYPH: Record<string, string> = { '✓': 'acc', '●': 'acc', '○': 'faint', '?': 'warn', '×': 'bad' }
const LABELS = new Set(['tests', 'files', 'commit', 'review', 'verdict', 'skills'])
const LINE_H = 18

/** One text line of a section, colored by what it starts with: a state glyph in its tone, a label word muted, the rest in ink. */
function paintLine(y: number, raw: string): string {
  const indent = raw.length - raw.trimStart().length
  const line = raw.trim()
  if (!line) return ''
  const glyph = line[0] ?? ''
  const cls = GLYPH[glyph]
  if (cls && line[1] === ' ') {
    const rest = line.slice(2)
    const band = glyph === '?' ? `<rect class="warnDim" x="12" y="${y - 13}" width="${W - 24}" height="${LINE_H}" rx="3"/>` : ''
    return `${band}${text(18, y, glyph, cls)}${text(34, y, fit(rest, W - 34 - 16, 12), glyph === '○' ? 'mute' : 'ink')}`
  }
  if (indent >= 6) return text(96, y, fit(line, W - 96 - 16, 12), 'faint')
  const word = line.split(/\s+/)[0] ?? ''
  if (LABELS.has(word)) return `${text(18, y, word, 'mute')}${text(96, y, fit(line.slice(word.length).trim(), W - 96 - 16, 12))}`
  return text(18, y, fit(line, W - 34, 12), 'mute')
}

/** A section: its rule, then its text lines; null when it has no lines. */
export function linesPanel(label: string, right: string, lines: string[], theme: Theme): Card | null {
  if (lines.length === 0) return null
  const h = 30 + lines.length * LINE_H + 8
  const body = rule(14, label, right) + lines.map((l, i) => paintLine(38 + i * LINE_H, l)).join('')
  return { source: svg(h, body, theme), alt: [label, ...lines.map(l => l.trim())].join(' | '), width: W, height: h }
}

/** The run's own rule: its name and the counts as the pane's first line. */
export function sessionRule(w: Watch, now: number, theme: Theme): Card {
  const t0 = w.stages.reduce((m, s) => Math.min(m, s.startedAt), Infinity)
  const counts = tally(w)
    .split(' · ')
    .filter(part => !/^0 /.test(part))
    .map(part => part.replace('running', 'live').toUpperCase())
    .join(' · ')
  const right = `${counts}${Number.isFinite(t0) ? ` · ${elapsed(now - t0)}` : ''}`
  const body = rule(14, `SESSION ${clip(w.run ?? '', 26)}`.toUpperCase(), right)
  return { source: svg(24, body, theme), alt: `SESSION ${w.run ?? ''} | ${right}`, width: W, height: 24 }
}

const figures = (s: Stage): string => [`${s.calls} tools`, `${fmtTokens(s.outputTokens)} out`].join(' · ')
const liveLine = (s: Stage): string => (s.endedAt === null ? `▸ ${s.lastTool ?? 'starting…'}` : stageResult(s))

/** NOW: the live turn (or the last one), what it is doing or what came of it, and the agent's plan with the step it is on. */
export function nowPanel(turn: Stage | undefined, signals: Signals | undefined, now: number, theme: Theme): Card {
  const plan = signals ? planLines(signals) : []
  const lines: string[] = []
  if (turn) lines.push(turnTitle(turn.prompt) ?? turn.label, liveLine(turn))
  else lines.push('waiting for the first turn')
  const h = 30 + (lines.length + plan.length) * LINE_H + 10
  const right = turn ? `${elapsed((turn.endedAt ?? now) - turn.startedAt)} · ${figures(turn)}` : ''
  const isLive = turn?.endedAt === null
  const body =
    (isLive ? `<rect class="accDim" width="${W}" height="${h}" rx="4"/><rect class="acc" width="2" height="${h}"/>` : '') +
    rule(14, 'NOW', right) +
    (turn ? text(18, 40, fit(lines[0] ?? '', W - 34, 13), 'ink', ' font-size="13" font-weight="700"') + text(18, 58, fit(lines[1] ?? '', W - 34, 12), isLive ? 'mute' : 'ink') : text(18, 40, lines[0] ?? '', 'mute')) +
    plan.map((l, i) => paintLine(38 + (lines.length + i) * LINE_H, l)).join('')
  return { source: svg(h, body, theme), alt: ['NOW', right, ...lines, ...plan.map(l => l.trim())].filter(Boolean).join(' | '), width: W, height: h }
}

/** USAGE: one row per meter as twenty cells with a notch where an even pace would sit, then the figures line. */
export function usagePanel(v: UsageView, theme: Theme): Card {
  const rowH = 22
  const h = 30 + v.meters.length * rowH + 28
  const rows = v.meters
    .map((m, i) => {
      const y = 42 + i * rowH
      let cells = ''
      if (m.percent !== null) {
        const on = Math.round((Math.max(0, Math.min(100, m.percent)) / 100) * 20)
        const cls = m.percent >= 85 ? 'onb' : m.percent >= 60 ? 'onw' : 'on'
        for (let c = 0; c < 20; c++) cells += `<rect class="${c < on ? cls : 'seg'}" x="${60 + c * 9}" y="${y - 9}" width="7" height="10"/>`
        if (m.pace !== null) cells += `<line class="notch" x1="${60 + (m.pace / 100) * 178}" y1="${y - 12}" x2="${60 + (m.pace / 100) * 178}" y2="${y + 4}" stroke-width="1.5"/>`
      }
      return `${text(18, y, m.label, 'mute')}${cells}${text(m.percent === null ? 60 : 250, y, fit(m.text, m.percent === null ? W - 76 : W - 266, 12))}`
    })
    .join('')
  const body = rule(14, 'USAGE') + rows + text(18, 42 + v.meters.length * rowH + 6, fit(v.figures, W - 34, 12), 'mute')
  return { source: svg(h, body, theme), alt: ['USAGE', ...v.meters.map(m => `${m.label} ${m.text}`), v.figures].join(' | '), width: W, height: h }
}

/** The TURNS rule with how many entries follow of how many turns. */
export function turnsRule(shown: number, total: number, theme: Theme): Card {
  const right = shown < total ? `LAST ${shown} OF ${total}` : `${total} ENTRIES`
  return { source: svg(24, rule(14, 'TURNS', right), theme), alt: `TURNS | ${right}`, width: W, height: 24 }
}

/** What an entry shows beyond its item: its digest line, and whether the person unfolded it to the full prompt, answer and tool trail. */
export type CardExtras = { digest?: string; isOpen?: boolean }

const KIND_WORD: Record<StageKind, string> = { turn: 'turn', skill: 'skill', agent: 'agent', commit: 'commit', stage: 'stage' }

/**
 * One entry of TURNS: the head row (number, state glyph and word, clock, figures), the title in bold, the prompt or
 * what is running, the result, the digest, then the items that started inside it as rows on a thin tree.
 * Unfolded, the prompt and the answer run to their stored length and the tool trail follows.
 */
export function turnEntry(s: Stage, children: Stage[], now: number, theme: Theme, extras: CardExtras = {}): Card {
  const isLive = s.endedAt === null
  const [glyph = '', word = ''] = state(s).split(' ')
  const num = s.label.replace(/^turn:/, '')
  const title = s.kind === 'turn' ? (turnTitle(s.prompt) ?? s.label) : s.label
  const width = W - 42 - 16
  const body: Array<[string, string]> = []
  if (s.prompt) {
    if (extras.isOpen) for (const l of wrap(`› ${s.prompt}`, width, 12)) body.push([l, 'mute'])
    else body.push([`› ${clip(s.prompt, 100)}`, 'mute'])
  }
  if (extras.isOpen && s.answer && !isLive) for (const l of wrap(s.answer, width, 12)) body.push([l, 'ink'])
  else if (isLive || s.summary) body.push([liveLine(s), isLive ? 'mute' : 'ink'])
  if (extras.digest) body.push([extras.digest, 'mute'])
  if (extras.isOpen) for (const tool of s.tools ?? []) body.push([tool, 'faint'])
  const rows = children.map(c => {
    const kind = c.kind ?? 'stage'
    const name = c.label.replace(/^[a-z]+:/, '')
    const live = c.endedAt === null
    const right = kind === 'agent' ? `${live ? '● ' : ''}${elapsed((c.endedAt ?? now) - c.startedAt)} · ${fmtTokens(c.outputTokens)} out` : ''
    return { word: KIND_WORD[kind], name, note: c.summary ?? '', right, live }
  })
  const h = 30 + 20 + body.length * LINE_H + rows.length * LINE_H + 14
  let y = 20
  let out = `${text(18, y, num, 'mute')}${text(42, y, glyph, GLYPH[glyph] ?? 'acc')}${text(58, y, word.toUpperCase(), 'mute')}${text(58 + word.length * 7.4 + 14, y, elapsed((s.endedAt ?? now) - s.startedAt), 'mute')}${text(W - 12, y, isLive ? `${s.calls} calls` : figures(s), 'mute', END)}`
  y += 21
  out += text(42, y, fit(title, width, 13), 'ink', ' font-size="13" font-weight="700"')
  for (const [v, cls] of body) {
    y += LINE_H
    out += text(42, y, fit(v, width, 12), cls)
  }
  if (rows.length) {
    const top = y + 6
    out += `<line class="tree" x1="47" y1="${top}" x2="47" y2="${top + (rows.length - 1) * LINE_H + 12}"/>`
    for (const r of rows) {
      y += LINE_H
      out += `<line class="tree" x1="47" y1="${y - 4}" x2="58" y2="${y - 4}"/>${text(64, y, r.word, 'mute')}${text(112, y, fit(r.name, 150, 12))}`
      if (r.right) out += text(W - 12, y, r.right, r.live ? 'acc' : 'mute', END)
      else if (r.note) out += text(112 + Math.min(150, r.name.length * 7.4) + 12, y, fit(r.note, W - 12 - (112 + Math.min(150, r.name.length * 7.4) + 12), 12), 'mute')
    }
  }
  out += `<line class="rule" x1="18" y1="${h - 1}" x2="${W - 18}" y2="${h - 1}"/>`
  const alt = [`${num} ${glyph} ${word} ${elapsed((s.endedAt ?? now) - s.startedAt)} ${isLive ? `${s.calls} calls` : figures(s)}`, title, ...body.map(([v]) => v), ...rows.map(r => `${r.word} ${r.name}${r.right ? ` ${r.right}` : r.note ? ` ${r.note}` : ''}`)]
  return { source: svg(h, out, theme), alt: alt.join(' | '), width: W, height: h }
}

/** A foldable section of the console: its name as its rule reads it, how many lines, meters or entries it holds, and its card (null while folded: the count alone is drawn). */
export type Section = { name: string; count: number; card: Card | null }

/** The DECISIONS, CHANGES and QUALITY sections for a session, each left out when empty; a folded one keeps its count and skips its card. */
export function signalPanels(signals: Signals | undefined, stages: Stage[], theme: Theme, folded: readonly string[] = []): Section[] {
  if (!signals) return []
  const waiting = signals.decisions.filter(d => d.kind === 'ask' && d.answer === null).length
  const parts: Array<[string, string, string[]]> = [
    ['DECISIONS', waiting ? `${waiting} WAITING` : '', decisionLines(signals)],
    ['CHANGES', '', changeLines(signals, stages)],
    ['QUALITY', '', qualityLines(signals, stages)],
  ]
  return parts.flatMap(([name, right, lines]) => {
    if (lines.length === 0) return []
    return [{ name, count: lines.length, card: folded.includes(name) ? null : linesPanel(name, right, lines, theme) }]
  })
}
