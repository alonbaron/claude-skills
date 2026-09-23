---
type: llm
focus: last_message
weight: 1
---

PASS if the response recognizes this is a whole-build ask behind a
single-prompt request and either (a) surfaces the skill's own hand-off —
suggesting architect / design docs first instead of one mega-prompt, and
explains why one giant prompt is the wrong shape for this scope — or (b)
still produces a prompt but visibly scopes it down (one slice of the system,
or a prompt whose job is to produce the architecture/plan first) while naming
the mega-scope risk out loud.

FAIL if the response silently writes one unscoped kitchen-sink prompt that
tries to hand a coding agent the entire billing system (Stripe, metering,
invoicing, admin dashboard) in one shot, with no mention of the architect
hand-off and no scoping caveat.
