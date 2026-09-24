---
name: root-cause
description: A bug report naming one symptom (signup) in a shared email-normalization helper should be fixed at the shared helper, not patched only in the caller the report happened to name.
tags: [ponytail, root-cause, needs-scaffold]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Grep, Skill]
---

We got a bug report: users who sign up with an email that has a trailing space (common with mobile autofill, like "user@example.com ") end up unable to log in afterward — signup silently stores the untrimmed address. The signup flow normalizes the email through normalizeEmail() in src/lib/normalize.js. Can you fix it?
