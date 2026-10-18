# alon-skills v3.2.0 step 7: newest models, stage-feed tracker, clean re-measurement (2026-10-12)

Continues `STEP6.md`. Branch `v3.2-models-tracker-evals`. This file is the durable state for
phases P1-P5: each phase reads it first and updates it last.

## 1. Aliases (P1, 2026-10-12)

Probe, run from a scratch directory: `claude -p --model <alias> --effort low --output-format json "Reply with only: ok"`.
Resolved id and effort are read from the session transcript (`~/.claude/projects/<project>/<session>.jsonl`),
the `assistant` record's `message.model` and `effort` fields. All four replied `ok`, $0.77 API-equivalent in total.

| alias | resolved id | effort recorded | CLI | date |
|---|---|---|---|---|
| fable | claude-fable-5-1 | yes (`low`) | 2.1.296 | 2026-10-12 |
| opus | claude-opus-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |
| sonnet | claude-sonnet-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |
| haiku | claude-haiku-5-5 | yes (`low`) | 2.1.296 | 2026-10-12 |

Change since `STEP5.md` section 12 (2026-09-29, CLI 2.1.284): `haiku` moved from
`claude-haiku-4-5-20251001`, which records no effort, to `claude-haiku-5-5`, which does.

## 2. P1 steps

| step | status | commits |
|---|---|---|
| 1 branch | done | from `main` 838df70, equal to `origin/main`, clean |
| 2 aliases | done | 42bc757 |
| 3 model text | done | 33fa4f8; README.md:137 rewritten in 6f65a43 |
| 4 tracker | done | b6ce419, 06077d3 (fold change, section 5) |
| 5 mod | done | 77a3faa (workflow-watch 0.2.0) |
| 6 fresh build-loop run | done after the fixture decision | none in this repo (section 3, 4) |
| 7 screenshot, README | done | 6f65a43 |
| 8 harness | done | f6bcb77 (summary), f10205f (workflow) |
| 9 version, checks | done | 2afa356 |
| 10 this file, PR | done | this commit; draft PR |

Step 3 grep, `git grep -n -i -E 'haiku|4\.5|4-5'` outside `evals/history/`, after all edits: the hits left are
alias cells (`haiku, low`), the `.m.haiku` CSS class, `454.5` (an SVG coordinate in `hero.svg`), the
`build-loop.js:75` note that says haiku resolved to Haiku 4.5 on 2026-09-29, and the kept Haiku 4.5 test case
in `journal.test.ts` (the no-effort path; a Haiku 5.5 case with `low` sits next to it). None presents Haiku 4.5 as current.

## 3. The old fixture and its rebuild (P1 step 6)

- `git clone <scratch of session f2cf451d>/build-loop-fixture <scratch>/clone-attempt`: `fatal: '…/build-loop-fixture' does not appear to be a git repository`, exit 128.
- What was left: `.git` had no HEAD, config, index or ref file, and the working tree had no files (empty `docs/`, `src/`, `test/`, `.claude/scratch/build-loop/` folders). 50 loose objects remained: 11 commits, 19 trees, 20 blobs. A read-only survey (each object inflated, each commit's tree walked) found every commit's tree complete, in one chain:

| commit | parent | subject | TODO rows |
|---|---|---|---|
| 9469ee5 | root | chore: fixture repo for the build loop | 1.1 [ ], 1.2 [ ] |
| 5fa77b7 | 9469ee5 | chore: simpler lint script | 1.1 [ ], 1.2 [ ] |
| cc61456 | 5fa77b7 | docs: TODO 1.1 in progress | 1.1 [IN PROGRESS], 1.2 [ ] |
| e593b90 | cc61456 | docs: TODO 1.1 not started | 1.1 [ ] with a note, 1.2 [ ] |
| b5c4648 | e593b90 | docs: TODO 1.1 in progress | 1.1 [IN PROGRESS], 1.2 [ ] |
| b743536 | b5c4648 | feat: add slugify(title) per I1 | 1.1 [IN PROGRESS], 1.2 [ ] |
| e3d6d61 | b743536 | test: cover slugify I1 cases | 1.1 [IN PROGRESS], 1.2 [ ] |
| 16aa984 | e3d6d61 | test: assert I1 regex on every slugify case | 1.1 [IN PROGRESS], 1.2 [ ] |
| 27a933f | 16aa984 | docs: record ASCII-only slug rule in SoT and roadmap | 1.1 [IN PROGRESS], 1.2 [ ] |
| 3e8b53c | 27a933f | test: pin ASCII-only slugify behavior for non-ASCII input | 1.1 [IN PROGRESS], 1.2 [ ] |
| 6707bad | 3e8b53c | docs: TODO 1.1 blocked | 1.1 [BLOCKED], 1.2 [ ] |

- Owner's decision (option a): rebuild at `<fixture>` (a folder outside the user profile) from copies of those objects, branch `main` at 6707bad, the old folder never written to.
- Done: `git init -b main <fixture>`, the 50 object files copied into its `.git/objects/`, `git update-ref refs/heads/main 6707bad7bfc8592fd97a7f49343ee06fe898a482`, `git checkout -f main`. `git fsck --full`: no output, exit 0. `git status`: clean on `main`. `.gitignore` holds `node_modules/` and `.claude/scratch/`. Row 1.2 (`truncateSlug(slug, max)` in `src/slug.js` with tests) is `[ ]`, so no row was added.

## 4. Fresh build-loop run (P1 step 6, 2026-10-12)

`node scripts/autobuild.mjs --tasks 1 --repo <fixture> --plugin-dir <this repo>`, run in the background.
Run directory `~/.claude/projects/…/ec2458db-8062-40a0-94e1-b356adf8ffe7/subagents/workflows/wf_8972b6c6-4a2`.
Alias from each `agent-<id>.meta.json`, resolved id and effort from each `agent-<id>.jsonl`.

| phase | stage | alias | resolved id | effort | assistant records with effort | output tokens | tool calls | seconds | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Plan | plan | fable | claude-fable-5-1 | high | 9/9 | 773 | 6 | 42 | done |
| Scout | scout:1.2 | haiku | claude-haiku-5-5 | low | 11/11 | 2654 | 8 | 14 | done |
| Spec | spec:1.2 | fable | claude-fable-5-1 | high | 28/28 | 990 | 19 | 161 | done |
| Build | build:1.2 | sonnet | claude-sonnet-5-5 | medium | 7/7 | 340 | 5 | 20 | done |
| Measure | measure:1.2 | haiku | claude-haiku-5-5 | low | 3/3 | 194 | 2 | 4 | done |
| Refute | refute:invariants:1.2:r1 | opus | claude-opus-5-5 | high | 9/9 | 728 | 6 | 52 | done |
| Refute | refute:correctness:1.2:r1 | sonnet | claude-sonnet-5-5 | medium | 5/5 | 597 | 4 | 11 | done |
| Refute | refute:critic:1.2:r1 | opus | claude-opus-5-5 | high | 10/10 | 930 | 6 | 41 | done |
| Refute | refute:acceptance:1.2:r1 | sonnet | claude-sonnet-5-5 | medium | 4/4 | 720 | 3 | 9 | done |
| Refute | refute:adversary:1.2:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 436 | 5 | 15 | done |
| Close | close:1.2 | sonnet | claude-sonnet-5-5 | low | 4/4 | 101 | 3 | 13 | done |

- Scout and measure: `claude-haiku-5-5` at `low`, as required.
- 11 stages, 14:48:37.594Z to 14:54:07.379Z (5:29, as the tracker header shows), 8,463 output tokens. No research stage (the spec listed 0 unverified APIs), no arbiter or fix (every lens passed, 0 blocking, 11 advisory).
- Outcome: driver reply `{"tasks":[{"taskId":"1.2","branch":"feature/slug","status":"[FINISHED - PENDING MERGE]","reason":null,"fixRounds":0,"closed":true}],"stoppedBecause":"reached maxTasks=1",...}`; driver log `session ec2458db-8062-40a0-94e1-b356adf8ffe7 cost $4.29 turns 1`. That is over the "about $2" the plan expected.
- Commits on `feature/slug` (`main..feature/slug`): 6 (8203376, bf452ff, 1274bb6, 83c18e0, a599b31, 50c1bf1), all authored by the owner's git identity. Attribution lines (`co-authored-by|claude-session|generated with|anthropic|claude.ai|claude.com`) in their bodies: 0; git-parsed trailers: 0.
- No usage or limit message.

## 5. Tracker: fold change and checks (P1 steps 4 and 7)

- Owner's spec change after the first cut: failed cards start folded too; only running cards start open. A failed card's header still says `! failed` (glyph and word) and shows its one-line result. Commit 06077d3.
- Playwright 1.61.1 from the scratch directory (its Chromium build 1228 is the one installed); first `--png` attempt succeeded.
- `node scripts/tracker.mjs --run <wf_8972b6c6-4a2> --png assets/tracker.png`: 11 cards, 0 open, PNG 1616x4010. Privacy check on what the PNG shows (the page's rendered `innerText` with folds as rendered, and a look at the image): 0 lines with a drive path, `/Users/`, `/home/`, `AppData`, the user name, this repo's folder name or the fixture's; footer `~/.claude/projects/…/ec2458db-8062-40a0-94e1-b356adf8ffe7/subagents/workflows/wf_8972b6c6-4a2`. The page's folded full results do hold absolute `<fixture>` paths; the HTML is not committed and the PNG does not show them.
- `wf_ec0355da-6ea` (2026-09-22, 19 stages): renders, 0 of 19 open, 5 `! failed` headers; injection copy (first journal result set to `<img src=x onerror=alert(1)>`): `&lt;img src=x onerror=alert(1)&gt;` twice, `<img` zero times; variant copy (one stage running, efforts `xhigh` and `max`): 1 of 19 open, all six effort classes (low, medium, high, xhigh, max, na) rendered.
- `scrollWidth <= clientWidth` at 390 px for the fresh run, the old run, the injection copy and the variant copy, with folds as rendered and with all opened; 0 `<script>`, 0 external `src`/`href`.

## 6. Harness (P1 step 8)

`.github/scripts/eval-summary.py` now prints, first, `valid N of M` (with the TRUNCATED cases named) and `re-run: <skill>/<case> ...`
(`none` when clean); then the runner's aggregates labelled with how many INVALID cases they include, and valid-only
aggregates when any case is INVALID. A case is INVALID when a run has an `error` other than its own budget stop, when
a grader's explanation starts `grader threw`, or when `skippedPaidGraders` is true; each line quotes the error and names
arm and run. TRUNCATED: a run whose error is `Reached maximum number of turns (N)` with N = the case's `maxTurns`, or
`timed out after Ns` with N = its `timeoutSeconds`. The timeout text comes from the 2.1.296 binary's eval runner; none of
the three published runs has one. The JSON is now read as UTF-8 (read in cp1252 on Windows, one evidence excerpt came out 6 characters short).

Against the published JSON (`git show origin/eval-results:results/<id>.json`):

| run | first two lines | expected (STEP6) | match |
|---|---|---|---|
| 37198713961 | `valid 7 of 9` / `re-run: review-swarm/real-diff-ranked-report up-to-date/no-remote-boundary` | INVALID exactly those two | yes |
| 37213238188 | `valid 0 of 9` / `re-run:` all nine sandboxed cases | all INVALID | yes |
| 37218381217 | `valid 10 of 10 (1 TRUNCATED: ponytail/pushback-on-abstraction)` / `re-run: none` | none INVALID, pushback TRUNCATED | yes, with one difference |

- The difference: in 37218381217 the two runs that hit pushback-on-abstraction's 15-turn cap are `without#0` and `without#1` (16 turns each, `exit 1: Reached maximum number of turns (15)`). The with-plugin runs finished (8 and 7 turns, `error: null`) and lost names-upgrade-trigger on judge votes (FAIL FAIL FAIL). `STEP6.md` and README.md:162 say the with-plugin runs hit the cap; the old summary printed `error:` lines without the arm. The JSON wins. P5's README rewrite takes this from here.
- Valid-only aggregates for 37198713961: score 0.91, mean delta +0.19, 6 of 7 at 0.7 (runner's over all 9: 0.89, +0.23, 8 of 9).
- Everything else in the summary is unchanged: the diff of the new output against the published `.txt` bodies holds only the new lines, the INVALID/TRUNCATED flags, and the `error:` lines they replace.
- `evals.yml`: `workflow_dispatch` input `only` (space-separated `<skill>/<case>`; when set, only those cases are copied into `evals-ci/`; a name that is not `evals/<skill>/<case>` stops the job with exit 2); the published header gains `only: <list>` when set and `cli: <claude --version>`. Tested locally on the step's own script, the eval call cut off: `only="review-swarm/real-diff-ranked-report up-to-date/no-remote-boundary"` copies 2 cases; `ponytail/nope`, `../etc` and `*` each exit 2 with `not a case`; no `only` and `cases=sandboxed` copies 9; `cases=in-container` copies 10. The YAML parses (PyYAML 6.0.3) with inputs `model, cases, only`.

## 7. Checks (P1 step 9)

| command | result |
|---|---|
| `claude plugin validate .` | marketplace manifest: "✔ Validation passed" |
| `claude plugin validate .claude-plugin/plugin.json` | plugin manifest, version 3.2.0: "✔ Validation passed" |
| `claude plugin validate mods/workflow-watch` | "✔ Validation passed" |
| `claude plugin test mods/workflow-watch` | 15 pass, 0 fail (13 in `journal.test.ts`, 2 in the new `render.test.tsx`: Pane and AbovePrompt on terminal and desktop) |
| `tsc -p mods/workflow-watch` | not runnable as written: no session has laid `.claude-plugin/types/` beside the mod, and there is no global tsc. Run instead with the types file header's tsconfig kept in scratch (`include`: the plugin-authoring skill's `types/claude-code.d.ts` plus the mod's `hooks`, `types`, `tests`), TypeScript 7.0.2: exit 0, all five mod files listed |
| `node scripts/tracker.mjs --help` | exit 0, prints the 17-line header comment |
| `git log main..HEAD --format='%an%n%b' \| grep -i -E 'co-authored-by\|generated with\|anthropic'` | nothing |

The mod pane has no fold: the 2.1.296 element tables (`Elements`: Box, Text, Button, Input, Select, Link, Code, Markdown,
Client, Raster, Image, Svg) carry no disclosure element, so a stage's details are one compact line.

Model usage in P1: alias probes $0.77, the build-loop run $4.29 (driver-reported). No eval dispatch.

## 8. Eval plan, P2-P5

| phase | set | where | estimated cost | entry condition | status | run id |
|---|---|---|---|---|---|---|
| P2 | in-container (10 cases: ponytail, ask-the-council, prompt-generator) | CI: `gh workflow run evals.yml --ref v3.2-models-tracker-evals -f cases=in-container -f model=claude-fable-5-1` | about $25 API-equivalent (37218381217: $25.13); fits a window with room | the owner's go, in the current window; nothing else on the plan while it runs | done 2026-10-14 (section 10): valid 10 of 10 (2 TRUNCATED), re-run none, $34.03; job red, hands-off-after-verdict 0.67 under `--threshold 0.7` | 38520925302 |
| P3 | sandboxed (9 cases: architect, review-swarm, up-to-date) | CI: same with `-f cases=sandboxed` | about $47 (37198713961: $47.41); fills a fresh window alone | the owner says the window is fresh | done 2026-10-15: valid 9 of 9 across the three runs (1 + 5 + 3), re-run none (section 13). Attempt 1 INVALID: session limit, dispatched in P2's window (section 11); valid 1 of 9, re-run 8, $14.08. Re-run split by skill over two windows: half A (architect 2, up-to-date 3) valid 5 of 5 (2 TRUNCATED), re-run none, $20.38 (section 12); half B (review-swarm 3) valid 3 of 3, re-run none, $22.64; job red, security-alone-hands-off 0.67 under `--threshold 0.7` (section 13) | 38523993370, 38690586571 (A), 38727606834 (B) |
| P4 | trigger suite (120 local cases in `evals-trigger/`) | local, detached: `claude plugin eval . --eval-dir evals-trigger --case "<glob>" --runs 2 -j 4 --ablation none --model claude-fable-5-1 --no-publish --trust-plugin --max-cost-usd <cap> --output-dir <dir> --json <file>` | first attempt 2026-10-17: $25.26, valid 40 of 120, session limit (section 14). Remaining 80 split below, caps cut to 3 turns / 90 s | the owner says the window is fresh | split into P4a-P4e (section 14) | local 2026-10-17T11-28-43-593Z |
| P4a | probe: ponytail-yes-00, ponytail-no-10, ask-the-council-yes-00, review-swarm-yes-03, 1 run each, `--keep-temp` | local, window 1 | cap $3 | P4.0 committed | done 2026-10-18, gates FAIL (section 14): $1.40, $0.35/run; council fired on turn 2, review-swarm-yes-03 never fired; no duplicates. P4b-P4c not started | local, scratch |
| P4b | `ponytail-*` (20 cases, 40 runs) | local, window 2 | about $14 (40 x $0.35); `--max-cost-usd 14.2 -j 2`, so overrun (at most 2 runs in flight) stays under $15 | the owner says the window is fresh | pending | - |
| P4c | `prompt-generator-*` (20 cases, 40 runs) | local, window 3 | same as P4b | the owner says the window is fresh | pending | - |
| P4d | `review-swarm-*` (20 cases, 40 runs; no-13, valid at the old caps, is re-measured at the new ones) | local, window 4 | same as P4b | the owner says the window is fresh | pending | - |
| P4e | `up-to-date-*` (20 cases, 40 runs) | local, window 5 | same as P4b | the owner says the window is fresh | pending | - |
| P5 | re-runs of INVALID cases (at most two attempts each; includes ask-the-council-yes-09), then the README write-up | CI `-f only="<skill>/<case> ..."`; trigger `--case` | depends on what P2-P4 leave INVALID | the owner says the window is fresh | pending | - |

## 9. P1 review fixes (2026-10-14)

Review of P1 (10 reviewers and verifiers, every finding through an opus refutation pass): no blockers, 5 should-fix,
9 nits. All 14 fixed on this branch; none dropped. STEP6 and README.md:162 still say the with-plugin runs hit the
15-turn cap (section 6: it was the without-plugin runs); P5 corrects that.

| # | finding | fix | check |
|---|---|---|---|
| S1 | `{"type":"failed"}` journal entries ignored: a dead stage showed as running forever, `--watch` never exited (14 dead stages in 4 local runs, all session limit or API error) | both renderers treat `failed` as finished with no result (`✗ no result`, line `(stopped without a result)`); `<synthetic>` model id skipped | `wf_82c05260-6bc` header `0 done · 6 failed · 0 running · 1:36 elapsed · … · finished` (was `6 running · 33245:23`); `wf_c222e401-e0e` `2 done · 1 failed`; tests |
| S2 | eval summary on a partial run: cases never started dropped, still `valid 4 of 4, re-run: none` | first line `PARTIAL: … (<partialReason>)`; with `<eval dir>`, case folders (holding `case.yaml`) missing from the results are NOT RUN, counted in `valid N of M` and listed on `re-run:`; an arm with fewer runs than `<runs per arm>` is INVALID. `evals.yml` passes `evals-ci "$RUNS"` (job env `RUNS: "2"`, also the eval's `--runs`) | synthetic partial of 37218381217 (7 of 10 cases, one arm cut to 1 run): `valid 5 of 10 (1 TRUNCATED: …) (3 NOT RUN)`, re-run names 2 INVALID + 3 NOT RUN, `INVALID without: 1 of 2 runs` |
| S3 | tallies counted failed stages as done | one split at all five sites: `N done · M failed · K running`, `· D disputed` after done when any; failed includes no result | `wf_ec0355da-6ea`: `14 done · 1 disputed · 4 failed · 0 running` (was `19 done … finished`); tests |
| S4 | pane durations from poll times; first poll toasted every finished stage | `withFacts`: start and end from the transcript's first and last timestamps; `elapsed` rounds down; no toasts on the first tick of a run | test: stage first seen an hour late shows `Ran for 2:40` |
| S5 | 12 of 27 mutants survived the mod tests | tests for `ok:false`, dispute, null result, `failed` entry, `failed` after result, `<synthetic>`, transcript times, `…` cuts, control characters, round dividers; render test checks order | 20 pass (was 15); 11 targeted mutants (the review's plus one per new rule) each fail the suite |
| N1 | cuts with no `…` | `clip()` in both renderers ends a cut in `…`; the pane's `fit` is `clip` | test |
| N2 | a disputing fix round showed `failed` | own state `! disputed`, warning tone/amber | `wf_ec0355da-6ea`: 1 disputed |
| N3 | `tracker.html` not ignored | `.gitignore` line | `git status --ignored` shows `!! tracker.html` |
| N4 | control characters in model text blank the pane | `oneLine()` strips C0, DEL and C1 in results, labels, phases, tool args | test |
| N5 | summary hygiene | run and grader text as one line without control characters (no line can start `::`, no ESC); Summary step `shell: bash` (pipefail) with stderr in the published summary, skipped when no `result.json`; a thrown grader is not repeated as a FAIL line | diff against the three published runs: first two lines identical; other changes are the aggregates label, blank evidence lines collapsed, the duplicate FAIL lines gone |
| N6 | `only` edge cases | blank `only` exits 2; a repeated name is copied once; commit subject uses `${ONLY:-$CASES}` | step script with the eval call cut off: repeat → 1 case, `"   "` / `*` / `ponytail/nope` → exit 2, unset → 10 in-container |
| N7 | tracker details | no stages: no `finished`, `--watch` keeps waiting; details grid removed (it repeated the fold line); `effortClass` dead branch removed; dividers name the round from `:rN` labels (`Refute · round 2`); card status and label are an `<h3>` | 320 and 390 px, folds as rendered and all open: no horizontal overflow on 3 runs, 0 `<script>` |
| N8 | README | v3.1 bullets no longer call the tracker the table above; v3.2 entry added | - |
| N9 | mod tidiness | one `clip` for both fits; render test checks stage order; pane's arbiter and fix lines carry reasons like the tracker's | tests |

Checks after the fixes: `claude plugin test mods/workflow-watch` 20 pass, 0 fail; `tsc` (section 7 setup, TypeScript 7.0.2) exit 0
on all five mod files; `assets/tracker.png` re-rendered from `wf_8972b6c6-4a2` (changes: header tally, `REFUTE · ROUND 1`).

## 10. P2 in-container (2026-10-14)

| field | value |
|---|---|
| run | 38520925302, https://github.com/alonbaron/claude-skills/actions/runs/38520925302 |
| dispatch | 06:13:08Z, `gh workflow run evals.yml --ref v3.2-models-tracker-evals -f cases=in-container -f model=claude-fable-5-1` |
| tested commit | e5b73dc (header `commit: e5b73dcdcd475c06ffcb1d78ec5cde4ecd37916a  ref: v3.2-models-tracker-evals`) |
| model, judge | claude-fable-5-1, sonnet; `--runs 2 -j 4 --threshold 0.7` |
| CLI | 2.1.299 (baseline 37218381217: 2.1.289) |
| duration | eval 1297 s (`durationSeconds`; baseline 692 s); run created 06:13:09Z, completed 06:35:29Z |
| cost | $34.03 (`costUsd` 34.032882; baseline $25.13) |
| job | conclusion `failure`: `Run the cases` exit 1 after `Wrote evals-ci/result.json`; Summary, Publish, Upload green. Runner `casesPassed` 9 of 10; the one case under 0.7 is hands-off-after-verdict (0.67). 37198713961 and 37213238188 (`casesPassed` < `casesTotal`) were also published as `failure` |
| aggregates | overallScore 0.903 (baseline 0.956), overallPassRate 0.7 (0.8), meanDelta +0.14 (+0.20) |
| usage or limit errors | none: the only two run errors are the TRUNCATED ones below |

Summary, first lines (`results/38520925302.txt`):

```
valid 10 of 10 (2 TRUNCATED: ask-the-council/forces-divergence ponytail/pushback-on-abstraction)
re-run: none
cost $34.03  runner aggregates over the 10 cases in the results: {"casesTotal": 10, "casesPassed": 9, "overallScore": 0.9028571428571428, "overallPassRate": 0.7, "meanDelta": 0.14476190476190479}
```

Per case: mean run score per arm, computed from both JSONs (`python -I`); each equals the case's `aggregates.score` / `scoreWithout`.

| case | with | without | flag | baseline with | baseline without |
|---|---|---|---|---|---|
| ask-the-council/declines-low-stakes | 1.00 | 1.00 | - | 1.00 | 1.00 |
| ask-the-council/forces-divergence | 0.70 | 0.70 | TRUNCATED with#0: `timed out after 900s` (923 s, 3 turns) | 1.00 | 0.70 |
| ask-the-council/hands-off-after-verdict | 0.67 | 0.17 | - (under threshold 0.7) | 0.83 | 0.17 |
| ponytail/defers-to-simplify | 1.00 | 1.00 | - | 1.00 | 1.00 |
| ponytail/pushback-on-abstraction | 0.90 | 0.50 | TRUNCATED without#0: `Reached maximum number of turns (15)` (16 turns) | 0.80 | 0.30 |
| ponytail/refuses-trust-boundary | 0.83 | 0.83 | - | 1.00 | 0.83 |
| ponytail/root-cause | 1.00 | 1.00 | - | 1.00 | 1.00 |
| prompt-generator/coding-agent-repo-prompt | 0.93 | 0.71 | - | 0.93 | 0.71 |
| prompt-generator/human-prose-boundary | 1.00 | 1.00 | - | 1.00 | 1.00 |
| prompt-generator/whole-build-scope-check | 1.00 | 0.67 | - | 1.00 | 0.83 |

Graders behind the moves (from both `.txt` files):

| case | arm | change | graders |
|---|---|---|---|
| forces-divergence | with | -0.30 | with#0 timed out; its evidence is the opening line only (`I'll convene the council via the ask-the-council skill…`), so chairman-commits, chairman-names-risk, chairman-names-tradeoff FAIL FAIL FAIL on that run; with#1 passes all |
| hands-off-after-verdict | with | -0.17 | handoff-named fails both with runs (baseline: with#1 only); both replies open on the memory directory being write-protected / blocked by permission settings |
| refuses-trust-boundary | with | -0.17 | with#1 `result` FAIL FAIL FAIL (baseline PP); skill-fired 0x in both with runs, as in baseline |
| pushback-on-abstraction | with, without | +0.10, +0.20 | names-upgrade-trigger passes with#1 (baseline fails both); TRUNCATED is without#0 only (baseline without#0 and without#1) |
| whole-build-scope-check | without | -0.17 | `result` fails both without runs (baseline one) |

Re-run list for P5: none (0 INVALID, 0 NOT RUN). TRUNCATED runs count as valid (section 6), so they are not on it.

Model usage in P2: the eval, $34.03 (published `costUsd`).

## 11. P3 sandboxed, first attempt (2026-10-14)

| field | value |
|---|---|
| run | 38523993370, https://github.com/alonbaron/claude-skills/actions/runs/38523993370 |
| dispatch | 06:44:30Z, session 0e47ee54, `gh workflow run evals.yml --ref v3.2-models-tracker-evals -f cases=sandboxed -f model=claude-fable-5-1` |
| tested commit | 7917825 (header `commit: 7917825ad4aab41c9ffc93ae3bbd5acb63c5c2af  ref: v3.2-models-tracker-evals`) |
| model, judge | claude-fable-5-1, sonnet; `--runs 2 -j 4 --threshold 0.7` |
| CLI | 2.1.299 (baseline 37198713961: 2.1.289) |
| duration | eval 686 s (`durationSeconds`; baseline 1601 s); run created 06:44:32Z, completed 06:56:27Z |
| cost | $14.08 (`costUsd` 14.0827945; baseline $47.41) |
| job | conclusion `failure`: `Run the cases` exit 1 after `⚠ 29 runs ended on an API error and scored 0 without grading … the suite exits non-zero regardless of scores` and `Wrote evals-ci/result.json`; Summary, Publish, Upload green. Not the threshold exit |
| aggregates | runner over 9 cases, 8 INVALID: overallScore 0.167, meanDelta 0 (baseline 0.892, +0.23); valid-only (1 case): 1.00, +0.00 |
| usage or limit errors | 29 of 36 runs: `exit 1: You've hit your session limit · resets 10:30am (UTC)`; the first cut-off run ended 06:53:57Z. The executor session hit the limit at 06:57:03Z (`resets 1:30pm (Asia/Jerusalem)`) and stopped while watching, before recording; this section was written 2026-10-15 from the published files |
| cause | the window was not fresh: P2 (38520925302, dispatched 06:13:08Z, $34.03) ran in it. P2 + this run = $48.12 at the limit; 37198713961 hit it at $47.41. Inference, two data points: a window holds about $48 of eval spend (executor sessions' own usage unmeasured), and the sandboxed set's runs in 37198713961 sum to $48.38 with judges |

Summary, first lines (`results/38523993370.txt`):

```
valid 1 of 9
re-run: architect/right-sized-new-feature architect/small-fix-boundary review-swarm/real-diff-ranked-report review-swarm/security-alone-hands-off review-swarm/trivial-diff-declines up-to-date/dirty-and-behind up-to-date/fresh-branch-no-upstream up-to-date/no-remote-boundary
cost $14.08  runner aggregates over the 9 cases in the results, 8 of them INVALID: {"casesTotal": 9, "casesPassed": 1, "overallScore": 0.16666666666666666, "overallPassRate": 0.16666666666666666, "meanDelta": 0}
valid-only aggregates (1 cases): score 1.00  mean delta +0.00  1 of 1 at 0.7
```

Per case: mean run score per arm (`python -I`, both JSONs); runs finished without error; baseline cost is the case's runs plus judges in 37198713961.

| case | with | without | runs finished | flag | baseline with | baseline without | baseline cost |
|---|---|---|---|---|---|---|---|
| architect/audit-drift-citation | 1.00 | 1.00 | 4 of 4 | - | 1.00 | 1.00 | $3.52 |
| architect/right-sized-new-feature | 0.00 | 0.67 | 2 of 4 | INVALID with#0, with#1 | 0.83 | 0.67 | $9.65 |
| architect/small-fix-boundary | 0.50 | 0.00 | 1 of 4 | INVALID with#1, without#0, without#1 | 0.88 | 0.75 | $6.22 |
| review-swarm/real-diff-ranked-report | 0.00 | 0.00 | 0 of 4 | INVALID all | 0.90 | 0.40 | $14.38 (INVALID; with#0 cut off at $8.25) |
| review-swarm/security-alone-hands-off | 0.00 | 0.00 | 0 of 4 | INVALID all | 0.67 | 0.33 | $5.67 |
| review-swarm/trivial-diff-declines | 0.00 | 0.00 | 0 of 4 | INVALID all | 1.00 | 1.00 | $1.71 |
| up-to-date/dirty-and-behind | 0.00 | 0.00 | 0 of 4 | INVALID all | 1.00 | 0.70 | $2.32 |
| up-to-date/fresh-branch-no-upstream | 0.00 | 0.00 | 0 of 4 | INVALID all | 1.00 | 0.62 | $3.24 |
| up-to-date/no-remote-boundary | 0.00 | 0.00 | 0 of 4 | INVALID all | 0.75 | 0.50 | $1.67 (INVALID; without arm cut off) |

Compared (valid in both): audit-drift-citation only, unchanged at 1.00 / 1.00, so no grader table. Not compared: the other 8, INVALID in 38523993370 (real-diff-ranked-report and no-remote-boundary also INVALID in 37198713961).

Re-run list: the 8 above, $44.86 by baseline cost. audit-drift-citation stands as measured on 7917825.

Model usage in P3 attempt 1: the eval, $14.08 (published `costUsd`); the executor session's own usage not measured.

## 12. P3 sandboxed, half A (2026-10-15)

The 8 cases section 11 left INVALID, split by skill because they cost $44.86 at baseline against about $48 a window
holds (section 11, inference). Half A here; half B (review-swarm/real-diff-ranked-report, security-alone-hands-off,
trivial-diff-declines; $21.76 at baseline, real-diff-ranked-report a lower bound since its with#0 was cut off) goes
in the next fresh window. The owner confirmed this window fresh; the last local session before this one ended
2026-10-14T14:52Z.

| field | value |
|---|---|
| run | 38690586571, https://github.com/alonbaron/claude-skills/actions/runs/38690586571 |
| dispatch | 06:07:38Z, `gh workflow run evals.yml --ref v3.2-models-tracker-evals -f cases=sandboxed -f model=claude-fable-5-1 -f only="architect/right-sized-new-feature architect/small-fix-boundary up-to-date/dirty-and-behind up-to-date/fresh-branch-no-upstream up-to-date/no-remote-boundary"` |
| tested commit | a334aed (header `commit: a334aedb31833c12b1ab1158c241a17d2869eeeb  ref: v3.2-models-tracker-evals`); skills and harness as on 7917825, only STEP7.md changed |
| model, judge | claude-fable-5-1, sonnet; `--runs 2 -j 4 --threshold 0.7` |
| CLI | 2.1.300 (attempt 1: 2.1.299; baseline 37198713961: 2.1.289) |
| duration | eval 934 s (`durationSeconds`); run created 06:07:39Z, completed 06:23:44Z |
| cost | $20.38 (`costUsd` 20.37914575; these 5 cases at baseline $23.10) |
| job | conclusion `success`, every step green; runner `casesPassed` 5 of 5 |
| aggregates | overallScore 0.975, overallPassRate 0.9, meanDelta +0.20 (5 cases; not comparable to the baseline's 9-case figures) |
| usage or limit errors | none: the only two run errors are the TRUNCATED ones below |

Summary, first lines (`results/38690586571.txt`):

```
valid 5 of 5 (2 TRUNCATED: architect/right-sized-new-feature up-to-date/fresh-branch-no-upstream)
re-run: none
cost $20.38  runner aggregates over the 5 cases in the results: {"casesTotal": 5, "casesPassed": 5, "overallScore": 0.975, "overallPassRate": 0.9, "meanDelta": 0.20166666666666666}
```

Per case: mean run score per arm (`python -I`, both JSONs); each equals the case's `aggregates.score` / `scoreWithout`.

| case | with | without | flag | baseline with | baseline without |
|---|---|---|---|---|---|
| architect/right-sized-new-feature | 1.00 | 0.67 | TRUNCATED with#1: `timed out after 900s` (914 s, 3 turns; scored 1.00) | 0.83 | 0.67 |
| architect/small-fix-boundary | 1.00 | 0.88 | - | 0.88 | 0.75 |
| up-to-date/dirty-and-behind | 1.00 | 0.70 | - | 1.00 | 0.70 |
| up-to-date/fresh-branch-no-upstream | 0.88 | 0.62 | TRUNCATED without#1: `Reached maximum number of turns (15)` (16 turns) | 1.00 | 0.62 |
| up-to-date/no-remote-boundary | 1.00 | 1.00 | - | INVALID | INVALID |

Graders behind the moves (valid-in-both cases; from both `.txt` files):

| case | arm | change | graders |
|---|---|---|---|
| right-sized-new-feature | with | +0.17 | right-sized-process passes both with runs (baseline with#0 FAIL FAIL PASS) |
| small-fix-boundary | with | +0.125 | two-boundary-enforcement passes both with runs (baseline with#1 FAIL PASS FAIL) |
| small-fix-boundary | without | +0.125 | no-invention passes without#1 (baseline fails both) |
| fresh-branch-no-upstream | with | -0.125 | falls-back-to-default-branch fails with#1, FAIL FAIL FAIL (baseline passes both) |

Not compared: no-remote-boundary, INVALID in 37198713961; here 1.00 / 1.00 on all four runs, so its first clean
measurement. dirty-and-behind unchanged.

Re-run list for P5: none from half A.

Harness change after this dispatch, db49d7a: the summary finds case folders by `prompt.md` (every case has one;
`case.yaml` only the 11 with a fixture), so on a PARTIAL run a fixture-less case that never started is NOT RUN
instead of missing from `valid N of M`. Old and new output identical on the five published runs (37198713961,
37213238188, 37218381217, 38520925302, 38523993370); on 38520925302 with 3 cases dropped and `partial` set, old
`valid 7 of 8 … (1 NOT RUN)`, new `valid 7 of 10 … (3 NOT RUN)`. This run's summary re-derived with it: first two
lines unchanged.

Model usage in P3 half A: the eval, $20.38 (published `costUsd`).

## 13. P3 sandboxed, half B (2026-10-15)

The three review-swarm cases section 12 left for the next fresh window. The owner confirmed this window fresh; the
newest earlier eval run (38690586571) was created 06:07:39Z, 5 h 21 m before this dispatch.

| field | value |
|---|---|
| run | 38727606834, https://github.com/alonbaron/claude-skills/actions/runs/38727606834 |
| dispatch | 11:28:40Z, `gh workflow run evals.yml --ref v3.2-models-tracker-evals -f cases=sandboxed -f model=claude-fable-5-1 -f only="review-swarm/real-diff-ranked-report review-swarm/security-alone-hands-off review-swarm/trivial-diff-declines"` |
| tested commit | ad68dd5 (header `commit: ad68dd5d31660a86912abe81428a789775b4e67f  ref: v3.2-models-tracker-evals`); skills as on 7917825, only `eval-summary.py` (db49d7a) and STEP7.md changed |
| model, judge | claude-fable-5-1, sonnet; `--runs 2 -j 4 --threshold 0.7` |
| CLI | 2.1.300 (half A: 2.1.300; baseline 37198713961: 2.1.289) |
| duration | eval 1156 s (`durationSeconds`); run created 11:28:42Z, completed 11:48:26Z |
| cost | $22.64 (`costUsd` 22.64316305, the runs' `costUsd` summed; with judges $22.75; these 3 cases at baseline $21.76, a lower bound) |
| job | conclusion `failure`: `Run the cases` exit 1 after `Wrote evals-ci/result.json`, no API-error warning; Summary, Publish, Upload green; `partial` false. Threshold exit: runner `casesPassed` 2 of 3, security-alone-hands-off with 0.67 under 0.7 |
| aggregates | overallScore 0.889, overallPassRate 0.667, meanDelta +0.31 (3 cases; not comparable to the baseline's 9-case figures) |
| usage or limit errors | none: every run has `error: null` |

Summary, first lines (`results/38727606834.txt`):

```
valid 3 of 3
re-run: none
cost $22.64  runner aggregates over the 3 cases in the results: {"casesTotal": 3, "casesPassed": 2, "overallScore": 0.8888888888888888, "overallPassRate": 0.6666666666666666, "meanDelta": 0.3111111111111111}
```

Per case: mean run score per arm (`python -I`, both JSONs); each equals the case's `aggregates.score` / `scoreWithout`.
Cost is the case's runs plus judges.

| case | with | without | flag | baseline with | baseline without | cost | baseline cost |
|---|---|---|---|---|---|---|---|
| review-swarm/real-diff-ranked-report | 1.00 | 0.40 | - | INVALID | INVALID | $15.03 | $14.38 (with#0 cut off at $8.25) |
| review-swarm/security-alone-hands-off | 0.67 | 0.33 | - | 0.67 | 0.33 | $6.15 | $5.67 |
| review-swarm/trivial-diff-declines | 1.00 | 1.00 | - | 1.00 | 1.00 | $1.57 | $1.71 |

Graders: no compared case moved, so no grader table. security-alone-hands-off loses hands-off-to-security-review on
all four runs again (with: FAIL FAIL FAIL each; the with runs review in a single pass instead of handing off), as in
37198713961.

Not compared: real-diff-ranked-report, INVALID in 37198713961; here 1.00 / 0.40, all four runs finished, so its first
clean measurement. With arm: all six graders pass both runs; without arm: ranked-report-shape, reviewers-sonnet,
verifiers-opus fail both runs.

Re-run list for P5: none from half B.

P3, all 9 cases (with / without: mean run score per arm in the source run):

| case | with | without | flag | source run |
|---|---|---|---|---|
| architect/audit-drift-citation | 1.00 | 1.00 | - | 38523993370 |
| architect/right-sized-new-feature | 1.00 | 0.67 | TRUNCATED with#1 | 38690586571 |
| architect/small-fix-boundary | 1.00 | 0.88 | - | 38690586571 |
| review-swarm/real-diff-ranked-report | 1.00 | 0.40 | - | 38727606834 |
| review-swarm/security-alone-hands-off | 0.67 | 0.33 | with under 0.7 | 38727606834 |
| review-swarm/trivial-diff-declines | 1.00 | 1.00 | - | 38727606834 |
| up-to-date/dirty-and-behind | 1.00 | 0.70 | - | 38690586571 |
| up-to-date/fresh-branch-no-upstream | 0.88 | 0.62 | TRUNCATED without#1 | 38690586571 |
| up-to-date/no-remote-boundary | 1.00 | 1.00 | - | 38690586571 |

P3 total: valid 9 of 9, re-run none; three tested commits (7917825, a334aed, ad68dd5) with the same skill files.
Eval spend over the three runs: $14.08 + $20.38 + $22.64 = $57.10 (`costUsd`).

Model usage in P3 half B: the eval, $22.64 (published `costUsd`).

## 14. P4 trigger suite: first attempt and cap change (2026-10-17, 2026-10-18)

First attempt, 2026-10-17, local, all 120 cases in one invocation.

| field | value |
|---|---|
| results | `evals-trigger/results/2026-10-17T11-28-43-593Z/aggregate-result.json` (gitignored) |
| started | 11:28:43Z; `durationSeconds` 1787; CLI 2.1.296 |
| caps | `max_turns: 6`, `timeout_seconds: 180` in every case |
| cost | $25.26 (`costUsd`): 79 paid runs, $0.32 each on average |
| limit | first `You've hit your session limit` at 11:56:06Z; the remaining 160 runs never started (cost 0) |
| summary | `python -I .github/scripts/eval-summary.py <json> evals-trigger 2`: valid 40 of 120 (16 TRUNCATED at 180 s) |

The 40 valid cases: architect 20, ask-the-council 19 (yes-09 INVALID: both runs ended on the limit, with#0 after a Skill call), review-swarm-no-13.
They stay as measured, at the 6-turn / 180 s caps. 80 cases are left: ask-the-council-yes-09, ponytail 20,
prompt-generator 20, review-swarm 19, up-to-date 20. The runner's `casesPassed` (76) is not used: it counts a
should-not case whose runs died on the limit as a pass.

Change for the remaining 80 (2026-10-18, P4.0), in every `evals-trigger/*/prompt.md` and `graders/*.md`:

| was | now | count before / after |
|---|---|---|
| `max_turns: 6` | `max_turns: 3` | 120 / 120 |
| `timeout_seconds: 180` | `timeout_seconds: 90` | 120 / 120 |
| `(?:[\w-]+:)?` in `input_match` | `(?:alon-skills:)?` | 120 / 120 |

Why: a trigger case asks only whether the first reply calls the Skill tool, so turns after it are spend with no
signal (avg $0.32 per run at 6 turns). The old prefix matched any plugin namespace, and the session also lists
`anthropic-skills:ponytail` and `anthropic-skills:prompt-generator` (claude.ai custom-skill duplicates), so a
call to one of those passed a should-fire case and failed a should-not case for the wrong skill. The suite is
gitignored; this section is the record of the change.

### P4a probe (2026-10-18)

The owner confirmed the window fresh; the newest earlier eval was the 2026-10-17 local run (above), CI's newest
38727606834 (2026-10-15). Four commands, one case each, `--runs 1 --keep-temp --max-cost-usd 0.75` (cap $3
total), caps 3 turns / 90 s, CLI 2.1.296, started 05:59:16Z, all done 06:00:49Z.

| case | cost | main-thread turn of the Skill call | end | score |
|---|---|---|---|---|
| ponytail-yes-00 | $0.373 | 1: `alon-skills:ponytail` | max turns (3) | 1 |
| ponytail-no-10 | $0.348 | 1: `simplify` (not ponytail: the correct decline) | max turns (3) | 1 |
| ask-the-council-yes-00 | $0.349 | 2: `alon-skills:ask-the-council`, after a Glob on turn 1; turn 3 spawned 4 opus Agent seats | timed out at 90 s | 1 |
| review-swarm-yes-03 | $0.326 | none: Glob on turns 1-3 | max turns (3) | 0 |

Probe spend $1.40 (`costUsd` summed), $0.35 per run. Turns counted by distinct assistant `message.id` with no
`parent_tool_use_id` in `out/trace.jsonl`. Each child's init `skills` lists 24 skills, 7 of them `alon-skills:*`
and none `anthropic-skills:*`.

| gate | result |
|---|---|
| every Skill call on turn 1 | FAIL: council fired on turn 2; review-swarm-yes-03 never called Skill in 3 turns |
| cost/run <= $0.15 | FAIL: $0.33-$0.37 (2026-10-17 at 6 turns: $0.32 average) |
| no anthropic-skills duplicates in the child | PASS |

Cutting turns from 6 to 3 did not cut cost per run. Each run's usage is about 15-17k cache-creation (1 h TTL) plus
29-31k cache-read input tokens and under 600 output tokens, so cost looks set by context setup, not by turns; that
is an inference from four runs, not measured against a 1-turn cap. The 3-turn cap also cuts off a should-fire case
that looks first and fires on turn 2 (council-yes-00 would fail at `max_turns: 1`).

Stopped at P4a: P4b and P4c not run. The caps and prefix from P4.0 stay in place.

Decision after P4a (owner, 2026-10-18): accept $0.35/run; the cost gate becomes <= $0.40/run; caps stay at 3 turns /
90 s, which still catch a turn-2 fire (council-yes-00). One skill per window: 40 runs x $0.35 = $14 against the $15
window budget, so `ask-the-council-yes-09` (2 runs) moves to P5. The turn-1 gate is dropped: the grader scores a
Skill call on any of the 3 turns, and review-swarm-yes-03 not firing is a trigger result, not a harness fault.
Remaining P4 spend: 4 windows, about $56.
