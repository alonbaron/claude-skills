---
name: security-alone-hands-off
description: A security-only ask is /security-review's job, and review-swarm's when_to_use says so. review-swarm must not fire, and the answer should point to /security-review.
tags: [review-swarm, must-not-fire, boundary, security, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: Skill does not fire; the response points to /security-review instead of running a six-lens swarm.
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

We just added JWT validation middleware in `src/middleware/auth.js` on our Express API — checks the Authorization header, verifies the signature, attaches `req.user` — but haven't committed it yet. Can you swarm review it for security holes? That's literally the only thing I care about right now, not style or perf.
