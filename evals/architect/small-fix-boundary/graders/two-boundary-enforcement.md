---
type: llm
focus: last_message
---

PASS if the new rate-limit invariant is specified as enforced at two
boundaries — e.g. an app-layer check in Hono middleware AND a durable counter
(D1 or another store) backing it — not just "add rate limiting" as a single
hand-waved layer. Both boundaries must be named explicitly.

FAIL if only one enforcement layer is named, or enforcement is described
without saying where it actually lives.
