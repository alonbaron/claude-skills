---
name: whole-build-scope-check
description: >-
  A single-prompt ask for an entire multi-tenant billing system build —
  prompt-generator must fire, recognize this is architect's job (a whole
  build, not one hand-off prompt), and either surface that hand-off or scope
  the prompt down with the mega-scope risk named.
tags: [must-fire, hand-off, scoping, portable]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill]
---

Write me a prompt I can give to a coding agent to build our entire
multi-tenant billing system from scratch — Stripe integration, usage-based
metering, invoicing, and an admin dashboard, all in one go.
