---
# Informational: the skill's own boundary says a repo with no remote gets one line and the task,
# so answering from the description alone without invoking the skill is acceptable. min 0 keeps
# the grader as a fire-rate readout only.
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?up-to-date"'
min: 0
---
