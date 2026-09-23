---
name: audit-drift-citation
description: Docs vs. code drift, cited on both sides, report-only.
max_turns: 15
timeout_seconds: 300
tags: [needs-scaffold]
---

Run architect audit on our repo. I think the docs are stale — we shipped a
Stripe webhook endpoint last week (POST /webhooks/stripe) and I don't think
it ever made it into the architecture roadmap or the API contract table.
