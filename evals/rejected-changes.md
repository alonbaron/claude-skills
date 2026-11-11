# Rejected skill changes

Append-only. One row per skill or description change that was tried and dropped on eval evidence, so the same change isn't proposed twice without new evidence. Accepted changes go in the README's "What's new", not here.

| Date | Skill | Attempted change | Evidence | Outcome |
|:---|:---|:---|:---|:---|
| 2026-11-10 | ponytail | `when_to_use` rewritten to name the three request shapes that trigger it (b048245) | No effect on pushback-on-abstraction. The cause was the runner's skill-listing budget dropping descriptions, fixed by `listing_budget` 40000 (run 42837413273). The run that tested the rewrite is not recorded. | Reverted in 8f4158e |
