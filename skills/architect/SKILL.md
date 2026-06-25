---
name: architect
description: >
  Produces a production-grade design doc set and a sequenced workstream BEFORE
  any code is written. Model-first: domain model + invariants → enforcement
  layer → failure-path design → API contracts → NFRs → small reversible build
  steps → a single source-of-truth roadmap. Design only, no implementation. Use
  when the user says "architect", "design doc", "spec this out", "before we
  build", "production-grade plan", "architecture for", or is starting a new app,
  feature, or workstream and wants the plan locked before execution.
argument-hint: "[what you're building]"
---

# Architect

Design the system before building it. Output is **documents and a workstream,
not code.** Optimize for decisions that survive contact with production.

Principles: **model first** (data + invariants before framework), **enforce
invariants at the core layer**, **design failure paths deliberately**, **ship in
small reversible steps**, keep **one roadmap as the source of truth**.

## Before you start

Ask 1–3 blocking questions only (scale, users, hard constraints, existing
stack). State assumptions for everything else and proceed — don't stall. Match
depth to size: a single feature gets a light version of this; a new product
gets the full set.

## The doc set

1. **Scope** — problem, target users, explicit non-goals, hard constraints. One
   tight PRD section, not a vision essay.
2. **Domain model (first)** — entities, relationships, state transitions, and
   the **invariants** that must always hold. For each invariant, name **where
   it's enforced** (core service, DB constraint, type) — never "the frontend
   will handle it".
3. **Architecture** — components, responsibilities, data flow, boundaries. Stack
   choices each get a one-line rationale. Record real decisions as mini-ADRs:
   *decision · why · alternative rejected*.
4. **Contracts** — APIs/interfaces: routes or signatures, request/response
   shapes, status/error codes.
5. **Failure-path design** — for each risky operation: what fails, how it's
   detected, what the user/system sees, how data loss is prevented. This is the
   section most plans skip; don't.
6. **NFRs** — security (trust boundaries, authz), performance (hot paths, N+1
   risks), observability (what you log/measure), data integrity.
7. **Workstream** — an ordered list of small, reversible, independently
   shippable steps, each with acceptance criteria and its dependency order. Mark
   MVP vs later.
8. **Roadmap SSOT** — one tracker doc that stays authoritative as work proceeds.

## Output

Offer to write these as markdown under `docs/architecture/` with a top-level
`ARCHITECTURE_ROADMAP.md` as the single source of truth (or inline if the task
is small). Use tables and bullets — decision-dense, not prose-padded.

## Rules

- **No code in this phase.** Pseudocode for a tricky algorithm is fine; an
  implementation is not.
- Every component has a defined responsibility *and* a failure mode. No "we'll
  figure it out later".
- Flag unknowns explicitly as open questions — never invent a constraint, a
  number, or an API you haven't confirmed.
- If a requirement is vague, surface it as a risk; don't paper over it with a
  confident guess.

## Done when

A competent dev could build it from these docs without guessing the data model,
the invariants, the failure handling, or the build order — and the roadmap says
what's done, next, and deferred.
