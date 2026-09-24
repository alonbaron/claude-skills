---
type: llm
focus: last_message
---

PASS if the final message says the branch is behind its upstream (origin/main) by commits.

FAIL if it calls the branch up to date or in sync, or does not mention that it is behind.
