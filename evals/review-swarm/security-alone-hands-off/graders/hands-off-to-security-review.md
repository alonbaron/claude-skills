---
type: llm
focus: last_message
weight: 1
---
PASS if the response recognizes this ask as security-only and hands off to `/security-review` (or clearly states that a dedicated security-only review is the right tool here) instead of running review-swarm's generic six-specialist swarm, and does not spawn reviewer subagents.

FAIL if it runs the six-lens swarm anyway, or fabricates specific vulnerability claims (e.g. asserting the JWT expiry or algorithm isn't checked) beyond what `src/middleware/auth.js` actually shows.
