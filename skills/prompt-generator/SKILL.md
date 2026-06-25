---
name: prompt-generator
description: >
  Turns a vague ask into a rigorous, grounded, token-efficient prompt for an
  agent or LLM. Bakes in explicit role + objective, testable success criteria,
  anti-hallucination rules (verify or say "I don't know", never invent
  files/APIs/facts), anti-tokenmaxing (output budget, no restating the prompt,
  lead with the answer), and strict agent rules (read before edit, ask when
  blocked, small reversible changes). Use whenever the user says
  "prompt-generator", "write a prompt", "make a prompt for", "improve this
  prompt", "turn this into a prompt", "prompt for an agent", or hands over a
  rough/sloppy prompt to tighten.
argument-hint: "[task, or a rough prompt to refine]"
---

# Prompt Generator

Produce the prompt the user should have written. A good prompt is precise,
grounded, and short — every token earns its place. You output a *prompt*, not
an essay about prompting.

## Process

1. **Read the intent.** What outcome does the user actually want, and who runs
   the prompt (a coding agent, a chat model, a one-shot task)?
2. **Ask only if blocked.** At most 1–2 questions, and only when a missing fact
   would change the prompt's structure. Otherwise proceed and list assumptions
   in one line.
3. **Draft** using the section menu — include only the sections the task needs
   (a one-shot classifier doesn't need "When blocked").
4. **Self-check** against the rubric below. Cut anything that doesn't change the
   model's behavior.
5. **Output** the finished prompt in a fenced block, then ≤3 lines on key
   choices and what to tune.

## Section menu (use what the task needs)

- **Role** — who the model is and its single objective.
- **Context / Inputs** — what it's given; mark placeholders as `{{like_this}}`.
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

## Output

The prompt in a fenced block, ready to paste. Then at most three lines: what you
assumed, what to tweak, and (if relevant) which rule you emphasized and why. No
lecture on prompt engineering.

## Done when

The prompt is self-contained, has a testable definition of done, carries the
grounding + efficiency rules, and contains nothing that doesn't change the
output. If your notes are longer than the prompt, cut the notes.
