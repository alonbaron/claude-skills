---
name: architect
description: >
  Produces Alon's design-doc system BEFORE code: SOURCE_OF_TRUTH,
  ARCHITECTURE_ROADMAP, TODO_WORKFLOW, CLAUDE.md (+ modular docs/architecture).
  Model first: data + invariants → core enforcement → failure paths → API
  contracts → phased workstream. Use proactively when a new app, feature, or
  workstream is starting and code hasn't been written, or docs may have drifted
  (audit). Also on "architect", "design doc", "spec this out", "roadmap". Not
  for small fixes inside a current design.
argument-hint: "[what you're building]   ·   add 'audit' to check existing docs for drift"
---

# Architect

Design and document the system before building it — in the house doc format,
kept in sync at all times. Output is **documents, not code.**

Principles, enforced *in the docs*: **model first** (data + invariants before
framework) · **enforce every invariant at the core**, ideally at *two*
boundaries (app-layer validation **and** a DB constraint) — never "the frontend
handles it" · **design failure paths** as deliberately as happy paths · **small,
reversible, independently shippable steps** · **one source of truth** —
everything else derives from it and links back.

## Proactive use

If a new app, feature, or workstream is starting and no current design docs
exist, invoke this without being asked: announce in one line — "Running
architect: <why>" — and proceed. Never ask permission to run the skill; the 1–3
blocking questions below are still allowed.

## The four artifacts (+ the modular set)

Authority flows top-down. A fact lives in exactly one place and is linked from
everywhere else.

1. **`SOURCE_OF_TRUTH.md`** (apex) — the canonical, slow-changing truth: scope &
   non-goals · the domain model · the **invariants** and *where each is
   enforced* · the load-bearing decisions as mini-ADRs (*decision · why ·
   alternative rejected*). If anything conflicts with this file, this file wins.
   Keep it tight — it is the contract, not the manual.
2. **`ARCHITECTURE_ROADMAP.md`** — architecture + phased plan derived from the
   SoT. Header block (`Version · Status · Owner`), then §-numbered: `0` Executive
   context · `1` Tech stack (Layer · Tech · Role table) · `2` Data schema
   (low-level: columns, types, constraints, indexes, JSONB shapes, decision
   call-outs) · `3` Backend (structure · services · API-contract table) · `4`
   Frontend · `5` Execution phases · `6` Non-functional requirements.
3. **`docs/architecture/00-index.md` + `01-…NN`** (larger projects only) —
   agent-friendly modular extracts of the roadmap sections. The index carries a
   **File Map** table (# · file · covers · roadmap §), a **Dependency Graph**
   (ASCII), and a **Quick Reference** ("I need to work on X → read these files").
4. **`TODO_WORKFLOW.md`** — the task tracker. Status legend (`[ ]` ·
   `[IN PROGRESS]` · `[FINISHED - PENDING MERGE]` · `[MERGED/DONE]` ·
   `[BLOCKED]`); tasks grouped by phase; each row:
   `# · Task · Architecture Ref (linked to the §/file) · Status · Branch`.
5. **`CLAUDE.md`** (project root) — the rules file Claude Code auto-loads:
   operating rules + the sync protocol (template below). One markdown file — no
   `.clauderules`, no `.cursorrules`, no import shim.

## Sync protocol — the docs are never allowed to drift

This is the whole point. Bake it into `CLAUDE.md` and obey it yourself:

- **Top-down, docs-before-code.** A change to any architectural fact updates
  `SOURCE_OF_TRUTH.md` first (if it touches a truth/invariant/decision), then
  `ARCHITECTURE_ROADMAP.md`, then the affected `docs/architecture/NN-*.md`,
  **then** the code. Never ship a change the docs don't yet describe.
- **One fact, one home, many links.** A detail is defined once and referenced by
  link elsewhere. Every doc header links to the others.
- **TODO tracks reality.** Every task cites the arch §/file it implements; a task
  that changes architecture names the doc it updated; statuses are current.
- **Definition of "synced":** no architectural claim in code that isn't in the
  docs · no dead cross-links · `00-index` File Map matches files on disk · TODO
  statuses match git reality.

## `audit` mode

Given `architect audit`, do **not** author — verify sync and report drift: code
facts missing from the docs, dead links, index/file mismatches, stale TODO
statuses. Output a prioritized fix list and offer to apply it.

Every drift item cites **both sides**: the `file:line` in code that states the
fact, and the doc (+ § or line) that should describe it and doesn't. No item
without both is a finding — it's a hunch, and hunches don't go in the list.

## `CLAUDE.md` template (generalize to the project)

```
# <Project> — Rules

Stack: <one-line stack summary>.

## Git (mandatory, no exceptions)
- Open `feature/<topic>` branch BEFORE first edit. Never commit to `main`.
- Micro-commit per logical step. Conventional Commits (feat/fix/refactor/chore/docs/test).
- Commits are authored by the repo owner alone — never add an AI co-author or `Co-Authored-By` trailer, never mention AI in commit messages or PRs.
- Never delete branches. Never force-push. Never skip hooks. PRs only.

## Workflow
1. Locate the task in `TODO_WORKFLOW.md`; mark `[IN PROGRESS]`; state which architecture file you reference.
2. Load `SOURCE_OF_TRUTH.md` + the relevant `docs/architecture/*.md` before coding. Never guess an API surface — verify against version-pinned context.
3. Update status: `[FINISHED - PENDING MERGE]` at PR open, `[MERGED/DONE]` after merge, `[BLOCKED]` with the blocker noted.
4. PR when every task in a phase is `[FINISHED - PENDING MERGE]`.

## Reference precedence
- Apex truth: `SOURCE_OF_TRUTH.md`.
- Architecture + phases: `ARCHITECTURE_ROADMAP.md`.
- Modular details: `docs/architecture/00-index.md` (start there).
- Tasks: `TODO_WORKFLOW.md`.

## Architecture-change rule (sync)
If a task changes any architectural fact, update `SOURCE_OF_TRUTH.md` → `ARCHITECTURE_ROADMAP.md` → the modular `NN-*.md` FIRST, THEN write code.
```

## Before you start

Ask 1–3 blocking questions only (scale, users, hard constraints, existing
stack). State assumptions for the rest and proceed — don't stall. Match depth to
size: a single feature → `SOURCE_OF_TRUTH` + a light `ARCHITECTURE_ROADMAP` +
`TODO_WORKFLOW` + `CLAUDE.md`; a new product → add the modular
`docs/architecture/` set.

## Rules

- **No code in this phase.** Pseudocode for a tricky algorithm is fine; an
  implementation is not.
- Every component has a defined responsibility *and* a failure mode.
- Flag unknowns as open questions — never invent a constraint, a number, or an
  API you haven't confirmed.
- Decision-dense: tables and bullets, not prose. Call out reversed or forbidden
  decisions inline (`> Do not reintroduce X without an explicit decision`).

## When not to use

- A small fix or task already covered by current design docs — just do it.
- Pure implementation of an already-designed phase — code, don't re-spec.

## Hand-offs

- Repo with a remote → run `up-to-date` first so the design builds on latest code.
- A load-bearing decision with genuinely competing options → `ask-the-council`
  before locking it into `SOURCE_OF_TRUTH.md`.
- After a phase is implemented → `review-swarm` the diff before the PR.
- The doc set carries prose a human (not an agent) will read — §0 executive
  context, a README, a mini-ADR rationale → `humanizer` on *those passages
  only*. The tables, invariants, and contracts stay as they are; they're
  reference text, and "sounding human" is not a goal there.

## Global rules

Apply on every run — canonical home `~/.claude/CLAUDE.md`:
- **Ground everything.** Only what's given or verified; never invent files, APIs, or facts. Unknown → say "I don't know" or state the assumption.
- **No tokenmaxing.** Lead with the answer; keep an output budget; no filler, no restating the question.
- **Agent discipline.** Read before you edit; small reversible changes; ask when blocked, don't guess; report failures honestly.
- **Commits are the user's alone.** Author = the user; never add an AI co-author or `Co-Authored-By`/credit line, and don't mention AI in commit messages.

## Done when

The four docs exist, cross-link, and agree with each other and the planned code;
a competent dev could build from them without guessing the model, the
invariants, the failure handling, or the order — and `CLAUDE.md` makes the sync
protocol non-optional for whoever builds it.
