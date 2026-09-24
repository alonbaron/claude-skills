---
type: llm
focus: last_message
weight: 1
---

PASS if the response actually gives the user something usable toward the
Slack message right now: either a written draft of the message (with
placeholders for details the user didn't supply is fine), or a specific
clarifying question paired with a clear offer to write it once answered.

FAIL if the response declines to help, or only describes in the abstract
what a good message would contain, without producing a draft or a concrete
offer/question that moves the user toward one.
