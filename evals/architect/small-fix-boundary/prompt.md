---
name: small-fix-boundary
description: Targeted addition to an existing doc set, not a re-author.
max_turns: 15
timeout_seconds: 300
tags: [needs-scaffold]
---

We already have SOURCE_OF_TRUTH.md and ARCHITECTURE_ROADMAP.md for our Cloudflare Workers auth service (Hono + D1). Product wants a rate limit of 100 requests/minute per IP on POST /login before we ship password reset next sprint. Can you spec that out?
