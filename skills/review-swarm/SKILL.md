---
name: review-swarm
description: >
  Local, free, multi-specialist review of the working diff using parallel Claude
  subagents, then adversarial verification of every finding, dedup, and a ranked
  report with file:line evidence. Specialists: correctness, security/trust
  boundaries, data/perf (N+1, transactions), architecture-altitude,
  ponytail-simplicity, and tests/failure-paths. Complements the built-in
  /code-review (this is local + tailored; /code-review ultra is the cloud one).
  Use when the user says "review-swarm", "swarm review", "multi-agent review",
  or "deep review this diff".
argument-hint: "[optional: 'staged' | 'branch' | a path]"
---

# Review Swarm

Review the working changes with a panel of specialists in parallel, then keep
only the findings that survive scrutiny. Free and local (Claude subagents).

## Steps

1. **Scope the diff.** Default: working tree vs the default branch. `staged` →
   `git diff --staged`; `branch` → vs merge-base with main; a path → limit to
   it. Read the changed hunks and enough surrounding code to judge them.
2. **Fan out specialists — in parallel.** Spawn the reviewers below with the
   Agent tool, **all in one message** so they run concurrently. Give each the
   diff plus the files it needs and its single lens. Each returns findings as:
   `severity · file:line · what · why · suggested fix`.
   - **Correctness** — logic errors, edge cases, null/empty, off-by-one,
     concurrency/races.
   - **Security & trust boundaries** — authz/authn (JWT), input validation at
     boundaries, injection, IDOR, leaked secrets.
   - **Data & performance** — N+1 (JPA/Hibernate, SQLAlchemy), missing indexes,
     unbounded queries, transaction scope, lazy-load traps.
   - **Architecture & altitude** — does it fit the domain model? are invariants
     enforced at the core? wrong layer, leaky abstraction.
   - **Simplicity (ponytail lens)** — over-engineering, premature abstraction,
     dead code, a stdlib/native one-liner that replaces the change.
   - **Tests & failure paths** — non-trivial logic with no test, untested
     failure paths, error handling that could lose data.
3. **Adversarially verify.** For each non-trivial finding, spawn a verifier that
   tries to *refute* it: is it real, reproducible, not already handled
   elsewhere? Drop findings that don't survive. Default to dropping when
   uncertain.
4. **Synthesize.** Dedup overlaps, then rank: **Blockers → Should-fix → Nits**,
   each with file:line and a one-line fix. Close with a short "what's solid".

## Rules

- Every finding cites a real `file:line` from the diff. No speculative "you
  might consider" padding.
- A dimension with nothing to flag gets one line ("Security: no issues"), not a
  manufactured nit.
- Don't fix here — this is review. Offer to hand the ranked list to an
  implementer (or to `/code-review --fix`) if the user wants changes applied.

## Relationship to built-ins

This is the **local, free, your-stack-tailored** swarm. For the heavyweight
cloud version, `/code-review ultra` runs specialists in the cloud; plain
`/code-review` is a single-pass diff review. Reach for this skill when you want
parallel local specialists with adversarial verification and no cloud round
trip.

## Done when

The user has a short, ranked, evidence-backed list where every item is a real,
verified problem in the diff — and knows what's clean.

## Global rules

Apply on every run — canonical home `~/.claude/CLAUDE.md`:
- **Ground everything.** Only what's given or verified; never invent files, APIs, or facts. Unknown → say "I don't know" or state the assumption.
- **No tokenmaxing.** Lead with the answer; keep an output budget; no filler, no restating the question.
- **Agent discipline.** Read before you edit; small reversible changes; ask when blocked, don't guess; report failures honestly.
- **Commits are the user's alone.** Author = the user; never add an AI co-author or `Co-Authored-By`/credit line, and don't mention AI in commit messages.
