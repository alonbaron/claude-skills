# whole-build-scope-check

Aggregates: {"score":1,"passRate":1,"scoreWithout":0.6666666666666666,"passRateWithout":0,"delta":0.33333333333333337}

## with#0 score=1 turns=3

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Here's the prompt. One concern first: "all in one go" is the riskiest way to build a billing system, so the prompt makes the agent deliver it in ordered phases with a checkpoint after each, all within the single run. Fill the `{{placeholders}}` before pasting.

````markdown
# Role
You are a senior backend engineer building a multi-tenant billing system from scratch in this repo. Your single objective: a working, tested system covering Stripe integration, usage-based metering, invoicing, and an admin dashboard, delivered in the phases below.

# Inputs
- Stack: {{language/framework}}, {{database}}, {{frontend framework for dashboard}}
- Stripe: test-mode keys in env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Never hardcode keys.
- Pricing model: {{e.g. per-seat base fee + metered API calls, monthly billing}}
- Tenant model: {{e.g. one organization = one tenant; users belong to one org}}
- Currency: {{e.g. USD only}}. Tax handling: out of scope unless stated here.

# Ground truth
Establish this before writing code. Do not assume any of it.
1. Read the repo root, existing package manifest, and any CLAUDE.md or docs. If the repo is empty, say so and scaffold.
2. Check the installed Stripe SDK version and use only APIs that exist in that version. Confirm against the SDK's types, not memory.
3. Correct me if any input above contradicts what you find.

# Non-negotiable design rules
- Money is integer minor units (cents). Never floats. All timestamps UTC.
- Every tenant-owned table carries `tenant_id`. Isolation is enforced at two boundaries: database (row-level security or a mandatory scoped query layer) and API (tenant resolved from auth, never from request body).
- Stripe is the source of truth for payment state. The local DB mirrors it via webhooks; never mark an invoice paid from a client call.
- Webhooks: verify signature, persist the raw event with its Stripe event id before processing, process idempotently, return 200 only after durable persistence. Duplicate events are a no-op.
- Usage events are append-only and idempotent on a client-supplied `idempotency_key`. Aggregation is a separate step; never mutate raw events.
- Invoices move draft → finalized → paid | void. Finalized invoices are immutable; corrections are credit notes or new invoices.
- All outbound Stripe writes use idempotency keys.
- Design the failure paths: Stripe unreachable, webhook out of order, usage reported after period close, tenant deleted mid-cycle. Each has explicit handling and a test.

# Phases (complete each fully, in order)
1. **Foundation**: schema + migrations for tenants, users, customers, plans, subscriptions, usage_events, invoices, invoice_line_items, webhook_events. Tenant scoping layer. Tests prove cross-tenant reads return nothing.
2. **Stripe integration**: customer + subscription lifecycle, webhook endpoint, event log. Tests use recorded Stripe fixtures, not live calls.
3. **Metering**: usage ingestion endpoint, idempotency, per-period aggregation job, push to Stripe (Billing Meters if the SDK version supports it, otherwise invoice items). Tests cover duplicate and late events.
4. **Invoicing**: generate from aggregated usage + subscription fees, finalize, sync state from Stripe webhooks, PDF or HTML render. Tests cover state transitions and immutability.
5. **Admin dashboard**: tenants, subscriptions, usage per period, invoices, webhook event log with replay, manual actions (void invoice, retry sync). Admin auth separate from tenant auth.
6. **Hardening**: end-to-end test of one full billing cycle, README with setup, env vars, how to run Stripe CLI webhook forwarding locally.

After each phase: run the full test suite, commit with a plain descriptive message, and write a ≤10-line status block (done, skipped, known gaps). Do not start the next phase with failing tests.

# Agent discipline
- Read before you edit. Verify every path, symbol, and SDK method exists before referencing it.
- Small, reversible changes. No refactoring beyond the task.
- Use only facts from the repo, the SDK, or these inputs. Unknown means stating the assumption, not inventing a plausible answer.
- Commits are authored by the repo's git user only. No AI co-author lines, no mention of AI in messages.
- If a step fails or is skipped, say so explicitly in the status block.

# When blocked
Stop and ask if: the pricing model is ambiguous in a way that changes the schema, the Stripe SDK lacks a required API, or a phase cannot pass its tests. State exactly what you need. Do not guess and continue.

# Output
Per phase: the status block only. No preamble, no narration of intent. Final message: a ≤150-word summary of what exists, what does not, and how to run it.

# Done when
- All six phases committed, full suite green.
- A cross-tenant access test exists and passes at both DB and API layers.
- A replayed duplicate webhook and a duplicate usage event each produce no change.
- A finalized invoice cannot be mutated by any code path.
- README lets a new developer run a full billing cycle locally against Stripe test mode.
````

Assumed a greenfield repo with no existing design docs and Stripe test mode only. Tweak the pricing model and tenant model lines first, since those drive the schema. Since this is a whole build, running `/alon-skills:architect` first to produce SOURCE_OF_TRUTH and roadmap docs would give the agent far better grounding than any single prompt, and this prompt could then point at those docs instead of restating the rules.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## with#1 score=1 turns=3

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
**One concern first:** a "build everything in one go" prompt is the single most common way to get a plausible-looking billing system that silently double-charges or leaks tenants. Billing is where I'd normally push `architect` to produce the design docs before a single line of code. I've kept the full scope you asked for, but structured the prompt as ordered phases with a hard stop-and-report gate after each, so the agent can't barrel through a broken foundation.

Your working directory is empty (no commits, no code), so stack choices are placeholders for you to fill.

````markdown
# Role
You are a senior backend engineer building a multi-tenant SaaS billing system from scratch in this repo. Objective: a working, tested system covering Stripe integration, usage-based metering, invoicing, and an admin dashboard. Correctness with money matters more than speed or feature count.

# Stack (fill in; do not choose for me)
- Language/framework: {{e.g. TypeScript + Node 22 + Fastify}}
- Database: {{e.g. Postgres 16}} with migrations
- Frontend for admin dashboard: {{e.g. React + Vite}}
- Stripe: use the official SDK, API version pinned in code. Test mode only.
- Package manager / test runner: {{e.g. pnpm + vitest}}

# Ground truth
- The repo is empty except for git init. There is no existing code, schema, or config. Do not assume any.
- Stripe test keys will be provided via `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars. Never hardcode keys. Never call live mode.
- Correct me if any of the above is wrong before starting.

# Non-negotiable invariants (enforce in the DB schema AND in application code)
1. Tenant isolation: every billing table carries `tenant_id`; every query is scoped by it. No cross-tenant read is possible through any API endpoint.
2. Money is stored as integer minor units (cents) plus an ISO currency code. Never floats.
3. Usage events are append-only and idempotent: each has a client-supplied `idempotency_key` unique per tenant. Replays are no-ops, not duplicates.
4. Stripe webhooks: verify signature, persist the raw event with its Stripe event ID before processing, and process each event ID at most once. Out-of-order delivery must not corrupt state.
5. Invoices are immutable once finalized. Corrections are credit notes or new invoices, never edits.
6. Every state transition (subscription, invoice, payment) is written to an audit log with actor, timestamp, before/after.
7. Any Stripe call that creates a charge, invoice, or subscription uses a Stripe idempotency key derived from our own record ID.

# Phases (do them in order; STOP and report after each)
1. Schema + migrations: tenants, customers, plans, prices, subscriptions, usage_events, invoices, invoice_line_items, payments, credit_notes, stripe_events, audit_log. Include indexes for tenant-scoped lookups. Write it down in `docs/DATA_MODEL.md` before writing code.
2. Metering: `POST /usage` endpoint, idempotent ingest, an aggregation job that rolls usage into billable quantities per subscription per period. Tests for replay, late-arriving events, and period boundaries.
3. Stripe integration: customer/subscription sync, webhook endpoint, reconciliation job that detects drift between our records and Stripe. Tests use Stripe's test fixtures or a recorded-response mock. No live network in unit tests.
4. Invoicing: generate draft invoices from aggregated usage plus flat fees, finalize, push to Stripe, handle payment succeeded/failed webhooks, dunning state machine (retries, grace period, suspension).
5. Admin dashboard: tenant list, per-tenant subscription/invoice/usage views, manual actions (issue credit note, retry payment, void draft) each writing to the audit log. Read-only by default; mutating actions require a confirm step.

At each STOP: list what was built, what tests pass (paste the runner summary), what was skipped or is uncertain, and wait for my go-ahead.

# Rules
- Read before you edit. Verify a path, symbol, or Stripe API method exists before referencing it. Do not invent Stripe fields or endpoints; if unsure, say so and check the SDK types.
- No plausible guesses about money math, tax, proration, or rounding. State the rule you're applying and where it came from. Tax calculation is out of scope: store a `tax_amount` field, leave it zero, and note it.
- Small, reversible commits per phase step. No unasked refactors.
- Report honestly: a failing or skipped test is reported as failing or skipped, never described as "mostly working."
- Commits are authored by me alone. No AI co-author lines, no `Co-Authored-By`, no mention of AI in commit messages.
- Output budget per STOP report: ≤300 words plus the test summary. No preamble, no restating the task.

# When blocked
Ask one specific question with your recommended default. Do not proceed on an assumption that affects money movement, tenant scoping, or schema shape.

# Done when
- All five phases complete and every invariant above has at least one test that would fail if it were violated.
- A fresh clone can run `{{install}}`, `{{migrate}}`, `{{test}}` and get green with no Stripe network access.
- A tenant cannot read another tenant's data through any endpoint (covered by an explicit test).
- Replaying the same webhook payload or usage event three times leaves the database identical to replaying it once (covered by an explicit test).
- `docs/DATA_MODEL.md` matches the migrations.
````

**Assumed:** greenfield repo, single-currency-per-tenant, tax out of scope. Swap the `{{placeholders}}` for your stack before pasting.
**Tweak:** if you'd rather the agent run unattended, delete the "wait for my go-ahead" clause but keep the per-phase reports.
**Emphasized:** invariants enforced at two boundaries and explicit "no guessing on money math," because those are the failures a plausible-looking billing build hides best.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## without#0 score=0.6666666666666666 turns=1

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=false scored=true withOnly=false
grader threw: judge call failed: You've hit your session limit · resets 8:50pm (Asia/Jerusalem)

## without#1 score=0.6666666666666666 turns=1

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=false scored=true withOnly=false
grader threw: judge call failed: You've hit your session limit · resets 8:50pm (Asia/Jerusalem)
