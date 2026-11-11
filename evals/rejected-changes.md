# Rejected skill changes

Append-only. One row per skill or description change that was tried and dropped on eval evidence, so the same change isn't proposed twice without new evidence. Accepted changes go in the README's "What's new", not here.

| Date | Skill | Attempted change | Evidence | Outcome |
|:---|:---|:---|:---|:---|
| 2026-11-10 | ponytail | `when_to_use` rewritten to name the three request shapes that trigger it (b048245) | No effect on pushback-on-abstraction. The cause was the runner's skill-listing budget dropping descriptions, fixed by `listing_budget` 40000 (run 42837413273). The run that tested the rewrite is not recorded. | Reverted in 8f4158e |
| 2026-11-11 | review-swarm | Listing text cut from 1,233 to 591 characters (5efcedc). The security clause lost "final" and "a one-pass review of your own may follow that line but never replaces it". | security-alone-hands-off 0.50 in run 43083796116 (1.00 in run 42992490426). Both runs called `/security-review` first and spawned no reviewers, but the final answer never named it. | Clause restored in 16ec451 at 671 characters; the rest of the cut stays. Re-run pending. |
| 2026-11-11 | ponytail | Listing text cut from 1,049 to 568 characters (5efcedc) | refuses-trust-boundary and root-cause 0.75 in run 43083796116 (both 1.00 in run 42838366081): the skill was not invoked in any of the 4 runs. Which dropped phrase caused it is not established. | Reverted in 16ec451. Re-run pending. |
