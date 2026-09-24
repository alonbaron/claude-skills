---
name: up-to-date
description: >-
  Preflight sync and situational brief before repo work: fetches origin,
  reports ahead/behind divergence (with a no-upstream/detached-HEAD
  fallback), recent commits, open PRs and issues touching the work, and
  dirty-tree warnings, then names one recommended first action. Read-only by
  default — never pulls, rebases, merges, or discards local work without
  explicit confirmation.
when_to_use: >-
  Use proactively before starting work in any repo with a remote, especially
  one that's shared or hasn't been touched in a while. Trigger phrases:
  "up-to-date", "sync first", "pull latest", "catch me up on the repo". Not
  for a repo with no remote (say so in one line, then start the task), and
  not for a mid-task re-check in a repo already briefed this session (a
  plain git fetch + git status answers that without the full brief).
argument-hint: "[optional: 'docs' to also refresh library docs, or a path to scope the PR/issue check]"
allowed-tools: Bash(git rev-parse *) Bash(git remote *) Bash(git branch *) Bash(git status *) Bash(git stash list*) Bash(git fetch *) Bash(git rev-list *) Bash(git log *) Bash(gh pr list *) Bash(gh issue list *)
---

# Up To Date

!`echo "--- git rev-parse --show-toplevel"; git rev-parse --show-toplevel 2>&1 || true; echo "--- git remote -v"; git remote -v 2>&1 || true; echo "--- git branch --show-current"; git branch --show-current 2>&1 || true; echo "--- git status --short"; git status --short 2>&1 || true; echo "--- git stash list"; git stash list 2>&1 || true; echo "--- git fetch --all --prune"; git fetch --all --prune 2>&1 || true; echo "--- git rev-list --left-right --count @{upstream}...HEAD"; git rev-list --left-right --count @{upstream}...HEAD 2>&1 || true; echo "--- git log --oneline -15"; git log --oneline -15 2>&1 || true; echo "--- gh pr list --limit 20"; gh pr list --limit 20 2>&1 || true; echo "--- gh issue list --limit 20"; gh issue list --limit 20 2>&1 || true`

The block above is this repo's git and GitHub state, captured once before you see the rest of this skill — raw command output, not analysis.

Get current before doing work. Goal: a short situational brief so you build on the latest code with full context. **Read-only by default. Never mutate a dirty tree, never force, never discard local work without explicit confirmation** — that holds even when this skill fired proactively.

## Reading the block

Read it; don't re-run those commands as tool calls. Only run one again if the block shows it failed for a transient reason (a network blip on `fetch`, say) — a missing remote, no upstream, or `gh` unauthenticated are expected outcomes to report, not errors to retry.

- The `rev-parse` line errored → not a git repo; say so and stop, there's nothing to sync.
- `git remote -v` came back empty → no remote; say so in one line and start the task. Skip divergence and PR/issue checks entirely.
- The `@{upstream}` count errored (branch never pushed, or detached HEAD) → say there is no upstream, never report that as "in sync", then run `git rev-list --left-right --count origin/HEAD...HEAD` (`origin/main` or `origin/master` if `origin/HEAD` is missing) and brief against the default branch. The brief still happens before any work.
- The `rev-list` line failed (fresh local branch, detached HEAD) → say so plainly, note the branch is unpushed, and fall back to comparing against `origin/<default-branch>`. Never report "in sync" from a failed command.
- `gh pr list` / `gh issue list` errored or came back empty (no `gh`, unauthenticated, non-GitHub remote) → skip that section and say so; don't guess at open work.

## The brief

- **Branch** + sync state (ahead/behind, clean/dirty) in one line.
- **Recent commits** — 2–4 line summary of what's new, not every line of `git log`.
- **Open PRs/issues** relevant to the intended work (or "none touching this").
- **Warnings** — dirty tree, diverged history, stale deps.
- **Recommended first action** — one line.

## Sync decision

- Clean + behind only → offer `git pull --ff-only`. Do it only on confirm.
- Diverged (ahead *and* behind) → explain; recommend rebase or merge; ask.
- Dirty → do NOT pull. Report the dirty state and let the user decide.

## Library currency

Only if asked, or the `docs` arg is given: for the key deps in play, use context7 (resolve-library-id → query-docs) to pull current API docs, so code targets today's API, not stale memory.

## Rules

- Report only what the injected block or a command actually returned. Never invent commit messages, PR titles, or authors.
- No mutating command (`pull`, `rebase`, `merge`, `checkout`, `stash pop`) without explicit user OK.
- Verify or say you don't know; never invent a path, API, number, or fact. Commits are the repo owner's alone: no AI co-author trailer, no AI mention in messages.

## When not to use

- No remote → nothing to sync; say so in one line and start the work.
- Mid-task re-checks in a repo already briefed this session — a plain `git fetch` + `git status` answers it without the full brief.

## Proactive use

When work is about to start in a repo with a remote, invoke this without being asked: announce in one line ("Running up-to-date on \<repo\>") and proceed. The sync decision still requires explicit confirmation, proactive or not.

## Hand-offs

- Brief delivered → start the actual task on the now-current tree.
- The task is a new app/feature/workstream with no design docs → `architect` next, before code.
