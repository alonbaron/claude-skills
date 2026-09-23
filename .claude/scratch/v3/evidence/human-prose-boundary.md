# human-prose-boundary

Aggregates: {"score":0.5,"passRate":0,"scoreWithout":0.5,"passRateWithout":0,"delta":0}

## with#0 score=0.5 turns=1

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
I don't have details on what actually caused the delay, so here's a draft with the specifics marked in brackets for you to fill in. The structure is what matters: what happened, why, what changed, and what's next.

```
Hey team, quick update on yesterday's deploy.

**What happened**
The [service/release name] deploy scheduled for [time] went out at [actual time], about [X hours] late.

**Why**
[One or two sentences on the root cause, e.g. "A migration in the release touched a table with a long-running lock, and the pre-deploy check flagged it after we'd already started the window. We paused rather than risk a partial rollout."]

No customer impact, and nothing was rolled back. [Adjust if not true.]

**What we're doing about it**
- [Fix 1, e.g. "Migrations now run in a separate step before the deploy window, so a slow one can't eat the window itself."] (owner: @name, by [date])
- [Fix 2, e.g. "Adding a dry-run check to CI so lock-heavy migrations get flagged at PR time, not deploy time."] (owner: @name, by [date])
- [Fix 3, if any]

**Next deploy**
Still on for [day/time]. I'll post in this channel if anything changes.

Questions or context I'm missing, reply in thread. Thanks to [names] for staying on it yesterday.
```

A few notes on how to fill it in:

- **Keep the "why" to the actual root cause,** not the chain of symptoms. If there were two causes, list both as bullets rather than a paragraph.
- **Every fix needs an owner and a date.** Without those, "we're making sure it doesn't happen again" reads as hand-waving.
- **Say plainly if there was customer impact.** Downplaying it costs more trust than the delay did.
- **Drop the thank-you line if it feels forced,** but if people worked late, name them.

If you tell me the actual cause and the fixes you've settled on, I can tighten the wording to fit.
</evidence>

### grader `skill-not-fired` passed=true scored=true withOnly=false
Skill called 0x (expected 0..0)

## with#1 score=0.5 turns=1

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
I don't have details on what caused the delay, so here's a draft with bracketed placeholders for the specifics. Fill those in and it's ready to send.

```
Hey team 👋

Quick update on yesterday's deploy, since it went out later than planned and I want everyone to have the full picture.

**What happened**
The deploy was scheduled for [time] but didn't go out until [time]. The delay came from [root cause in one or two sentences, e.g. "a failing migration in the staging run that we caught right before promotion" or "the CI pipeline hanging on the integration test stage"]. To be clear, nothing broke in production and no customer impact resulted. The delay was us choosing to hold rather than ship something we weren't confident in.

**Why it took as long as it did**
[One or two sentences on what made diagnosis or resolution slow, e.g. "we didn't have a clear owner for the pipeline on call, so it took a while to get the right eyes on it" or "the error surfaced late because that test only runs on the release branch."]

**What we're changing**
1. [Concrete fix for the root cause, e.g. "Migrations now run against a prod snapshot in CI before a release branch can be cut."]
2. [Process fix, e.g. "We're adding a named deploy owner to each release, posted in #deploys the morning of."]
3. [Detection/visibility fix, e.g. "Pipeline timeouts now alert #eng-oncall instead of failing silently."]

Owners and target dates are in [link to ticket or doc]. I'll post a follow-up here once those are in place.

Thanks to [names] for jumping on this yesterday and getting it sorted. If anyone has questions or thinks we're missing something, reply here or grab me directly.
```

A few notes on the shape of it:

- **Lead with facts, not apology.** Teams read defensiveness quickly. Stating what happened plainly builds more trust than "sorry for the delay."
- **Separate root cause from slow response.** These are usually different problems with different fixes, and lumping them together makes the action items vaguer.
- **Keep action items to three, each with an owner.** More than that reads as a wishlist rather than a plan.
- **Drop the "no customer impact" line if that isn't true.** If there was impact, say what it was in one sentence instead.

If you give me the actual cause and what you've decided to change, I can tighten this into a final version.
</evidence>

### grader `skill-not-fired` passed=true scored=true withOnly=false
Skill called 0x (expected 0..0)

## without#0 score=0.5 turns=1

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
Here's a draft. I don't know the actual cause or fix, so I've left bracketed placeholders for the specifics and filled in a plausible example so you can see the shape.

**Draft (fill in the brackets):**

```
Hey team, quick update on yesterday's deploy.

**What happened**
We planned to ship [release/version] at [time], but it went out at [actual time] instead. The delay came from [root cause in one sentence, e.g. "a migration that locked the users table longer than expected on staging"]. We caught it during [where it was caught], paused the rollout, and [what you did: rolled back / fixed forward / waited for X].

**Impact**
[No customer-facing impact / brief description of impact]. [Any downstream effects on other teams, e.g. "QA lost about two hours of testing time."]

**What we're changing**
1. [Concrete fix for the root cause, with an owner and date, e.g. "Add a pre-deploy migration timing check to CI. Owner: Priya, by Friday."]
2. [Process change, e.g. "Deploys that include migrations get a dry run on a prod snapshot first."]
3. [Communication change, e.g. "If a deploy slips more than 30 minutes, we post in #releases right away instead of waiting for a resolution."]

**Next steps**
I'll follow up in this thread once [item 1] is done. If you were affected by the delay and I missed it above, please reply here or DM me.

Thanks for everyone's patience yesterday, especially [names] for staying late to get it over the line.
```

**Example with the placeholders filled in**, so you can see the tone:

```
Hey team, quick update on yesterday's deploy.

**What happened**
We planned to ship 2.14 at 2pm, but it went out at 5:40pm. The delay came from a schema migration that held a lock on the orders table far longer than it did on staging. We caught it in the canary stage, paused the rollout, and rewrote the migration to run in batches.

**Impact**
No customer-facing impact. Support did lose the afternoon window they'd blocked out for testing the new refund flow.

**What we're changing**
1. Migrations get a timing dry run against a prod-sized snapshot before they can merge. Owner: Priya, in place by Friday.
2. Any deploy that includes a migration gets flagged in the release checklist so we plan a wider window.
3. If a deploy slips more than 30 minutes, we post in #releases immediately rather than waiting until we have a fix.

**Next steps**
I'll follow up in this thread once the CI check is live. If the delay caused a problem for you that I haven't listed, reply here or DM me.

Thanks for the patience yesterday, and thanks to Priya and Marcus for staying on to get it out the door.
```

A few notes on the choices: it leads with the plain facts, names a single root cause rather than a list of contributing factors, and every fix has an owner and a date. That's what stops these messages from reading as vague reassurance. If you tell me what actually went wrong, I can tighten the real version.
</evidence>

### grader `skill-not-fired` passed=true scored=true withOnly=false
Skill called 0x (expected 0..0)

## without#1 score=0.5 turns=2

### grader `result` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
I don't have any details on what actually delayed the deploy, so I've written the message with bracketed placeholders for the specifics. Swap those in and it's ready to send.

```
Hey team 👋

Quick update on yesterday's deploy, which went out at [actual time] instead of the planned [scheduled time].

**What happened**
[One or two sentences on the cause, e.g. "The staging smoke tests failed on the payments service because of a config value that was set for the old environment. It took about 90 minutes to track down since the error message pointed at the wrong component."]

No customer impact. The delay was entirely on our side, and the release itself went out cleanly once we resolved it.

**What we're changing**
• [Fix for the root cause, e.g. "Environment config is now validated in CI before a deploy can start."]
• [Fix for detection time, e.g. "We're adding clearer error output to the smoke test runner so failures point at the right service."]
• [Process change, e.g. "Deploys now have a named on-call owner who can make the go/no-go call without waiting on a group thread."]

**Owners and timing**
[Name] is handling the first item by [date]. [Name] has the second. I'll post here when both land.

Thanks to [names] for staying on it yesterday. If you have thoughts on the above or saw something I missed, reply in thread.
```

A few notes on the structure:

- **Lead with the facts, not the apology.** The team wants to know what happened and whether it affected anyone. Saying "no customer impact" early answers the question everyone has.
- **Separate the root cause from the slow detection.** Delays usually come from both, and the fixes are different. If detection wasn't a factor, drop that bullet.
- **Name owners and dates.** Without them, "we're going to fix this" reads as filler. If you don't have owners yet, say you'll assign them at the next standup rather than leaving it vague.
- **Keep the thanks specific.** Naming the people who debugged it is more meaningful than a generic "great job all."

If you tell me what the actual cause was and what you've decided to change, I'll fill in the placeholders and tighten the wording.
</evidence>

### grader `skill-not-fired` passed=true scored=true withOnly=false
Skill called 0x (expected 0..0)
