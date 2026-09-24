---
type: llm
focus: last_message
weight: 1
---
PASS if the response treats this as a security-only ask and points to `/security-review` as the right tool (recommending it, or saying it tried it), instead of running a generic six-specialist review swarm.

FAIL if it runs or offers the six-lens swarm as the answer, never mentions `/security-review`, or makes a claim that `src/middleware/auth.js` contradicts. The file calls `jwt.verify(token, process.env.JWT_SECRET)` with no `algorithms` option and no try/catch, so saying the algorithm is not pinned, or that a bad token throws, is accurate, not invented.
