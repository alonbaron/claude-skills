/** The pane's card theme, picked with its toggle and kept between sessions. */
export type Theme = 'dark' | 'light'

/** The pane's size the person picked with its Minimize/Expand button, until the session next turns busy or idle. */
export type PaneView = 'full' | 'compact'

export type StageKind = 'stage' | 'turn' | 'skill' | 'agent' | 'commit'

export type Stage = {
  /** The kind of item in the feed; defaults to 'stage' for Workflow stages. */
  kind?: StageKind
  /** The journal's or session's key for this item. */
  key: string
  /** The subagent's loop id; its transcript is agent-<id>.jsonl beside the journal or under subagents/. */
  agentId: string | null
  label: string
  phase: string
  /** The transcript's first timestamp (epoch ms); until there is one, $.clock.now() at the tick that first saw the stage. */
  startedAt: number
  /** The transcript's last timestamp once the stage finished, else $.clock.now() at the tick that saw it finish; null while running. */
  endedAt: number | null
  /** One line about the result, or null while running. */
  summary: string | null
  /** For a turn: the person's words that opened it, or the latest typed while it ran. */
  prompt?: string | null
  /** True when the journal recorded a null result, or a `failed` entry (the stage died before it returned). */
  isEmpty: boolean
  /** True when the result reports a failure: a failing verdict or `ok: false`. */
  isFailed: boolean
  /** True when a fix round left findings disputed, for the arbiter to rule on. */
  isDisputed: boolean
  /** The model alias the script asked for (from the agent's meta.json), or null. */
  alias: string | null
  /** The model id the engine resolved the alias to, from the transcript, or null. */
  model: string | null
  /** The effort level the transcript recorded; null for a model without one. */
  effort: string | null
  /** Output tokens the stage generated so far, thinking included. */
  outputTokens: number
  /** Tool calls seen in the transcript so far. */
  calls: number
  /** The last tool the stage called, with a short argument. */
  lastTool: string | null
  /** True once a finished stage's transcript was read for the last time. */
  isSettled: boolean
}

export type Watch = {
  /** The journal.jsonl being tailed, or null when no run was found yet. */
  journal: string | null
  /** The run's directory name (the run id). */
  run: string | null
  stages: Stage[]
  /** $.clock.now() at the last tick, so elapsed times redraw. */
  now: number
  /** Set while a log could not be read: what the pane says above the items it kept. */
  notice?: string | null
  /** True once nothing has run for IDLE_MS: the pane folds to its compact strip unless the person expanded it. */
  isIdle?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-watch': { watch: Watch; theme: Theme; isTimelineOpen: boolean; pinnedView: PaneView | null }
  }
}
