# alon-skills v3.1.0 step 6: Fable 5.1 eval passes (2026-10-04)

Continues `STEP5.md`. Run ids are GitHub Actions runs of `.github/workflows/evals.yml`;
each run publishes `results/<run id>.txt` and `.json` to the `eval-results` branch.

## Fable pass 1 of 2: sandboxed cases (scheduled run)

- Run 37198713961: https://github.com/alonbaron/claude-skills/actions/runs/37198713961
- head_sha 554244804bc9ad1260a7c154ef2a7e1f9abec068 (main, "Enhance eval workflow with scheduling and conditions")
- The cron `41 10 4 10 *` never fired. No run with event `schedule` existed at 11:25 UTC, 44 minutes
  after its time, so the reporter started the same job by `workflow_dispatch` with the defaults
  (model claude-fable-5-1, cases sandboxed). The header lines of the published summary:

  ```text
  run: 37198713961 https://github.com/alonbaron/claude-skills/actions/runs/37198713961
  event: workflow_dispatch  commit: 554244804bc9ad1260a7c154ef2a7e1f9abec068  ref: main
  model: claude-fable-5-1  cases: sandboxed  job status at publish: failure
  cost $47.41  aggregates {"casesTotal": 9, "casesPassed": 8, "overallScore": 0.8916666666666665, "overallPassRate": 0.6666666666666666, "meanDelta": 0.22777777777777775}
  ```

- Claude Code 2.1.289 on the runner, plugin alon-skills 3.1.0, judge sonnet, `--runs 2 -j 4`,
  threshold 0.7. The eval step ran 1601 s (11:26 to 11:53 UTC). The job is marked failure
  because `claude plugin eval` exits non-zero when a case is under threshold; the Summary,
  Publish and Upload steps all succeeded.
- Result: 8 of 9 cases pass at 0.7, overall 0.89, mean uplift +0.23, $47.41 API-equivalent
  (billed to the owner's plan window through CLAUDE_CODE_OAUTH_TOKEN, not a charge).

  | case | with | without | graders that failed (with arm) |
  |---|---|---|---|
  | audit-drift-citation | 1.00 | 1.00 | none |
  | right-sized-new-feature | 0.83 | 0.67 | right-sized-process with#0, judge votes FAIL FAIL PASS. The 700-char evidence excerpt is the session init line, so the reason is not visible without the transcript. Both without runs fail the same grader 3/3. |
  | small-fix-boundary | 0.88 | 0.75 | two-boundary-enforcement with#1, judge votes FAIL PASS FAIL. Evidence: the SoT edit carries "Throttles POST /login per client IP as an abuse guard (Invariant 3); this ships before password reset (ARCHITECTURE_ROADMAP.md §5, Phase 2a)" and a "Non-goals (rate limiting)" list, the same roadmap and non-goal spill as run 36529160605. Both without runs fail no-invention 3/3. |
  | real-diff-ranked-report | 0.90 | 0.40 | ranked-report-shape with#0: grader threw, "judge call failed: You've hit your session limit · resets 3:40pm (UTC)". The run itself finished in 956 s (22 turns, $8.25) with reviewers-sonnet and verifiers-opus both passed, so the 1500 s timeout held; only the judge call was lost. with#1 passed every grader. Without the plugin no agents are spawned (Agent called 0x) and the report shape fails 3/3. |
  | security-alone-hands-off | 0.67 | 0.33 | hands-off-to-security-review with#0 and with#1, judge votes FAIL FAIL FAIL on both. Evidence (with#0): "The file is 12 lines, so I reviewed it in a single pass instead of spawning a swarm ... **Blockers** ... **Auth bypass if `JWT_SECRET` is unset** at `src/middleware/auth.js:6` ... CVE-2022-23540". Evidence (with#1): "Review done. The file is 11 lines, so one careful read covers it fully ... **Unsigned tokens can pass when the secret is missing**". skill-not-fired and no-swarm-spawn pass in both with runs. Without the plugin Fable spawned three agents in both runs (no-swarm-spawn: Agent called 3x, expected 0), so the without arm fell from 0.67 to 0.33. |
  | trivial-diff-declines | 1.00 | 1.00 | none |
  | dirty-and-behind | 1.00 | 0.70 | none. Without: reports-behind fails 3/3 in both runs, leaves-decision-to-user fails once. |
  | fresh-branch-no-upstream | 1.00 | 0.62 | none. Without: falls-back-to-default-branch fails both runs, says-no-upstream fails once. |
  | no-remote-boundary | 0.75 | 0.50 | result with#1: grader threw, "judge call failed: You've hit your session limit · resets 3:40pm (UTC)". with#0 passed 3/3. Both without runs errored (below), so 0.50 there is the no-subagents process grader alone, not a judged score. |

- Every error line in the summary (all from the plan's five-hour window, which opened 10:40 UTC
  and was exhausted at about 11:51 UTC, 25 minutes into the run):

  ```text
  == real-diff-ranked-report
     error: exit 1: You've hit your session limit · resets 3:40pm (UTC)        (with#0, after the swarm ran)
     FAIL with#0 ranked-report-shape: grader threw: judge call failed: You've hit your session limit · resets 3:40pm (UTC)
  == no-remote-boundary
     error: exit 1: You've hit your session limit · resets 3:40pm (UTC)        (without#0)
     error: exit 1: You've hit your session limit · resets 3:40pm (UTC)        (without#1)
     FAIL with#1 result: grader threw: judge call failed: You've hit your session limit · resets 3:40pm (UTC)
  ```

  No case timed out. The three cases that start last in `-j 4` order (real-diff-ranked-report's
  judging, no-remote-boundary) are the ones the limit reached. A sandboxed pass costs about $47
  API-equivalent and the window held it to within three judge calls and two short agent runs;
  the owner's own interactive use shares that window.
- Against run 37188685382 (same day, same skills, before the 1500 s timeout): architect
  1.00/0.83/1.00 became 1.00/0.83/0.88, review-swarm 0.80/0.67/1.00 became 0.90/0.67/1.00,
  up-to-date 0.90/1.00/1.00 became 1.00/1.00/0.75. The two drops (small-fix-boundary,
  no-remote-boundary) are one judge vote and one lost judge call; nothing in the skills changed.
- Pass 2 (the ten in-container cases, cron `41 15 4 10 *`) lands one minute after the window
  resets at 15:40 UTC. The first cron did not fire, so whoever reports pass 2 should start the
  job by `workflow_dispatch` with cases `in-container` if no scheduled run exists by about
  15:50 UTC, and should not run anything else on the plan while it runs.
