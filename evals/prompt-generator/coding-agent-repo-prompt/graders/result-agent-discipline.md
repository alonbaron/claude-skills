---
type: llm
focus: last_message
weight: 1
---

PASS if the generated hand-off prompt instructs the receiving coding agent
to do all three of: (a) read a file before editing it, (b) keep changes
small/minimal and avoid unrelated refactors or cleanups, and (c) stop and
report or ask a question rather than guess when it is blocked or cannot
reproduce the bug, with an explicit instruction to report what it could and
could not verify.

FAIL if the generated prompt omits any one of (a), (b), or (c), or states it
as vague filler with no bearing on this specific bug hand-off (e.g. a single
generic "be careful" line with no concrete instruction). A missing standalone
"no AI co-author" commit-message rule is NOT by itself a failure, since a
prompt that correctly forbids the agent from committing at all makes that
rule moot.
