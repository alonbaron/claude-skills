# alon-skills v3.3 step B3: build loop measured with the patterns section and the base check (2026-11-12)

Continues `STEP8.md`. Branch `feat/v3.3`, HEAD 5f4f338, CLI 2.1.322, billed to the plan.

## 1. What changed in `workflows/build-loop.js`

| commit | stage | change |
|---|---|---|
| 3dcd9d6 | close | new step 3: keep a `## Reusable patterns` section in `docs/handoff.md`, between the header and the newest entry; one bullet per pattern, `- <pattern> (<file>; from <id>)`, at most 3 added per task, 12 in the section |
| 3dcd9d6 | spec | reads that section (not the log under it) and puts each pattern that bears on the task in spec section 3, 4 or 6 |
| 5f4f338 | refute, correctness lens | sees the task row and always sets `baseCheck`; for a bug-fix row it runs the new test in a detached worktree of the base commit under `<scratch>/<id>/base` and removes the worktree |
| 5f4f338 | loop | `REFUTE_SCHEMA.baseCheck` (`fails-on-base`, `passes-on-base`, `not-run`, `not-a-bug-fix`); one log line per round, `round N: base check <value>` |

## 2. Fixture

A clone of the 2026-11-11 run 2 end state (`STEP8.md` section 4, commit e127c4c: row 1.1 finished, `docs/handoff.md`
present with one entry and no patterns section), plus one commit, 0b89a32:

- `src/slug.js`: a seeded defect. The separator class became `[^a-zA-Z0-9']`, so `slugify("Don't stop")` returned
  `don't-stop`. No existing test title held an apostrophe: 7 of 7 tests passed and lint exited 0 with the defect in.
- `TODO_WORKFLOW.md`: a new row 1.2, a bug fix ("Fix: `slugify("Don't stop")` returns `don't-stop` … Add a regression
  test"). `truncateSlug` moved from row 1.2 to row 1.3, and the "Left for 1.2" note in row 1.1 became "Left for 1.3".

## 3. The run

`node scripts/autobuild.mjs --tasks 2 --repo <fixture> --plugin-dir <this repo>`, in the background, with
`ANTHROPIC_API_KEY` not set in the shell. Two tasks, not the one of `STEP8.md`: the second session's spec stage is
the only reader of a patterns section that a close stage wrote. Table columns as in `STEP8.md`.

### Session 1, row 1.2 (the bug fix)

Run directory `~/.claude/projects/…/b1e25cb7-3a26-4adb-a25a-c1c4b1ae73c7/subagents/workflows/wf_20cad14a-53a`.

| phase | stage | alias | resolved id | effort | assistant records with effort | output tokens | tool calls | seconds | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Plan | plan | fable | claude-fable-5-2 | high | 8/8 | 2385 | 6 | 23 | done |
| Scout | scout:1.2 | haiku | claude-haiku-5-5 | low | 6/6 | 2819 | 5 | 15 | done |
| Spec | spec:1.2 | fable | claude-fable-5-2 | high | 15/15 | 7007 | 12 | 67 | done |
| Build | build:1.2 | sonnet | claude-sonnet-5-5 | medium | 11/11 | 2003 | 9 | 33 | done |
| Measure | measure:1.2 | haiku | claude-haiku-5-5 | low | 3/3 | 458 | 2 | 3 | done |
| Refute | refute:correctness:1.2:r1 | sonnet | claude-sonnet-5-5 | medium | 4/4 | 751 | 3 | 14 | done |
| Refute | refute:invariants:1.2:r1 | opus | claude-opus-5-5 | high | 6/6 | 1729 | 3 | 19 | done |
| Refute | refute:critic:1.2:r1 | opus | claude-opus-5-5 | high | 8/8 | 1747 | 4 | 18 | done |
| Refute | refute:acceptance:1.2:r1 | sonnet | claude-sonnet-5-5 | medium | 4/4 | 583 | 3 | 12 | done |
| Close | close:1.2 | sonnet | claude-sonnet-5-5 | low | 6/6 | 1447 | 4 | 23 | done |

- 10 stages, 12:06:25.526Z to 12:09:31.523Z (3:06), 20,929 output tokens. No research (0 unverified APIs), no
  arbiter or fix (every lens passed, 0 blocking, 4 advisory). No adversary lens: the diff was 3 files and 5 lines,
  under the 30-line gate.
- Driver log `session b1e25cb7-3a26-4adb-a25a-c1c4b1ae73c7 cost $3.24 turns 1`, `session 1 done: reached maxTasks=1`.

### Session 2, row 1.3 (truncateSlug)

Run directory `~/.claude/projects/…/3255dcd0-0011-441a-a65e-4d0d61945a76/subagents/workflows/wf_7bf76201-09e`.

| phase | stage | alias | resolved id | effort | assistant records with effort | output tokens | tool calls | seconds | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Plan | plan | fable | claude-fable-5-2 | high | 11/11 | 3374 | 8 | 34 | done |
| Scout | scout:1.3 | haiku | claude-haiku-5-5 | low | 11/11 | 5740 | 8 | 28 | done |
| Spec | spec:1.3 | fable | claude-fable-5-2 | high | 31/31 | 16768 | 24 | 166 | done |
| Build | build:1.3 | sonnet | claude-sonnet-5-5 | medium | 9/9 | 2950 | 8 | 37 | done |
| Measure | measure:1.3 | haiku | claude-haiku-5-5 | low | 3/3 | 456 | 2 | 3 | done |
| Refute | refute:correctness:1.3:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 1047 | 4 | 18 | done |
| Refute | refute:invariants:1.3:r1 | opus | claude-opus-5-5 | high | 4/4 | 1920 | 3 | 20 | done |
| Refute | refute:critic:1.3:r1 | opus | claude-opus-5-5 | high | 9/9 | 3066 | 6 | 30 | done |
| Refute | refute:acceptance:1.3:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 834 | 4 | 16 | done |
| Refute | refute:adversary:1.3:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 1542 | 4 | 25 | done |
| Close | close:1.3 | sonnet | claude-sonnet-5-5 | low | 4/4 | 1756 | 3 | 22 | done |

- 11 stages, 12:09:40.232Z to 12:15:32.252Z (5:52), 39,453 output tokens. No research, arbiter or fix (every lens
  passed, 0 blocking, 10 advisory). The spec stage committed a doc change first (d7a2b25: rule 2.3 reworded, I1 by
  construction, rule 3.1), which the two carried "Left for 1.3" notes asked for.
- Driver log `session 3255dcd0-0011-441a-a65e-4d0d61945a76 cost $3.47 turns 1`, `session 2 done: reached maxTasks=1`.

### Both sessions

- Driver-reported cost $6.71 ($3.24 + $3.47); driver exit 0; no usage or limit message. Plan window before and
  after: not read.
- Commits on `feature/slug` after 0b89a32: 9 (8a81647, 765c270, 133fea3, 283c36c, 34eae69, d7a2b25, 48d8501,
  3265a5a, 665e2d8), all authored by the owner's git identity. Git-parsed trailers: 0. Tests 15 of 15, lint exit 0,
  tree clean, `git worktree list` shows the main worktree only.
- Model aliases resolved as on 2026-11-11.

## 4. The base check (5f4f338)

| row | `baseCheck` | what the correctness lens ran |
|---|---|---|
| 1.2 | `fails-on-base` | `git worktree add --detach .claude/scratch/build-loop/1.2/base 0b89a32…`, copied `test/slug.test.js` into it, ran `node --test test/slug.test.js` there, `git worktree remove --force`, `git status --short` |
| 1.3 | `not-a-bug-fix` | no worktree command |

- Row 1.2 on the base commit: pass 5, fail 2. The failing assertion was `actual: "don't-stop"`, `expected: 'don-t-stop'`
  in the 2.3 test; the I1 test failed on the same case.
- The log line reached each session's `workflows/wf_<id>.json`: `round 1: base check fails-on-base` and
  `round 1: base check not-a-bug-fix`. The driver's refute summary does not print `baseCheck`.
- Not measured: a test that passes on the base commit (`passes-on-base` and its blocking finding), and `not-run`.

## 5. The patterns section (3dcd9d6)

| stage | what it did |
|---|---|
| spec:1.2 | read `docs/handoff.md`; the file had no patterns section; `spec.md` cites none |
| close:1.2 | created `## Reusable patterns` between the header and the new entry, with 2 bullets (commit 283c36c) |
| spec:1.3 | read `docs/handoff.md`; `spec.md` line 86 carries bullet 1 as a "Do not" ("Do not edit `slugify`. It replaces separators before it lowercases … reusable pattern from 1.2") and line 87 marks bullet 2 resolved by its own doc commit |
| close:1.3 | added 3 bullets and removed bullet 2 (commit 665e2d8); the section holds 4 |

The two bullets close:1.2 wrote:

```
- slugify replaces separators before it lowercases; the Kelvin and U+0130 cases depend on that order, so keep it (src/slug.js; from 1.2)
- SoT rule 2.3 wording ("after lowercasing") disagrees with the code order; code and tests are right until 1.3 rewords it (SOURCE_OF_TRUTH.md; from 1.2)
```

What to know before relying on it:

1. Bullet 2 was an open item, not a pattern. The same fact was already in row 1.2's "Left for 1.3" note. The spec
   stage of 1.3 resolved it, and then the invariants and critic lenses each raised the stale bullet as an advisory
   finding (`docs/handoff.md:7`). Of the three bullets close:1.3 added, one is an open item too ("Error precedence
   when both slug and max are invalid is unspecified; code checks slug first").
2. close:1.3 removed the stale bullet. The prompt does not tell it to; it says to leave existing bullets as they
   are. The removal was correct here, and it followed the two advisory findings in the outcome.
3. Not measured: a close on a repo with no `docs/handoff.md` at all, the 12-bullet ceiling, and the "- none yet"
   line.
