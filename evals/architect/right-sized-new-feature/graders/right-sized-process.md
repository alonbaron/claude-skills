---
type: llm
focus: trace
---

PASS if all of the following hold across the conversation:
- It announces in one short line that it's running architect (or equivalent)
  and proceeds without asking permission to start.
- It creates a right-sized doc set for a single feature — SOURCE_OF_TRUTH.md,
  a light ARCHITECTURE_ROADMAP.md, TODO_WORKFLOW.md, and CLAUDE.md — and does
  NOT scaffold the modular docs/architecture/ set, which is reserved for
  larger projects.
- It asks at most 3 blocking questions (e.g. PDF generation approach, email
  delivery provider, itinerary size limits) and states explicit assumptions
  for anything else instead of stalling on a long questionnaire.
- Failure paths for the export/email flow (PDF generation fails, email
  bounces, an oversized itinerary) are designed with a defined failure mode
  per component, not just the happy path.

FAIL if it stays silent instead of proactively running, over-scaffolds the
modular doc set for a single feature, asks more than 3 blocking questions
without stating assumptions, or only describes the happy path.
