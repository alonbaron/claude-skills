---
# Informational: the boundary holds whether the skill fires and declines or the model answers directly
# from the description alone, so firing is not required. min 0 keeps the grader as a fire-rate readout.
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?ask-the-council"'
min: 0
---
