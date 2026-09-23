---
name: pushback-on-abstraction
description: An ordinary caching ask padded with a pluggable-backend interface and a swappable eviction-policy interface should get pushed back to the simplest rung that works, not built as asked.
tags: [ponytail, abstraction, portable]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Skill]
---

I'm adding response caching to our Node/Express API for the /products endpoint since it's getting hammered. Can you build a Cache class with a pluggable backend interface (in-memory now, Redis later) and a CacheStrategy interface so we can swap eviction policies down the line?
