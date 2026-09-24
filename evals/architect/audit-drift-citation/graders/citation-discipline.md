---
type: llm
focus: last_message
---

PASS if the response reports the drift as a finding that cites both sides:
the code that states the fact (the POST /webhooks/stripe handler in
src/routes/webhooks.js) AND the doc + section that should describe it and
doesn't (ARCHITECTURE_ROADMAP.md §3's API contract table). It stays in
verify-and-report form — a prioritized fix list with an offer to apply it —
rather than treating the finding as settled without pointing at the actual
code location, and it does not pull in an unrelated hand-off (ask-the-council,
review-swarm) for what is a single straightforward drift item.

FAIL if any drift is reported as a hunch without citing both the code
location and the doc location, if it fabricates a file/line that isn't in the
repo, or if it goes further than a report (e.g. claims the docs are now
fixed) without ever actually changing them.
