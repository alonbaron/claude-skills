---
name: ask-the-council
description: >
  Convenes a panel of opinionated advisors (parallel Claude subagents, each with
  a distinct mandate and a forbidden move so they genuinely diverge), then a
  Chairman synthesis that COMMITS to one recommendation with explicit tradeoffs.
  Use proactively for any high-stakes design, architecture, or tradeoff decision
  where credible options genuinely compete. Also on "ask the council", "the
  council", "get a panel". Not for fact-finding or decisions with one obvious
  answer — answer those directly.
argument-hint: "[the decision or question] [+ 'deep' for the full panel]"
---

# Ask the Council

A panel of advisors who are required to disagree, then a Chairman who decides.
Use for decisions and tradeoffs, not for gathering facts.

## Proactive use

If a decision is high-stakes and the options genuinely compete — architecture
choice, buy-vs-build, irreversible migration — invoke this without being asked:
announce in one line ("Convening the council: <decision>") and proceed. Never
ask permission to run the skill.

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

## When not to use

- Fact-finding — run a research pass; the council opines, it doesn't verify.
- Low-stakes or one-obvious-answer calls — deciding directly is cheaper and
  faster than a panel.

## Hand-offs

- Verdict chosen → `ponytail` the winning option down to its minimal build.
- Verdict changes an architectural fact → `architect` updates
  `SOURCE_OF_TRUTH.md` before any code.

## Done when

The user has a single clear recommendation, understands the strongest case
against it, and knows the one risk to watch.

## Global rules

Apply on every run — canonical home `~/.claude/CLAUDE.md`:
- **Ground everything.** Only what's given or verified; never invent files, APIs, or facts. Unknown → say "I don't know" or state the assumption.
- **No tokenmaxing.** Lead with the answer; keep an output budget; no filler, no restating the question.
- **Agent discipline.** Read before you edit; small reversible changes; ask when blocked, don't guess; report failures honestly.
- **Commits are the user's alone.** Author = the user; never add an AI co-author or `Co-Authored-By`/credit line, and don't mention AI in commit messages.
