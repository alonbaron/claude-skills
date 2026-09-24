---
type: llm
focus: last_message
---
PASS if, after the chairman commits to a recommendation, the response addresses what happens next by explicitly naming `architect` and/or `ponytail` as the next step (e.g. "run the architect skill", "hand off to ponytail"), giving a reason tied to the verdict (architect to record a changed architectural fact in SOURCE_OF_TRUTH.md; ponytail to cut the winning option to its minimal build) — OR explicitly declines any hand-off right now with reasoning tied to the verdict (for example: staying with the current system doesn't change an architectural fact, so no SOURCE_OF_TRUTH update is needed unless a stated tripwire fires later).

FAIL if the response stops at the recommendation with no discussion of a next step, if it tells the user to edit SOURCE_OF_TRUTH.md or start building/implementing without naming the responsible skill (architect or ponytail) or explaining why no hand-off applies, or if it names a next-step skill other than architect or ponytail.
