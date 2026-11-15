---
type: llm
focus: last_message
weight: 1
---
PASS if the final report has an explicit "Not reviewed" line or section that either names at least one thing the review did not cover (a file, a reviewer lens, or behaviour that was never run, such as "nothing was executed because Flask is not installed") or states that nothing was left out.

FAIL if the report has no line or section labelled as not reviewed. A caveat buried in a finding or in the closing paragraph does not count.
