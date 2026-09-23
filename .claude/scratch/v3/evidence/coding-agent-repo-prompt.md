# coding-agent-repo-prompt

Aggregates: {"score":0.8333333333333333,"passRate":0.5,"scoreWithout":0.6666666666666666,"passRateWithout":0,"delta":0.16666666666666663}

## with#0 score=1 turns=3

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Here's the hand-off prompt.

````markdown
# Role
You are a coding agent working in the repo at `C:/dev/acme-api` (Node/Express + Postgres).
Single objective: find the root cause of an intermittent HTTP 500 on `POST /orders` when
the request has `quantity: 0`, fix it, and prove the fix with a test.

# Ground truth (verify each before relying on it; correct me if any is wrong)
- Repo path: `C:/dev/acme-api`. Stack: Node, Express, Postgres.
- Symptom: `POST /orders` with `quantity: 0` returns 500. Reported as **intermittent**.
- Hypothesis from the reporter, **not verified, file not yet opened**: an unguarded
  divide-by-zero in a file named `pricing.js`. Treat this as a lead, not a conclusion.
  Confirm the file exists and read it before referencing it.

# Rules
- Use only what you can read or run in the repo. Never invent file paths, function
  names, or error text. If a path from this prompt doesn't exist, say so and search.
- Reproduce before you fix. A divide-by-zero is deterministic; the report says
  *intermittent*. If your reproduction is deterministic, explain the gap or find the
  real nondeterministic cause (race, connection pool, cached price, null row, etc.).
  Do not declare the hunch confirmed unless you have a failing request or test that
  shows it.
- Separate fact from inference in your report. Flag anything you could not confirm.
- Smallest correct change. No refactors, no reformatting, no unrelated cleanups.
- Read a file before editing it. Don't touch files outside the bug's blast radius.
- Do not commit. Leave changes in the working tree for the user to review and commit.
- If you cannot reproduce after a reasonable effort, stop and report what you tried.
  Do not ship a speculative guard and call it fixed.

# Steps
1. Run `up-to-date` (or `git fetch` + `git status`) and confirm a clean tree on the
   expected branch.
2. Locate the `POST /orders` route handler and trace the call path from request
   validation through pricing and DB writes. Note every place `quantity` is used as a
   divisor, array index, or loop bound, and every code path that differs by
   product/customer/inventory state.
3. Find how tests are run (`package.json` scripts) and how the app is run locally.
   Reproduce the 500 with `quantity: 0`. Capture the stack trace. If it does not fail
   every time, vary the inputs that differ between runs until you can explain why.
4. Identify the root cause. Decide, based on existing validation patterns in the
   repo, whether `quantity: 0` should be rejected with a 400 at validation or handled
   in pricing. Follow the repo's existing convention rather than inventing a new one.
5. Write a failing test that reproduces the bug at the level the repo already tests
   (route-level or unit-level, whichever exists). Then apply the fix. Confirm the new
   test passes and the full suite still passes.
6. Report.

# When blocked
- Ambiguous intended behavior (400 vs. 200 with zero total vs. something else): pick
  the option matching the repo's existing validation convention, state it as an
  assumption in the report, and make it trivial to flip.
- No local DB or no way to run the app: say so, fall back to unit tests around the
  suspect code, and state clearly that the end-to-end path was not exercised.

# Output format (≤ 300 words, plus diff and test output in code blocks)
1. **Root cause**, one or two sentences, with `file:line`. State whether the
   divide-by-zero hunch was correct, partly correct, or wrong.
2. **Why it was intermittent**, or an explicit "could not explain intermittency."
3. **Fix**: files changed and the diff.
4. **Proof**: the reproduction (request or test) failing before and passing after,
   with actual command output.
5. **Not verified / skipped**: anything you couldn't run or confirm.

# Done when
- A test exists that fails on the old code and passes on the new code.
- The full existing test suite passes.
- `POST /orders` with `quantity: 0` no longer returns 500.
- The report explains the intermittency or explicitly says it could not.
- Nothing is committed.
````

Assumed: the repo has some test runner and the agent can run it locally. Tweak the intended behavior for zero quantity if you already know it (reject with 400 vs. accept with zero total). Emphasized the reproduce-first rule because "intermittent" and "divide-by-zero" don't naturally go together, so the hunch may be a red herring.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## with#1 score=0.6666666666666666 turns=3

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL PASS FAIL

<evidence>
Here's the hand-off prompt.

````markdown
# Role
You are a senior Node.js engineer working in the repo at `C:/dev/acme-api`
(Express + Postgres). Your single objective: find the root cause of an
intermittent HTTP 500 on `POST /orders` when the request's `quantity` is `0`,
fix it with a minimal change, and prove the fix with a test.

# Ground truth (verify before relying on; correct me if any is wrong)
- Repo path: `C:/dev/acme-api`. Stack: Node/Express, Postgres.
- Symptom: `POST /orders` with `quantity: 0` returns 500 **intermittently**,
  not every time.
- Hunch from the requester, NOT verified — they have not opened the file:
  an unguarded divide-by-zero in a file called `pricing.js`. Treat this as
  one hypothesis to test, not as the answer. Confirm the file exists and read
  it before citing it. If the bug is elsewhere, say so and follow the evidence.
- Note: a plain `x / 0` in JS yields `Infinity`/`NaN`, not a throw, and would
  fail deterministically. "Intermittent" suggests something else may be
  involved (e.g. `NaN` reaching a Postgres numeric column, a code path only
  hit for some products/promos, a race, or input coercion). Do not force the
  evidence to fit the hunch.

# Steps
1. Run `up-to-date` first (sync/brief the repo). Note the current branch and
   any dirty tree.
2. Locate the `POST /orders` handler and trace the full request path:
   validation -> pricing/calculation -> DB write -> response. Record every
   place `quantity` is used as a divisor, in a `Math.*` call, or written to
   the DB.
3. Reproduce before fixing. Write a failing test (or a scripted request
   against a local server) that sends `quantity: 0`. If the 500 is
   intermittent, vary the inputs that differ between passing and failing runs
   (product, discount, tier, existing rows) until it fails reliably. Capture
   the actual stack trace / Postgres error.
4. Identify the root cause from the trace, not from the hunch. State it in one
   sentence with `file:line`.
5. Fix at the right layer. Decide and state which applies:
   - `quantity: 0` is invalid input -> reject with 400 and a clear message at
     the validation boundary, and also guard the calculation so it can't
     produce `NaN`/`Infinity`.
   - `quantity: 0` is legitimate -> guard the calculation so it returns a
     defined value and the DB write succeeds.
   Prefer the smallest change that makes the failing test pass. Do not
   refactor pricing logic beyond the fix.
6. Run the full existing test suite plus your new test. Report the results
   verbatim (pass/fail counts, any failures).
7. Do NOT commit. Leave changes in the working tree for review.

# Rules
- Read a file before editing it. Never reference a path, function, or symbol
  you have not confirmed exists in this repo.
- Separate fact from inference: "confirmed" vs "suspected", always.
- If you cannot reproduce the 500 after a reasonable effort, stop and report
  exactly what you tried and what you observed. Do not ship a speculative fix
  and call it done.
- Small, reversible edits only. No unrelated cleanup, no dependency changes.
- No preamble. No restating the task. No hedging filler.

# When blocked
If the repo can't be found, tests can't run (missing DB, env vars), or the
correct behavior for `quantity: 0` (400 vs allowed) is genuinely ambiguous
after reading the code and any validation schema, ask one specific question
and stop.

# Output format (<=250 words plus code)
1. **Root cause** — one sentence, with `file:line`. Was the hunch right?
   Yes / No / Partly, in one line.
2. **Why it was intermittent** — one or two sentences, from evidence.
3. **Fix** — the diff (fenced).
4. **Proof** — the new test (fenced) and verbatim test-run output.
5. **Not done / uncertain** — anything skipped, unverified, or that needs a
   human decision. "None" if none.

# Done when
- A test that sent `quantity: 0` fails before the fix and passes after.
- `POST /orders` with `quantity: 0` returns a deliberate 4xx or a valid 2xx,
  never a 500, across the input variations that previously triggered it.
- Full test suite passes.
- Root cause is stated from an actual stack trace or DB error, not inferred
  from the hunch alone.
- Nothing is committed.
````

Assumed: the agent has a runnable local DB or test harness, and that whether quantity 0 should be rejected or allowed is decidable from the existing code. Tweak: if you already know 0 should be a 400, replace the either/or in step 5 with that decision. I emphasized "reproduce before fixing" and demoted the pricing.js hunch to a hypothesis, because an intermittent failure does not match a plain divide-by-zero and anchoring on it is the main way this hand-off goes wrong.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## without#0 score=0.6666666666666666 turns=1

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
Here's a handoff prompt. I wrote it so the agent treats your pricing.js hunch as a lead to verify, not a conclusion, since you haven't opened the file yet.

```markdown
# Task: Fix intermittent 500 on POST /orders when quantity is 0

Repo: C:/dev/acme-api (Node/Express + Postgres)

## Problem
POST /orders returns an intermittent HTTP 500 when the request body has
`quantity: 0`. It does not fail every time, so there is likely a
data-dependent or timing-dependent path involved.

## Starting lead (unverified)
There may be an unguarded divide-by-zero in pricing.js (e.g. computing a
per-unit price or discount ratio with quantity as the divisor). This is a
hunch only. Nobody has confirmed it by reading the code. Check it first,
but do not stop there if it doesn't fully explain the behavior.

Note that in JavaScript, `x / 0` yields `Infinity` or `NaN` rather than
throwing. So if a divide-by-zero is involved, the actual 500 is probably
thrown downstream: a Postgres error on inserting NaN/Infinity into a
numeric column, a JSON serialization failure, a validation library
rejecting the value, or similar. Trace it all the way to the throw.

## Steps
1. Reproduce before changing anything. Find how the app is started and
   tested (package.json scripts, README, docker-compose, .env.example).
   Send POST /orders with quantity 0 several times and capture the full
   stack trace from the server logs. If reproduction requires specific
   seed data or DB state, document what it needs.
2. Explain the intermittency. Identify what varies between a passing and
   a failing request with the same payload (e.g. product has a discount
   vs. not, cached price vs. fresh DB lookup, presence of a promo, race
   with another query). The fix is not done until this is understood.
3. Locate the root cause. Start with pricing.js and the POST /orders
   route handler, then follow the call chain: validation middleware,
   service layer, DB queries, response serialization.
4. Fix the root cause, not the symptom. Prefer rejecting quantity 0 at
   input validation with a 400 and a clear error message if the domain
   does not allow zero-quantity orders. If zero-quantity orders are
   legitimate (check existing tests, schema constraints, and other
   callers), guard the arithmetic instead and return a sane price of 0.
   State which of these you chose and why.
5. Add a regression test that sends quantity 0 to POST /orders and
   asserts the intended status code. If the intermittency depends on
   specific data, cover both the passing and failing variants.
6. Run the full existing test suite and confirm it passes.

## Constraints
- Do not change the DB schema or add migrations without flagging it.
- Do not refactor unrelated code in pricing.js.
- Keep the change minimal and consistent with the surrounding style.

## Report back with
- The confirmed root cause, with file paths and line numbers.
- Why it was intermittent.
- Whether the pricing.js divide-by-zero hunch was correct, partially
  correct, or wrong.
- The diff summary and the test you added.
- Test suite output (pass/fail, with any failures verbatim).
- Anything you could not verify or had to assume.
```

Two things worth adjusting before you hand it off. If you know whether zero-quantity orders are ever valid in your domain, say so explicitly in the prompt so the agent doesn't have to infer it from tests. And if there's a known way to run the app locally, such as a docker-compose file or a specific npm script, name it in step 1 to save the agent discovery time.
</evidence>

## without#1 score=0.6666666666666666 turns=1

### grader `no-edit` passed=true scored=true withOnly=false
Edit called 0x (expected 0..0)

### grader `no-write` passed=true scored=true withOnly=false
Write called 0x (expected 0..0)

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
Here's a handoff prompt. I framed your divide-by-zero hunch as a lead to verify rather than a conclusion, since you haven't opened the file, so the agent won't tunnel on it if the real cause is elsewhere.

```markdown
# Task: Fix intermittent 500 on POST /orders when quantity is 0

## Repo
C:/dev/acme-api — Node/Express API backed by Postgres.

## Problem
POST /orders intermittently returns HTTP 500 when the request body contains
a line item with `quantity: 0`. It should never 500. Depending on what the
handler is supposed to do, the correct behavior is either a 400 validation
error or successful handling of a zero-quantity item. Determine which from
the existing validation rules, schema, and tests, and say which you chose
and why.

## Starting hypothesis (unverified)
The person handing this off suspects an unguarded divide-by-zero in
pricing.js (something like unit price = total / quantity, or a per-unit
discount calculation). Treat this as a lead, not a diagnosis. They have
not opened the file. Confirm or rule it out with evidence before changing
anything.

Note that in JavaScript, dividing by zero yields Infinity or NaN rather
than throwing. So if pricing.js is involved, the 500 probably comes from
somewhere downstream that chokes on Infinity/NaN, such as a Postgres
numeric column rejecting the value, a JSON serializer, a rounding helper,
or an assertion. Trace the whole path, not just the arithmetic.

## Steps
1. Reproduce first. Find the POST /orders route, its validation layer,
   and pricing.js. Write a failing test (or a curl/supertest script) that
   sends quantity 0 and observe the actual error and stack trace. Do not
   guess at the cause from reading code alone.
2. Explain the "intermittent" part. A pure divide-by-zero would be
   deterministic. Look for what makes it flaky: a code path that only
   runs when a discount/promo/tax rule applies, a DB constraint hit only
   for certain products, a race with another request, or a cached
   pricing result masking the bug on some calls. If you cannot make it
   reproduce reliably, say so and report what you tried.
3. Fix the root cause, not the symptom. Do not just wrap the handler in
   try/catch and return 400. If validation should reject quantity 0,
   add it at the existing validation layer so it is consistent with the
   other rules. If zero is legitimate, make pricing handle it correctly.
4. Add a regression test for quantity 0 in the existing test suite,
   following its conventions. Also check quantity as a negative number,
   a string "0", and a missing quantity, and note whether those need
   the same fix (fix them if they're the same bug; otherwise just report).
5. Run the full test suite and confirm it passes. Include the command
   and output summary.

## Constraints
- Keep the change minimal and scoped to this bug. Don't refactor pricing.js.
- Don't change the API contract for the success case.
- Don't modify database migrations unless the root cause is a schema issue,
  and flag it clearly if so.
- Match the repo's existing style, validation library, and error format.

## Report back with
- Root cause, with the file:line and the actual error/stack you observed.
- Whether the divide-by-zero hunch was right, wrong, or partially right.
- What explains the intermittency.
- The diff summary and the test you added.
- Test suite results.
- Anything you noticed but deliberately left alone.
```

Two things worth deciding before you hand it off, if you have opinions: whether quantity 0 should be a 400 or a legitimate order, and whether the agent may touch migrations. The prompt currently tells the agent to infer the first from the codebase and to flag the second rather than proceed.
</evidence>
