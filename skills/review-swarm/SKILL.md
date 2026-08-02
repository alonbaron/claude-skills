---
name: review-swarm
description: >
  Local, free, multi-specialist review of a diff: parallel Claude subagents
  (correctness, security/trust boundaries, data/perf, architecture-altitude,
  ponytail-simplicity, tests/failure paths), adversarial verification, dedup,
  ranked file:line report. Use proactively when asked to review, check, or
  assess a diff, branch, or PR — and after any non-trivial implementation,
  before the PR. Also on "review-swarm", "swarm review", "deep review". Not for
  trivial diffs, not when asked to fix rather than review, not when security
  alone is the whole ask (built-in "security-review"), and not when
  "/code-review" is named explicitly.
argument-hint: "[optional: 'staged' | 'branch' | a path]"
---

# Review Swarm

Review the working changes with a panel of specialists in parallel, then keep
only the findings that survive scrutiny. Free and local (Claude subagents).

## Proactive use

If the user asks to review, check, or assess changes — or you've just finished
a non-trivial implementation and a PR is next — invoke this without being
asked: announce in one line ("Running review-swarm on <scope>") and proceed.
Never ask permission to run the skill.

## Steps

1. **Scope the diff.** Default: working tree vs the default branch. `staged` →
   `git diff --staged`; `branch` → vs merge-base with main; a path → limit to
   it. Read the changed hunks and enough surrounding code to judge them.
   **Size guard:** over ~40 changed files or ~2000 changed lines, don't swarm
   the whole thing — split by area and say which slice you reviewed, or ask
   which slice matters. A swarm that overruns its context reports confidently
   on code it never read.
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

## When not to use

- A trivial diff (docs, rename, one-liner) — a single-pass read or plain
  `/code-review` covers it; a swarm is overkill.
- The ask is "fix it", not "review it" — implement, then swarm the result.

## Hand-offs

- Architecture findings that contradict the design docs → `architect audit`.
- The diff touches UI, forms, or markup → hand those hunks to `ux-designer`
  for the UX/a11y read; this swarm judges correctness, not interface quality.
- Simplicity findings the user accepts → `ponytail` the fix.
- Heavyweight cloud pass wanted → `/code-review ultra`.

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
