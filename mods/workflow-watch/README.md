# workflow-watch

A mod (a plugin of function hooks) that follows the newest Workflow run of the session and draws its stages live: a pane, a band above the prompt while stages run, the status line, and a toast as each stage finishes. `/workflow-watch` opens the pane and prints the same report as text, which is all the mobile app shows.

Each stage gets one block, in the order the run started them, and the phase name appears as a divider wherever it changes. The first line of a block shows the state as a glyph and a word (▶ running, ✓ done, ! failed, ✗ no result), the stage label, the model alias the script asked for and the id it resolved to, and the effort level. Two indented lines follow. One is the result. The other is the details: how long the stage ran, how many tools it called and how many output tokens it produced, or, while it is still running, its calls so far and the tool it is on now. Mods draw from element tables that have no fold, so the details stay on one line instead of collapsing. The band above the prompt shows each running stage as its first line plus its live details, and the status line names what is running and counts what finished and what failed. The build loop's stages each get their own result line (plan, scout, spec, build, measure, refute, arbiter, fix, close); any other workflow gets a generic one.

It reads Claude Code's own files under `~/.claude/projects/<project>/<session>/subagents/workflows/<run>/` every two seconds: `journal.jsonl` for the stages, `agent-<id>.meta.json` for the alias, `agent-<id>.jsonl` for model, effort, tokens and tool calls. That layout is internal; when it moves, the mod shows nothing rather than guessing.

Install with the marketplace (`/plugin install workflow-watch@alonbaron`) or load it for one session with `claude --plugin-dir <this folder>`. The pane needs a terminal of 144 columns, or `/workflow-watch` to seat it narrower. `scripts/tracker.mjs` renders the same stages to HTML or PNG from outside a session.

Check it: `claude plugin validate mods/workflow-watch`, `claude plugin test mods/workflow-watch`, `tsc -p mods/workflow-watch` once a session has laid the types beside it.
