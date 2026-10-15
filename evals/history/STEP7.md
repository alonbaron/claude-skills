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
| P3 | sandboxed (9 cases: architect, review-swarm, up-to-date) | CI: same with `-f cases=sandboxed` | about $47 (37198713961: $47.41); fills a fresh window alone | the owner says the window is fresh | INVALID: session limit, dispatched in P2's window (section 11); valid 1 of 9, re-run 8, $14.08 | 38523993370 |
| P4 | trigger suite (120 local cases in `evals-trigger/`) | local, detached: `claude plugin eval <repo> --eval-dir evals-trigger --runs 2 -j 4 --ablation none --model claude-fable-5-1 --no-publish --trust-plugin --json <scratch>/trigger.json` | not measured for a clean pass; `STEP5.md` section 6: about $115 over four invocations, two of them re-runs after the 5-hour limit | the owner says the window is fresh | pending | - |
| P5 | re-runs of INVALID cases (at most two attempts each), then the README write-up | CI `-f only="<skill>/<case> ..."`; trigger `--case` | depends on what P2-P4 leave INVALID | the owner says the window is fresh | pending | - |

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
