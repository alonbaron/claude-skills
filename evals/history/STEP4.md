# Step 4 — eval diagnosis and repair (2026-09-23)

Supersedes the Status table in HANDOFF.md for steps 1, 2 and 4.

## Steps 1 and 2 are done and verified

All six SKILL.md rewritten and within the verifier's budget:

| skill | description | when_to_use | combined |
|---|---|---|---|
| architect | 447 | 475 | 922 |
| ask-the-council | 246 | 494 | 740 |
| ponytail | 323 | 656 | 979 |
| prompt-generator | 279 | 369 | 648 |
| review-swarm | 371 | 496 | 867 |
| up-to-date | 375 | 428 | 803 |

Limits: 450 / 800 / 1300. D-series decisions all hold: `effort: max` on architect,
ask-the-council, review-swarm only; `allowed-tools` on review-swarm and up-to-date only;
`disallowed-tools: Edit Write NotebookEdit` on review-swarm only.

`evals/` holds 19 cases. `workflows/build-loop.js` (727 lines) and `scripts/autobuild.mjs`
(329) both parse; build-loop's `meta` is a pure literal with no Date.now/Math.random.

## Why the first suite scored 18% — it was not the skills

Run `evals/results/2026-09-22T13-46-43-653Z/`, 4/19 passed, $20.57.

11 of 19 cases never started. The runner invokes `/bin/bash <path>` with the path's
backslashes stripped, so every case with a `scaffold_script` dies at `exit 127` before the
agent runs and both arms score 0.00. Four probe runs ruled out every workaround:

| tried | result |
|---|---|
| absolute path, forward slashes | re-normalized to backslashes, still mangled |
| inline script body in case.yaml | rejected, the value must be a path |
| `fixture.ps1`, `fixture.cmd` | still handed to `/bin/bash`, no extension dispatch |
| `context.files`, `context.workspace`, `context.files_dir` | silently ignored, empty workspace |

Second, independent blocker: `--allow-tools Bash` makes the runner refuse the whole run
("no sandbox backend on this platform"). WSL is not a shortcut — the Ubuntu image has git
but no node, no `~/.claude` credentials, and no `bwrap`.

The 11 are tagged `needs-scaffold`, the 8 that run anywhere are tagged `portable`.
`evals/README.md` documents all of it.

## The 8 runnable cases: rubric repair

Workflow `wf_e3743048-7b0` (10 agents, 873k tokens): one repair agent per failing case,
each reading the real transcript first, then a format checker. Compound multi-condition
rubrics were split into 16 single-property graders.

| case | before | after | delta |
|---|---|---|---|
| hands-off-after-verdict | 0.50 / 0.00 | 1.00 / 0.17 | +0.83 |
| coding-agent-repo-prompt | 0.83 / 0.67 | 1.00 / 0.86 | +0.14 |
| human-prose-boundary | 0.50 / 0.50 | 1.00 / 1.00 | 0 |
| forces-divergence | 0.50 / 0.00 | 0.90 / 0.70 | +0.20 |
| pushback-on-abstraction | 0.00 / 0.25 | 0.70 / 0.70 | 0 |

Runs: `rerun1` (5 cases, $12.25), `rerun2` (2 cases, $8.70). Not re-run because they
already passed: right-sized-new-feature, declines-low-stakes, whole-build-scope-check.

Grader bugs found and fixed along the way: brace globs (`**/*.{js,ts}`) are not supported
by `file_exists`; `chairman-commits` demanded one of two named options and so failed a
chairman that committed to a better third one; `pushback-on-abstraction` needed
`timeout_seconds: 600`.

## Skill edits made (two, both in ponytail)

1. `when_to_use` said "not when the full version is explicitly requested" and "When NOT to
   be lazy" repeated it. Every request for a one-caller abstraction is explicitly
   requested, so the exemption cancelled the skill's primary trigger. Evidence: with#1 of
   the first run replied "You asked for the pluggable version explicitly, so that is what I
   built." The exemption now starts only after the user has heard the lazier option and
   reaffirmed, or gives a reason it is needed today.
2. Added "This skill spawns nothing" under Boundaries. Ponytail was spawning 2 subagents
   per run, contradicting D7 ("the other four spawn nothing"), and its text never said so.

## Open, for Alon to decide

- **ponytail relapses about half the time.** After the fix, with#0 shipped `cache.js` and
  said "Skipped: backend interface, strategy interface"; with#1 built `MemoryBackend` +
  `LruStrategy` + JSDoc interfaces and put "Lazier alternative, your call" in a footnote.
  n=2, so the rate is not established. The delta on this case is currently 0.
- **`avoids-padded-interfaces` gave a false pass.** Its regex
  `\b(class|interface)\s+\w*(Strategy|Backend)\b` over `target: files` reported "pattern
  absent" on the run that describes building `MemoryBackend` and `LruStrategy`. Re-run that
  case with `--keep-temp` and inspect the workspace before trusting the grader.
- **ask-the-council never names ponytail** in its hand-off, though SKILL.md makes that
  hand-off unconditional. The architect hand-off inconsistency flagged in the first run did
  not reproduce.
- Steps 5, 6 and 7 of HANDOFF.md are untouched.
