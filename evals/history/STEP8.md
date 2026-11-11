# alon-skills v3.2.3: build loop measured on Fable 5.2 (2026-11-11)

Continues `STEP7.md` section 4. Branch `fix/fable-5-2-evals`, CLI 2.1.322, billed to the plan.

## 1. Fixture

The October fixture is gone, so a new one was built outside this repo: a Node repo with no dependencies
(`node --test`, a lint script that runs `node --check` over `src/` and `test/`), one commit (855f3c5) on `main`.

- `SOURCE_OF_TRUTH.md`: the surface of `slugify(title)` and `truncateSlug(slug, max)`, six slugify rules, four
  truncateSlug rules, invariants I1 and I2. Rule 2.3 decides the non-ASCII case up front (separators, no
  transliteration); that missing decision blocked row 1.1 in the October fixture's history.
- `ARCHITECTURE_ROADMAP.md`, `CLAUDE.md` with the `## Commands` table (test `npm test`, lint `npm run lint`).
- `TODO_WORKFLOW.md`: rows 1.1 and 1.2, both `[ ]`, branch `feature/slug`. No `docs/` folder.

Run 2 used a clone of that commit, so both runs started from the same tree and both built row 1.1.
October's run built row 1.2 on a fixture that already had `docs/handoff.md`.

## 2. Run 1, before the close change (HEAD 6a56477)

`node scripts/autobuild.mjs --tasks 1 --repo <fixture> --plugin-dir <this repo>`, run in the background.
Run directory `~/.claude/projects/…/745a5aa2-2699-4fa2-9616-e23fc02fbb0b/subagents/workflows/wf_6100360f-825`.
Alias from each `agent-<id>.meta.json`, resolved id and effort from each `agent-<id>.jsonl`.

| phase | stage | alias | resolved id | effort | assistant records with effort | output tokens | tool calls | seconds | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Plan | plan | fable | claude-fable-5-2 | high | 9/9 | 2647 | 8 | 27 | done |
| Scout | scout:1.1 | haiku | claude-haiku-5-5 | low | 10/10 | 2597 | 8 | 14 | done |
| Spec | spec:1.1 | fable | claude-fable-5-2 | high | 13/13 | 7805 | 11 | 70 | done |
| Build | build:1.1 | sonnet | claude-sonnet-5-5 | medium | 15/15 | 3695 | 12 | 55 | done |
| Measure | measure:1.1 | haiku | claude-haiku-5-5 | low | 3/3 | 449 | 2 | 4 | done |
| Refute | refute:correctness:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 1413 | 4 | 21 | done |
| Refute | refute:invariants:1.1:r1 | opus | claude-opus-5-5 | high | 9/9 | 2926 | 5 | 38 | done |
| Refute | refute:acceptance:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 1182 | 4 | 17 | done |
| Refute | refute:critic:1.1:r1 | opus | claude-opus-5-5 | high | 11/11 | 4763 | 6 | 53 | done |
| Refute | refute:adversary:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 8/8 | 1656 | 6 | 27 | done |
| Close | close:1.1 | sonnet | claude-sonnet-5-5 | low | 6/6 | 1856 | 4 | 24 | done |

- 11 stages, 14:49:56.153Z to 14:54:36.023Z (4:40), 30,989 output tokens. No research (0 unverified APIs), no
  arbiter or fix (every lens passed, 0 blocking, 9 advisory).
- Driver reply `{"tasks":[{"taskId":"1.1","branch":"feature/slug","status":"[FINISHED - PENDING MERGE]","reason":null,"fixRounds":0,"closed":true}],"stoppedBecause":"reached maxTasks=1",...}`;
  driver log `session 745a5aa2-2699-4fa2-9616-e23fc02fbb0b cost $3.56 turns 1`.
- Commits on `feature/slug` (`main..feature/slug`): 4 (f3bc25d, 4d4b857, de026de, 2a3b3a7), all authored by the
  owner's git identity. Attribution lines in their bodies: 0; git-parsed trailers: 0. Tests 7 of 7, lint exit 0.
- No usage or limit message. Plan window: 2% before the run, 7% after, this session's own use included.

### What close did differently from October

1. Its script edited `TODO_WORKFLOW.md`, then failed with `FileNotFoundError: 'docs/handoff.md'` (no `docs/`
   folder). The same shell command went on to `git add -A && git commit`, so commit ffde4ec held the TODO row only.
2. It wrote `docs/handoff.md` and ran `git commit -q --amend --no-edit`. Reflog: `2a3b3a7 commit (amend)`.
3. It sent `{"ok":true,"commit":"pending"}` in the same assistant message as that Bash call (14:54:33.103Z); the
   command's result arrived at 14:54:36.017Z. October's close returned `{"ok":true,"commit":"50c1bf1"}` in a
   later message than its commit.

End state correct: 2a3b3a7 holds both files, tree clean. Cause of 1 and 2: first close on a repo without
`docs/handoff.md`, a path October's fixture did not take. Cause of 3: unknown; both runs used
`claude-sonnet-5-5` at `low`.

## 3. The close change (831332c)

- Step 3: one commit, made after both files are written; never `--amend`; a second commit with the same subject
  if something was left out.
- Step 4, new: after the commit command has returned, run `git status --short` and `git log -1 --format=%h`, read
  the output, then answer; `ok` is true only when the status is empty and the hash is the commit just made.
- `CLOSE_SCHEMA.commit` carries a description saying the same.

## 4. Run 2, with the close change (HEAD 831332c)

Same command on the clone. Run directory
`~/.claude/projects/…/5d5f46a3-3f5b-4f4c-9a90-c1250182d457/subagents/workflows/wf_7269e3b3-0bc`.

| phase | stage | alias | resolved id | effort | assistant records with effort | output tokens | tool calls | seconds | outcome |
|---|---|---|---|---|---|---|---|---|---|
| Plan | plan | fable | claude-fable-5-2 | high | 10/10 | 2703 | 7 | 27 | done |
| Scout | scout:1.1 | haiku | claude-haiku-5-5 | low | 10/10 | 4413 | 7 | 24 | done |
| Spec | spec:1.1 | fable | claude-fable-5-2 | high | 19/19 | 8263 | 15 | 77 | done |
| Build | build:1.1 | sonnet | claude-sonnet-5-5 | medium | 16/16 | 3832 | 11 | 44 | done |
| Measure | measure:1.1 | haiku | claude-haiku-5-5 | low | 4/4 | 620 | 3 | 5 | done |
| Refute | refute:correctness:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 6/6 | 1025 | 4 | 16 | done |
| Refute | refute:invariants:1.1:r1 | opus | claude-opus-5-5 | high | 7/7 | 2432 | 4 | 25 | done |
| Refute | refute:critic:1.1:r1 | opus | claude-opus-5-5 | high | 6/6 | 2616 | 3 | 28 | done |
| Refute | refute:acceptance:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 7/7 | 930 | 5 | 12 | done |
| Refute | refute:adversary:1.1:r1 | sonnet | claude-sonnet-5-5 | medium | 7/7 | 1349 | 5 | 18 | done |
| Close | close:1.1 | sonnet | claude-sonnet-5-5 | low | 4/4 | 1298 | 3 | 15 | done |

- 11 stages, 15:05:19.218Z to 15:09:21.772Z (4:03), 29,481 output tokens. No research, arbiter or fix (every
  lens passed, 0 blocking, 9 advisory).
- Driver reply: same shape, `[FINISHED - PENDING MERGE]`, `fixRounds` 0, `closed` true; driver log
  `session 5d5f46a3-3f5b-4f4c-9a90-c1250182d457 cost $3.38 turns 1`.
- Close: one command wrote both files and committed (15:09:18.130Z), its result came back with `e127c4c`
  (15:09:20.503Z), then `{"ok":true,"commit":"e127c4c"}` (15:09:21.769Z). Reflog: one `commit:` entry for close,
  no amend. e127c4c holds `TODO_WORKFLOW.md` and `docs/handoff.md`; tree clean.
- Commits on `feature/slug`: 4 (dc47ddd, d3914ee, 1512ee5, e127c4c), all authored by the owner's git identity.
  Attribution lines: 0; trailers: 0. Tests 7 of 7, lint exit 0. No usage or limit message.
- Plan window: 7% before the run, 13% after, this session's own use included (reading both run directories,
  writing this file and the README paragraph).

## 5. Output tokens against October

Counted the same way in all three runs: the last record of each API message id, summed. That gives 8,070 for
the October run (the README's 8.1k; STEP7 section 4 says 8,463 and its method is not recorded).

The October transcripts (CLI 2.1.296) carry start-of-message counts on most records: tool-calling messages show
3, 8 or 16 output tokens, and close shows 98 for 1,975 visible characters. The 2.1.322 transcripts carry one
count per message, repeated on each of its records. The 8.1k figure is therefore most likely an undercount
(an inference from the records, not a documented CLI change), and the October and November totals are not
comparable.
