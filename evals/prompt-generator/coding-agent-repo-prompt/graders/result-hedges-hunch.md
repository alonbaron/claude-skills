---
type: llm
focus: last_message
weight: 1
---

PASS if the generated hand-off prompt frames the pricing.js divide-by-zero
as the user's unverified hunch that the receiving coding agent must confirm
before relying on it — e.g. "hypothesis, not verified", "correct me if
wrong", "confirm the file exists and read it before referencing it" — rather
than as an established fact.

FAIL if the generated prompt states, anywhere, that the divide-by-zero in
pricing.js is the confirmed or already-established root cause, or otherwise
drops the hedge and hands the receiving agent a conclusion instead of a lead
to verify.
