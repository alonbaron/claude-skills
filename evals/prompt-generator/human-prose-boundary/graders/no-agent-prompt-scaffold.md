---
type: llm
focus: last_message
weight: 1
---

PASS if the final message gives the user the Slack message itself (or a
draft/question toward it) in ordinary human prose, without wrapping it in
formal agent-prompt scaffolding — i.e. it is not organized around labeled
sections like "Role", "Objective", "Context", "Done When" / "Success
Criteria", or "Output Format" written as instructions to an AI agent.

FAIL if the response is structured as such an agent-directed prompt (using
those or clearly equivalent labeled sections) for the task of writing the
Slack message, instead of producing the message itself.
