---
name: review-swarm
description: >-
  Local, free, multi-specialist review of a diff: parallel Claude subagents
  for correctness, security/trust boundaries, data/perf, architecture-altitude,
  ponytail-simplicity, and tests/failure-paths, each non-trivial finding
  adversarially verified before being kept, deduped, and ranked into a
  Blockers / Should-fix / Nits report with file:line and a one-line fix per
  item.
when_to_use: >-
  Proactively after any non-trivial implementation, before the PR, and
  whenever asked to review, check, or assess a diff, branch, or PR. Also
  fires on "review-swarm", "swarm review", "deep review". Not for a trivial
  diff (docs, rename, one-liner) — a single-pass read or plain /code-review
  covers it. Not when the ask is to fix rather than review — implement
  first, then swarm the result. Not when security is the whole ask — hand
  off to /security-review. Not when /code-review is named explicitly.
argument-hint: "[optional: 'staged' | 'branch' | a path]"
effort: max
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git merge-base *) Bash(git log *)
disallowed-tools: Edit Write NotebookEdit
---

# Review Swarm

!`git status --short 2>&1; echo "--- diff --stat (working tree)"; git diff --stat 2>&1; true`

The block above is the working tree's dirty state and diff shape, captured before you see the rest of this skill — raw command output, not analysis.

Review the working changes with a panel of specialists in parallel, then keep only the findings that survive scrutiny. Free and local (Claude subagents).

## Proactive use

If the user asks to review, check, or assess changes — or you've just finished a non-trivial implementation and a PR is next — invoke this without being asked: announce in one line ("Running review-swarm on <scope>") and proceed. Never ask permission to run the skill.

## Scope

Default: working tree vs the default branch. `staged` → `git diff --staged`; `branch` → vs merge-base with main; a path → limit to it. Read the changed hunks and enough surrounding code to judge them.

**Size guard:** over ~40 changed files or ~2000 changed lines, don't swarm the whole thing — split by area and say which slice you reviewed, or ask which slice matters. A swarm that overruns its context reports confidently on code it never read.

## Reviewers

Spawn the six specialists below with the Agent tool, **all in one message** so they run concurrently, each with `model: sonnet`. Give each the diff plus the files it needs and its single lens. Each returns findings as: `severity · file:line · what · why · suggested fix`.

- **Correctness** — logic errors, edge cases, null/empty, off-by-one, concurrency/races.
- **Security & trust boundaries** — authz/authn (JWT), input validation at boundaries, injection, IDOR, leaked secrets.
- **Data & performance** — N+1 (JPA/Hibernate, SQLAlchemy), missing indexes, unbounded queries, transaction scope, lazy-load traps.
- **Architecture & altitude** — does it fit the domain model? are invariants enforced at the core? wrong layer, leaky abstraction.
- **Simplicity (ponytail lens)** — over-engineering, premature abstraction, dead code, a stdlib/native one-liner that replaces the change.
- **Tests & failure paths** — non-trivial logic with no test, untested failure paths, error handling that could lose data.

## Verification

For each non-trivial finding, spawn a verifier with `model: opus` that tries to *refute* it: is it real, reproducible, not already handled elsewhere? Default to dropping when uncertain. Never report a finding that has not been through the verifier pass.

## Model routing

Reviewers spawn with the Agent tool's `model` parameter set to `sonnet`; verifiers spawn with it set to `opus` — refutation is the judgment-heavy step and earns the stronger model. Naming the model in the spawn itself is what makes this portable: it doesn't depend on any installer's default subagent model.

## Report

Dedup overlaps, then rank: **Blockers → Should-fix → Nits**, each with file:line and a one-line fix. A dimension with nothing to flag gets one line ("Security: no issues"), not a manufactured nit. Close with a short "what's solid".

## Rules

- Every finding cites a real `file:line` from the diff. No speculative "you might consider" padding.
- A clean dimension gets one line, not a manufactured nit.
- Don't fix here — this is review. Offer to hand the ranked list to an implementer, or to `/code-review --fix`, if the user wants changes applied.
- Verify or say you don't know; never invent a path, API, number, or fact. Commits are the repo owner's alone: no AI co-author trailer, no AI mention in messages.

## When not to use

- A trivial diff (docs, rename, one-liner) — a single-pass read or plain `/code-review` covers it; a swarm is overkill.
- The ask is "fix it", not "review it" — implement, then swarm the result.
- Security is the whole ask → `/security-review`.
- `/code-review` is named explicitly.

## Hand-offs

- Architecture findings that contradict the design docs → `architect audit`.
- The diff touches UI, forms, or markup → hand those hunks to `ux-designer` for the UX/a11y read; this swarm judges correctness, not interface quality.
- Simplicity findings the user accepts → `ponytail` the fix.
- Heavyweight cloud pass wanted → `/code-review ultra`.

## Relationship to built-ins

The local, free, your-stack-tailored swarm. For the heavyweight cloud version, `/code-review ultra` runs specialists in the cloud; plain `/code-review` is a single-pass diff review; `/security-review` is the built-in for a security-only ask. Reach for this skill when you want parallel local specialists with adversarial verification and no cloud round trip.

## Done when

The user has a short, ranked, evidence-backed list where every item is a real, verified problem in the diff — and knows what's clean.
