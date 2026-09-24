---
name: hands-off-after-verdict
description: After the council verdicts on an irreversible auth migration, the skill should name the right next-step skill and separate its opinion from facts still needing verification.
tags: [ask-the-council, handoff, portable]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Skill, Agent]
---

Ask the council: should we migrate our auth from a homegrown JWT setup to Auth0? We have SOURCE_OF_TRUTH.md and ARCHITECTURE_ROADMAP.md for this project already, and about 40k monthly active users on the current system.
