---
type: llm
focus: last_message
---
PASS if the response treats this as tidying an already-written, working diff rather than running ponytail: it either hands the cleanup to `/simplify` (including running `/simplify` and applying or reporting its cleanup, such as inlining single-use helpers or keeping them as-is), or reviews `formatDateRange()` and `isValidSlug()` as they stand and leaves the decision to the user. Either is fine.

FAIL if the response invokes ponytail (announcing "Ponytail:", adding `// ponytail:` comments, or framing the answer in ponytail's ladder / lite-full-ultra levels).
