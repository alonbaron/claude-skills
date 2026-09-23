---
type: llm
focus: last_message
weight: 1
---

PASS if the generated hand-off prompt does not invent specifics beyond what
the user gave (repo path C:/dev/acme-api, Node/Express + Postgres, POST
/orders, quantity 0, the pricing.js hunch): no invented file:line citations,
no invented function or variable names, no invented stack traces or error
text presented as already-observed fact. General, non-repo-specific
programming knowledge used as reasoning (for example, noting that `x / 0` in
JavaScript yields `Infinity`/`NaN` rather than throwing) is NOT an invented
fact, and neither is an explicitly-flagged illustrative example (e.g., "e.g.
a per-unit price calculation") or a bracketed placeholder.

FAIL if the generated prompt asserts a specific file:line, function/variable
name, or error message as if it were already known or confirmed, when the
user never supplied it and the agent could not yet have read it.
