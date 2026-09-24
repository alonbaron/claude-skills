---
type: llm
focus: last_message
weight: 1
---
PASS if the final report: (1) surfaces the N+1 query pattern in `app/routes.py` (one `Item` lookup per order inside the `for order in orders` loop) as a data/performance finding, (2) surfaces the missing test for the zero-orders case as a tests/failure-paths finding, (3) is structured as a ranked Blockers / Should-fix / Nits report with a file:line-style reference and a one-line fix for each item, and (4) shows evidence of adversarial verification (e.g. explains why a finding is real and reproducible, or explicitly drops a speculative one) rather than only listing raw first-pass findings.

FAIL if the report misses either the N+1 pattern or the missing-test finding, is not organized into a ranked Blockers/Should-fix/Nits structure, or shows no sign that findings were verified before being reported.
