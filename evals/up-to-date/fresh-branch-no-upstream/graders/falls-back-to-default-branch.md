---
type: llm
focus: last_message
---

PASS if the final message compares the branch against origin's default branch (origin/main) and says that is what it compared against.

FAIL if it gives no comparison at all, or gives ahead/behind numbers without saying what they are relative to.
