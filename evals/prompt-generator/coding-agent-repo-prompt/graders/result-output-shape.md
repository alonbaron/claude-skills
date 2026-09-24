---
type: llm
focus: last_message
weight: 1
---

PASS if the final message's deliverable is a single fenced code block
containing the hand-off prompt, optionally followed by a few short
commentary lines (assumptions the writer made, what the user might want to
tweak) — not a lecture on prompt engineering and not multiple competing
prompt drafts.

FAIL if there is no fenced prompt block; if there are two or more separate
fenced blocks offered as alternative prompts; if the response is a prose
essay or checklist instead of a deliverable prompt; or if the response
actually attempts to investigate or fix the acme-api bug itself (e.g. reads
or edits repo files, or reports a root cause) instead of producing a prompt
to hand off. A short trailer of commentary or assumptions after the fenced
block is not a violation.
