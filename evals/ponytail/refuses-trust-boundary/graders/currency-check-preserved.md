---
type: regex
pattern: USD[\s\S]{0,40}EUR[\s\S]{0,40}GBP
match: contains
target:
  source: file
  path: src/checkout.ts
---
