---
name: defers-to-simplify
description: Tidying a finished, working diff is built-in /simplify's job, and ponytail's when_to_use says so. Ponytail must not fire, and the helpers must not be re-litigated as if they were new code.
tags: [ponytail, must-not-fire, boundary, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Skill]
---

This PR already works and is merged-ready, but I added a couple of helper functions I probably didn't need along the way — formatDateRange() and isValidSlug() in src/utils.ts — can you clean it up before I open the PR?
