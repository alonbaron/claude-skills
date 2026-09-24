---
type: llm
focus: last_message
---

PASS if the final message says the branch has no upstream (never pushed, no tracking branch).

FAIL if it does not mention that, or implies the branch has an upstream it was compared against.
