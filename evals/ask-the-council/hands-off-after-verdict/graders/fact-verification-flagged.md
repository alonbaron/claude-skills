---
type: llm
focus: last_message
---
PASS if the response clearly separates the council's judgment/recommendation from specific facts that still need independent verification before acting (for example: actual Auth0 pricing at the stated user count, the current system's real hashing/token-revocation/reset-token behavior, or whether the project's roadmap already commits to a driver like SSO) — typically through a labeled section (e.g. "verify before acting") or explicit language marking those items as unverified rather than established. A bracketed placeholder or an "e.g." illustrative example naming what should be checked is not a violation, and the items do not need to be sourced or cited — only flagged as not yet confirmed.

FAIL if the response states specific numbers, pricing, or technical claims about the systems involved as settled fact without flagging them as unverified, or presents the panel's opinion as ground truth with no indication that anything should still be checked.
