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

## 2. P1 progress (2026-10-12)

| step | status | evidence |
|---|---|---|
| 1 branch | done | `v3.2-models-tracker-evals` from `main` 838df70, equal to `origin/main`, clean |
| 2 aliases | done | section 1, commit 42bc757 |
| 3 model text | done | 33fa4f8 (README build-loop paragraph, `build-loop.js` tier comment). Remaining `git grep -n -i -E 'haiku\|4\.5\|4-5'` hits outside `evals/history/`: the `haiku, low` alias cells, the `.m.haiku` CSS class, `454.5` (an SVG coordinate in `hero.svg`), README.md:137 (the v3.1 run, rewritten in step 7), the kept Haiku 4.5 test case |
| 4 tracker | done | b6ce419 |
| 5 mod | done | 77a3faa (workflow-watch 0.2.0) |
| 6 fresh build-loop run | blocked | section 3 |
| 7-11 | not started | |

Checks so far:

- `node scripts/tracker.mjs --help`: prints the header comment, exit 0. The slice now ends at the first non-comment line.
- Tracker on `wf_ec0355da-6ea` (`~/.claude/projects/…/e2e9eb96-33c7-4463-9b61-e829e5407973/subagents/workflows/`): 19 cards, the 5 failed ones open, `--png` gives 1616x9846. Playwright 1.61.1 (its Chromium is the installed build 1228) from the scratch directory: `scrollWidth <= clientWidth` at 390 px and at 900 px, folds as rendered and all opened; 0 `<script>` elements, 0 external `src`/`href`. Footer: `~/.claude/projects/…/e2e9eb96-33c7-4463-9b61-e829e5407973/subagents/workflows/wf_ec0355da-6ea`.
- Injection copy (scratch copy of that run, first journal result set to the string `<img src=x onerror=alert(1)>`): the page contains `&lt;img src=x onerror=alert(1)&gt;` twice (result line, full result) and `<img` zero times.
- Variant copy (last result dropped so one stage runs, two transcripts' effort set to `xhigh` and `max`): effort classes low, medium, high, xhigh, max and na all rendered.
- `claude plugin validate mods/workflow-watch`: "✔ Validation passed".
- `claude plugin test mods/workflow-watch`: 15 pass, 0 fail (13 in `journal.test.ts`, 2 new in `render.test.tsx`, which mount the Pane and the AbovePrompt band on terminal and desktop).
- `tsc -p mods/workflow-watch`: not runnable as written (no session has laid `.claude-plugin/types/` beside the mod; no global tsc). Run instead with the types file header's tsconfig kept in the scratch directory, `include` = the plugin-authoring skill's `types/claude-code.d.ts` plus the mod's `hooks`, `types`, `tests`; TypeScript 7.0.2 in scratch: exit 0, all five mod files listed by `--listFiles`.
- Mod fold: the 2.1.296 element tables (`Elements`: Box, Text, Button, Input, Select, Link, Code, Markdown, Client, Raster, Image, Svg) have no disclosure element, so a stage's details are one compact line.

Model usage in P1 so far: the four alias probes ($0.77). Nothing else.

## 3. Blocker: the old fixture cannot be cloned (P1 step 6)

- `git clone <scratch of session f2cf451d>/build-loop-fixture <scratch>/clone-attempt`: `fatal: '…/build-loop-fixture' does not appear to be a git repository`, exit 128.
- What is left: `.git` has no HEAD, config, index or ref file (`refs/heads/feature/` and `logs/refs/heads/feature/` are empty folders), and the working tree has no files (`docs/`, `src/`, `test/`, `.claude/scratch/build-loop/` are empty folders). 50 loose objects remain: 11 commits, 19 trees, 20 blobs. A read-only survey (each object inflated, each commit's tree walked) finds every commit's tree complete. The commits form one chain:

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

- Decision needed (owner), one of:
  a. rebuild a fixture from these objects at the clone path (new repository, objects copied, a branch at a commit the owner names, e.g. 6707bad whose row 1.2 is `[ ]`); the old folder is not touched;
  b. name another fixture to clone;
  c. make a new throwaway repo from the architect templates.
- Not done until then (P1 steps 6-11): the fresh run and its facts, the new `assets/tracker.png` with README.md:130 and :137, the harness (`eval-summary.py`, `evals.yml`), plugin.json 3.2.0 and its checks, this file's eval plan for P2-P5, the draft PR.
