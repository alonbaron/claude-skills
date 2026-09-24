---
type: llm
focus: last_message
weight: 1
---
PASS if the response treats this diff (a variable rename plus a comment typo fix across three files) as too small for the six-specialist swarm, does not run that swarm, and either gives a single-pass review itself or points to one (a single read or `/code-review`) as the next step.

FAIL if it runs the six-lens swarm on this diff, or declines without reviewing the diff and without offering any way to review it.
