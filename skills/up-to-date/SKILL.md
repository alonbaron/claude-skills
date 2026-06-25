---
name: up-to-date
description: >
  Preflight sync + situational-awareness brief to run BEFORE starting work on a
  repo, so the agent builds on latest code, not stale local state. Fetches from
  origin, reports ahead/behind divergence, summarizes recent commits and open
  PRs/issues, flags uncommitted/dirty state, and (on request) refreshes library
  docs via context7. Read-only by default — never pulls or rewrites a dirty tree
  without explicit OK. Use when the user says "up-to-date", "sync first", "pull
  latest", "catch me up on the repo", or "before we start".
argument-hint: "[optional: 'docs' to also refresh library docs, or a path]"
---

# Up To Date

Get current before doing work. Goal: a short situational brief so you build on
the latest code with full context. **Read-only by default. Never mutate a dirty
tree, never force, never discard local work without explicit confirmation.**

## Steps

1. **Confirm it's a git repo with a remote.** If not, say so and stop — there's
   nothing to sync.
2. **Local state:** `git status --short` and `git stash list`. Note uncommitted
   changes, untracked files, stashes. This gates everything below.
3. **Fetch:** `git fetch --all --prune`. (Fetch is safe; it changes nothing
   local.)
4. **Divergence:** current branch vs its upstream —
   `git rev-list --left-right --count @{upstream}...HEAD`. Report ahead/behind.
5. **Recent activity:** `git log --oneline -15` on the branch, and the same for
   the default branch if you're not on it. Summarize what changed, not every
   line.
6. **Open work (if `gh` is available and the remote is GitHub):** `gh pr list`
   and `gh issue list`. Surface anything touching the files you're about to
   work on.
7. **Sync decision:**
   - Clean + behind only → offer `git pull --ff-only`. Do it only on confirm.
   - Diverged (ahead *and* behind) → explain; recommend rebase or merge; ask.
   - Dirty → do NOT pull. Report the dirty state and let the user decide.
8. **Library currency (only if asked or `docs` arg given):** for the key deps in
   play, use context7 (resolve-library-id → query-docs) to pull current API
   docs, so code targets today's API, not stale memory.

## Output: the brief

- **Branch** + sync state (ahead/behind, clean/dirty) in one line.
- **Recent commits** — 2–4 line summary of what's new.
- **Open PRs/issues** relevant to the intended work (or "none touching this").
- **Warnings** — dirty tree, diverged history, stale deps.
- **Recommended first action** — one line.

## Rules

- Report only what commands return. Never invent commit messages, PR titles, or
  authors.
- No mutating command (`pull`, `rebase`, `merge`, `checkout`, `stash pop`)
  without explicit user OK.
- If `gh` is missing or unauthenticated, skip that section and say so — don't
  guess at remote state.

## Done when

The user knows: what branch they're on, whether it's behind/ahead/clean, what
changed recently, what open work overlaps, and the one safe next action.

## Global rules

Apply on every run — canonical home `~/.claude/CLAUDE.md`:
- **Ground everything.** Only what's given or verified; never invent files, APIs, or facts. Unknown → say "I don't know" or state the assumption.
- **No tokenmaxing.** Lead with the answer; keep an output budget; no filler, no restating the question.
- **Agent discipline.** Read before you edit; small reversible changes; ask when blocked, don't guess; report failures honestly.
- **Commits are the user's alone.** Author = the user; never add an AI co-author or `Co-Authored-By`/credit line, and don't mention AI in commit messages.
