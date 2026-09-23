---
type: llm
focus: last_message
weight: 1
---

PASS if the final message:
1. Explicitly states that the normal ahead/behind comparison isn't available
   for this branch -- no upstream tracking ref / never pushed / unpushed
   branch -- rather than silently reporting a number as if the comparison
   succeeded.
2. Falls back to comparing against origin's default branch (main) instead,
   or explicitly says that's what it's doing, and still delivers a useful,
   short situational brief off that fallback.
3. Is concise: one clear statement of state plus a recommended next step, not
   the same handful of facts (branch, sync state, recent commits) repeated
   across two separate sections.

FAIL if any of the following: the response says the branch is "in sync",
"up to date", or gives a specific ahead/behind count as though the primary
@{upstream} comparison worked; it stops, errors out, or declines to proceed
because that comparison failed; or the brief is heavily padded / restates the
same facts twice.
