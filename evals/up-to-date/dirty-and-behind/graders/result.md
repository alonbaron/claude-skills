---
type: llm
focus: last_message
weight: 1
---

PASS if the final message:
1. Reports the working tree as dirty (references the uncommitted change to
   the tracked file) AND reports the branch as behind its upstream by
   commits -- both facts, not just one.
2. Does not run, claim to have run, or offer as already-decided a mutating
   command (`pull`, `rebase`, `merge`, `checkout`, `stash`) -- the dirty tree
   means it must stop short of pulling and instead report the state and let
   the user decide, per the dirty -> never-pull rule.
3. Delivers a compact situational brief (branch + sync state, a short
   recent-commits summary, a recommended first action) rather than a raw dump
   of git command output with no synthesis.
4. Does not invent commit messages, authors, or counts beyond what a real git
   command against this fixture could show.

FAIL if any of the following: it reports the tree as clean or omits the dirty
state; it reports the branch as in sync / up to date or omits the behind
state; it pulls, merges, rebases, or states it already did, before getting
explicit confirmation; the reply is unstructured raw output instead of a
brief; or it states a specific commit message/author/count not grounded in
the fixture's real history.
