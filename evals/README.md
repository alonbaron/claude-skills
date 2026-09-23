# alon-skills behavioral eval suite

19 cases across the six skills. Each one runs twice, once with the plugin loaded and once without, and the number that matters is the gap between the two arms. A case that scores well in both arms is measuring the base model, not the skill.

## Running it

```
claude plugin eval . --tag portable --runs 2 -j 4 \
  --allow-tools Write Edit --model claude-fable-5-1 --judge-model sonnet \
  --no-publish --trust-plugin --threshold 0.7 --json
```

Run it detached (`Start-Process` on Windows, `nohup` elsewhere). A full pass takes 10 to 15 minutes and costs roughly $20 at `--runs 2`. Every agent run shares one rate limit, so `-j 4` is the practical ceiling.

On Linux or macOS, drop `--tag portable` and add `--scaffold` to run all 19.

## Two groups of cases

| Tag | Cases | Runs on |
|---|---|---|
| `portable` | 8 | anywhere |
| `needs-scaffold` | 11 | Linux/macOS only |

The `needs-scaffold` cases build a real git repo in the workspace before the agent starts: stale docs to audit, an uncommitted N+1 to review, a repo two commits behind its remote. That fixture is a bash script, and on Windows it never runs.

## What Windows can't do

Measured on 2026-09-23 against Claude Code 2.1.273. Both limits live in the runner, not in this suite.

Scaffolds never execute. The runner shells out to `/bin/bash <path>` with the path's backslashes stripped, so every scaffolded case dies at `exit 127` before the agent starts. Both arms score 0.00 and the case tells you nothing. Nothing in a case file gets around it: absolute forward-slash paths are re-normalized, an inline script body is rejected because the value must be a path, `.ps1` and `.cmd` fixtures are still handed to bash, and `context.files`, `context.workspace` and `context.files_dir` are silently ignored, leaving an empty workspace.

Shell tools can't be granted either. Passing `--allow-tools Bash` refuses the whole run: "no sandbox backend on this platform." So no case may require the model to run git, npm, or a test command, and no rubric may penalize it for saying it couldn't.

WSL is not the shortcut it looks like. The default Ubuntu image has git, but no node, no `~/.claude` credentials, and no `bwrap`.

## Writing a case

A case is a directory holding `prompt.md`, a `graders/` directory, and `case.yaml` when it needs a fixture.

One property per grader. A rubric that ANDs five conditions fails whenever a judge dislikes any one of them, and the score never tells you which one. That is how this suite first scored 18%. Split it up so each grader names one observable thing and carries its own PASS and FAIL sentence.

Grade the right window. `focus: last_message` shows the judge only the final assistant message, and `focus: trace` shows the first and last twelve messages rather than the whole run. If it lives in a tool call, use `tool_used`.

`target: files` is not file contents. The runner hands a `regex` grader the list of paths the run created, one per line, and `file_exists` globs the same list. A content pattern over `files` can never match, so a `not_contains` grader passes every run. To check what the model wrote, use `tool_used` with `tool: Write` and an `input_match` on the content, or point a grader at a known path with `target: {source: file, path: ...}`. Measured on 2026-09-23 against 2.1.280.

Skip style. "Leads with code rather than an essay" is not something three judges will agree on twice.

Results land in `evals/results/<timestamp>/` and are gitignored.
