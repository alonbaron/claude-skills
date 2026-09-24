---
name: prompt-generator
description: >-
  Turns a vague ask into a rigorous, grounded, token-efficient prompt for
  another agent or LLM: role and objective, testable done criteria,
  anti-hallucination and anti-tokenmaxing rules baked into the generated
  prompt itself, and strict agent discipline for coding-agent hand-offs.
when_to_use: >-
  Use proactively when the user hands over a prompt, a task spec, or a "have
  it do X" destined for another agent or LLM — also on "write a prompt",
  "improve this prompt", "prompt for an agent". Not for text a human will
  read (docs, messages, specs for people) — just write it. Not for work
  you'll execute yourself this session — just do it, don't write yourself a
  prompt.
argument-hint: "[task, or a rough prompt to refine]"
---

# Prompt Generator

Produce the prompt the user should have written. A good prompt is precise,
grounded, and short — every token earns its place. You output a *prompt*, not
an essay about prompting.

## Proactive use

If the user hands over text another agent or LLM will run — a rough prompt, a
task spec, a "have it do X" — invoke this without being asked: announce in one
line ("Tightening this into a rigorous prompt") and proceed. Never ask
permission to run the skill.

## Draft it

Read the intent: what outcome does the user actually want, and who runs the
prompt — a coding agent, a chat model, a one-shot task? Ask only if blocked —
at most 1–2 questions, and only when a missing fact would change the prompt's
structure; otherwise proceed and list assumptions in one line. Pick sections
from the menu below, only what the task needs — a one-shot classifier doesn't
need "When blocked." Before you output, check the draft against Done When and
cut anything that doesn't change the model's behavior.

## Section menu (use what the task needs)

- **Role** — who the model is and its single objective.
- **Context / Inputs** — what it's given; mark placeholders as `{{like_this}}`.
- **Ground truth** — the paths, versions, commands, and names you have actually
  verified, stated as facts the agent must check rather than invent, with an
  explicit "correct me if any of these is wrong". A coding-agent prompt without
  this section is where hallucinated file paths come from.
- **Rules** — the grounding + efficiency rules below, plus task-specific ones.
- **Steps** — ordered, only if the task is genuinely multi-step.
- **Output format** — exact shape; lead with the answer.
- **When blocked** — what to do on ambiguity or missing data.
- **Done when** — testable success criteria.

## Rules every generated prompt must carry

**Grounding (no hallucination):**
- Use only what's given or verifiably checked. Never invent file paths, APIs,
  function names, numbers, or citations.
- Unknown? Say "I don't know" or state the assumption — don't fill the gap with
  a plausible guess.
- Separate fact from inference. Claims that need checking are flagged, not
  asserted.

**Efficiency (no tokenmaxing):**
- Lead with the answer. No preamble, no restating the question, no "great
  question", no summary of what you're about to do.
- Set an output budget (e.g. "≤200 words", "code + ≤3 lines"). Match length to
  the task, not to fill space.
- No hedging filler. One clear recommendation beats five caveated options.

**Agent discipline (when the prompt drives a coding/tool agent):**
- Read before you edit; verify a path or symbol exists before referencing it.
- Make small, reversible changes. Don't refactor unasked.
- When blocked or ambiguous, ask — don't guess and barrel ahead.
- Report honestly: if a step failed or was skipped, say so.
- Commits are the user's alone — author = the user; never add an AI co-author
  or `Co-Authored-By`/credit line, and don't mention AI in commit messages.

## When not to use

- Text a human will read (docs, messages, specs for people) — that's writing,
  not prompting; just write it.
- Work you'll do yourself in this session — just do it; don't write yourself a
  prompt.

## Hand-offs

- The prompt drives a coding agent onto a repo → bake "run `up-to-date` first"
  into its steps.
- The task behind the prompt is a whole build → suggest `architect` for the
  design docs instead of one mega-prompt.

## Output

The prompt in a fenced block, ready to paste. Then at most three lines: what you
assumed, what to tweak, and (if relevant) which rule you emphasized and why. No
lecture on prompt engineering.

## Done when

The prompt is self-contained, has a testable definition of done, carries the
grounding + efficiency rules, and contains nothing that doesn't change the
output. If your notes are longer than the prompt, cut the notes.
