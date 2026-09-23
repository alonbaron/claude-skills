---
name: security-alone-hands-off
description: review-swarm should hand a security-only ask to /security-review instead of running its generic six-lens swarm
tags: [review-swarm, boundary, security, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: Skill fires, recognizes the ask is security-only, and hands off to /security-review instead of spawning reviewer subagents.
---

We just added JWT validation middleware in `src/middleware/auth.js` on our Express API — checks the Authorization header, verifies the signature, attaches `req.user` — but haven't committed it yet. Can you swarm review it for security holes? That's literally the only thing I care about right now, not style or perf.
