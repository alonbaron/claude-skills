---
name: no-remote-boundary
description: >-
  A git repo with no remote configured at all -- up-to-date should recognize
  there's nothing to sync, say so in about one line, and move straight into
  the actual task instead of trying to fetch or building a full sync brief.
tags: [must-fire, no-remote, boundary, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

No remote here, just a personal script I've been hacking on in
~/scratch/csv-tools -- let's add a function that converts a CSV file to
JSON.
