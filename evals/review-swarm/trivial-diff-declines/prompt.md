---
name: trivial-diff-declines
description: The user names review-swarm on a rename-plus-typo diff. Loading the skill or not are both fine; what matters is that no six-lens swarm runs and a single-pass read or /code-review is offered instead.
tags: [review-swarm, boundary, trivial-diff, needs-scaffold]
max_turns: 40
timeout_seconds: 900
expected_outcome: No specialist swarm; a single-pass read or /code-review instead, whether or not the skill loads.
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

I renamed `userId` to `accountId` across `src/users.js`, `src/orders.js`, and `src/session.js` in our Node API, and fixed a typo in a comment while I was in there (`recieve` -> `receive`). Nothing's committed yet. Can you run review-swarm on this before I open the PR?
