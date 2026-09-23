---
name: fresh-branch-no-upstream
description: >-
  Local branch was created yesterday and never pushed, so it has no upstream
  tracking ref -- the divergence check up-to-date normally runs will fail,
  and it must say so plainly and fall back to comparing against origin's
  default branch instead of silently reporting "in sync".
tags: [must-fire, no-upstream, fallback, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

Let's keep going on the ShiftManager payment work -- I branched off
yesterday for the retry-backoff logic on flaky card charges but haven't
pushed it up yet. Pick up where I left off.
