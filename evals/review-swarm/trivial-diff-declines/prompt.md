---
name: trivial-diff-declines
description: review-swarm should recognize a rename-plus-typo diff as trivial and decline the full six-lens swarm
tags: [review-swarm, boundary, trivial-diff, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: Skill fires, declines to run the full six-specialist swarm on this trivial diff, and points to a single-pass read or /code-review instead.
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

I renamed `userId` to `accountId` across `src/users.js`, `src/orders.js`, and `src/session.js` in our Node API, and fixed a typo in a comment while I was in there (`recieve` -> `receive`). Nothing's committed yet. Can you run review-swarm on this before I open the PR?
