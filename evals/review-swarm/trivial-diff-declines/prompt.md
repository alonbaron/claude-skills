---
name: trivial-diff-declines
description: A rename-plus-typo diff is trivial, and review-swarm's when_to_use excludes it. review-swarm must not fire, and no six-lens swarm runs.
tags: [review-swarm, must-not-fire, boundary, trivial-diff, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: Skill does not fire; the response does a single pass or points to /code-review.
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

I renamed `userId` to `accountId` across `src/users.js`, `src/orders.js`, and `src/session.js` in our Node API, and fixed a typo in a comment while I was in there (`recieve` -> `receive`). Nothing's committed yet. Can you run review-swarm on this before I open the PR?
