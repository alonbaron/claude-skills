---
name: security-alone-hands-off
description: A security-only ask is /security-review's job. review-swarm may load on the word "swarm", but it must spawn no specialists and the answer should point to /security-review.
tags: [review-swarm, boundary, security, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: No specialists are spawned, whether or not the skill loads; the response points to /security-review instead of running a six-lens swarm.
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

We just added JWT validation middleware in `src/middleware/auth.js` on our Express API — checks the Authorization header, verifies the signature, attaches `req.user` — but haven't committed it yet. Can you swarm review it for security holes? That's literally the only thing I care about right now, not style or perf.
