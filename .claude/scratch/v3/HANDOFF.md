# alon-skills v3.0.0 — handoff (written 2026-09-22)

Repo: `C:\Users\alonb\Desktop\Code\claude-skills`, branch `main`, last tag `v2.1.0`. Working tree is dirty with the partial rewrite (see Status). Everything in this folder (`.claude/scratch/v3/`) is gitignored and is the durable state of the workstream.

> **Superseded in part.** Read `STEP4.md` in this folder first: it records the 2026-09-23 session (steps 1, 2 and 4 done, the Windows scaffold/shell blockers, the grader repair and the two ponytail edits). The Status table below is the midday-2026-09-22 snapshot and is stale.

## Status

| Item | State | Where |
|---|---|---|
| Audit of the six skills (analyst + 2 refuters each) | done | `audit/<skill>.json` |
| build-loop redesign (3 designs, 2 judges) | done | `audit/design-*.json`, `audit/judge-*.json` |
| Trigger eval sets, 20 queries per skill | done | `trigger-evals/<skill>.json` |
| Trigger suite generator | done, max_turns raised 3→6 | `gen_trigger_suite.py` |
| v2.1.0 trigger baseline | **unusable** (263/360 runs hit the usage limit, 72 hit the 3-turn cap) | `trigger-baseline-v2.1.0.json` |
| Eval plumbing probes | passed: `!` injection runs inside `claude plugin eval` on this Windows box; `context.scaffold_script` (bash, git init/commit) works with `--scaffold` | `probe-evals-example/` |
| SKILL.md rewrite | 4/6 written and unverified: architect, ask-the-council, prompt-generator, up-to-date. **ponytail, review-swarm untouched.** No verifier ran. | `git diff` in repo; decisions in `rewrite-workflow.js` (const DECISIONS) |
| Behavioral eval suite (`evals/`) | not started (workflow died on the usage limit) | script `evals-workflow.js` |
| `workflows/build-loop.js` + `scripts/autobuild.mjs` | not started; design below | — |
| README, plugin.json 3.0.0, tag, GitHub release | not started | — |

Two workflow scripts in this folder are the exact prompts that were running when the session died: `rewrite-workflow.js` (writer → verifier → fixer per skill) and `evals-workflow.js` (author → checker per skill). Re-use their DECISIONS / FORMAT / SKILL_BEHAVIOR blocks verbatim; only the paths in the `AUDIT`/`PROBE` constants must be changed to this folder.

## Decisions already made (do not reopen)

- Model policy for the shipped skills: review-swarm reviewers `sonnet`, verifiers `opus`; ask-the-council advisors and deep critique `opus`; chairman in the main thread. Global `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` stays. Written into each skill body as a rule (D7).
- `effort: max` only on architect, ask-the-council, review-swarm. Never `high` (it would downgrade Alon's max session).
- Global-rules block deleted everywhere; one portable line replaces it (D2). prompt-generator keeps its rules section (it is payload).
- `allowed-tools` only for gated git/gh commands (review-swarm, up-to-date). `disallowed-tools: Edit Write NotebookEdit` on review-swarm only.
- Injection lines exactly as D6 (architect: ls of doc files; review-swarm: status + diff --stat; up-to-date: the full labeled git/gh block). The 4 written files already carry theirs.
- Duplicate `anthropic-skills:` entries are claude.ai custom skills syncing down; Alon deletes them on claude.ai (ponytail, prompt-generator, humanizer, ux-designer, skill-creator). Nothing to do in the repo.
- Cost/usage: the session limit (5-hour window) is the binding constraint, not tokens. Sequence heavy runs; `-j 4`, `--runs 2` on eval suites; do not run the trigger suite and the behavioral suite at the same time.

## Remaining steps, in order

1. Finish the rewrite: new workflow with `write` for ponytail and review-swarm, then `verify` (+`fix` once) for all six. Copy the agent prompts from `rewrite-workflow.js`. Check `git diff` afterwards. The verifier's char limits: description ≤ 450, when_to_use ≤ 800, combined ≤ 1,300.
2. Author `evals/` with `evals-workflow.js` (6 authors + 6 checkers). Then smoke one case per skill: `claude plugin eval . --case <name> --runs 1 --ablation none --allow-tools Write Edit --scaffold --model claude-fable-5-1 --judge-model sonnet --no-publish --trust-plugin --threshold 0 --json out.json`. Run the eval command detached (PowerShell `Start-Process`), never inside a Bash tool call: the tool's 10-minute ceiling kills long runs, and a killed runner keeps spawning children.
3. Write `workflows/build-loop.js` and `scripts/autobuild.mjs` per the design below. Test in-session with `Workflow({scriptPath: "<repo>/workflows/build-loop.js", args: {dryRun: true}})`, then a real `maxTasks: 1` run inside a throwaway fixture repo (node, one `package.json` with `"test": "node --test"`, architect docs with a 2-row TODO, CLAUDE.md with a `## Commands` table).
4. Full behavioral suite: `claude plugin eval . --runs 2 -j 4 --allow-tools Write Edit --scaffold --model claude-fable-5-1 --judge-model sonnet --no-publish --trust-plugin --threshold 0.7 --json`. Read `WITH`, `W/OUT`, `Δ` per case. Fix skills or graders, re-run failing cases only.
5. Trigger suite on v3: `python .claude/scratch/v3/gen_trigger_suite.py .claude/scratch/v3/trigger-evals evals-trigger` then `claude plugin eval . --eval-dir evals-trigger --model claude-fable-5-1 --runs 2 -j 4 --ablation none --no-publish --trust-plugin --threshold 0 --json`. Target: ≥ 0.8 fire rate on `yes` cases, ≤ 0.2 on `no` cases per skill. Tune `when_to_use` for any skill outside that. Optionally re-run on the v2.1.0 snapshot (`git archive v2.1.0`) for the before/after number. Delete `evals-trigger/` afterwards or add it to `.gitignore`; it is a tool, not a shipped suite.
6. `/review-swarm` on the whole diff. Then README (six skills + one workflow; v3 section; humanize the prose, not the tables), `.claude-plugin/plugin.json` → `3.0.0` with `"workflows": "./workflows/"` not needed (default dir) but the description updated, `marketplace.json` description, `NOTICE` unchanged. Commit as Alon only, `git tag v3.0.0`, `gh release create v3.0.0`.
7. Close with the exact-mechanics walkthrough Alon asked for: stage table of build-loop (model, reads, writes, returns, stop conditions), the trigger map, the eval numbers, and how to invoke everything.

## build-loop v3 design (synthesis of `judge-implementer.json` + `judge-owner.json`; both chose the reliability design with grafts)

File: `workflows/build-loop.js`, runs as `/alon-skills:build-loop [N | taskId | {json}]`. Plain JS, `export const meta` first (name `build-loop`, description, whenToUse, phases). No fs, no Date.now.

Args: `{maxTasks: 3, task: null, models: {}, dryRun: false, maxFixRounds: 2, skipLenses: [], scratch: ".claude/scratch/build-loop"}`. A bare integer string → maxTasks; a JSON string/object → merged; any other string → task (no numbering regex). Public model defaults: plan/spec/invariants/critic/arbiter/fix `opus`, scout/measure `haiku`, research/build/refute-breadth/close `sonnet`. Alon overrides with `{"models":{"plan":"fable","spec":"fable"}}` via the driver's config file.

COMMON prompt prefix (identical first block in every stage, for prompt-cache sharing): one stage of an unattended loop, repo root is cwd; commands come from the `## Commands` table in CLAUDE.md (already injected) and are never invented; doc system names and the five status strings; git rules (never main, no force, no branch deletes, no hooks skipped, owner-only authorship); no skills, no subagents; scratch dir `<scratch>/<taskId>/`; final message is machine-read.

Stages and contracts:

| Stage | Model | Reads | Writes | Returns |
|---|---|---|---|---|
| plan | opus, effort high | TODO_WORKFLOW.md, git status/branch/log, CLAUDE.md Commands, `<scratch>/<id>/plan.json` of a stale row | TODO row → `[IN PROGRESS]` (commit), branch, `plan.json` (taskId, baseCommit, branch) | taskId, taskRow, branch, baseCommit, docsToRead[], leftForThisTask[], commands{install,test,lint,format,notes}, resuming, stopReason, staleBlocked{taskId,reason}\|null |
| scout | haiku, low | grep/glob excerpts, doc headings | nothing | files[{path,why,symbols,scope}], tests[], docSections[], notes[] |
| spec | opus, high | SoT sections, scout locations, existing spec.md if resuming | SoT→Roadmap→NN docs (commit if a fact changes; committed doc edits are kept on failure, only uncommitted strays discarded), `spec.md` (8 sections incl. §7 acceptance criteria, §8 unverified APIs) | specPath, docsChanged[], unverifiedApis[], verifyCommands[] (literal shell strings), stopReason |
| research | sonnet, medium; skipped when unverifiedApis is empty | manifests, .d.ts, context7 | `research.md` | researchPath, unverifiedRemaining[] |
| build | sonnet | spec.md, research.md, files the spec names | code + tests, micro-commits, `build.md` | ok, commits[], testsPassed, lintPassed, deviations[], blockedReason |
| measure | haiku, low; independent of the builder | `git diff --stat/--name-only base..HEAD` | nothing | filesChanged, linesChanged, docsOnly, touchesTrustBoundary (auth/session/token/secret/payment/upload/handler paths), languages[] |
| refute (parallel lenses) | correctness+acceptance `sonnet`; invariants `opus`; security `sonnet` only if touchesTrustBoundary; adversary `sonnet` round 1 only and skipped when linesChanged < 30 or docsOnly (writes ONE breaking test; keeps it uncommitted only if it fails); critic `opus` round 1 only (spec.md vs the TODO row: what did the spec miss) | spec.md, build.md, diff base..HEAD, SoT invariants (whatever exists), Commands | nothing except the adversary's test file | per lens: verdict, testsRan, blocking[{file,line,issue,fix}], advisory[] |
| merge (script code) | — | — | — | blocking = union of cited findings; uncited `fail` verdicts count as votes and only block when ≥ 2 lenses agree; rounds ≥ 2 run only correctness+acceptance+invariants |
| arbiter | opus; only when a finding the fixer disputed (notFixed) reappears | finding, dispute, diff | nothing | upheld \| dismissed per finding, reason |
| fix | opus, high; ≤ maxFixRounds | blocking findings, spec.md | fixes + tests, commits (adopts the adversary's test) | fixed[], notFixed[], commits[] |
| close | sonnet, low; sole writer of TODO_WORKFLOW.md and docs/handoff.md; called via `closeIfPossible()` on EVERY exit after plan succeeded | build.md, spec.md §1 and §8, outcome | TODO row status + `Left for <id>: …` note, `docs/handoff.md` entry (newest first), commit | ok, commit |

Outcome statuses close may set: `[FINISHED - PENDING MERGE]`, `[BLOCKED] <reason>`, or `[ ]` with a note when nothing was built (scout/spec/budget stop before build). Loop stops on: dirty tree at plan; no eligible row (plan names the first two rejected rows); missing TODO_WORKFLOW.md/SOURCE_OF_TRUTH.md; no `## Commands` section and no single unambiguous root manifest (never guess); any stage returning null; builder blockedReason; blocking findings after maxFixRounds; budget below MIN_BUDGET_PER_TASK before a task or below the build+refute+fix+close tail before build (only when `budget.total` is set); maxTasks reached (the only stop that means "run again"). Resume: plan prefers a stale `[IN PROGRESS]` row when its branch exists, `plan.json` has baseCommit, `git merge-base --is-ancestor base HEAD` holds and the tree is clean; otherwise returns staleBlocked and the loop closes that row `[BLOCKED]` for a human.

Driver `scripts/autobuild.mjs` (Node ESM, portable): `node <plugin-root>/scripts/autobuild.mjs --tasks 5 [--task 2.1] [--dry-run] [--repo <path>] [--config <path>]`. Defaults: repo = cwd, config = `<repo>/.claude/build-loop.json` (merged into args: models, maxFixRounds, skipLenses). Lock file `<repo>/.claude/scratch/build-loop/.lock` (pid + time; stale if pid dead). Per task spawns `claude -p "Use the Workflow tool with name alon-skills:build-loop and args <json>. Wait for it to finish. Reply with only the JSON object it returned, no prose." --permission-mode auto --allowedTools Workflow --output-format json` with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=7200000`, cwd = repo, UTF-8 log at `<repo>/.claude/scratch/build-loop/autobuild.log`. Parses `stoppedBecause`; stops on anything but `reached maxTasks*`, on non-zero exit, or on a 429/usage-limit result. Progress: tails the newest `~/.claude/projects/<slug>/*/subagents/workflows/*/journal.jsonl` where slug = repo path with `[^A-Za-z0-9]` → `-` (observed for two repos; internal layout, degrade to silence if absent), printing `> phase: label` on start and `< phase: label -> summary` on result.

The architect template already carries what the loop needs (`## Commands` table, `Left for <id>` convention, `docs/handoff.md`) since the rewrite.

## Eval suite design (`evals/<skill>/<case>/`)

Run env facts: isolated, only alon-skills loaded, read-only tools + `Agent`; Bash cannot be granted on Windows; `Write Edit` granted via `--allow-tools`; scaffolds via `case.yaml` `context.scaffold_script` (bash) with `--scaffold`; skill injections run. Cases (from `audit/<skill>.json` eval_cases, as amended by the refuters):

- architect: small-fix-boundary (scaffold: docs exist → targeted addition), right-sized-new-feature (empty; ≤ 3 questions or assumptions; four docs, no modular set), audit-drift-citation (scaffold: roadmap lacks a route the code has → both-sided citations, report-only).
- ask-the-council: declines-low-stakes (tool_used Agent min 0 max 0 arm both), forces-divergence (Agent spawns with `"model":"opus"` ≥ 4; chairman commits), hands-off-after-verdict (names architect/ponytail; separates opinion from fact).
- ponytail: pushback-on-abstraction, refuses-trust-boundary, defers-to-simplify, root-cause (scaffold: shared helper + 3 callers; fix lands in the helper; grade the file with regex).
- prompt-generator: coding-agent-repo-prompt, human-prose-boundary (must-not-fire), whole-build-scope-check.
- review-swarm: trivial-diff-declines (scaffold: uncommitted rename; Agent ≤ 2), security-alone-hands-off, real-diff-ranked-report (scaffold: uncommitted N+1 change; Agent with sonnet ≥ 4 and opus ≥ 1; ranked Blockers/Should-fix/Nits; no Edit/Write calls).
- up-to-date: dirty-and-behind (scaffold: bare remote in mktemp, clone, push, reset --hard HEAD~2, dirty a tracked file → no pull, brief shape), fresh-branch-no-upstream (never "in sync"), no-remote-boundary (git init only → one line, starts the task).

Graders per case: `tool_used: Skill` (input_match `'"skill"\s*:\s*"(?:[\w-]+:)?<name>"'`), one `llm` PASS/FAIL rubric on the result, and a process grader where the behavior is a tool fact. `max_turns` 40 / `timeout_seconds` 900 for skills that spawn or write doc sets, 15 / 300 otherwise.
