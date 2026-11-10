---
type: llm
focus: last_message
---

PASS if the final message notes that the branch has no upstream, has no tracking branch, or is unpushed / local-only (any of those phrasings counts).

FAIL if it does not mention that the branch is unpushed / has no upstream, or implies the branch has its own upstream tracking branch that it was compared against.
