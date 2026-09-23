---
name: ask-the-council
description: >-
  Convenes a panel of opinionated Claude advisors, each with a distinct
  mandate and a forbidden move so they genuinely diverge, then a Chairman
  synthesis that commits to one recommendation with the decisive tradeoff and
  the strongest dissent named.
when_to_use: >-
  Trigger proactively for high-stakes design, architecture, or tradeoff
  decisions where credible options genuinely compete and being wrong is
  expensive to reverse — schema, auth model, vendor lock-in, an irreversible
  migration. Also on "ask the council", "the council", "get a panel". Not for
  fact-finding (the council opines, it doesn't verify — run research
  instead), not for calls with one obvious answer, and not for anything
  reversible in an afternoon: decide, ship, and revisit if it bites.
argument-hint: "[the decision or question] [+ 'deep' for the full panel]"
effort: max
---

# Ask the Council

A panel of advisors who are required to disagree, then a Chairman who
decides. Use for decisions and tradeoffs, not for gathering facts.

## Proactive use

If a decision is high-stakes and the options genuinely compete — architecture
choice, buy-vs-build, irreversible migration — invoke this without being
asked: announce in one line ("Convening the council: <decision>") and
proceed. Never ask permission to run the skill.

Gate it first: if you can't name what the wrong choice costs to reverse,
don't seat the council — decide directly and move on. A panel costs 4–6 opus
subagents; spend that only where being wrong is expensive to undo.

## Frame and seat the council

Restate the decision, the real options, and the binding constraints. If one
missing fact would flip the answer, ask it (max 1–2 questions) — otherwise
proceed on stated assumptions. Then spawn the advisors with the Agent tool,
all in one message, so they run in parallel. Each returns: **position · core
reasoning · biggest risk they see · confidence (low/med/high)**. On `deep`,
once all seats report, show each advisor the others' positions
(unattributed) and have them name the single strongest opposing point.

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
`deep` seats all 6 and adds the cross-critique round. The forbidden move is
what forces real divergence instead of four agents politely agreeing — keep
it non-negotiable; seat count never changes.

## Model routing

Spawn every advisor seat — and the deep-mode critique round — with the Agent
tool's `model` parameter set to `opus`: this is the one skill in the plugin
whose entire value is the quality of independent judgment per seat, and it
shouldn't silently inherit whatever subagent default a given session has.
The Chairman synthesis is never a subagent — it runs in the main thread, on
the session's own model, because committing to a recommendation needs the
full conversation context the advisors don't have. Naming `model: opus` in
the spawn itself is what makes this portable: it doesn't depend on any
installer's default subagent model.

The Chairman synthesis is not an average of the seats' positions — it's a
judgment call. Weigh the seats, don't tally them; a 3–1 split doesn't win by
count if the lone dissent names the risk that actually decides it.

## Output

Lead with the **recommendation** (one or two sentences). Then: the key split
and the tradeoff that decides it, then any dissent worth keeping. Short — a
brief, not a transcript.

## Boundaries

- The Chairman **commits** to a recommendation — naming the risk is allowed,
  refusing to choose is not.
- Advisors must actually diverge; enforce it through the mandates. No
  fence-sitting, no five-hedged-options answers.
- Separate opinion from fact; flag any claim that should be verified before
  acting. The council gives judgment, not ground truth.
- Not for fact-finding — run a research pass instead; the council opines, it
  doesn't verify. Not for low-stakes or one-obvious-answer calls — deciding
  directly is cheaper and faster than a panel.
- Verify or say you don't know; never invent a path, API, number, or fact.
  Commits are the repo owner's alone: no AI co-author trailer, no AI mention
  in messages.

## Hand-offs

- Verdict chosen → `ponytail` the winning option down to its minimal build.
- Verdict changes an architectural fact → `architect` updates
  `SOURCE_OF_TRUTH.md` before any code.

## Done when

The user has a single clear recommendation, understands the strongest case
against it, and knows the one risk to watch.
