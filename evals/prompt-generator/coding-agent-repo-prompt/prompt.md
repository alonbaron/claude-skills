---
name: coding-agent-repo-prompt
description: >-
  Hand-off request for a coding-subagent prompt against a repo, with an
  explicitly unverified hypothesis and a fix destined for a real repo — must
  fire prompt-generator, hedge the hypothesis, bake in agent discipline and
  the up-to-date hand-off, and never touch the filesystem itself.
tags: [must-fire, grounding, hand-off, portable]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
---

I need a prompt I can hand to a coding subagent. Point it at our repo at
C:/dev/acme-api (Node/Express + Postgres) and have it track down and fix an
intermittent 500 on POST /orders whenever quantity is 0. My hunch is an
unguarded divide-by-zero in pricing.js, but I haven't actually opened the file
to check. Write me the prompt to hand off — don't go fix it yourself, I just
need the prompt.
