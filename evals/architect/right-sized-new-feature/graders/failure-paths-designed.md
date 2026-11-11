---
type: llm
focus:
  source: file
  path: ARCHITECTURE_ROADMAP.md
---

PASS if ARCHITECTURE_ROADMAP.md designs the failure paths of the export and
email flow, not just the happy path: failures such as PDF generation failing,
the email send failing or bouncing, and an oversized itinerary each get a
defined failure mode (what the system does, and what the user sees or can do
next).

FAIL if the file only describes the happy path, or names failures without
saying what happens when they occur.
