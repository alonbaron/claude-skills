# hands-off-after-verdict

Aggregates: {"score":0.5,"passRate":0,"scoreWithout":0,"passRateWithout":0,"delta":0.5}

## with#0 score=0.5 turns=10

### grader `advisors-opus-routing` passed=true scored=true withOnly=false
Agent called 4x (expected 4..∞)

### grader `handoff-and-fact-separation` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
The council has reported. Chairman synthesis follows.

**Recommendation: do not migrate to Auth0 now.** Harden the homegrown system this quarter behind an auth boundary you own, and set one written tripwire that flips the decision: a signed or near-signed customer requirement for enterprise SSO or SCIM provisioning. If that tripwire fires, buy a hosted IdP, and Auth0 is a defensible pick, but only under the ownership rules below.

**Caveat first.** The working directory is empty, so I could not read SOURCE_OF_TRUTH.md or ARCHITECTURE_ROADMAP.md. The roadmap is exactly where the tripwire question lives. If it already commits to enterprise SSO within two quarters, the answer inverts and you should start the migration now, with the same ownership rules.

**The split.** Three seats chose hardening. The Long-term Architect alone chose Auth0, and their argument is the only serious case for migrating: enterprise feature gravity (SAML per connection, SCIM, org roles, retained audit logs) is brutal to build under deal pressure with no identity engineer. That argument is strong when federation demand exists and empty when it doesn't. Nothing in the stated facts shows it exists, so it doesn't decide the call today.

**The tradeoff that decides it.** A migration delivers zero user-visible value in its best case and, in its worst case, forces a password reset for all 40k users during a visible login-domain change. The Adversary's scenario is realistic: the reset email is indistinguishable from phishing, and neither audit trail covers the cutover window. Against that, the real live hazards (revocation, refresh rotation, reset-token quality, breach-password checks, MFA) are each a one-to-two-week fix on the stack you already debug. You close the actual security gap faster by staying.

**Do these regardless of the tripwire, because they keep the exit open:**
- Keep your own user ID as the primary key everywhere. Any future IdP subject is a linkable external identity, never a foreign key.
- Put one auth abstraction in front of login, refresh, and reset so a future cutover can go flow by flow instead of big bang.
- Keep all authorization logic and roles on your side. Never let business logic drift into a vendor's rules engine.

**Verify before acting, these are facts not opinions:**
- Exact hashing algorithm and parameters, and whether a pepper or non-column-local salt exists. This alone determines whether any vendor imports your users without a forced reset.
- Test empirically, don't read the code: does logout or password change invalidate outstanding refresh and access tokens?
- Are reset tokens high-entropy, single-use, and short-lived?
- Whether the roadmap or the sales pipeline contains any enterprise SSO or SCIM commitment.
- Written quotes at 40k and 400k monthly active users, and a contractual right to bulk-export password hashes on termination.

**The one risk to watch.** Hardening degrades into doing nothing while feeling deliberate. The Executor and First-Principles seats both flagged it: a team without an identity engineer may not recognize its own holes, and a silently broken reset flow looks identical to a working one in normal operation. Set a dated deliverable for revocation, rotation, and reset-token quality this quarter, and get an external review of those three flows. If they haven't landed by quarter end, the migration argument gets stronger than it is today.

**Next hand-offs.** This verdict does not change an architectural fact yet, so no SOURCE_OF_TRUTH update is needed. If the tripwire fires, run the architect skill to record "identity provider: hosted, own user ID is source of truth" before any code.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## with#1 score=0.5 turns=11

### grader `advisors-opus-routing` passed=true scored=true withOnly=false
Agent called 5x (expected 4..∞)

### grader `handoff-and-fact-separation` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
**Recommendation: don't migrate to Auth0 now.** Harden the homegrown stack as a dated, owned piece of work, and add a small identities table so a federation provider can be plugged in later as configuration rather than a second migration. Revisit the moment a named driver appears.

**The split.** Four seats (Executor, First-Principles, Long-term Architect, Adversary) all rejected a full migration, differing only on whether to harden alone or also build the identities boundary. The Contrarian argued for migrating now, and made the one argument the Chairman takes seriously: hardening is not a project that finishes, it is a staffing commitment, and small teams reliably ship the fun 20 percent (alg pinning, refresh rotation) and never the rest (MFA and recovery UX, breached-password checks, session management, audit trails).

**The tradeoff that decides it.** You would be walking through a one-way door with no stated driver. Once hashes, MFA enrollments, and linked identities live in Auth0, exit means a second migration and likely a forced reset across 40k users. Against that, the cost of staying is a finite, testable invariant list that one engineer can close in weeks, and it is reversible in an afternoon. When one side is irreversible and the other is cheap and undoable, the irreversible move needs a concrete reason. Nothing stated here provides one.

**What to actually do.**
- Write the invariant list into SOURCE_OF_TRUTH.md with an owner and a date: pinned algorithm, short access TTL, opaque rotating refresh tokens with reuse detection, revocation on password change, single-use reset tokens, tuned hash cost.
- Add a `user_id → (provider, provider_subject)` identities table now. Your user ID must never become a vendor subject. This is what makes "Auth0 for one B2B tenant" a config change later.
- Set explicit flip conditions. Migrate if a SAML or SCIM requirement lands in the pipeline, an auditor demands it, or the hardening list is not closed within six weeks.

**Dissent worth keeping.** The Contrarian's timing point stands: SSO requirements arrive attached to a signed deal with a six-week clock, and migrating under that clock is worse than migrating calmly at 40k. If you know such a deal is plausible within two quarters, that shifts the answer toward migrating now.

**The one risk to watch.** Hardening quietly becomes a backlog item. If that happens you end up with neither a vendor nor a hardened system, which every seat agreed is the worst outcome.

**Verify before acting.** The council opined; it did not check facts.
- Auth0 pricing at 40k MAU and the step-ups at 50k and 100k, plus which tier gates MFA, Organizations, and enterprise connections.
- Whether your exact hash scheme is importable, tested against a real sample, and whether Auth0 exports hashes on exit.
- Whether SOURCE_OF_TRUTH.md or ARCHITECTURE_ROADMAP.md already names an SSO, compliance, or MFA requirement. The working directory here was empty, so I could not read either file. That is the single fact most likely to flip this verdict.
</evidence>

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 1x (expected 1..∞)

## without#0 score=0 turns=13

### grader `advisors-opus-routing` passed=false scored=true withOnly=false
Agent called 0x (expected 4..∞)

### grader `handoff-and-fact-separation` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
I could not run a council or read your docs, so what follows is my own assessment under stated assumptions.

**What I could not do**

- No skill or agent named "council" is installed in this session. If it is a plugin or slash command on your machine, it is not registered here.
- The working directory is empty. `SOURCE_OF_TRUTH.md` and `ARCHITECTURE_ROADMAP.md` are not in it, and reads outside it are blocked by the current permission mode.

If you point me at the right directory or paste the two docs, I will redo this against your actual constraints.

**Recommendation**

Do not migrate wholesale as the first move. At 40k MAU a homegrown JWT system is not inherently a problem. Migrate only if one of the concrete triggers below applies. Otherwise, keep the current system and harden it.

**Triggers that justify moving to Auth0**

- You need enterprise SSO, SAML, or SCIM for B2B customers and do not want to build it.
- You have a compliance requirement, such as SOC 2 or HIPAA, where auditors are pushing back on custom auth.
- Nobody on the team owns auth anymore, and it has become unmaintained security-critical code.
- You need MFA, passwordless, anomaly detection, or breached-password checks soon and they are on the roadmap.
- The current system has known weaknesses, such as no key rotation, long-lived tokens with no revocation, or hand-rolled crypto.

**Reasons to stay**

- Cost. At 40k MAU you are past Auth0's self-serve tiers. Expect a sales-quoted contract in the low-to-mid four figures per month, and re-price annually. Get a written quote before deciding.
- Lock-in. Auth0 rules, actions, and the user store are proprietary. Leaving later is harder than joining.
- Migration risk. Password hashes must be exported in a compatible format, or you force a reset for all 40k users. Sessions, refresh tokens, and any service-to-service tokens all need a cutover plan.
- Latency and availability. You add an external dependency to every login and token refresh.

**If you do migrate, the shape that works**

1. Run both systems in parallel with a lazy migration. Users are moved to Auth0 on their next successful login, so hashes are verified by your code and rehashed by Auth0.
2. Keep your own user table as the source of truth for application data. Auth0 owns credentials and identity only.
3. Keep tokens validated locally with Auth0's public keys. Do not put Auth0 on the hot path for every request.
4. Set a deadline for the old path and force-reset the stragglers.

**Middle option worth considering**

If the real driver is "we do not want to maintain auth" rather than "we need Auth0's features", evaluate open-source or cheaper alternatives such as Keycloak, Ory, or Zitadel, or a managed option like Clerk or Supabase Auth. They cover most of the same ground at 40k MAU for far less and with less lock-in.

**What I need from the two docs to firm this up**

- Whether the roadmap already calls for SSO, MFA, or B2B features.
- What the current JWT implementation actually does for rotation, revocation, and hashing.
- Any stated constraints on vendor spend, data residency, or external dependencies.
</evidence>

## without#1 score=0 turns=9

### grader `advisors-opus-routing` passed=false scored=true withOnly=false
Agent called 0x (expected 4..∞)

### grader `handoff-and-fact-separation` passed=false scored=true withOnly=false
judge votes: FAIL FAIL FAIL

<evidence>
I could not run this through a "council," and I could not find your project docs. Here is what happened and what I can offer instead.

**No council exists in this environment.** There is no skill, agent, or repo file named "council." The available skills are listed in the session and none match. If "council" is a custom skill or slash command you use elsewhere, it is not installed here. Tell me where it lives, or describe the format you want, and I will follow it.

**The two docs are not in the working directory.** The current directory is empty, and my search for them outside it was denied. If they are in another folder, give me the path, or start the session from the project root.

Without those docs I cannot check the migration against your roadmap or stated constraints. Below is my general assessment under the assumptions that you have a homegrown JWT issuer, roughly 40k monthly active users, and no unusual compliance regime.

**My recommendation is to migrate only if you can name a concrete pain the current system causes.** At 40k MAU a homegrown setup is usually workable, and the migration cost is real. Auth0 earns its cost when the answer to at least one of these is yes:

- **You need features you have not built.** MFA, social login, SSO for enterprise customers, passwordless, breached-password detection, or anomaly detection are expensive to build and maintain well.
- **You lack security ownership.** If nobody on the team owns key rotation, token revocation, session policy, and incident response for auth, outsourcing is a risk reduction.
- **Compliance is coming.** SOC 2 or similar audits go faster when auth is a vendor with its own attestations.

Reasons to stay with the current system:

- **Cost scales with users.** Auth0's per-MAU pricing at 40k is meaningful, and it rises with growth. Get a current quote rather than trusting published tiers.
- **Migration risk is concentrated in password hashes and sessions.** You will need either a bulk hash import, which Auth0 supports for common formats, or a lazy migration that re-hashes at next login. Both require careful planning to avoid locking users out.
- **Vendor lock-in.** Custom rules, actions, and universal login pages are not portable.

If you do migrate, the safest approach is lazy migration with a custom database connection, keeping your JWT verification in place during a dual-issuer window so existing tokens stay valid until expiry.

To give you a proper answer, I need the paths to the two docs and a description of what your council workflow looks like.
</evidence>
