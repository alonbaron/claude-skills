---
name: defers-to-simplify
description: A finished, merge-ready PR with two small helper functions the author now second-guesses should be handed off to /simplify, not re-run through the ladder as if it were new code.
tags: [ponytail, hand-off, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Skill]
---

This PR already works and is merged-ready, but I added a couple of helper functions I probably didn't need along the way — formatDateRange() and isValidSlug() in src/utils.ts — can you clean it up before I open the PR?
