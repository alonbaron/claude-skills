export type Stage = {
  /** The journal's key for this agent() call. */
  key: string
  /** The subagent's loop id; its transcript is agent-<id>.jsonl beside the journal. */
  agentId: string | null
  label: string
  phase: string
  /** $.clock.now() at the tick that first saw the stage. */
  startedAt: number
  /** $.clock.now() at the tick that saw its result; null while running. */
  endedAt: number | null
  /** One line about the result, or null while running. */
  summary: string | null
  /** True when the journal recorded a null result (skipped or died). */
  isEmpty: boolean
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
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-watch': { watch: Watch }
  }
}
