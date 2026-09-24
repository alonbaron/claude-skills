---
type: llm
focus:
  source: file
  path: SOURCE_OF_TRUTH.md
---

PASS if SOURCE_OF_TRUTH.md states the new login rate-limit invariant and names
two places it is enforced, e.g. a Hono middleware check AND a platform or
storage layer behind it (a Workers Rate Limiting binding, D1, KV, a Durable
Object). Both must be named, not just "rate limiting is applied".

FAIL if the invariant is missing, or only one enforcement point is named.
