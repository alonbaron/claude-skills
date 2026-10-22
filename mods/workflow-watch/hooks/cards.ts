import type { Stage, StageKind, Theme, Watch } from '../types'
import { elapsed, phaseTitle, stageDetail, stageResult, state, tally, timelineBar, tone, who } from './journal'

/** Card markup for the graphical surfaces (desktop, vscode, mobile): rounded cards, round kind avatars, pill badges. */
export type Card = { source: string; alt: string; width: number; height: number }

export const W = 440
const FONT = `font-family="Segoe UI, -apple-system, system-ui, sans-serif"`

/** One fill per kind of item, the same as the terminal chips, read in dark ink. */
export const KIND_FILL: Record<StageKind, string> = { turn: '#FB923C', skill: '#A78BFA', agent: '#2DD4BF', commit: '#60A5FA', stage: '#F472B6' }
const KIND_LETTER: Record<StageKind, string> = { turn: 'T', skill: 'S', agent: 'A', commit: 'C', stage: 'W' }
const kindOf = (s: Stage | undefined): StageKind => s?.kind ?? 'stage'

// The pane's toggle picks the theme, whatever the system's: both name the same classes.
const PILLS = `.ink{fill:#111}.pill-success{fill:rgba(52,199,89,.18)}.pill-warning{fill:rgba(245,176,65,.18)}.pill-error{fill:rgba(239,68,68,.18)}.pill-subtle{fill:rgba(154,156,161,.14)}`
const STYLE: Record<Theme, string> = {
  dark: `<style>${PILLS}.card{fill:#202124;stroke:#2f3033}.live{stroke:#f5b041}.t{fill:#ececec}.m{fill:#9a9ca1}.p{fill:#f0a35e}.who{fill:#8ab4f8}.track{fill:#2c2d31}.tx-success{fill:#5ee38a}.tx-warning{fill:#f7c35c}.tx-error{fill:#f87171}.tx-subtle{fill:#9a9ca1}</style>`,
  light: `<style>${PILLS}.card{fill:#fff;stroke:#e7e7ea}.live{stroke:#d97706}.t{fill:#1a1a1a}.m{fill:#6b6d72}.p{fill:#c2560c}.who{fill:#1d4ed8}.track{fill:#efeff2}.tx-success{fill:#15803d}.tx-warning{fill:#b45309}.tx-error{fill:#b91c1c}.tx-subtle{fill:#6b6d72}</style>`,
}

/** The pane's own background under the cards in each theme. */
export const PANE_BG: Record<Theme, string> = { dark: '#181818', light: '#f3f3f5' }

const esc = (v: string): string => v.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
/** Cuts a line to what fits in `px` at `size`, estimating an average glyph at 0.5em. */
const fit = (v: string, px: number, size: number): string => {
  const n = Math.max(1, Math.floor(px / (size * 0.5)))
  return v.length <= n ? v : `${v.slice(0, n - 1)}…`
}
const textW = (v: string, size: number): number => Math.ceil(v.length * size * 0.5)
const svg = (h: number, body: string, theme: Theme): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" ${FONT}>${STYLE[theme]}${body}</svg>`
const frame = (h: number, cls = 'card'): string => `<rect class="${cls}" x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="16" stroke-width="1"/>`

/** The run's name, the token total, and one pill per count, each with its number in a badge. */
export function headerCard(w: Watch, tokens: number, theme: Theme): Card {
  const h = 92
  const toks = `${(tokens / 1000).toFixed(1)}k output tokens`
  let x = 18
  const pills = tally(w)
    .split(' · ')
    .map(part => {
      const [count = '0', word = ''] = part.split(' ')
      const t = count === '0' ? 'subtle' : word === 'done' ? 'success' : word === 'failed' ? 'error' : 'warning'
      const pw = 30 + textW(word, 12) + 14
      const out = `<rect class="pill-${t}" x="${x}" y="50" width="${pw}" height="28" rx="14"/><rect class="pill-${t}" x="${x + 4}" y="54" width="22" height="20" rx="10"/><text class="tx-${t}" x="${x + 15}" y="68" font-size="12" font-weight="700" text-anchor="middle">${esc(count)}</text><text class="tx-${t}" x="${x + 32}" y="68" font-size="12" font-weight="600">${esc(word)}</text>`
      x += pw + 8
      return out
    })
    .join('')
  const body = `${frame(h)}<text class="p" x="18" y="32" font-size="17" font-weight="700">${esc(fit(w.run ?? '', W - 36 - textW(toks, 12) - 12, 17))}</text><text class="m" x="${W - 18}" y="31" font-size="12" text-anchor="end">${esc(toks)}</text>${pills}`
  return { source: svg(h, body, theme), alt: `${w.run}: ${tally(w)} · ${toks}`, width: W, height: h }
}

/** Each item's span on the shared clock as a rounded bar in its kind color, on a soft track. */
export function timelineCard(stages: Stage[], t0: number, total: number, now: number, theme: Theme): Card {
  const rows = stages.slice(-10)
  const h = 50 + rows.length * 24 + 8
  const tx = 132
  const tw = W - tx - 62
  const body = rows
    .map((s, i) => {
      const y = 50 + i * 24
      const bar = timelineBar(s, t0, total, 40)
      const start = bar.indexOf(bar.match(/[█▓]/)?.[0] ?? '█')
      const len = (bar.match(/[█▓]+/)?.[0] ?? '█').length
      const bx = tx + (start / 40) * tw
      const bw = Math.max(8, (len / 40) * tw)
      const dur = elapsed((s.endedAt ?? now) - s.startedAt)
      return `<text class="t" x="18" y="${y + 13}" font-size="12">${esc(fit(s.label, tx - 26, 12))}</text><rect class="track" x="${tx}" y="${y + 3}" width="${tw}" height="12" rx="6"/><rect x="${bx}" y="${y + 3}" width="${bw}" height="12" rx="6" fill="${KIND_FILL[kindOf(s)]}" opacity="${s.endedAt === null ? 0.65 : 0.95}"/><text class="m" x="${W - 18}" y="${y + 13}" font-size="12" text-anchor="end">${esc(dur)}</text>`
    })
    .join('')
  const title = `<text class="t" x="18" y="30" font-size="14" font-weight="700">Timeline</text><text class="m" x="${18 + textW('Timeline', 14) + 10}" y="30" font-size="12">${esc(`${elapsed(total)} elapsed`)}</text>`
  return { source: svg(h, `${frame(h)}${title}${body}`, theme), alt: `Timeline, ${elapsed(total)} elapsed: ${rows.map(s => s.label).join(', ')}`, width: W, height: h }
}

/** The phase a run of cards belongs to, as a pill in its kind color at the left of a card-wide strip, so it scales as the cards do. */
export function phaseChip(g: { phase: string; stages: Stage[] }, theme: Theme): Card {
  const label = fit(phaseTitle(g), W - 40, 12)
  const pw = textW(label, 12) + 28
  const body = `<rect x="2" y="2" width="${pw}" height="24" rx="12" fill="${KIND_FILL[kindOf(g.stages[0])]}"/><text class="ink" x="${2 + pw / 2}" y="18" font-size="12" font-weight="700" text-anchor="middle">${esc(label)}</text>`
  return { source: svg(28, body, theme), alt: label, width: W, height: 28 }
}

/** One item: a round avatar in its kind color, the label and the model, a state pill, then prompt, result and details. */
export function stageCard(s: Stage, now: number, theme: Theme): Card {
  const t = tone(s)
  const st = state(s)
  const pw = textW(st, 12) + 22
  const isLive = s.endedAt === null
  const lines: Array<{ cls: string; v: string; size: number; italic?: boolean }> = []
  if (s.prompt) lines.push({ cls: 'p', v: `› ${s.prompt}`, size: 13 })
  lines.push({ cls: isLive ? 'm' : 't', v: stageResult(s), size: 13, italic: isLive })
  lines.push({ cls: 'm', v: stageDetail(s, now), size: 12 })
  const h = 64 + lines.length * 20 + 10
  const x = 62
  const rows = lines
    .map((l, i) => `<text class="${l.cls}" x="${x}" y="${78 + i * 20}" font-size="${l.size}"${l.italic ? ' font-style="italic"' : ''}>${esc(fit(l.v, W - x - 18, l.size))}</text>`)
    .join('')
  const body =
    frame(h, s.endedAt === null ? 'card live' : 'card') +
    `<circle cx="34" cy="36" r="18" fill="${KIND_FILL[kindOf(s)]}"/><text class="ink" x="34" y="41" font-size="14" font-weight="700" text-anchor="middle">${KIND_LETTER[kindOf(s)]}</text>` +
    `<text class="t" x="${x}" y="32" font-size="14" font-weight="700">${esc(fit(s.label, W - x - pw - 30, 14))}</text>` +
    `<text class="who" x="${x}" y="52" font-size="12">${esc(fit(who(s), W - x - 18, 12))}</text>` +
    `<rect class="pill-${t}" x="${W - 16 - pw}" y="17" width="${pw}" height="24" rx="12"/><text class="tx-${t}" x="${W - 16 - pw / 2}" y="33" font-size="12" font-weight="700" text-anchor="middle">${esc(st)}</text>` +
    rows
  return { source: svg(h, body, theme), alt: [`${st} ${s.label} ${who(s)}`, ...lines.map(l => l.v)].join(' | '), width: W, height: h }
}
