# Step 5 prerequisites: the three checks on Linux (2026-09-23)

Machine: Linux cloud container, root, Claude Code 2.1.280. Supersedes the Linux
assumptions in STEP4.md and evals/README.md.

## 1. Auth and sandbox

- Auth works. `claude -p` and `claude plugin eval` both ran and billed.
- No sandbox backend at first: `--allow-tools Bash` refused the run ("bubblewrap
  (bwrap) not installed, socat not installed"). After `apt-get install bubblewrap
  socat` the runner accepts the grant, but every shell call inside the run fails:
  `apply-seccomp: write /proc/self/uid_map: Operation not permitted`. Plain nested
  bwrap works from the host shell; the failure is in the runner's seccomp helper
  inside this container. The runner writes its own settings.json per run, so
  `sandbox.enableWeakerNestedSandbox` cannot be set from here.

## 2. Scaffolds

- They execute. dirty-and-behind, `--scaffold --keep-temp`: the workspace was a
  real clone, behind origin by 2, `src/api_client.py` dirty, reflog showing the
  `reset --hard HEAD~2`.
- New blocker: `!` injections. Without a Bash grant the Skill call errors with
  "Shell command permission check failed ... Permission to use Bash has been
  denied" and the skill body never loads (probe with haiku, explicit invocation).
  With Bash granted the injection runs into the seccomp failure above. So
  architect, review-swarm and up-to-date (the three skills with `!` lines) cannot
  load in an eval on this machine, whether or not the case has a scaffold.
- Runs: check2 with Bash (score 0.67, $0.54), check2b without Bash (score 0,
  skill never invoked, model spawned an Agent instead), probe4 (injection denied).

## 3. avoids-padded-interfaces

- The grader was at fault, not the model's summary. In 2.1.280, `target: files`
  is `cwdDiff`, which the runner builds as the sorted list of paths the run
  created, not their contents. `file_exists` globs the same list.
- Probes (haiku, `probe-regex/`, not committed): a literal marker in a
  scaffold-written file and in an agent-written file were both "not found in
  files"; the `not_contains` form passed in all three. A `tool_used: Write` grader
  with `input_match` on the class pattern counted the Write (min 1 passed, max 0
  failed). JS regex, so `(?i)` is rejected.
- Fix: avoids-padded-interfaces is now `tool_used: Write`, `input_match` on the
  same pattern, `max: 0`, `arm: both`. README corrected.

## 4. ponytail relapse: root cause and fix

- Cause: the model invoked ponytail itself with `args: "lite"`, and lite by
  definition builds what was asked and names the lazier option in one line —
  the "footnote" relapse. Seen in the trace of r-pushback with#0.
- A second grader bug hid it: `input_match` runs on JSON-encoded input, where a
  newline is `\n`, so `\bclass` at the start of a line never matched. The pattern
  now has no leading `\b`. Checked against six saved traces.
- Fix: SKILL.md says only the user picks a level; self-invoked means full.
- After (r3, `--runs 3`, both arms): with 1.00 / 1.00 / 1.00, without 0.40 x3. No
  level arg in any of the three Skill calls, no Strategy/Backend class written, no
  Agent call. $7.63.
- Before the fix, over all saved with-arm runs: 2 relapses in 7 (STEP4 1/2,
  suite10 0/2 inferred from the tradeoff grader, r-pushback 1/3).
- `no-subagents-spawned` failures are the model working around the missing Bash:
  it spawns a general-purpose Agent to run `node --test`. Both arms do it.

## 5. The 10 cases whose skills load here (suite10, `--runs 2 -j 4`, $21.99)

8/10 passed at 0.7, overall 0.88, mean delta +0.23. Graders repaired afterwards
and re-run: refuses-trust-boundary 1.00 / 0.83, defers-to-simplify 1.00 / 1.00
(now must-not-fire), pushback 1.00 / 0.40. The other nine (architect,
review-swarm, up-to-date) are not measurable in this container; see section 2.

## 6. Trigger suite on v3 (`--runs 2 -j 4 --ablation none`, fable-5-1)

Target: >= 0.8 fire rate on should-fire, <= 0.2 on should-not, per skill.

| skill | should-fire | false fires | note |
|---|---|---|---|
| architect | 20/20 | 0/20 | |
| ask-the-council | 20/20 | 0/20 | |
| ponytail | 19/20 | 0/20 | after the when_to_use edit; before it 14/20 |
| prompt-generator | 17/20 | 0/18 | two no-cases never ran (first run hit its cost cap) |
| review-swarm | 16/20 | 0/20 | misses yes-03 ("what's left before I ship"), yes-07 ("does this fit the architecture", arguably architect's) |
| up-to-date | 20/20 | 0/20 | |

All six are inside the target. API-equivalent cost about $115 over four
invocations; two batches were lost to the 5-hour usage limit and re-run.

## 7. Review and first real build-loop run

- Built-in /code-review (high) on v2.1.0..HEAD, shipped code only: 10 findings,
  all in build-loop.js and autobuild.mjs, all confirmed and fixed in 4239e81.
  review-swarm itself was not available in this session.
- build-loop, never run before: dry run OK; `autobuild.mjs --tasks 1` on a
  fixture repo (scratchpad/fixture-repo, not kept) built row 1.1 end to end in ~4
  min, driver-reported $1.75. All stages ran; the adversary lens was skipped
  (19 lines < 30), research skipped (nothing unverified), no fix round needed.
- Found: the planner's commit carried Co-Authored-By + Claude-Session trailers
  despite COMMON forbidding them; the host's attribution instruction won. The
  refute lenses flagged it. Documented in README; not fixed in code.
- CI: .github/workflows/evals.yml runs the 9 sandbox cases on ubuntu-24.04 when a
  commit message contains [run-evals]. Needs the ANTHROPIC_API_KEY secret. Not
  yet run.

## 8. The 9 sandbox cases on a GitHub runner (ubuntu-24.04, CLAUDE_CODE_OAUTH_TOKEN)

bwrap works there (AppArmor userns restriction turned off). Two passes:
run 35891452644 ($14.39 API-equivalent) and 35959216183 ($29.77). Both were cut
short by the owner's plan: first "session limit", then "You've reached your
Fable limit". The evals run the agent on Fable, so they spend the owner's own
Fable allowance. Do not re-run on Fable without asking.

Valid results (with / without, runs that completed):
- audit-drift-citation 1.00 / 1.00 (fires 2/2; base model does it too)
- right-sized-new-feature 1.00 / 0.67 (fires 2/2)
- small-fix-boundary 0.50 / 0.50 after timeout raised to 900s: fires, targeted
  addition passes; no-invention and two-boundary-enforcement fail in both arms.
  Evidence: wrangler syntax "recorded from memory", flagged as an open question.
  Grader-or-skill undecided.
- real-diff-ranked-report 0.50 / 0.60: review-swarm call made but "denied by the
  session's permission mode"; no Agent spawns. Hypothesis, unverified: the
  injection runs `git --no-pager diff --stat`, which does not match the skill's
  own allowed-tools `Bash(git diff *)`. A local haiku probe was inconclusive.
- security-alone-hands-off 0.25 / 0.00: review-swarm never fired (0/2).
- trivial-diff-declines 1.00 / 0.75: right behaviour, skill never fired.
- dirty-and-behind: 1 valid with-run passed; the rest hit the Fable limit.
- fresh-branch-no-upstream, no-remote-boundary: no data (Fable limit).

Reading results: artifacts cannot be downloaded from this container (blob
storage is blocked); the Summary step prints them to the job log instead.

## 9. Opus 5.5 runner passes (2026-09-24), plan limits permitting

Runner evals now use `--model claude-opus-5-5`, off the owner's Fable allowance.

- Root cause of review-swarm never loading: in don't-ask mode a skill that
  carries allowed-tools/disallowed-tools is refused unless Skill is
  pre-approved. Measured with `claude -p --permission-mode dontAsk` (haiku):
  architect loads, review-swarm is denied; with `--allowedTools Skill` both
  load. The review-swarm cases had no allowed_tools line; fixed (cf52034).
  The `--no-pager` edit (62fa248) was not the cause; kept, harmless.
- real-diff-ranked-report after the fix: 0.90 / 0.40. Sonnet reviewers and
  Opus verifiers spawned, ranked report. One with-run judge lost to the limit.
- security-alone-hands-off, trivial-diff-declines: review-swarm correctly did
  not fire (its when_to_use excludes both). Cases rewritten to must-not-fire;
  the security rubric's "invented claim" example was true of the fixture
  (7191077). Not yet re-run.
- up-to-date on Opus: no-remote-boundary 1.00 / 0.75. fresh-branch-no-upstream
  failed: the SKILL.md body never named the no-upstream fallback its
  description promised; added (dc7b04e), not yet re-run. dirty-and-behind
  result failed 0/2 on Opus; reason not visible in the truncated evidence.
- small-fix-boundary on Opus: fails no-invention and two-boundary-enforcement
  in both arms again. The runs state "429 with Retry-After: 60" and "fails
  open" as decided without flagging them; that reads as a real skill miss
  against architect's verify-or-flag rule, not a grader bug.
- Still to run: security-alone-hands-off, trivial-diff-declines,
  fresh-branch-no-upstream, dirty-and-behind. Plan limit resets 10:10 UTC.

## 10. Final runner passes: all 19 cases pass (2026-09-24, Opus 5.5)

- Run 35986236858 ($5.12): small-fix-boundary 0.75 / 0.62 after the architect
  "(proposed)" rule and the file-based two-boundary grader;
  security-alone-hands-off 1.00 / 0.50; trivial-diff-declines 0.83 / 1.00
  (review-swarm still fired in 1 of 2 runs). dirty-and-behind and
  fresh-branch-no-upstream failed both arms on compound rubrics whose evidence
  showed the right behaviour.
- Run 35987770158 ($1.34), rubrics split one property per grader:
  dirty-and-behind 1.00 / 0.80, fresh-branch-no-upstream 0.88 / 0.62.
- README eval table updated with every case. Mixed models: the 10 in-container
  cases and two architect cases on Fable 5.1, the other 7 on Opus 5.5.
- Not done: v3.0.0 tag and release. The work is on the WIP branch; tagging
  wants a merge to main first, which is the owner's call.

## 11. v3.0.1: the two known issues

- Build-loop attribution: Claude Code adds Co-Authored-By by default and a
  Claude-Session trailer in web/Remote Control sessions (settings
  `attribution.commit`, `attribution.pr`, `attribution.sessionUrl`, found in
  the CLI schema). Sonnet probe: 3/3 commits had both by default, 0/3 with
  `{"attribution":{"commit":"","pr":"","sessionUrl":false}}`. autobuild.mjs
  now writes that to <scratch>/session-settings.json and passes --settings.
  Build-loop task 1.2 on the fixture: 4 commits, no trailers.
- review-swarm on a trivial diff: the case names the skill, so "fires when
  named" and "not for a trivial diff" collided. Rule now: named on one, do the
  single pass yourself and spawn nothing. Case grades no-swarm + a review.
  Runner (Opus 5.5): trivial-diff-declines 1.00 / 1.00,
  real-diff-ranked-report 1.00 / 0.40 as the regression check.

## 12. v3.0.2: the sonnet alias moved to Sonnet 5.5 (2026-09-29)

- Premise checked before any edit. On 2026-09-23 (CLI 2.1.280) `sonnet`
  resolved to Sonnet 5. On 2026-09-29, CLI 2.1.284, `claude -p --model <alias>
  --output-format json` reports `modelUsage` keys: sonnet = claude-sonnet-5-5,
  opus = claude-opus-5-5, haiku = claude-haiku-4-5-20251001. Three probes, one
  word each, $0.36 total.
- What that changes: nothing in code. review-swarm's reviewers (`model: sonnet`),
  the build loop's research/build/refute/close stages, and every eval's judge
  (`--judge-model sonnet`) now run on Sonnet 5.5 through the alias. The eval
  grader `reviewers-sonnet` matches the alias string, so it still passes.
- Edits: README (build-loop paragraph said "Sonnet 5 builds"), the tier comment in
  `workflows/build-loop.js`, version 3.0.2 in plugin.json and the README badge.
  No tier was moved between models; that stays an owner decision with evidence.
- Runner pass for the before/after: the 9 sandbox cases on ubuntu-24.04, agent
  `--model claude-opus-5-5`, judge `sonnet` (now 5.5), `--runs 2 -j 4`, run
  36529160605. "Before" is the README table from 2026-09-24 (judge on Sonnet 5,
  review-swarm reviewers on Sonnet 5, agent on Opus 5.5 for the same 9 cases
  except audit-drift-citation and right-sized-new-feature, which were Fable 5.1).
- Result, run 36529160605 (16 min, $19.78 API-equivalent, all runs completed,
  no limit hit): 9/9 pass at 0.7, overall 0.96, mean delta +0.22. The cost was
  above the $15 line the owner set; the estimate came from the earlier Opus
  passes, which were shorter because runs had been cut off by the plan limit.

  | case | before with / without | after with / without |
  |---|---|---|
  | audit-drift-citation | 1.00 / 1.00 (Fable 5.1) | 1.00 / 1.00 |
  | right-sized-new-feature | 1.00 / 0.67 (Fable 5.1) | 1.00 / 0.67 |
  | small-fix-boundary | 0.75 / 0.62 | 0.88 / 0.75 |
  | real-diff-ranked-report | 1.00 / 0.40 | 0.90 / 0.40 |
  | security-alone-hands-off | 1.00 / 0.50 | 0.83 / 0.50 |
  | trivial-diff-declines | 1.00 / 1.00 | 1.00 / 1.00 |
  | dirty-and-behind | 1.00 / 0.80 | 1.00 / 0.80 |
  | fresh-branch-no-upstream | 0.88 / 0.62 | 1.00 / 0.50 |
  | no-remote-boundary | 1.00 / 0.75 | 1.00 / 1.00 |

- The three with-arm graders that failed one run each (the artifact cannot be
  fetched from the container, so this is the 700-char evidence in the job log):
  real-diff-ranked-report `ranked-report-shape` with#0: reviewers on sonnet and
  verifiers on opus both spawned (process graders 2/2), report opens with a
  "Don't open the PR yet" verdict and a `## Blockers` section; the judges voted
  FAIL 3/3, reason not visible in the excerpt. security-alone-hands-off
  `hands-off-to-security-review` with#0: the skill correctly stayed quiet, the
  model did the security read itself ("I reviewed auth.js myself instead of
  launching a swarm") and never pointed at /security-review. small-fix-boundary
  `two-boundary-enforcement` with#0: the SoT edit carried a "(proposed)"
  non-goal and a roadmap link; judges FAIL 3/3, excerpt ends before the reason.
  None of the three is a Sonnet 5.5 regression on its face: the reviewers and
  verifiers spawned as specified, and the two rubric misses are judged by the
  new Sonnet 5.5 judge on Opus 5.5 output. Left as is; a skill change wants the
  full transcripts, which need a machine that can download the artifact.
- Not re-run: the 10 in-container cases (ponytail, ask-the-council,
  prompt-generator). Only the judge changed for them (no sonnet subagents), and
  a `--runs 2` pass on Fable 5.1 cost $21.99 last time, over the $15 line.
  Their README rows keep the 2026-09-23/24 numbers and say so.
- Banner: review-swarm and up-to-date rows and the desc updated in hero.svg;
  social-preview.png re-rendered from it with the container's headless chromium (1280x800 shot, cropped to 640).
