---
type: llm
focus: last_message
weight: 1
---

PASS if the final message:
1. Does not produce a sync brief. At most one line acknowledging that there
   is nothing to sync; saying so is optional, because the user already stated
   there is no remote.
2. Makes no claims about ahead/behind counts, open PRs, or issues (none of
   that applies without a remote), and does not attempt or narrate running a
   fetch or divergence check against a remote that does not exist.
3. Moves directly into the CSV-to-JSON task -- either starting on it, or
   asking a normal clarifying question about it -- rather than dead-ending.

FAIL if any of the following: it produces a sync brief (fetch, ahead/behind,
PRs/issues) anyway; it blocks or stalls trying to reach a nonexistent remote;
it fabricates or guesses at remote-relative state; or it stops after noting
there is no remote with no next step toward the requested task.
