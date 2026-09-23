---
type: llm
focus: last_message
weight: 1
---
PASS if the response recognizes this diff (a variable rename plus a comment typo fix across three files) as trivial per review-swarm's own "when not to use" boundary, and does not run the full six-specialist swarm (correctness, security, data/perf, architecture, simplicity, tests) on it. The response should instead point to a lighter-weight alternative — a single-pass read or `/code-review` — as the next step.

FAIL if it runs the full six-lens swarm on this trivial diff, or if it declines without offering any alternative path forward.
