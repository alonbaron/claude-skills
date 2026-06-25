---
name: architect
description: >
  Produces and maintains a production-grade design doc system BEFORE code, in
  Alon's house format: SOURCE_OF_TRUTH.md, ARCHITECTURE_ROADMAP.md,
  TODO_WORKFLOW.md, and .clauderules (mirrored byte-for-byte to .cursorrules and
  imported by CLAUDE.md), plus a modular docs/architecture/ set for larger
  projects. Model first — data + invariants → enforcement at the core → failure
  paths → API contracts → NFRs → phased workstream. All four docs stay synced
  top-down at all times (docs before code). Design only, no implementation. Use
  when the user says "architect", "design doc", "spec this out", "before we
  build", "production-grade plan", "architecture for", "roadmap", "source of
  truth", or is starting a new app, feature, or workstream.
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
5. **`.clauderules`** — operating rules + the sync protocol (template below).
   Mirror it byte-for-byte to **`.cursorrules`**, and add a one-line root
   **`CLAUDE.md`** containing `@.clauderules` so Claude Code auto-loads it
   (Claude Code reads `CLAUDE.md`, not `.clauderules`).

## Sync protocol — the docs are never allowed to drift

This is the whole point. Bake it into `.clauderules` and obey it yourself:

- **Top-down, docs-before-code.** A change to any architectural fact updates
  `SOURCE_OF_TRUTH.md` first (if it touches a truth/invariant/decision), then
  `ARCHITECTURE_ROADMAP.md`, then the affected `docs/architecture/NN-*.md`,
  **then** the code. Never ship a change the docs don't yet describe.
- **One fact, one home, many links.** A detail is defined once and referenced by
  link elsewhere. Every doc header links to the others.
- **TODO tracks reality.** Every task cites the arch §/file it implements; a task
  that changes architecture names the doc it updated; statuses are current.
- **Mirror stays identical.** `.clauderules` ≡ `.cursorrules`, byte for byte.
- **Definition of "synced":** no architectural claim in code that isn't in the
  docs · no dead cross-links · `00-index` File Map matches files on disk · TODO
  statuses match git reality.

## `audit` mode

Given `architect audit`, do **not** author — verify sync and report drift: code
facts missing from the docs, dead links, index/file mismatches, stale TODO
statuses, `.clauderules` ≠ `.cursorrules`. Output a prioritized fix list and
offer to apply it.

## `.clauderules` template (generalize to the project)

```
# <Project> Rules

Stack: <one-line stack summary>.

## Git (mandatory, no exceptions)
- Open `feature/<topic>` branch BEFORE first edit. Never commit to `main`.
- Micro-commit per logical step. Conventional Commits (feat/fix/refactor/chore/docs/test).
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
If a task changes any architectural fact, update `SOURCE_OF_TRUTH.md` → `ARCHITECTURE_ROADMAP.md` → the modular `NN-*.md` FIRST, THEN write code. Keep `.cursorrules` identical to this file.
```

## Before you start

Ask 1–3 blocking questions only (scale, users, hard constraints, existing
stack). State assumptions for the rest and proceed — don't stall. Match depth to
size: a single feature → `SOURCE_OF_TRUTH` + a light `ARCHITECTURE_ROADMAP` +
`TODO_WORKFLOW` + `.clauderules`; a new product → add the modular
`docs/architecture/` set.

## Rules

- **No code in this phase.** Pseudocode for a tricky algorithm is fine; an
  implementation is not.
- Every component has a defined responsibility *and* a failure mode.
- Flag unknowns as open questions — never invent a constraint, a number, or an
  API you haven't confirmed.
- Decision-dense: tables and bullets, not prose. Call out reversed or forbidden
  decisions inline (`> Do not reintroduce X without an explicit decision`).

## Done when

The four docs exist, cross-link, and agree with each other and the planned code;
a competent dev could build from them without guessing the model, the
invariants, the failure handling, or the order — and `.clauderules` makes the
sync protocol non-optional for whoever builds it.
