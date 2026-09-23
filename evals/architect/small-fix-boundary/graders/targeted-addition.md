---
type: llm
focus: last_message
---

PASS if the response treats this as a targeted addition to the auth service's
existing design docs: it adds the new rate-limiting invariant (100
requests/minute per IP on POST /login), says where it lives (e.g. wired into
SOURCE_OF_TRUTH.md's invariants table and ARCHITECTURE_ROADMAP.md), and does
this without re-authoring or regenerating the whole SOURCE_OF_TRUTH.md /
ARCHITECTURE_ROADMAP.md / TODO_WORKFLOW.md / CLAUDE.md set from scratch. It
should build on the existing login/logout/session model and D1 schema rather
than re-deriving unrelated sections.

FAIL if it re-authors the whole doc set for a one-endpoint change, ignores the
docs that already exist, or jumps straight to implementation code instead of
a design addition.
