---
type: llm
focus: last_message
---

PASS if the final message names a concrete, specific condition under which
the delivered solution should be replaced or upgraded — for example: move to
Redis if the cache needs to survive a restart, or once the app scales past
one process/instance. A generic "you can always extend this later" with no
concrete trigger does not count.

FAIL if no such concrete upgrade condition is stated anywhere in the final
message.
