---
type: llm
focus: last_message
weight: 1
---

PASS if the generated hand-off prompt includes a step for the receiving
coding agent to sync or check the repo's state before starting work on the
bug — e.g. running `up-to-date`, or `git fetch` plus `git status`, or
otherwise confirming a clean tree on the expected branch — before it starts
investigating the bug.

FAIL if the generated prompt has the agent start investigating or fixing the
bug with no step anywhere to check the repo's current/clean state first.
