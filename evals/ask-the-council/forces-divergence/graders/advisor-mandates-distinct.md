---
type: llm
focus: trace
---
PASS if the trace shows at least four Agent tool calls whose prompts/descriptions each assign a genuinely different analytical stance on the event-sourcing vs. CRUD-with-audit-trigger decision — for example, one advisor is told to argue for event-sourcing, another for the CRUD approach, another to focus on a cross-cutting concern such as failure modes, long-term scale, delivery speed, or team capacity. The seats do not need to be labeled with the exact names from the skill (e.g. "Pragmatic Executor") — grade only whether the assigned angle differs, not whether a specific label string appears. Two advisors ending up recommending the same option is fine as long as their assigned reasoning/mandate differs; this grader is about the mandates diverging, not the conclusions.

FAIL if fewer than four Agent calls with a distinct mandate appear anywhere in the visible trace, or if the spawn prompts are near-duplicates of each other (same question, no distinguishing angle assigned).
