# workflow-watch

A mod (a plugin of function hooks) that follows the newest Workflow run of the session and draws its stages live: a pane, a band above the prompt while stages run, the status line, and a toast as each stage finishes. `/workflow-watch` opens the pane and prints the same report as text, which is all the mobile app shows.

Each row is one subagent: phase, outcome, label, the model alias the script asked for and the id it resolved to, the effort level, output tokens, elapsed time, and either the tool it is calling right now or its result in one line. The build loop's stages get a result line each (plan, scout, spec, build, measure, refute, arbiter, fix, close); any other workflow gets a generic one.

It reads Claude Code's own files under `~/.claude/projects/<project>/<session>/subagents/workflows/<run>/` every two seconds: `journal.jsonl` for the stages, `agent-<id>.meta.json` for the alias, `agent-<id>.jsonl` for model, effort, tokens and tool calls. That layout is internal; when it moves, the mod shows nothing rather than guessing.

Install with the marketplace (`/plugin install workflow-watch@alonbaron`) or load it for one session with `claude --plugin-dir <this folder>`. The pane needs a terminal of 144 columns, or `/workflow-watch` to seat it narrower. `scripts/tracker.mjs` renders the same rows to HTML or PNG from outside a session.

Check it: `claude plugin validate mods/workflow-watch`, `claude plugin test mods/workflow-watch`, `tsc -p mods/workflow-watch` once a session has laid the types beside it.
