---
name: review-swarm
description: >-
  Reviews a diff with parallel local specialists, verifies each finding, and
  ranks the survivors as Blockers / Should-fix / Nits.
when_to_use: >-
  Use unasked after a non-trivial implementation or when asked to review a
  diff, branch, or PR. Also on "review-swarm", "swarm review", "deep
  review". Security is the whole ask: don't invoke this or spawn reviewers,
  even on "swarm". Open the final answer by naming /security-review, then
  run or recommend it; a one-pass review of your own may follow that line
  but never replaces it. Trivial diff (docs, rename, one-liner): read it
  once or point to /code-review; spawn nothing, even when named. Not for a
  fix request or when /code-review is named.
argument-hint: "[optional: 'staged' | 'branch' | a path]"
effort: high
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git merge-base *) Bash(git log *)
disallowed-tools: Edit Write NotebookEdit
---

# Review Swarm

!`git status --short 2>&1; echo "--- diff --stat (working tree)"; git diff --stat 2>&1; true`

The block above is the working tree's dirty state and diff shape, captured before you see the rest of this skill — raw command output, not analysis.

Review the working changes with a panel of specialists in parallel, then keep only the findings that survive scrutiny. The subagents are local and spend the user's own tokens: seven sonnet reviewers (six when there is no spec to check against), then an opus verifier for each non-trivial finding.

## Proactive use

If the user asks to review, check, or assess changes — or you've just finished a non-trivial implementation and a PR is next — invoke this without being asked: announce in one line ("Running review-swarm on <scope>") and proceed. Never ask permission to run the skill.

## Scope

Default: working tree vs the default branch. `staged` → `git diff --staged`; `branch` → vs merge-base with main; a path → limit to it. Read the changed hunks and enough surrounding code to judge them.

**Size guard:** over ~40 changed files or ~2000 changed lines, don't swarm the whole thing — split by area and say which slice you reviewed, or ask which slice matters. A swarm that overruns its context reports confidently on code it never read.

**Spec source:** find what the change was meant to do, in this order: the `TODO_WORKFLOW.md` row or design-doc section it implements, the PR or issue description, a spec path the user gave, the request as the user stated it in this conversation. Read it before spawning. If there is none, the Spec reviewer does not spawn and the report says "Spec: no spec found".

## Reviewers

Spawn the specialists below with the Agent tool, **all in one message** so they run concurrently, each with `model: sonnet`. Give each the diff plus the files it needs and its single lens. Each returns findings as: `severity · file:line · what · why · suggested fix`.

- **Correctness** — logic errors, edge cases, null/empty, off-by-one, concurrency/races.
- **Security & trust boundaries** — authz/authn (JWT), input validation at boundaries, injection, IDOR, leaked secrets.
- **Data & performance** — N+1 (JPA/Hibernate, SQLAlchemy), missing indexes, unbounded queries, transaction scope, lazy-load traps.
- **Architecture & altitude** — does it fit the domain model? are invariants enforced at the core? wrong layer, leaky abstraction.
- **Simplicity (ponytail lens)** — over-engineering, premature abstraction, dead code, a stdlib/native one-liner that replaces the change.
- **Tests & failure paths** — non-trivial logic with no test, untested failure paths, error handling that could lose data.
- **Spec** — the diff against the spec source, and nothing else. Give it the spec text along with the diff. It returns three kinds of finding: *missing* (the spec asks for it, the diff lacks it), *scope creep* (the diff does it, the spec never asked), *wrong* (both have it and they disagree). Each one quotes the spec line it rests on, in place of a severity.

## Verification

For each non-trivial finding, spawn a verifier with `model: opus` that tries to *refute* it. The verifier receives the claim and the code, and nothing else from the reviewer. Write its prompt to this recipe:

```
Claim: <the finding as one checkable sentence> at <file:line>
Code: <the hunk, plus the paths to read to judge the claim>
Task: try to refute the claim. Is it real, reproducible, not already handled elsewhere?
Return: holds | refuted | cannot tell, with the evidence (a file:line or command output). For "cannot tell", name the one fact that would settle it.
```

The reviewer's reasoning, its severity and its suggested fix stay out of that prompt: a verifier handed the argument tends to agree with it. For a Spec finding, the quoted spec line is part of the claim. You assign severity after the verdicts are in.

What each verdict does:

- **holds** → the finding is ranked in the report.
- **refuted** → dropped.
- **cannot tell** → it goes to Needs validation if the verifier named the missing fact (a column's type, a table's size, whether a gateway already enforces auth). With no nameable fact, drop it.

Never report a finding that has not been through the verifier pass.

## Model routing

Reviewers spawn with the Agent tool's `model` parameter set to `sonnet`; verifiers spawn with it set to `opus` — refutation is the judgment-heavy step and earns the stronger model. Naming the model in the spawn itself is what makes this portable: it doesn't depend on any installer's default subagent model.

## Report

Dedup overlaps, then fill every slot below, in this order. A slot with nothing in it keeps its line or heading and says "none": that is how the user knows it was checked.

```
Reviewed: <scope> · <n> files, <n> changed lines · spec: <its source, or "no spec found">
Not reviewed: <each file, lens or behaviour left out, with the reason> | nothing left out

## Spec
<missing | scope creep | wrong> · <file:line> · "<the spec line>" · <one-line fix>

## Blockers
## Should-fix
## Nits
<file:line> · <what, with the evidence that survived verification> · <one-line fix>

## Needs validation
<the claim> · <file:line> · missing fact: <the one fact that would settle it, and where to find it>

## What's solid
```

- **Not reviewed** names what this review cannot vouch for: files outside the slice you took, a reviewer that did not spawn, behaviour that could only be judged by running code that did not run.
- **Spec** findings sit above the ranking and outside it. Each is labelled missing, scope creep, or wrong, and carries the quoted spec line, the file:line where the change belongs, and a one-line fix. They take no rank because the fix may be to the spec: whether the code or the spec moves is the user's call.
- **Blockers → Should-fix → Nits** is the ranking, for findings whose verifier returned "holds".
- **Needs validation** lists the "cannot tell" findings. An entry without its missing fact does not belong here; drop it.
- **What's solid** is short. A dimension with nothing to flag gets one line there ("Security: no issues"), not a manufactured nit.

The slots are for a swarm that ran. A declined swarm (trivial diff, security-only ask) answers the way "When not to use" says, without them.

## Rules

- Every finding cites a real `file:line` from the diff. No speculative "you might consider" padding.
- A clean dimension gets one line, not a manufactured nit.
- Don't fix here — this is review. Offer to hand the ranked list to an implementer, or to `/code-review --fix`, if the user wants changes applied.
- Verify or say you don't know; never invent a path, API, number, or fact. Commits are the repo owner's alone: no AI co-author trailer, no AI mention in messages.

## When not to use

- A trivial diff (docs, rename, one-liner) — a single-pass read or plain `/code-review` covers it; a swarm is overkill. Invoked by name on one anyway: say so in one line, do the single-pass read yourself, and spawn no specialists.
- The ask is "fix it", not "review it" — implement, then swarm the result.
- Security is the whole ask → `/security-review`. Loaded on one anyway (the user said "swarm"): spawn no specialists, open the answer by naming `/security-review`, then run it or recommend it. If it can't run (no remote to diff against, say), keep that opening line, say why, and only then give a pass of your own.
- `/code-review` is named explicitly.

## Hand-offs

- Architecture findings that contradict the design docs → `architect audit`.
- The diff touches UI, forms, or markup → hand those hunks to `ux-designer` for the UX/a11y read; this swarm judges correctness, not interface quality.
- Simplicity findings the user accepts → `ponytail` the fix.
- Heavyweight cloud pass wanted → `/code-review ultra`.

## Relationship to built-ins

The local, your-stack-tailored swarm, paid for in the user's own subagent tokens. For the heavyweight cloud version, `/code-review ultra` runs specialists in the cloud; plain `/code-review` is a single-pass diff review; `/security-review` is the built-in for a security-only ask. Reach for this skill when you want parallel local specialists with adversarial verification and no cloud round trip.

## Done when

The user has a short, ranked, evidence-backed list where every ranked item is a real, verified problem in the diff — and knows what's clean, what still needs a fact, and what was not reviewed.
