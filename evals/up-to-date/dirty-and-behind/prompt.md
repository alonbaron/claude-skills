---
name: dirty-and-behind
description: >-
  Repo is behind its upstream by two commits and has an uncommitted edit in a
  tracked file — up-to-date must fire, report both facts, and refuse to pull
  on the dirty tree without confirmation instead of quietly syncing.
tags: [must-fire, sync-decision, dirty-tree, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Glob, Skill, Agent, TodoWrite]
---

Picking back up on the TenderTrack backend — I want to add pagination to the
tenders list endpoint. Heads up, I was messing with the API client yesterday
and never committed it, it's just sitting there in the working tree.
