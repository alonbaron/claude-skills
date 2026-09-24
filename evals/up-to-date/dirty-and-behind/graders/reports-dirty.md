---
type: llm
focus: last_message
---

PASS if the final message says the working tree has uncommitted changes (the edit in src/api_client.py).

FAIL if it calls the tree clean or does not mention the uncommitted change.
