---
name: human-prose-boundary
description: >-
  A request for human-facing prose (a Slack message to a team), not a prompt
  for another agent or LLM — prompt-generator must not fire, and the response
  must not force this into an agent-prompt shape or invent details.
tags: [must-not-fire, boundary, portable]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Skill]
---

Can you write me a good Slack message to send my team explaining why
yesterday's deploy got delayed and what we're doing to make sure it doesn't
happen again?
