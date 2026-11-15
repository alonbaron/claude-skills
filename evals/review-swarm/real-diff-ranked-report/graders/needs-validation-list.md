---
type: llm
focus: last_message
weight: 1
---
PASS if the final report has a "Needs validation" section, and every entry in it names the specific fact that is missing and would settle the claim (for example the column type of `user_id`, how many orders one user can have, or whether a gateway enforces auth upstream). A "Needs validation" section that says "none" is also a PASS.

FAIL if the report has no "Needs validation" section, or if an entry only calls a finding uncertain or unverified without naming the missing fact.
