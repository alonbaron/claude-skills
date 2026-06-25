---
name: ask-the-council
description: >
  Convene a panel of opinionated advisors (parallel Claude subagents, each with
  a distinct mandate and a forbidden move so they genuinely diverge), gather
  independent positions, optionally cross-critique, then deliver a Chairman
  synthesis that COMMITS to one recommendation with explicit tradeoffs. For
  high-stakes judgment, design, and tradeoff calls — not fact-finding (use
  deep-research for facts). Use when the user says "ask the council", "convene
  the council", "the council", "get a panel", or wants multiple expert
  perspectives on a decision.
argument-hint: "[the decision or question] [+ 'deep' for the full panel]"
---

# Ask the Council

A panel of advisors who are required to disagree, then a Chairman who decides.
Use for decisions and tradeoffs, not for gathering facts.

## Process

1. **Frame the decision.** Restate the question, the real options, and the
   binding constraints. If one missing fact would flip the answer, ask it (max
   1–2). Otherwise proceed on stated assumptions.
2. **Seat the council — in parallel.** Spawn advisors with the Agent tool, **all
   in one message**. Default panel of 4; `deep` seats all 6 and adds a critique
   round. Each advisor returns: **position · core reasoning · biggest risk they
   see · confidence (low/med/high)**.
3. **(deep only) Cross-critique.** Show each advisor the others' positions
   (unattributed) and have them name the single strongest opposing point.
4. **Chairman synthesis (you).** Not an average — a judgment. Output where they
   converge, where they split and *why*, the decisive tradeoff, and **one
   recommended path** with its rationale and the main risk to watch.

## The seats (mandate + forbidden move = real divergence)

- **Pragmatic Executor** — what ships fastest and safest with current resources.
  *Forbidden:* greenfield / ideal-world answers.
- **First-Principles** — reason up from fundamentals and constraints.
  *Forbidden:* citing "best practice" or precedent.
- **The Contrarian** — argue against the front-runner.
  *Forbidden:* agreeing with the apparent consensus.
- **Long-term Architect** — model-first; what this is at 10× scale and in two
  years. *Forbidden:* optimizing for today only.
- **The Adversary** — how this breaks in prod: failure paths, data loss,
  security. *Forbidden:* assuming the happy path.
- **The Outsider** *(deep panel)* — an analogy from a different domain.
  *Forbidden:* the field's standard framing.

Default 4 = Executor, First-Principles, Long-term Architect, Adversary.

## Output

Lead with the **recommendation** (one or two sentences). Then: the key split and
the tradeoff that decides it, then any dissent worth keeping. Short — a brief,
not a transcript.

## Rules

- Advisors must actually diverge; enforce it through the mandates. No
  fence-sitting, no five-hedged-options answers.
- The Chairman **commits** to a recommendation — naming the risk is allowed,
  refusing to choose is not.
- Separate opinion from fact; flag any claim that should be verified before
  acting. The council gives judgment, not ground truth.

## Done when

The user has a single clear recommendation, understands the strongest case
against it, and knows the one risk to watch.
